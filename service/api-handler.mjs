import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGemmaClient } from './gemma-client.mjs';
import { ApiError, buildFixtureBriefing, generateLiveBriefing } from './briefing.mjs';

const SCHEMA_VERSION = '1.0.0';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_INTENT_CHARS = 500;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const LIVE_MODELS = new Set(['gemma-4-26b-a4b-it', 'gemma-4-31b-it']);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function send(res, status, payload, extraHeaders = {}) {
  if (res.headersSent) { res.destroy(); return; }
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(body);
}

const sendError = (res, status, code, message, retryable) =>
  send(res, status, { schemaVersion: SCHEMA_VERSION, error: { code, message, retryable } },
    status === 413 ? { Connection: 'close' } : {});

const invalidRequest = message => new ApiError(400, 'INVALID_REQUEST', message, false);
const notFound = message => new ApiError(404, 'NOT_FOUND', message, false);

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    let finished = false;
    const fail = error => { if (!finished) { finished = true; reject(error); } };
    req.on('data', chunk => {
      if (finished) return; // keep draining without storing
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { chunks.length = 0; fail(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 8 KiB.', false)); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!finished) { finished = true; resolveBody(Buffer.concat(chunks)); } });
    req.on('error', () => fail(invalidRequest('Request body could not be read.')));
    req.on('aborted', () => fail(invalidRequest('Request was aborted.')));
  });
}

function parseBriefingRequest(buffer) {
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
  catch { throw invalidRequest('Body must be valid UTF-8 JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidRequest('Body must be a JSON object.');
  for (const key of Object.keys(value)) {
    if (key !== 'caseId' && key !== 'changeIntent') throw invalidRequest(`Unknown field: ${key.slice(0, 40)}`);
  }
  if (typeof value.caseId !== 'string') throw invalidRequest('caseId must be a string.');
  let intent;
  if (value.changeIntent !== undefined) {
    if (typeof value.changeIntent !== 'string') throw invalidRequest('changeIntent must be a string.');
    if (Array.from(value.changeIntent).length > MAX_INTENT_CHARS) throw invalidRequest('changeIntent must be at most 500 characters.');
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value.changeIntent)) throw invalidRequest('changeIntent must be plain text.');
    intent = value.changeIntent.trim() || undefined;
  }
  return { caseId: value.caseId, intent };
}

/**
 * Integration factory required by the launcher.
 * `deps` is an optional second argument used by tests: { env, fetchImpl, now, timeoutMs, maxConcurrent, maxPerMinute }.
 */
export async function createApiHandler({ projectRoot, bundlePath }, deps = {}) {
  const env = deps.env ?? process.env;
  const aiMode = env.AI_MODE ?? 'fixture';
  if (aiMode !== 'fixture' && aiMode !== 'live') throw new Error('AI_MODE must be "fixture" or "live"');
  const model = env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  if (aiMode === 'live' && !LIVE_MODELS.has(model)) throw new Error('GEMMA_MODEL must be a supported Gemma 4 model');
  const apiKey = env.GEMMA_API_KEY || '';

  const { readJson, validateBundle } = await import(pathToFileURL(resolve(projectRoot, 'contracts/validate.mjs')).href);
  const { validateBriefing } = await import(pathToFileURL(resolve(projectRoot, 'contracts/validate.mjs')).href);
  const bundle = deepFreeze(validateBundle(await readJson(bundlePath)));
  const casesById = new Map(bundle.cases.map(item => [item.id, item]));
  const provenance = { repository: bundle.repository, artifactKind: bundle.artifactKind, generatedAt: bundle.generatedAt, tools: bundle.tools };

  const client = aiMode === 'live' ? createGemmaClient({ apiKey, model, fetchImpl: deps.fetchImpl }) : null;
  const timeoutMs = deps.timeoutMs ?? 30000;
  const maxConcurrent = deps.maxConcurrent ?? 2;
  const maxPerMinute = deps.maxPerMinute ?? 20;
  let inFlight = 0;
  const recent = [];

  function acquireSlot() {
    const cutoff = Date.now() - 60000;
    while (recent.length && recent[0] < cutoff) recent.shift();
    if (inFlight >= maxConcurrent || recent.length >= maxPerMinute) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many briefing requests; try again shortly.', true);
    }
    inFlight += 1;
    recent.push(Date.now());
  }

  async function briefing(req, res) {
    const media = String(req.headers['content-type'] ?? '').split(';');
    const params = media.slice(1).map(p => p.trim().toLowerCase()).filter(Boolean);
    if (media[0].trim().toLowerCase() !== 'application/json' || params.some(p => p.startsWith('charset=') && p !== 'charset=utf-8')) {
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.', false);
    }
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 8 KiB.', false);
    const { caseId, intent } = parseBriefingRequest(await readBody(req));
    const selected = casesById.get(caseId);
    if (!selected) throw notFound('Unknown case.');
    if (selected.evidence.length === 0) {
      throw new ApiError(422, 'INSUFFICIENT_EVIDENCE', 'This case has no usable evidence; no model was called.', false);
    }
    let result;
    if (aiMode === 'fixture') {
      result = buildFixtureBriefing(bundle, selected);
    } else {
      if (!apiKey) throw new ApiError(503, 'MODEL_UNAVAILABLE', 'Live model credentials are missing or not usable.', true);
      acquireSlot();
      try {
        result = await generateLiveBriefing({ bundle, selected, intent, client, model, now: deps.now, timeoutMs });
      } finally {
        inFlight -= 1;
      }
    }
    try { validateBriefing(result, bundle); }
    catch {
      if (aiMode === 'live') throw new ApiError(502, 'INVALID_MODEL_OUTPUT', 'The model returned an unusable response.', true);
      throw new Error('Fixture briefing failed contract validation');
    }
    send(res, 200, { schemaVersion: SCHEMA_VERSION, data: result });
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (url.search) throw invalidRequest('Query parameters are not supported.');
    const path = url.pathname;
    const method = req.method;
    if (path === '/api/v1/health' && method === 'GET') {
      return send(res, 200, { schemaVersion: SCHEMA_VERSION, data: {
        status: 'ok', apiMode: 'service', aiMode, artifactKind: bundle.artifactKind, gemmaConfigured: Boolean(apiKey),
      } });
    }
    if (path === '/api/v1/catalog' && method === 'GET') {
      return send(res, 200, { schemaVersion: SCHEMA_VERSION, data: {
        ...provenance, cases: bundle.cases.map(({ id, title, changedFiles }) => ({ id, title, changedFiles })),
      } });
    }
    if (path.startsWith('/api/v1/cases/') && method === 'GET') {
      const id = path.slice('/api/v1/cases/'.length);
      const selected = ID_RE.test(id) ? casesById.get(id) : undefined;
      if (!selected) throw notFound('Unknown case.');
      return send(res, 200, { schemaVersion: SCHEMA_VERSION, data: { ...provenance, case: selected } });
    }
    if (path === '/api/v1/briefings' && method === 'POST') return briefing(req, res);
    throw notFound('Unknown API route.');
  }

  return async function handle(req, res) {
    try {
      await route(req, res);
    } catch (error) {
      if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message, error.retryable);
      console.error('API request failed:', error?.name ?? 'Error'); // never log keys, bodies or stacks
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected request failure.', false);
    }
  };
}
