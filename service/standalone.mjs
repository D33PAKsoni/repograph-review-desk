// API-only local launcher: node service/standalone.mjs  (uses the fixture bundle by default)
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './api-handler.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = resolve(projectRoot, process.env.ARTIFACT_BUNDLE ?? 'fixtures/artifact-bundle.fixture.json');
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');

try {
  const handler = await createApiHandler({ projectRoot, bundlePath });
  const server = createServer(async (req, res) => {
    if (!new URL(req.url, 'http://localhost').pathname.startsWith('/api/')) {
      const body = JSON.stringify({ schemaVersion: '1.0.0', error: { code: 'NOT_FOUND', message: 'API only.', retryable: false } });
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
      return;
    }
    await handler(req, res);
  });
  server.listen(port, '127.0.0.1', () => console.log(`Review Desk API on http://127.0.0.1:${server.address().port} (AI_MODE=${process.env.AI_MODE ?? 'fixture'})`));
} catch (error) {
  console.error('Startup failed:', error.message);
  process.exitCode = 1;
}
