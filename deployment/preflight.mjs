import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateBundle, validateBriefing } from '../contracts/validate.mjs';

// Read-only integration checks. No handler import, inference, credentials or network calls.
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const checks = [];
async function check(name, action) {
  try { const detail = await action(); checks.push({ name, passed: true, detail }); }
  catch (error) { checks.push({ name, passed: false, detail: error.message }); }
}
async function json(path) { return JSON.parse(await readFile(resolve(projectRoot, path), 'utf8')); }
async function file(path) {
  const bytes = await readFile(resolve(projectRoot, path));
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await check('Node runtime', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!((major === 20 && minor >= 18) || (major === 22 && minor >= 12) || major === 24)) throw new Error('Use Node 20.18+, Node 22.12+ or Node 24.');
  return process.version;
});
await check('Root build/start commands', async () => {
  const pkg = await json('package.json');
  if (pkg.scripts.build !== 'npm --prefix web ci && npm --prefix web run build' || pkg.scripts.start !== 'node bootstrap/server.mjs') throw new Error('Restore the frozen-launcher build/start configuration.');
  return 'Clean frontend install/build; supplied Node launcher.';
});
await check('Frontend dependency lock', async () => {
  const pkg = await json('web/package.json');
  const lock = await json('web/package-lock.json');
  for (const group of ['dependencies', 'devDependencies']) {
    if (JSON.stringify(pkg[group]) !== JSON.stringify(lock.packages[''][group])) throw new Error(`web/package-lock.json is out of sync for ${group}; run npm install in web/.`);
  }
  return file('web/package-lock.json');
});
await check('Built frontend', async () => {
  const html = await readFile(resolve(projectRoot, 'web/dist/index.html'), 'utf8');
  if (!html.includes('id="root"') || !html.includes('/assets/')) throw new Error('Run npm run build to produce the dashboard.');
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) await access(resolve(projectRoot, `web/dist${asset}`));
  return file('web/dist/index.html');
});
await check(production ? 'Generated analysis bundle' : 'Supplied fixture bundle and briefing', async () => {
  const path = production ? 'data/production/artifact-bundle.json' : 'fixtures/artifact-bundle.fixture.json';
  let bundle;
  try { bundle = await json(path); } catch { throw new Error(`Missing or unreadable ${path}.`); }
  validateBundle(bundle);
  if (bundle.artifactKind !== (production ? 'generated' : 'fixture')) throw new Error('Artifact provenance does not match the requested preflight mode.');
  if (!production) validateBriefing(await json('fixtures/briefing.fixture.json'), bundle);
  if (production && !bundle.cases.some(item => item.evidence.some(record => record.producer === 'repograph') && item.architecture.evidenceIds.some(id => item.evidence.some(record => record.id === id && record.producer === 'graphify')))) throw new Error('No generated case combines RepoGraph evidence with cited Graphify architecture context.');
  return { ...(await file(path)), artifactKind: bundle.artifactKind, commitSha: bundle.repository.commitSha, cases: bundle.cases.length };
});
if (production) {
  await check('API handler module', async () => {
    try { return await file('service/api-handler.mjs'); }
    catch { throw new Error('Missing service/api-handler.mjs.'); }
  });
  await check('Production process environment', () => {
    const expected = { ARTIFACT_BUNDLE: 'data/production/artifact-bundle.json', API_HANDLER_MODULE: 'service/api-handler.mjs', WEB_DIST: 'web/dist', AI_MODE: 'live' };
    const missing = Object.entries(expected).filter(([name, value]) => process.env[name] !== value).map(([name]) => name);
    for (const name of ['GEMMA_MODEL', 'GEMMA_API_KEY']) if (!process.env[name]?.trim()) missing.push(name);
    if (missing.length) throw new Error(`Configure these production process variables privately: ${missing.join(', ')}. Values are not printed.`);
    return 'Required variable names are set; credentials/model access are not validated by this offline check.';
  });
}
const report = { checkedAt: new Date().toISOString(), mode: production ? 'production' : 'mock', passed: checks.every(item => item.passed), checks, limitations: 'Offline preflight only. Does not certify handler behavior, source availability, hosting or live model access.' };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--record')) {
  await mkdir(new URL('./verification/', import.meta.url), { recursive: true });
  await writeFile(new URL(`./verification/preflight-${report.mode}.json`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
}
if (!report.passed) process.exitCode = 1;
