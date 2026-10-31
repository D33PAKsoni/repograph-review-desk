import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from '../api-handler.mjs';
import { readJson, validateBriefing } from '../../contracts/validate.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundlePath = resolve(projectRoot, 'data/production/artifact-bundle.json');
const bundle = await readJson(bundlePath);

async function start(t) {
  const handler = await createApiHandler({ projectRoot, bundlePath }, { env: { AI_MODE: 'fixture' } });
  const server = createServer((req, res) => handler(req, res));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('service handler health check returns service mode and generated bundle provenance', async t => {
  const base = await start(t);
  const result = await fetch(`${base}/api/v1/health`);
  assert.equal(result.status, 200);
  const { data } = await result.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.apiMode, 'service');
  assert.equal(data.artifactKind, 'generated');
});

test('service handler catalog returns cases and repo info', async t => {
  const base = await start(t);
  const result = await fetch(`${base}/api/v1/catalog`);
  assert.equal(result.status, 200);
  const { data } = await result.json();
  assert.equal(data.repository.id, 'repograph');
  assert.equal(data.cases.length, 1);
  assert.equal(data.cases[0].id, 'repograph-impact-core');
});

test('service handler returns specific case details', async t => {
  const base = await start(t);
  const result = await fetch(`${base}/api/v1/cases/repograph-impact-core`);
  assert.equal(result.status, 200);
  const { data } = await result.json();
  assert.equal(data.case.id, 'repograph-impact-core');
  assert.ok(data.case.evidence.length >= 3);
});

test('service handler generates valid briefing and preserves limitations', async t => {
  const base = await start(t);
  const result = await fetch(`${base}/api/v1/briefings`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ caseId: 'repograph-impact-core', changeIntent: 'Refactor impact analysis' }),
  });
  assert.equal(result.status, 200);
  const { data } = await result.json();
  validateBriefing(data, bundle);
  assert.equal(data.caseId, 'repograph-impact-core');
  assert.equal(data.mode, 'fixture');
  assert.ok(data.findings.length > 0);
  assert.match(data.markdown, /^# Review briefing:/);
  for (const limitation of [...bundle.cases[0].limitations, ...bundle.cases[0].impact.blindSpots]) {
    assert.ok(data.limitations.includes(limitation));
  }
});
