import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const base = args.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:3000';
const production = args.includes('--production');
const expectedModel = args.find(value => value.startsWith('--model='))?.slice(8);
const result = { checkedAt: new Date().toISOString(), baseUrl: base, verification: production ? 'production' : 'mock', passed: false };

async function get(path, body) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(90000),
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const envelope = await response.json();
  assert.equal(response.ok, true, `HTTP ${response.status} (${envelope.error?.code ?? 'unexpected response'})`);
  assert.equal(envelope.schemaVersion, '1.0.0');
  return envelope.data;
}
try {
  if (production) assert.ok(expectedModel, 'Production verification requires --model=<actual-team-verified-model>');
  const health = await get('/api/v1/health');
  Object.assign(result, { health });
  assert.equal(health.status, 'ok');
  assert.equal(health.apiMode, production ? 'service' : 'mock');
  assert.equal(health.aiMode, production ? 'live' : 'fixture');
  assert.equal(health.artifactKind, production ? 'generated' : 'fixture');
  assert.equal(health.gemmaConfigured, production);
  const root = await fetch(new URL('/', base));
  assert.equal(root.status, 200);
  const html = await root.text();
  assert.ok(html.includes('id="root"') && html.includes('/assets/'), 'Built UI must be served, not the bootstrap placeholder');
  const catalog = await get('/api/v1/catalog');
  assert.ok(catalog.cases.length, 'Catalog has no cases');
  let detail;
  for (const item of catalog.cases) {
    const candidate = await get(`/api/v1/cases/${encodeURIComponent(item.id)}`);
    if (candidate.case.evidence.length) { detail = candidate; break; }
  }
  assert.ok(detail, 'No scenario with usable evidence');
  if (production) {
    assert.ok(detail.case.evidence.some(record => record.producer === 'repograph'));
    assert.ok(detail.case.architecture.evidenceIds.some(id => detail.case.evidence.some(record => record.id === id && record.producer === 'graphify')));
    for (const record of detail.case.evidence) {
      const source = new URL(record.sourceUrl);
      assert.equal(source.protocol, 'https:'); assert.equal(source.hostname, 'github.com');
      assert.ok(source.pathname.includes(`/blob/${detail.repository.commitSha}/${record.path}`));
      assert.ok(source.hash.startsWith(`#L${record.startLine}`));
    }
  }
  const briefing = await get('/api/v1/briefings', { caseId: detail.case.id });
  assert.equal(briefing.caseId, detail.case.id);
  assert.equal(briefing.commitSha, detail.repository.commitSha);
  assert.equal(briefing.repositoryId, detail.repository.id);
  assert.equal(briefing.artifactKind, production ? 'generated' : 'fixture');
  assert.equal(briefing.mode, production ? 'live' : 'fixture');
  assert.equal(briefing.model, production ? expectedModel : null);
  const ids = new Set(detail.case.evidence.map(record => record.id));
  for (const finding of briefing.findings) {
    assert.ok(finding.evidenceIds.length);
    for (const id of finding.evidenceIds) assert.ok(ids.has(id), `Unknown evidence ${id}`);
  }
  for (const item of briefing.reviewChecklist) for (const id of item.evidenceIds) assert.ok(ids.has(id));
  for (const warning of [...detail.case.limitations, ...detail.case.impact.blindSpots]) assert.ok(briefing.limitations.includes(warning), 'Missing limitation/blind spot');
  assert.ok(briefing.markdown.length);
  assert.ok(briefing.markdown.includes(briefing.commitSha));
  Object.assign(result, { passed: true, caseId: briefing.caseId, commitSha: briefing.commitSha, model: briefing.model, inferenceMode: briefing.mode });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  Object.assign(result, { error: error.message });
  console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
}
if (args.includes('--record')) {
  await mkdir(new URL('./verification/', import.meta.url), { recursive: true });
  await writeFile(new URL(`./verification/${production ? 'production' : 'mock'}-smoke.json`, import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
}
