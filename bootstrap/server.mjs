import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function send(res, status, body, type = 'text/plain; charset=utf-8', head = false) {
  const bytes = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': type, 'Content-Length': bytes.length,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  });
  res.end(head ? undefined : bytes);
}

async function readStatic(webRoot, candidate) {
  // Check both the requested path and its real target: a symlink in dist must
  // never turn the static server into a source-code or credential file server.
  if (!inside(webRoot, candidate)) return null;
  try {
    const [actualRoot, actualFile] = await Promise.all([realpath(webRoot), realpath(candidate)]);
    if (!inside(actualRoot, actualFile) || !(await stat(actualFile)).isFile()) return null;
    return { bytes: await readFile(actualFile), extension: extname(actualFile).toLowerCase() };
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) return null;
    throw error;
  }
}

export async function createAppServer(options = {}) {
  const projectRoot = resolve(options.projectRoot ?? defaultProjectRoot);
  const bundlePath = resolve(projectRoot, options.bundlePath ?? process.env.ARTIFACT_BUNDLE ?? 'fixtures/artifact-bundle.fixture.json');
  const webDist = resolve(projectRoot, options.webDist ?? process.env.WEB_DIST ?? 'web/dist');
  const apiHandlerModule = Object.hasOwn(options, 'apiHandlerModule')
    ? options.apiHandlerModule
    : process.env.API_HANDLER_MODULE;
  let apiHandler;
  if (apiHandlerModule) {
    const modulePath = resolve(projectRoot, apiHandlerModule);
    const module = await import(pathToFileURL(modulePath).href);
    if (typeof module.createApiHandler !== 'function') {
      throw new Error('API_HANDLER_MODULE must export createApiHandler(context)');
    }
    apiHandler = await module.createApiHandler({ projectRoot, bundlePath });
  } else {
    const { createMockApi } = await import('./mock-api.mjs');
    apiHandler = await createMockApi({ projectRoot, bundlePath });
  }
  if (typeof apiHandler !== 'function') throw new Error('API handler factory must return a request handler');

  return createServer(async (req, res) => {
    let pathname;
    let isApi = false;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
      isApi = pathname === '/api' || pathname.startsWith('/api/');
      if (isApi) {
        await apiHandler(req, res);
        if (!res.writableEnded) throw new Error('API handler returned without ending response');
        return;
      }
      const head = req.method === 'HEAD';
      if (req.method !== 'GET' && !head) {
        res.setHeader('Allow', 'GET, HEAD');
        send(res, 405, 'Method not allowed');
        return;
      }
      try { pathname = decodeURIComponent(pathname); }
      catch { send(res, 400, 'Invalid URL encoding', undefined, head); return; }
      const segments = pathname.split('/');
      if (pathname.includes('\\') || pathname.includes('\0') || segments.some(part => part.startsWith('.'))) {
        send(res, 404, 'Not found', undefined, head);
        return;
      }
      const candidate = resolve(webDist, `.${pathname === '/' ? '/index.html' : pathname}`);
      let file = await readStatic(webDist, candidate);
      // Extension-bearing misses are missing assets, not frontend routes.
      if (!file && !extname(pathname)) file = await readStatic(webDist, resolve(webDist, 'index.html'));
      if (file) {
        res.writeHead(200, {
          'Content-Type': mimeTypes[file.extension] ?? 'application/octet-stream',
          'Content-Length': file.bytes.length, 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(head ? undefined : file.bytes);
        return;
      }
      if (pathname === '/') {
        const mode = apiHandlerModule ? 'service module configured' : 'mock API; synthetic fixtures; no model called';
        send(res, 200, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review Desk — bootstrap placeholder</title><main><h1>RepoGraph Review Desk — bootstrap placeholder</h1><p>The frontend has not been built. API mode: ${mode}.</p><p>This is a starter shell, not a completed sponsor demonstration.</p><p><a href="/api/v1/health">Inspect API health and provenance</a></p></main></html>`, 'text/html; charset=utf-8', head);
        return;
      }
      send(res, 404, 'Not found', undefined, head);
    } catch (error) {
      console.error('Request failed:', error.name);
      if (res.headersSent) { res.destroy(); return; }
      if (isApi) {
        send(res, 500, JSON.stringify({ schemaVersion: '1.0.0', error: {
          code: 'INTERNAL_ERROR', message: 'Unexpected request failure', retryable: false,
        } }), 'application/json; charset=utf-8');
      } else send(res, 500, 'Unexpected request failure');
    }
  });
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  try {
    const port = Number(process.env.PORT ?? 3000);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
    const server = await createAppServer();
    server.on('error', error => { console.error('Server startup failed:', error.message); process.exitCode = 1; });
    server.listen(port, '0.0.0.0', () => {
      console.log(`Review Desk listening on 0.0.0.0:${server.address().port}; API=${process.env.API_HANDLER_MODULE ? 'service' : 'mock (fixture data)'}`);
      console.log('Check /api/v1/health for analysis and inference provenance.');
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  }
}
