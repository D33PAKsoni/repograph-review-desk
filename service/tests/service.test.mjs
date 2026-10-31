import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from '../api-handler.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundlePath = resolve(projectRoot, 'data/production/artifact-bundle.json');

function createMockReqRes({ method = 'GET', url = '/api/v1/health', body = null } = {}) {
  let statusCode = 200;
  let headers = {};
  let responseData = '';
  let ended = false;

  const req = {
    method,
    url,
    headers: {
      'content-type': 'application/json',
      ...(body ? { 'content-length': String(Buffer.byteLength(JSON.stringify(body))) } : {})
    },
    on(event, handler) {
      if (event === 'data' && body) {
        handler(Buffer.from(JSON.stringify(body)));
      }
      return this;
    },
    once(event, handler) {
      if (event === 'end') {
        handler();
      }
      return this;
    },
    off() { return this; },
    resume() { return this; }
  };

  const res = {
    writeHead(code, h) {
      statusCode = code;
      headers = h;
    },
    end(data) {
      if (data) responseData += data;
      ended = true;
      this.writableEnded = true;
    },
    writableEnded: false
  };

  return { req, res, getResult: () => ({ statusCode, headers, data: JSON.parse(responseData) }) };
}

test('service handler health check returns service mode and generated bundle provenance', async () => {
  const handler = await createApiHandler({ projectRoot, bundlePath });
  const { req, res, getResult } = createMockReqRes({ url: '/api/v1/health' });
  await handler(req, res);
  const result = getResult();
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.data.status, 'ok');
  assert.equal(result.data.data.apiMode, 'service');
  assert.equal(result.data.data.artifactKind, 'generated');
});

test('service handler catalog returns cases and repo info', async () => {
  const handler = await createApiHandler({ projectRoot, bundlePath });
  const { req, res, getResult } = createMockReqRes({ url: '/api/v1/catalog' });
  await handler(req, res);
  const result = getResult();
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.data.repository.id, 'repograph');
  assert.equal(result.data.data.cases.length, 1);
  assert.equal(result.data.data.cases[0].id, 'repograph-impact-core');
});

test('service handler returns specific case details', async () => {
  const handler = await createApiHandler({ projectRoot, bundlePath });
  const { req, res, getResult } = createMockReqRes({ url: '/api/v1/cases/repograph-impact-core' });
  await handler(req, res);
  const result = getResult();
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.data.case.id, 'repograph-impact-core');
  assert.ok(result.data.data.case.evidence.length >= 3);
});

test('service handler generates valid briefing and preserved limitations', async () => {
  const handler = await createApiHandler({ projectRoot, bundlePath });
  const { req, res, getResult } = createMockReqRes({
    method: 'POST',
    url: '/api/v1/briefings',
    body: { caseId: 'repograph-impact-core', changeIntent: 'Refactor impact analysis' }
  });
  await handler(req, res);
  const result = getResult();
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.data.caseId, 'repograph-impact-core');
  assert.ok(result.data.data.findings.length > 0);
  assert.ok(result.data.data.markdown.includes('Review Desk Briefing'));
});
