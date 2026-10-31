import { readdir, lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Package Member 3's owned-file overlay only. Recipient already has the frozen starter.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'deployment/handoff');
const omitted = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', 'handoff', '.git']);
const files = ['package.json', 'package-lock.json', 'README.md', 'LICENSE', 'ATTRIBUTION.md'];
async function walk(relative) {
  for (const name of (await readdir(resolve(root, relative))).sort()) {
    if (omitted.has(name) || name === '.env' || name.startsWith('.env.') || name.endsWith('.log')) continue;
    const path = `${relative}/${name}`;
    const info = await lstat(resolve(root, path));
    if (info.isSymbolicLink()) throw new Error(`Refusing a symlink in the handoff: ${path}`);
    if (info.isDirectory()) await walk(path);
    else if (info.isFile()) files.push(path);
  }
}
await walk('web'); await walk('deployment'); files.sort();
await mkdir(output, { recursive: true });
const inventory = [];
for (const path of files) {
  const bytes = await readFile(resolve(root, path));
  inventory.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const archive = resolve(output, 'member-3-overlay.tar.gz');
const manifest = { createdAt: new Date().toISOString(), kind: 'member-3-owned-files-overlay', analysis: 'synthetic fixtures; production handoffs pending', inference: 'canned fixture; no live model verified', sourceCommit: null, remoteCommit: null, files: inventory };
await writeFile(resolve(output, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const archiveEntries = [...files, 'deployment/handoff/MANIFEST.json'];
// Feed validated relative file names through stdin; no command shell or computed deletion/move.
const packaged = spawnSync('tar', ['-czf', archive, '-C', root, '-T', '-'], { input: archiveEntries.join('\n') + '\n', encoding: 'utf8', windowsHide: true });
if (packaged.error) throw new Error(`tar could not run: ${packaged.error.message}`);
if (packaged.status !== 0) throw new Error(`tar failed: ${packaged.stderr}`);
const listed = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8', windowsHide: true });
if (listed.status !== 0) throw new Error('Archive could not be read back.');
const actual = listed.stdout.trim().split(/\r?\n/).sort();
if (JSON.stringify(actual) !== JSON.stringify(archiveEntries.sort())) throw new Error('Archive inventory does not match the allowed file list.');
const archiveBytes = await readFile(archive);
const hash = createHash('sha256').update(archiveBytes).digest('hex');
await writeFile(resolve(output, 'SHA256SUMS.txt'), `${hash}  member-3-overlay.tar.gz\n`);
console.log(JSON.stringify({ archive, files: archiveEntries.length, bytes: archiveBytes.length, sha256: hash, scope: 'Only Member 3 owned files; excludes credentials, dependencies, build output and other members/frozen files.' }, null, 2));
