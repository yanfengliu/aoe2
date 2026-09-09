// Standalone documentation gate. Bound: structure, retained bytes, effective Git
// attributes, and the fixed seven-import raw boundary. It does not
// prove authored content, truthful status, review independence, or acceptance.
import { createHash } from 'node:crypto';
import { assertApprovedRaw } from './workDocsRaw.js';

type Files = ReadonlyMap<string, Buffer>;
type LegacyFile = { path: string; sha256: string; source: string };
type Allocation = { id: number; theme: string; legacyFiles: LegacyFile[] };
const statuses = new Set(['planned', 'active', 'blocked', 'complete', 'cancelled', 'legacy']);
const planSections = ['Problem and outcome', 'Scope', 'Approach', 'Acceptance criteria', 'Implementation steps', 'Outcome'];
const reviewSections = ['Target', 'Reviewers and coverage', 'Reports', 'Findings and disposition', 'Verification', 'Round outcome'];
const roundPattern = /^(0|[1-9]\d*)_(plan|design|implementation|integration|legacy)\.md$/;
const rawNames = new Set([
  'codex.md', 'codex.txt', 'claude.md', 'claude.txt', 'diff.md', 'diff.txt',
  'error.md', 'error.txt', 'opus.md', 'opus.txt', 'prompt.md', 'prompt.txt',
  'stderr.md', 'stderr.txt', 'stdout.md', 'stdout.txt',
]);
const rawPattern = /^(?:.*\.log|.*\.stderr|.*\.stdout|raw-.*\.md|.*-prompt\.md|.*-diff\.md|.*-stdout\.md|.*-stderr\.md|transcript-.*\.md)$/;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function safePath(value: unknown): value is string {
  return typeof value === 'string' && !value.includes('\\') && value.split('/').every((part) =>
    part && part !== '.' && part !== '..' && !/[:\0\r\n]/.test(part));
}
function requiredFile(files: Files, name: string) {
  const bytes = files.get(name);
  ensure(bytes !== undefined, `docs/${name} is missing; restore the required work document.`);
  return bytes;
}
function parseRegistry(bytes: Buffer): Allocation[] {
  const value: unknown = JSON.parse(bytes.toString('utf8'));
  ensure(record(value) && value.version === 1 && Array.isArray(value.allocations) && value.allocations.length > 0, 'docs/work/registry.json needs version 1 and a nonempty allocations array.');
  return value.allocations.map((raw: unknown, index: number) => {
    ensure(record(raw) && Number.isSafeInteger(raw.id) && raw.id === index && typeof raw.theme === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.theme), `Registry allocation ${index} needs contiguous ID ${index} and a lowercase hyphenated theme.`);
    ensure(raw.legacyFiles === undefined || Array.isArray(raw.legacyFiles), `Registry allocation ${index} legacyFiles must be an array.`);
    const seen = new Set<string>();
    const legacyFiles = (raw.legacyFiles ?? []).map((file: unknown) => {
      ensure(record(file) && safePath(file.path) && /^(historical|reviews)\//.test(file.path) && typeof file.sha256 === 'string' && /^[0-9a-f]{64}$/.test(file.sha256) && typeof file.source === 'string' && file.source.trim() && !/[\r\n\0]/.test(file.source), `Registry allocation ${index} needs safe legacy file paths, SHA-256 digests, and source provenance.`);
      ensure(!seen.has(file.path), `Duplicate legacy file ${file.path}; record each imported file once.`);
      seen.add(file.path);
      return { path: file.path, sha256: file.sha256, source: file.source };
    });
    return { id: index, theme: raw.theme, legacyFiles };
  });
}
function sections(text: string, headings: string[], file: string) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  for (const heading of headings) {
    const start = lines.indexOf(`## ${heading}`);
    let end = lines.findIndex((line, index) => index > start && /^## /.test(line));
    if (end < 0) end = lines.length;
    ensure(start >= 0 && lines.slice(start + 1, end).join('\n').trim(), `docs/${file} needs a nonempty "## ${heading}" section; state unavailable evidence explicitly.`);
  }
}
function plan(bytes: Buffer, file: string) {
  const text = bytes.toString('utf8');
  const status = /^Status: (.+)$/m.exec(text)?.[1].trim() ?? '';
  ensure(statuses.has(status), `docs/${file} needs a valid Status field.`);
  for (const field of ['Owner', 'Created', 'Updated']) {
    ensure(new RegExp(`^${field}: \\S.*$`, 'm').test(text), `docs/${file} needs ${field}: metadata.`);
  }
  for (const field of ['Created', 'Updated']) {
    const value = new RegExp(`^${field}: (.+)$`, 'm').exec(text)![1].trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : undefined;
    ensure((date && Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value) || /^Unknown \(historical record; .+\)$/.test(value), `docs/${file} ${field} needs a real ISO date or Unknown (historical record; reason).`);
  }
  sections(text, planSections, file);
}
function rawPath(file: string) {
  const parts = file.split('/');
  const name = parts.at(-1)!.toLowerCase();
  return parts.some(part => part.toLowerCase() === 'raw') || rawNames.has(name) || rawPattern.test(name);
}
function unit(files: Files, allocation: Allocation, readSource?: (source: string) => Buffer) {
  const prefix = `work/${allocation.id}_${allocation.theme}/`;
  const entries = [...files].filter(([file]) => file.startsWith(prefix)).map(([file, bytes]) => [file.slice(prefix.length), bytes] as const);
  plan(requiredFile(files, `${prefix}plan.md`), `${prefix}plan.md`);
  const legacy = new Map(allocation.legacyFiles.map((file) => [file.path, file]));
  const rawExceptions = new Set<string>();
  for (const file of allocation.legacyFiles) {
    const bytes = requiredFile(files, prefix + file.path);
    const unchanged = digest(bytes) === file.sha256;
    ensure(unchanged || file.path.startsWith('reviews/'), `docs/${prefix}${file.path} differs from its imported digest; preserve historical bytes.`);
    if (unchanged && rawPath(prefix + file.path)) {
      ensure(file.path.startsWith('historical/') && readSource, `docs/${prefix}${file.path} is raw output; only the seven fixed reviewed historical bindings are allowed.`);
      assertApprovedRaw(`docs/${prefix}${file.path}`, file, bytes, readSource);
      rawExceptions.add(prefix + file.path);
    }
  }
  const rounds: number[] = [];
  for (const [name, bytes] of entries) {
    ensure(name.split('/').at(-1) !== '.gitattributes', `docs/${prefix}${name} can change stored bytes; nested .gitattributes are forbidden.`);
    if (name === 'plan.md') continue;
    if (name === 'design.md') { ensure(bytes.toString('utf8').trim(), `docs/${prefix}design.md must contain the design it records.`); continue; }
    if (name.startsWith('historical/')) { ensure(legacy.has(name), `docs/${prefix}${name} needs exact imported-file provenance.`); continue; }
    if (name.startsWith('snapshots/')) {
      ensure(/\.(md|txt)$/.test(name), `docs/${prefix}${name}: snapshots keep authored .md/.txt documents; raw or binary output stays ignored.`);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const binaryControls = Array.from(text).some((character) => {
        const code = character.charCodeAt(0);
        return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
      });
      ensure(text.trim() && !binaryControls, `docs/${prefix}${name} needs nonempty UTF-8 document text without binary control bytes.`);
      continue;
    }
    ensure(name.startsWith('reviews/'), `docs/${prefix}${name} is outside plan.md, design.md, reviews/, snapshots/, or historical/.`);
    const match = roundPattern.exec(name.slice('reviews/'.length));
    ensure(match, `docs/${prefix}${name} needs reviews/<round>_<stage>.md with a supported stage.`);
    ensure(bytes.toString('utf8').trim(), `docs/${prefix}${name} is empty; retain only actual review rounds.`);
    rounds.push(Number(match[1]));
    if (legacy.get(name)?.sha256 !== digest(bytes)) {
      sections(bytes.toString('utf8'), reviewSections, prefix + name);
      if (match[2] === 'design') requiredFile(files, prefix + 'design.md');
    }
  }
  rounds.sort((a, b) => a - b).forEach((round, index) => ensure(round === index, `docs/${prefix} review rounds must be contiguous from 0; expected ${index}, found ${round}.`));
  return rawExceptions;
}

