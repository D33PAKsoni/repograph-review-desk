import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';

const entry = new URL('./cloudways-entry.mjs', import.meta.url).href;
function launch(extra = {}) {
  const env = { ...process.env, PORT: '0', ARTIFACT_BUNDLE: 'fixtures/artifact-bundle.fixture.json', WEB_DIST: 'web/dist', ...extra };
  if (!Object.hasOwn(extra, 'API_HANDLER_MODULE')) delete env.API_HANDLER_MODULE;
  // No script argv: reproduce PM2's ESM import while outside the project cwd.
  return spawn(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(entry)})`], { env, cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}
test('hosting entry serves fixture health when imported by a process manager', { timeout: 15000 }, async t => {
  const child = launch();
  t.after(() => { child.kill(); });
  const port = await new Promise((resolve, reject) => {
    let text = '';
    child.stdout.on('data', bytes => {
      text += bytes;
      const match = text.match(/listening on 0\.0\.0\.0:(\d+)/);
      if (match) resolve(Number(match[1]));
    });
    child.on('error', reject);
    child.on('exit', code => reject(new Error(`Entry exited before listening (${code})`)));
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schemaVersion, '1.0.0');
  assert.deepEqual(body.data, { status: 'ok', apiMode: 'mock', aiMode: 'fixture', artifactKind: 'fixture', gemmaConfigured: false });
});
test('hosting entry exits on an explicitly missing handler rather than falling back', { timeout: 15000 }, async () => {
  const child = launch({ API_HANDLER_MODULE: 'service/__missing-handler-for-startup-check__.mjs' });
  let errors = '';
  child.stderr.on('data', bytes => { errors += bytes; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(errors, /Server startup failed:/);
});
test('hosting entry rejects an invalid port before listening', { timeout: 15000 }, async () => {
  const child = launch({ PORT: 'not-a-port' });
  let errors = '';
  child.stderr.on('data', bytes => { errors += bytes; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(errors, /PORT must be an integer/);
});
