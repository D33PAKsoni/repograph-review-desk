// Production API Handler — RepoGraph Review Desk
// Connects artifact evidence with Gemma 4 reasoning via Google Gemini API.

import { validateBundle, validateBriefing, readJson } from '../contracts/validate.mjs';

const VERSION = '1.0.0';
const BODY_LIMIT = 8 * 1024;
const DEFAULT_MODEL = 'gemma-4-26b-a4b-it';

class RequestError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message);
    Object.assign(this, { status, code, retryable });
  }
}

function fail(status, code, message, retryable = false) {
  throw new RequestError(status, code, message, retryable);
}

function send(res, status, payload) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify({ schemaVersion: VERSION, ...payload }));
}

function readBody(req) {
  const mediaType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    req.resume();
    fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'This endpoint requires application/json.');
  }
  const declaredLength = req.headers['content-length'];
  if (declaredLength !== undefined && Number(declaredLength) > BODY_LIMIT) {
    req.resume();
    fail(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 8 KiB.');
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onAborted);
    };
    const onError = () => {
      cleanup();
      reject(new RequestError(400, 'INVALID_REQUEST', 'Request body could not be read.'));
    };
    const onAborted = () => onError();
    const onData = chunk => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > BODY_LIMIT) {
        cleanup();
        req.resume();
        reject(new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 8 KiB.'));
        return;
      }
      chunks.push(bytes);
    };
    const onEnd = () => {
      cleanup();
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        resolve(JSON.parse(text));
      } catch {
        reject(new RequestError(400, 'INVALID_REQUEST', 'Body must contain valid UTF-8 JSON.'));
      }
    };
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onAborted);
  });
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !['caseId', 'changeIntent'].includes(key))
      || typeof body.caseId !== 'string' || !body.caseId || body.caseId.length > 80
      || (Object.hasOwn(body, 'changeIntent')
          && (typeof body.changeIntent !== 'string' || body.changeIntent.length > 500))) {
    fail(400, 'INVALID_REQUEST', 'Expected {caseId, changeIntent?}; intent is limited to 500 characters.');
  }
  return body;
}

function escapeMarkdown(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/([`*_{}\[\]()#+.!|<>~])/g, '\\$1');
}

function renderMarkdown(briefing, selected) {
  const records = new Map(selected.evidence.map(record => [record.id, record]));
  const citation = id => {
    const record = records.get(id);
    const label = escapeMarkdown(id);
    if (!record?.sourceUrl) return `[${label}]`;
    const parsed = new URL(record.sourceUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return `[${label}]`;
    const href = parsed.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
    return `[${label}](${href})`;
  };
  const item = value => `- ${escapeMarkdown(value.text)}${value.evidenceIds.length ? ` ${value.evidenceIds.map(citation).join(' ')}` : ''}`;
  const markdown = [
    `# Review Desk Briefing: ${escapeMarkdown(selected.title)}`,
    '',
    `Model: ${briefing.model ?? 'deterministic baseline'}. Mode: ${briefing.mode}.`,
    '',
    `Analysis data: ${briefing.artifactKind}. Repository commit: ${briefing.commitSha}.`,
    '',
    escapeMarkdown(briefing.summary),
    '',
    '## Findings',
    ...briefing.findings.map(item),
    '',
    '## Review checklist',
    ...briefing.reviewChecklist.map(item),
    '',
    '## Limitations and blind spots',
    ...briefing.limitations.map(value => `- ${escapeMarkdown(value)}`),
    '',
  ].join('\n');
  if (markdown.length > 30000) {
    throw new Error('Complete briefing Markdown exceeds the contract size budget.');
  }
  return markdown;
}

async function callGemmaInference({ model, apiKey, selected, changeIntent }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = [
    `You are an expert software reviewer. Review the following code change evidence:`,
    `Case: ${selected.title}`,
    `Changed files: ${selected.changedFiles.join(', ')}`,
    changeIntent ? `Reviewer change intent: ${changeIntent}` : null,
    `Evidence items:`,
    ...selected.evidence.map(e => `- [${e.id}] (${e.producer}) ${e.path}:${e.startLine} ${e.relation} (${e.confidence}): "${e.excerpt}"`),
    `Respond with a concise summary paragraph explaining what the change touches.`
  ].filter(Boolean).join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 250, temperature: 0.2 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      if (resp.status === 429) fail(429, 'RATE_LIMITED', 'Upstream Gemma inference rate limited.', true);
      fail(502, 'INVALID_MODEL_OUTPUT', `Upstream inference error: ${resp.statusText}`, true);
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof RequestError) throw err;
    if (err.name === 'AbortError') fail(504, 'MODEL_TIMEOUT', 'Upstream Gemma request timed out.', true);
    fail(502, 'INVALID_MODEL_OUTPUT', 'Failed to communicate with Gemma API.', true);
  }
}

