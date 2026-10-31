import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from '../api-handler.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundlePath = resolve(projectRoot, 'fixtures/artifact-bundle.fixture.json');
const { validateBriefing, readJson } = await import(new URL('../../contracts/validate.mjs', import.meta.url));
const bundle = await readJson(bundlePath);
const KEY = 'test-key-not-real-123456';

const gem = (text, finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), { status: 200, headers: { 'content-type': 'application/json' } });
const good = JSON.stringify({
  summary: 'The route imports the changed service.',
  findings: [{ text: 'The API route imports cancel.', evidenceIds: ['RG001'] }],
  reviewChecklist: [{ text: 'Run the full test suite.', evidenceIds: [] }],
});

async function start(deps = {}, contextBundle = bundlePath) {
  const calls = [];
  const fetchImpl = deps.fetchImpl ? async (url, init) => { calls.push({ url, init }); return deps.fetchImpl(url, init, calls.length); } : undefined;
  const handler = await createApiHandler({ projectRoot, bundlePath: contextBundle }, { ...deps, fetchImpl });
  const server = createServer((req, res) => handler(req, res));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise(r => server.close(r)) };
}
const live = (fetchImpl, extra = {}) => start({ env: { AI_MODE: 'live', GEMMA_API_KEY: KEY }, fetchImpl, ...extra });
const post = (base, body, headers = { 'content-type': 'application/json' }) =>
  fetch(`${base}/api/v1/briefings`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
const req = { caseId: 'subscription-change' };

async function expectError(res, status, code) {
  assert.equal(res.status, status);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const json = await res.json();
  assert.equal(json.schemaVersion, '1.0.0');
  assert.equal(json.error.code, code);
  assert.equal(typeof json.error.retryable, 'boolean');
  assert.ok(!JSON.stringify(json).includes('at file:'));
  assert.ok(!JSON.stringify(json).includes(KEY));
  return json;
}

test('health, catalog and case endpoints (fixture mode, no key)', async () => {
  const s = await start();
  try {
    const health = await (await fetch(`${s.base}/api/v1/health`)).json();
    assert.deepEqual(health.data, { status: 'ok', apiMode: 'service', aiMode: 'fixture', artifactKind: 'fixture', gemmaConfigured: false });
    const catalog = await (await fetch(`${s.base}/api/v1/catalog`)).json();
    assert.equal(catalog.data.cases.length, 3);
    const one = await (await fetch(`${s.base}/api/v1/cases/subscription-change`)).json();
    assert.equal(one.data.case.id, 'subscription-change');
    assert.equal(one.data.repository.id, 'fixture-shop');
  } finally { await s.close(); }
});

test('unknown routes, cases, methods and query controls', async () => {
  const s = await start();
  try {
    await expectError(await fetch(`${s.base}/api/v1/nope`), 404, 'NOT_FOUND');
    await expectError(await fetch(`${s.base}/api/v1/cases/unknown`), 404, 'NOT_FOUND');
    await expectError(await fetch(`${s.base}/api/v1/cases/__proto__`), 404, 'NOT_FOUND');
    await expectError(await post(s.base, { caseId: 'unknown' }), 404, 'NOT_FOUND');
    await expectError(await fetch(`${s.base}/api/v1/health`, { method: 'POST' }), 404, 'NOT_FOUND');
    await expectError(await fetch(`${s.base}/api/v1/briefings?mock=timeout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) }), 400, 'INVALID_REQUEST');
  } finally { await s.close(); }
});

test('fixture briefing is deterministic, case-specific and contract-valid', async () => {
  const s = await start();
  try {
    const a = await (await post(s.base, req)).json();
    const b = await (await post(s.base, req)).json();
    assert.deepEqual(a, b);
    validateBriefing(a.data, bundle);
    assert.equal(a.data.mode, 'fixture');
    assert.equal(a.data.model, null);
    assert.equal(a.data.caseId, 'subscription-change');
    const partial = await (await post(s.base, { caseId: 'partial-analysis' })).json();
    assert.equal(partial.data.caseId, 'partial-analysis');
    validateBriefing(partial.data, bundle);
  } finally { await s.close(); }
});

test('request validation: fields, JSON, length, size, media type', async () => {
  const s = await start();
  try {
    await expectError(await post(s.base, { caseId: 'subscription-change', extra: 1 }), 400, 'INVALID_REQUEST');
    await expectError(await post(s.base, { caseId: 'subscription-change', model: 'x' }), 400, 'INVALID_REQUEST');
    await expectError(await post(s.base, '{bad json'), 400, 'INVALID_REQUEST');
    await expectError(await post(s.base, '[]'), 400, 'INVALID_REQUEST');
    await expectError(await post(s.base, {}), 400, 'INVALID_REQUEST');
    await expectError(await post(s.base, { ...req, changeIntent: 'x'.repeat(501) }), 400, 'INVALID_REQUEST');
    assert.equal((await post(s.base, { ...req, changeIntent: 'x'.repeat(500) })).status, 200);
    await expectError(await post(s.base, JSON.stringify({ ...req, changeIntent: 'a'.repeat(9000) })), 413, 'PAYLOAD_TOO_LARGE');
    await expectError(await post(s.base, JSON.stringify(req), { 'content-type': 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
    await expectError(await post(s.base, JSON.stringify(req), {}), 415, 'UNSUPPORTED_MEDIA_TYPE');
  } finally { await s.close(); }
});

test('insufficient evidence returns 422 without calling the model', async () => {
  const s = await live(async () => gem(good));
  try {
    await expectError(await post(s.base, { caseId: 'empty-result' }), 422, 'INSUFFICIENT_EVIDENCE');
    assert.equal(s.calls.length, 0);
  } finally { await s.close(); }
});

test('live success: trusted identity, preserved limitations, key never exposed', async () => {
  const s = await live(async () => gem(good));
  try {
    const res = await post(s.base, { ...req, changeIntent: 'Tighten cancellation rules' });
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(!text.includes(KEY));
    const body = JSON.parse(text).data;
    validateBriefing(body, bundle);
    assert.equal(body.mode, 'live');
    assert.equal(body.model, 'gemma-4-26b-a4b-it');
    assert.equal(body.artifactKind, 'fixture'); // live AI over synthetic data is still fixture data
    const selected = bundle.cases.find(c => c.id === 'subscription-change');
    for (const l of [...selected.limitations, ...selected.impact.blindSpots]) assert.ok(body.limitations.includes(l));
    assert.equal(s.calls.length, 1);
    assert.match(s.calls[0].url, /gemma-4-26b-a4b-it:generateContent$/);
    assert.equal(s.calls[0].init.headers['x-goog-api-key'], KEY);
    assert.ok(!JSON.parse(s.calls[0].init.body).contents[0].parts[0].text.includes(KEY));
    const health = await (await fetch(`${s.base}/api/v1/health`)).json();
    assert.equal(health.data.aiMode, 'live');
    assert.equal(health.data.gemmaConfigured, true);
  } finally { await s.close(); }
});

test('markdown escapes model text', async () => {
  const evil = JSON.stringify({ summary: '<script>alert(1)</script> [x](http://evil)', findings: [{ text: '*bold* [link](http://evil.example)', evidenceIds: ['RG001'] }], reviewChecklist: [] });
  const s = await live(async () => gem(evil));
  try {
    const body = (await (await post(s.base, req)).json()).data;
    assert.ok(!body.markdown.includes('<script>'));
    assert.ok(!body.markdown.includes('](http://evil'));
  } finally { await s.close(); }
});

test('invalid JSON then valid output: one repair, two calls', async () => {
  const s = await live(async (u, i, n) => (n === 1 ? gem('not json') : gem(good)));
  try {
    assert.equal((await post(s.base, req)).status, 200);
    assert.equal(s.calls.length, 2);
  } finally { await s.close(); }
});

test('bad model output twice -> 502 with exactly two calls', async () => {
  for (const bad of ['not json', JSON.stringify({ summary: 's', findings: [{ text: 't', evidenceIds: ['NOPE'] }], reviewChecklist: [] }),
    JSON.stringify({ summary: 'This change is safe to merge.', findings: [{ text: 't', evidenceIds: ['RG001'] }], reviewChecklist: [] })]) {
    const s = await live(async () => gem(bad));
    try {
      await expectError(await post(s.base, req), 502, 'INVALID_MODEL_OUTPUT');
      assert.equal(s.calls.length, 2);
    } finally { await s.close(); }
  }
});

test('missing candidate, empty text and truncated output -> 502', async () => {
  const cases = [
    () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    () => gem('   '),
    () => gem('{"summary":"cut', 'MAX_TOKENS'),
  ];
  for (const make of cases) {
    const s = await live(async () => make());
    try {
      await expectError(await post(s.base, req), 502, 'INVALID_MODEL_OUTPUT');
      assert.ok(s.calls.length <= 2);
    } finally { await s.close(); }
  }
});

test('thought parts are excluded from the answer', async () => {
  const body = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'secret reasoning', thought: true }, { text: good }] }, finishReason: 'STOP' }] }), { status: 200 });
  const s = await live(async () => body);
  try { assert.equal((await post(s.base, req)).status, 200); } finally { await s.close(); }
});

test('timeout -> 504 with no retry', async () => {
  const hang = (u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  const s = await live(hang, { timeoutMs: 60 });
  try {
    await expectError(await post(s.base, req), 504, 'MODEL_TIMEOUT');
    assert.equal(s.calls.length, 1);
  } finally { await s.close(); }
});

test('provider throttling -> 429 with no retry', async () => {
  const s = await live(async () => new Response('{}', { status: 429 }));
  try {
    await expectError(await post(s.base, req), 429, 'RATE_LIMITED');
    assert.equal(s.calls.length, 1);
  } finally { await s.close(); }
});

test('invalid credentials are not retried -> 503', async () => {
  const s = await live(async () => new Response('{"error":{"message":"API key not valid"}}', { status: 400 }));
  try {
    await expectError(await post(s.base, req), 503, 'MODEL_UNAVAILABLE');
    assert.equal(s.calls.length, 1);
  } finally { await s.close(); }
  const s2 = await live(async () => new Response('{}', { status: 403 }));
  try { await expectError(await post(s2.base, req), 503, 'MODEL_UNAVAILABLE'); assert.equal(s2.calls.length, 1); } finally { await s2.close(); }
});

test('missing key in live mode -> 503, no call, no silent fixture fallback', async () => {
  const s = await start({ env: { AI_MODE: 'live' }, fetchImpl: async () => gem(good) });
  try {
    const json = await expectError(await post(s.base, req), 503, 'MODEL_UNAVAILABLE');
    assert.equal(json.error.retryable, true);
    assert.equal(s.calls.length, 0);
    assert.equal((await (await fetch(`${s.base}/api/v1/health`)).json()).data.gemmaConfigured, false);
  } finally { await s.close(); }
});

test('transient provider errors: retry once, then give up', async () => {
  const s = await live(async () => new Response('{}', { status: 500 }));
  try {
    await expectError(await post(s.base, req), 503, 'MODEL_UNAVAILABLE');
    assert.equal(s.calls.length, 2);
  } finally { await s.close(); }
  const s2 = await live(async (u, i, n) => (n === 1 ? new Response('{}', { status: 503 }) : gem(good)));
  try { assert.equal((await post(s2.base, req)).status, 200); assert.equal(s2.calls.length, 2); } finally { await s2.close(); }
});

test('local concurrency limit -> 429', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const s = await live(async () => { await gate; return gem(good); }, { maxConcurrent: 1 });
  try {
    const first = post(s.base, req);
    await new Promise(r => setTimeout(r, 100));
    await expectError(await post(s.base, req), 429, 'RATE_LIMITED');
    release();
    assert.equal((await first).status, 200);
  } finally { release(); await s.close(); }
});

test('factory rejects bad configuration and bad artifacts', async () => {
  await assert.rejects(() => createApiHandler({ projectRoot, bundlePath }, { env: { AI_MODE: 'maybe' } }));
  await assert.rejects(() => createApiHandler({ projectRoot, bundlePath }, { env: { AI_MODE: 'live', GEMMA_MODEL: 'other' } }));
  await assert.rejects(() => createApiHandler({ projectRoot, bundlePath: resolve(projectRoot, 'package.json') }));
  await assert.rejects(() => createApiHandler({ projectRoot, bundlePath: resolve(projectRoot, 'nope.json') }));
});
