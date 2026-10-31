// Development-only fixture service. No provider request, API key, or model execution.
import { validateBundle, validateBriefing, readJson } from '../contracts/validate.mjs';

const VERSION = '1.0.0';
const BODY_LIMIT = 8 * 1024;
const MOCK_ERRORS = {
  timeout: [504, 'MODEL_TIMEOUT', 'Simulated model timeout.', true],
  'rate-limit': [429, 'RATE_LIMITED', 'Simulated inference rate limit.', true],
  'invalid-response': [502, 'INVALID_MODEL_OUTPUT', 'Simulated invalid model response.', true],
};

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

function queryControls(url, allowMock) {
  for (const key of url.searchParams.keys()) {
    if (!allowMock || !['mock', 'delayMs'].includes(key) || url.searchParams.getAll(key).length !== 1) {
      fail(400, 'INVALID_REQUEST', 'Unsupported or repeated query parameter.');
    }
  }
  const mock = url.searchParams.get('mock');
  if (mock !== null && !Object.hasOwn(MOCK_ERRORS, mock)) {
    fail(400, 'INVALID_REQUEST', 'Unsupported mock error control.');
  }
  const delay = url.searchParams.get('delayMs');
  if (delay !== null && (!/^(0|[1-9][0-9]*)$/.test(delay) || Number(delay) > 2000)) {
    fail(400, 'INVALID_REQUEST', 'delayMs must be an integer from 0 through 2000.');
  }
  return { mock, delayMs: Number(delay ?? 0) };
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
    // URLs originate solely in the already validated artifact, never in user text.
    if (!record?.sourceUrl) return `[${label}]`;
    const parsed = new URL(record.sourceUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return `[${label}]`;
    const href = parsed.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
    return `[${label}](${href})`;
  };
  const item = value => `- ${escapeMarkdown(value.text)}${value.evidenceIds.length ? ` ${value.evidenceIds.map(citation).join(' ')}` : ''}`;
  const markdown = [
    '# Review Desk fixture briefing',
    '',
    'Canned development response; no model was called.',
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
    // A complete export must preserve every limitation; never return a partial export.
    throw new Error('Complete briefing Markdown exceeds the contract size budget.');
  }
  return markdown;
}

function makeBriefing(bundle, selected, changeIntent) {
  const chosen = ['repograph', 'graphify']
    .map(producer => selected.evidence.find(record => record.producer === producer))
    .filter(Boolean);
  if (!chosen.length) fail(422, 'INSUFFICIENT_EVIDENCE', 'This case has no usable evidence.');
  const findings = chosen.map(record => ({
    text: `${record.producer} records ${record.relation} at ${record.path}:${record.startLine} with original label ${record.confidence}.`,
    evidenceIds: [record.id],
  }));
  const relatedTest = selected.impact.relatedTests[0];
  const checklist = [];
  if (relatedTest) checklist.push({
    text: `Inspect the suggested test file ${relatedTest.path}; its inclusion is not proof of complete test coverage.`,
    evidenceIds: [...relatedTest.evidenceIds],
  });
  checklist.push({ text: 'Run the full test suite before relying on the change.', evidenceIds: [] });
  const limitations = [...new Set([...selected.limitations, ...selected.impact.blindSpots])];
  const briefing = {
    schemaVersion: VERSION,
    artifactKind: bundle.artifactKind,
    repositoryId: bundle.repository.id,
    commitSha: bundle.repository.commitSha,
    caseId: selected.id,
    mode: 'fixture',
    model: null,
    summary: `Fixture response for ${selected.title}. Inspect the recorded relationships and blind spots; no model was called.${changeIntent ? ` Reviewer intention: ${changeIntent}` : ''}`,
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

export async function createMockApi({ projectRoot, bundlePath }) {
  if (typeof projectRoot !== 'string' || typeof bundlePath !== 'string') {
    throw new TypeError('createMockApi requires projectRoot and bundlePath.');
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
        queryControls(url, false);
        return send(res, 200, { data: {
          status: 'ok', apiMode: 'mock', aiMode: 'fixture',
          artifactKind: bundle.artifactKind, gemmaConfigured: false,
        } });
      }
      if (key === 'GET /api/v1/catalog') {
        queryControls(url, false);
        return send(res, 200, { data: {
          ...metadata(),
          cases: bundle.cases.map(({ id, title, changedFiles }) => ({ id, title, changedFiles })),
        } });
      }
      if (req.method === 'GET' && /^\/api\/v1\/cases\/[^/]+$/.test(url.pathname)) {
        queryControls(url, false);
        let caseId;
        try { caseId = decodeURIComponent(url.pathname.slice('/api/v1/cases/'.length)); }
        catch { fail(400, 'INVALID_REQUEST', 'Invalid case ID encoding.'); }
        const selected = cases.get(caseId);
        if (!selected) fail(404, 'NOT_FOUND', 'Unsupported case ID.');
        return send(res, 200, { data: { ...metadata(), case: selected } });
      }
      if (key === 'POST /api/v1/briefings') {
        const { mock, delayMs } = queryControls(url, true);
        const body = validateRequest(await readBody(req));
        const selected = cases.get(body.caseId);
        if (!selected) fail(404, 'NOT_FOUND', 'Unsupported case ID.');
        if (!selected.evidence.length) fail(422, 'INSUFFICIENT_EVIDENCE', 'This case has no usable evidence.');
        if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
        if (mock) fail(...MOCK_ERRORS[mock]);
        return send(res, 200, { data: makeBriefing(bundle, selected, body.changeIntent) });
      }
      fail(404, 'NOT_FOUND', 'Unknown API route.');
    } catch (error) {
      const known = error instanceof RequestError;
      return send(res, known ? error.status : 500, { error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Unexpected mock service error.',
        retryable: known ? error.retryable : false,
      } });
    }
  };
}