async function generateBriefing(bundle, selected, changeIntent) {
  const apiKey = process.env.GEMMA_API_KEY?.trim();
  const configuredModel = process.env.GEMMA_MODEL?.trim() || DEFAULT_MODEL;
  const isLive = process.env.AI_MODE === 'live' && Boolean(apiKey);

  const repographRecords = selected.evidence.filter(r => r.producer === 'repograph');
  const graphifyRecords = selected.evidence.filter(r => r.producer === 'graphify');
  if (!repographRecords.length && !graphifyRecords.length) {
    fail(422, 'INSUFFICIENT_EVIDENCE', 'This case has no usable evidence.');
  }

  const findings = [];
  for (const record of repographRecords) {
    if (findings.length >= 12) break;
    findings.push({
      text: `RepoGraph detects ${record.relation} relationship from ${record.path} (line ${record.startLine}) with confidence '${record.confidence}'.`,
      evidenceIds: [record.id],
    });
  }
  for (const record of graphifyRecords) {
    if (findings.length >= 12) break;
    findings.push({
      text: `Graphify architecture topology notes ${record.relation} coupling at ${record.path}:${record.startLine}.`,
      evidenceIds: [record.id],
    });
  }

  const checklist = [];
  for (const test of selected.impact.relatedTests) {
    checklist.push({
      text: `Verify test coverage in ${test.path}. Static presence does not guarantee execution.`,
      evidenceIds: [...test.evidenceIds],
    });
  }
  checklist.push({
    text: 'Execute full test suite and typechecks before merging.',
    evidenceIds: [],
  });

  const limitations = [...new Set([...selected.limitations, ...selected.impact.blindSpots])];

  let summary = `Evidence briefing for ${selected.title}. Verified static relationships across RepoGraph AST index and Graphify architecture.`;
  if (changeIntent) {
    summary += ` Stated reviewer intention: ${changeIntent}.`;
  }

  let liveModelName = null;
  if (isLive) {
    try {
      const modelSummary = await callGemmaInference({
        model: configuredModel,
        apiKey,
        selected,
        changeIntent
      });
      if (modelSummary) {
        summary = modelSummary;
        liveModelName = configuredModel;
      }
    } catch (error) {
      if (error instanceof RequestError && error.retryable) throw error;
      // Fallback gracefully to evidence summary if non-critical
    }
  }

  const briefing = {
    schemaVersion: VERSION,
    artifactKind: bundle.artifactKind,
    repositoryId: bundle.repository.id,
    commitSha: bundle.repository.commitSha,
    caseId: selected.id,
    mode: isLive && liveModelName ? 'live' : 'fixture',
    model: isLive && liveModelName ? liveModelName : null,
    summary,
    findings,
    reviewChecklist: checklist,
    limitations,
    generatedAt: new Date().toISOString(),
    markdown: '',
  };

  briefing.markdown = renderMarkdown(briefing, selected);
  validateBriefing(briefing, bundle);
  return briefing;
}

export async function createApiHandler({ projectRoot, bundlePath }) {
  if (typeof projectRoot !== 'string' || typeof bundlePath !== 'string') {
    throw new TypeError('createApiHandler requires projectRoot and bundlePath.');
  }
  const bundle = await readJson(bundlePath);
  validateBundle(bundle);
  const cases = new Map(bundle.cases.map(selected => [selected.id, selected]));
  const metadata = () => ({
    repository: bundle.repository,
    artifactKind: bundle.artifactKind,
    generatedAt: bundle.generatedAt,
    tools: bundle.tools,
  });

  return async function handle(req, res) {
    try {
      let url;
      try { url = new URL(req.url, 'http://review-desk.local'); }
      catch { fail(400, 'INVALID_REQUEST', 'Invalid request URL.'); }
      const key = `${req.method} ${url.pathname}`;

      if (key === 'GET /api/v1/health') {
        return send(res, 200, { data: {
          status: 'ok',
          apiMode: 'service',
          aiMode: process.env.AI_MODE || (process.env.GEMMA_API_KEY ? 'live' : 'fixture'),
          artifactKind: bundle.artifactKind,
          gemmaConfigured: Boolean(process.env.GEMMA_API_KEY?.trim()),
        } });
      }

      if (key === 'GET /api/v1/catalog') {
        return send(res, 200, { data: {
          ...metadata(),
          cases: bundle.cases.map(({ id, title, changedFiles }) => ({ id, title, changedFiles })),
        } });
      }

      if (req.method === 'GET' && /^\/api\/v1\/cases\/[^/]+$/.test(url.pathname)) {
        let caseId;
        try { caseId = decodeURIComponent(url.pathname.slice('/api/v1/cases/'.length)); }
        catch { fail(400, 'INVALID_REQUEST', 'Invalid case ID encoding.'); }
        const selected = cases.get(caseId);
        if (!selected) fail(404, 'NOT_FOUND', 'Unsupported case ID.');
        return send(res, 200, { data: { ...metadata(), case: selected } });
      }

      if (key === 'POST /api/v1/briefings') {
        const body = validateRequest(await readBody(req));
        const selected = cases.get(body.caseId);
        if (!selected) fail(404, 'NOT_FOUND', 'Unsupported case ID.');
        if (!selected.evidence.length) fail(422, 'INSUFFICIENT_EVIDENCE', 'This case has no usable evidence.');
        const briefing = await generateBriefing(bundle, selected, body.changeIntent);
        return send(res, 200, { data: briefing });
      }

      fail(404, 'NOT_FOUND', 'Unknown API route.');
    } catch (error) {
      const known = error instanceof RequestError;
      return send(res, known ? error.status : 500, { error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Unexpected service error.',
        retryable: known ? error.retryable : false,
      } });
    }
  };
}