export function validateWorkDocs(files: Files, directories: ReadonlySet<string>, readSource?: (source: string) => Buffer): string[] {
  try {
    for (const name of [...files.keys(), ...directories]) ensure(safePath(name), `Invalid docs path ${name}; paths must stay within docs/.`);
    ensure(['threads', 'reviews'].every((root) => !directories.has(root) && !files.has(root)), 'Legacy docs/threads and docs/reviews roots must be fully migrated to docs/work.');
    const allocations = parseRegistry(requiredFile(files, 'work/registry.json'));
    ensure(requiredFile(files, 'work/.gitattributes').equals(Buffer.from('* -text\n')), 'docs/work/.gitattributes must contain exactly "* -text" and a final LF to preserve stored bytes.');
    const expected = new Set(allocations.map((entry) => `${entry.id}_${entry.theme}`));
    for (const directory of directories) {
      if (!directory.startsWith('work/')) continue;
      const parts = directory.split('/');
      ensure(expected.has(parts[1]), `docs/${directory} has no matching registry allocation.`);
      if (parts.length > 2) ensure(['reviews', 'historical', 'snapshots'].includes(parts[2]), `docs/${directory} is not a supported work-document category.`);
      if (parts[2] === 'reviews') ensure(parts.length === 3, `docs/${directory}: review rounds are files directly inside reviews/.`);
    }
    for (const name of files.keys()) {
      if (!name.startsWith('work/')) continue;
      if (['work/registry.json', 'work/.gitattributes'].includes(name)) continue;
      ensure(expected.has(name.split('/')[1]) && name.split('/').length > 2, `docs/${name} has no matching work allocation or category.`);
    }
    const exceptions = new Set(allocations.flatMap((allocation) => [...unit(files, allocation, readSource)]));
    for (const name of files.keys()) ensure(!rawPath(name) || exceptions.has(name), `docs/${name} is raw review or error-log output; keep new captures under an ignored path.`);
    for (const directory of directories) {
      if (!rawPath(directory)) continue;
      const children = [...files.keys()].filter((file) => file.startsWith(directory + '/'));
      ensure(children.length && children.every((file) => exceptions.has(file)), `docs/${directory} is a raw artifact directory without exact already-tracked historical inputs.`);
    }
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

export function validateGitAttributes(output: string, paths: string[]): string[] {
  const fields = output.split('\0');
  const seen = new Map<string, Set<string>>();
  const errors: string[] = [];
  const expected = new Set(paths);
  const attributes = ['text', 'filter', 'working-tree-encoding', 'ident'];
  for (let i = 0; i + 2 < fields.length; i += 3) {
    const [file, attribute, value] = fields.slice(i, i + 3);
    if (!expected.has(file) || !attributes.includes(attribute)) { errors.push(`Unexpected Git attribute measurement for ${file}:${attribute}.`); continue; }
    const measured = seen.get(file) ?? new Set<string>();
    if (measured.has(attribute)) errors.push(`Duplicate Git attribute measurement for ${file}:${attribute}.`);
    measured.add(attribute); seen.set(file, measured);
    if (attribute === 'text' ? value !== 'unset' : !['unset', 'unspecified'].includes(value)) errors.push(`${file} has effective ${attribute}=${value}; disable this byte transformation for docs/work.`);
  }
  for (const file of paths) {
    if (seen.get(file)?.size !== attributes.length) errors.push(`${file} lacks a complete Git attribute measurement; run git check-attr for every work file.`);
  }
  if (!paths.length) errors.push('No work files were measured; the byte-preservation check did not run.');
  return errors;
}
