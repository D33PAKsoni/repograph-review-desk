import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createAppServer } from './server.mjs';
import { readJson, validateBundle, validateBriefing } from '../contracts/validate.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let bundle;
let fixtureBriefing;
let server;
let baseUrl;

async function start(options = {}) {
  const app = await createAppServer({ projectRoot, apiHandlerModule: null, ...options });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { app, url: `http://127.0.0.1:${app.address().port}` };
}
async function stop(app) {
  const closed = new Promise((resolve, reject) => app.close(error => error ? reject(error) : resolve()));
  app.closeAllConnections();
  await closed;
}
async function getJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.equal(body.schemaVersion, '1.0.0');
  return { response, body };
}
function briefingRequest(body = { caseId: 'subscription-change' }) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

before(async () => {
  bundle = await readJson(join(projectRoot, 'fixtures/artifact-bundle.fixture.json'));
  fixtureBriefing = await readJson(join(projectRoot, 'fixtures/briefing.fixture.json'));
  ({ app: server, url: baseUrl } = await start({ webDist: '.starter-test-nonexistent-dist' }));
});
after(async () => { if (server) await stop(server); });

test('supplied fixture bundle and briefing pass schema and semantic validation', () => {
  assert.equal(validateBundle(bundle), bundle);
  assert.equal(validateBriefing(fixtureBriefing, bundle), fixtureBriefing);
});

test('unknown evidence citations are rejected by the shared validator', () => {
  const invalid = structuredClone(fixtureBriefing);
  invalid.findings[0].evidenceIds = ['NOT_A_REAL_EVIDENCE_ID'];
  assert.throws(() => validateBriefing(invalid, bundle));
});

test('health explicitly identifies the mock and fixture inference', async () => {
  const { response, body } = await getJson('/api/v1/health');
  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.apiMode, 'mock');
  assert.equal(body.data.aiMode, 'fixture');
  assert.equal(body.data.artifactKind, 'fixture');
  assert.equal(typeof body.data.gemmaConfigured, 'boolean');
});

test('catalog and case responses preserve artifact and repository provenance', async () => {
  const catalog = await getJson('/api/v1/catalog');
  assert.equal(catalog.response.status, 200);
  assert.equal(catalog.body.data.artifactKind, 'fixture');
  assert.equal(catalog.body.data.repository.commitSha, bundle.repository.commitSha);
  assert.equal(catalog.body.data.cases.length, bundle.cases.length);
  const selected = await getJson('/api/v1/cases/subscription-change');
  assert.equal(selected.response.status, 200);
  assert.equal(selected.body.data.case.id, 'subscription-change');
  assert.equal(selected.body.data.case.evidence[0].sourceUrl, null);
});

test('briefing succeeds as a clearly labeled canned response with valid evidence', async () => {
  const { response, body } = await getJson('/api/v1/briefings', briefingRequest());
  assert.equal(response.status, 200);
  assert.equal(body.data.mode, 'fixture');
  assert.equal(body.data.model, null);
  validateBriefing(body.data, bundle);
  assert.ok(body.data.markdown.length > 0);
});

test('empty analysis returns 422 rather than fabricating a briefing', async () => {
  const { response, body } = await getJson('/api/v1/briefings', briefingRequest({ caseId: 'empty-result' }));
  assert.equal(response.status, 422);
  assert.equal(body.error.code, 'INSUFFICIENT_EVIDENCE');
  assert.equal(body.error.retryable, false);
});

test('partial analysis preserves every limitation and blind spot', async () => {
  const { response, body } = await getJson('/api/v1/briefings', briefingRequest({ caseId: 'partial-analysis' }));
  assert.equal(response.status, 200);
  validateBriefing(body.data, bundle);
  const partial = bundle.cases.find(item => item.id === 'partial-analysis');
  for (const warning of [...partial.limitations, ...partial.impact.blindSpots]) {
    assert.ok(body.data.limitations.includes(warning), `Missing warning: ${warning}`);
  }
});

test('malformed and extra-field requests return stable JSON errors', async () => {
  const malformed = await getJson('/api/v1/briefings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.body.error.code, 'INVALID_REQUEST');
  const extra = await getJson('/api/v1/briefings', briefingRequest({ caseId: 'subscription-change', model: 'not-allowed' }));
  assert.equal(extra.response.status, 400);
  assert.equal(extra.body.error.code, 'INVALID_REQUEST');
});

for (const [control, status, code] of [
  ['timeout', 504, 'MODEL_TIMEOUT'], ['rate-limit', 429, 'RATE_LIMITED'],
  ['invalid-response', 502, 'INVALID_MODEL_OUTPUT'],
]) {
  test(`mock control ${control} exercises the expected retryable failure`, async () => {
    const { response, body } = await getJson(`/api/v1/briefings?mock=${control}`, briefingRequest());
    assert.equal(response.status, status);
    assert.equal(body.error.code, code);
    assert.equal(body.error.retryable, true);
  });
}

test('unknown API routes and cases remain JSON 404, never SPA HTML', async () => {
  for (const path of ['/api/v1/not-a-route', '/api/v1/cases/not-a-case']) {
    const { response, body } = await getJson(path);
    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  }
});

test('missing frontend build has an honest placeholder, with HEAD support', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /bootstrap placeholder/i);
  assert.match(html, /mock API/i);
  assert.match(html, /synthetic fixtures/i);
  const head = await fetch(`${baseUrl}/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('static files, SPA fallback, missing assets, and traversal are separated', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'review-desk-starter-'));
  const dist = join(temporary, 'dist');
  let app;
  try {
    await mkdir(dist);
    await writeFile(join(dist, 'index.html'), '<!doctype html><h1>Test dashboard</h1>');
    await writeFile(join(dist, 'app.js'), 'console.log("test");');
    await writeFile(join(temporary, 'secret.txt'), 'SHOULD_NOT_BE_SERVED');
    const running = await start({ webDist: dist });
    app = running.app;
    const asset = await fetch(`${running.url}/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    const page = await fetch(`${running.url}/review/subscription-change`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Test dashboard/);
    assert.equal((await fetch(`${running.url}/missing.js`)).status, 404);
    const escaped = await fetch(`${running.url}/%2e%2e%2fsecret.txt`);
    assert.equal(escaped.status, 404);
    assert.doesNotMatch(await escaped.text(), /SHOULD_NOT_BE_SERVED/);
  } finally {
    if (app) await stop(app);
    await rm(temporary, { recursive: true, force: true });
  }
});
