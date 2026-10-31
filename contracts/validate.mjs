import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_JSON_BYTES = 2 * 1024 * 1024;

export async function readJson(path) {
  const info = await stat(path);
  if (info.size > MAX_JSON_BYTES) throw new Error('JSON file exceeds the 2 MiB limit');
  const bytes = await readFile(path);
  if (bytes.length > MAX_JSON_BYTES) throw new Error('JSON file exceeds the 2 MiB limit');
  try {
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

const bundleSchema = await readJson(new URL('./artifact-bundle.schema.json', import.meta.url));
const briefingSchema = await readJson(new URL('./briefing.schema.json', import.meta.url));
const labels = {
  repograph: new Set(['confirmed', 'inferred', 'heuristic', 'unresolved', 'external']),
  graphify: new Set(['EXTRACTED', 'INFERRED', 'AMBIGUOUS']),
};
const gemmaModels = new Set(['gemma-4-26b-a4b-it', 'gemma-4-31b-it']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

// Intentionally implements only the JSON Schema subset used by these two schemas.
function checkSchema(value, schema, path) {
  if (own(schema, 'const') && value !== schema.const) fail(path, `must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(path, 'value is not in the allowed enum');
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matches = types.some(type => {
      if (type === 'null') return value === null;
      if (type === 'array') return Array.isArray(value);
      if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
      if (type === 'integer') return Number.isSafeInteger(value);
      if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
      return typeof value === type;
    });
    if (!matches) fail(path, `must have type ${types.join(' or ')}`);
  }
  if (typeof value === 'string') {
    const length = Array.from(value).length;
    if (schema.minLength !== undefined && length < schema.minLength) fail(path, `must contain at least ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && length > schema.maxLength) fail(path, `must contain at most ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) fail(path, 'does not match the required pattern');
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) fail(path, `must be at least ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(path, `must contain at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(path, `must contain at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, index) => checkSchema(item, schema.items, `${path}[${index}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const key of schema.required ?? []) if (!own(value, key)) fail(path, `missing required field ${key}`);
    for (const key of Object.keys(value)) {
      if (schema.properties && own(schema.properties, key)) checkSchema(value[key], schema.properties[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) fail(path, `unknown field ${key}`);
    }
  }
}

function unique(items, path) {
  if (new Set(items).size !== items.length) fail(path, 'IDs must be unique');
}

function checkPath(value, path) {
  if (value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value)
      || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)
      || value.split('/').includes('..') || /[\u0000-\u001F\u007F]/u.test(value)) {
    fail(path, 'must be a repository-relative POSIX path without traversal');
  }
}

function checkTimestamp(value, path) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(value);
  if (!match) fail(path, 'must be a UTC ISO 8601 timestamp ending in Z');
  const date = new Date(value);
  const actual = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
  if (!Number.isFinite(date.getTime()) || actual.some((part, index) => part !== Number(match[index + 1]))) {
    fail(path, 'timestamp contains an invalid date or time');
  }
}

function repositoryPath(url) {
  let parsed;
  try { parsed = new URL(url); } catch { fail('bundle.repository.url', 'must identify a GitHub repository'); }
  if (parsed.origin !== 'https://github.com' || parsed.username || parsed.password || parsed.search || parsed.hash
      || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(parsed.pathname)) {
    fail('bundle.repository.url', 'must identify an HTTPS GitHub repository without a query or fragment');
  }
  return parsed.pathname.replace(/\/$/, '');
}

function checkSourceUrl(evidence, bundle, repoPath, path) {
  if (bundle.artifactKind === 'fixture') {
    if (evidence.sourceUrl !== null) fail(`${path}.sourceUrl`, 'fixture evidence must use null');
    return;
  }
  let url;
  try { url = new URL(evidence.sourceUrl); } catch { fail(`${path}.sourceUrl`, 'generated evidence requires a pinned GitHub blob URL'); }
  let decodedPath;
  try { decodedPath = decodeURIComponent(url.pathname); } catch { fail(`${path}.sourceUrl`, 'contains malformed URL encoding'); }
  const expected = `${repoPath}/blob/${bundle.repository.commitSha}/${evidence.path}`;
  const start = `#L${evidence.startLine}`;
  const range = `${start}-L${evidence.endLine}`;
  const anchorMatches = evidence.startLine === evidence.endLine ? [start, range].includes(url.hash) : url.hash === range;
  if (url.origin !== 'https://github.com' || url.username || url.password || url.search || decodedPath !== expected || !anchorMatches) {
    fail(`${path}.sourceUrl`, 'must match the repository, pinned commit, evidence path, and exact line range');
  }
}

function checkRefs(ids, evidence, path, producer) {
  for (const id of ids) {
    const record = evidence.get(id);
    if (!record) fail(path, `unknown evidence ID ${id}`);
    if (producer && record.producer !== producer) fail(path, `evidence ${id} must come from ${producer}`);
  }
}

export function validateBundle(bundle) {
  checkSchema(bundle, bundleSchema, 'bundle');
  checkTimestamp(bundle.generatedAt, 'bundle.generatedAt');
  unique(bundle.tools.map(tool => tool.name), 'bundle.tools');
  for (const tool of bundle.tools) {
    const expectedMode = tool.name === 'repograph' ? 'static' : 'code-only';
    if (tool.mode !== expectedMode) fail('bundle.tools', `${tool.name} must retain mode ${expectedMode}`);
    if (!tool.version.trim()) fail('bundle.tools', 'tool versions cannot be blank');
  }
  unique(bundle.cases.map(item => item.id), 'bundle.cases');
  let repoPath = null;
  if (bundle.artifactKind === 'generated') {
    if (/^0{40}$/.test(bundle.repository.commitSha)) fail('bundle.repository.commitSha', 'generated data cannot use the fixture placeholder commit');
    repoPath = repositoryPath(bundle.repository.url);
  }
  let usefulGeneratedCase = false;
  bundle.cases.forEach((item, index) => {
    const path = `bundle.cases[${index}]`;
    item.changedFiles.forEach((file, i) => checkPath(file, `${path}.changedFiles[${i}]`));
    unique(item.evidence.map(record => record.id), `${path}.evidence`);
    const evidence = new Map(item.evidence.map(record => [record.id, record]));
    item.evidence.forEach((record, i) => {
      const recordPath = `${path}.evidence[${i}]`;
      checkPath(record.path, `${recordPath}.path`);
      if (record.endLine < record.startLine) fail(recordPath, 'endLine must be at least startLine');
      if (!labels[record.producer].has(record.confidence)) fail(`${recordPath}.confidence`, 'label does not belong to its producer');
      checkSourceUrl(record, bundle, repoPath, recordPath);
    });
    for (const group of ['directDependents', 'transitiveDependents', 'relatedTests']) {
      item.impact[group].forEach((entry, i) => {
        checkPath(entry.path, `${path}.impact.${group}[${i}].path`);
        checkRefs(entry.evidenceIds, evidence, `${path}.impact.${group}[${i}].evidenceIds`, 'repograph');
      });
    }
    checkRefs(item.architecture.evidenceIds, evidence, `${path}.architecture.evidenceIds`, 'graphify');
    if (item.evidence.some(record => record.producer === 'repograph') && item.architecture.evidenceIds.length > 0) usefulGeneratedCase = true;
  });
  if (bundle.artifactKind === 'generated' && !usefulGeneratedCase) {
    fail('bundle.cases', 'a primary generated demo case must include RepoGraph evidence and Graphify architecture evidence');
  }
  return bundle;
}

export function validateBriefing(briefing, bundle) {
  validateBundle(bundle);
  checkSchema(briefing, briefingSchema, 'briefing');
  checkTimestamp(briefing.generatedAt, 'briefing.generatedAt');
  for (const [field, expected] of Object.entries({ artifactKind: bundle.artifactKind, repositoryId: bundle.repository.id, commitSha: bundle.repository.commitSha })) {
    if (briefing[field] !== expected) fail(`briefing.${field}`, 'must match the selected artifact bundle');
  }
  const selected = bundle.cases.find(item => item.id === briefing.caseId);
  if (!selected) fail('briefing.caseId', 'does not identify an allowlisted case');
  if (selected.evidence.length === 0) fail('briefing.caseId', 'case has no usable evidence; return INSUFFICIENT_EVIDENCE instead');
  if (briefing.mode === 'fixture' && briefing.model !== null) fail('briefing.model', 'fixture inference must use null');
  if (briefing.mode === 'live' && !gemmaModels.has(briefing.model)) fail('briefing.model', 'live inference must name a supported Gemma 4 model');
  const evidence = new Map(selected.evidence.map(record => [record.id, record]));
  for (const group of ['findings', 'reviewChecklist']) {
    briefing[group].forEach((entry, index) => checkRefs(entry.evidenceIds, evidence, `briefing.${group}[${index}].evidenceIds`));
  }
  const preserved = new Set(briefing.limitations);
  for (const limitation of [...selected.limitations, ...selected.impact.blindSpots]) {
    if (!preserved.has(limitation)) fail('briefing.limitations', 'must preserve every case limitation and blind spot verbatim');
  }
  return briefing;
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--bundle', '--briefing'].includes(args[i]) || !args[i + 1] || own(options, args[i])) {
        throw new Error('Usage: node contracts/validate.mjs --bundle path [--briefing path]');
      }
      options[args[i]] = args[i + 1];
    }
    if (!options['--bundle']) throw new Error('Usage: node contracts/validate.mjs --bundle path [--briefing path]');
    const bundle = validateBundle(await readJson(options['--bundle']));
    if (options['--briefing']) validateBriefing(await readJson(options['--briefing']), bundle);
    process.stdout.write(`Valid bundle (${bundle.cases.length} cases)${options['--briefing'] ? ' and briefing' : ''}.\n`);
  } catch (error) {
    process.stderr.write(`Validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
