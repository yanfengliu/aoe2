// How a workflow file asks for a run on a push to main: the `on.push` block
// read out of the YAML at the commit being judged, and GitHub's `paths` filter
// applied to the files that commit changed. Pure functions over text, split
// out of scripts/ci-status.mjs (which re-exports them) when that file reached
// the 500-line budget; ci-status.mjs is the only caller.

function yamlRows(text) {
  return text
    .split(/\r?\n/)
    .map((raw) => ({ indent: raw.length - raw.trimStart().length, text: raw.trim() }))
    .filter((row) => row.text && !row.text.startsWith('#'));
}

function blockRange(rows, headerIndex) {
  const base = rows[headerIndex].indent;
  let end = headerIndex + 1;
  while (end < rows.length && rows[end].indent > base) end += 1;
  return [headerIndex + 1, end];
}

function findChild(rows, headerIndex, key) {
  const [start, end] = blockRange(rows, headerIndex);
  if (start >= end) return -1;
  let childIndent = Infinity;
  for (let i = start; i < end; i += 1) childIndent = Math.min(childIndent, rows[i].indent);
  for (let i = start; i < end; i += 1) {
    if (rows[i].indent === childIndent && rows[i].text.replace(/:.*$/, '') === key) return i;
  }
  return -1;
}

// `{ parsed: false }` means we did not understand the file, and that is NOT the
// same as "no filter": an unparsed trigger makes a missing run UNGATED and
// loud, because a filter we half-understand would answer "never asked" for a
// commit that was in fact never checked.
export function parsePushTrigger(text) {
  const rows = yamlRows(text);
  const name = /^name:\s*(.+)$/m.exec(text)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
  const onAt = rows.findIndex((row) => row.indent === 0 && row.text === 'on:');
  if (onAt === -1) return { name, parsed: false };
  const pushAt = findChild(rows, onAt, 'push');
  if (pushAt === -1) return { name, parsed: true, hasPush: false, paths: [] };
  if (rows[pushAt].text !== 'push:') return { name, parsed: false };
  // Only `branches` and a block-style `paths` list are read. Any other key
  // (`paths-ignore`, `tags`, `branches-ignore`) is a filter this parser would
  // otherwise report as "no filter", so the whole trigger is refused instead.
  const [pushStart, pushEnd] = blockRange(rows, pushAt);
  const pushIndent = Math.min(...rows.slice(pushStart, pushEnd).map((row) => row.indent));
  for (let i = pushStart; i < pushEnd; i += 1) {
    if (rows[i].indent !== pushIndent) continue;
    const key = rows[i].text.replace(/:.*$/, '');
    if (key !== 'branches' && key !== 'paths') return { name, parsed: false };
  }
  const pathsAt = findChild(rows, pushAt, 'paths');
  if (pathsAt === -1) return { name, parsed: true, hasPush: true, paths: null };
  if (rows[pathsAt].text !== 'paths:') return { name, parsed: false };
  const [start, end] = blockRange(rows, pathsAt);
  const paths = [];
  for (let i = start; i < end; i += 1) {
    const item = /^-\s*(.+)$/.exec(rows[i].text);
    if (!item) return { name, parsed: false };
    paths.push(item[1].trim().replace(/^['"]|['"]$/g, ''));
  }
  return { name, parsed: true, hasPush: true, paths };
}

// GitHub's filter syntax minus the parts these workflows do not use. A pattern
// with `!`, a character class or a brace group is REFUSED (null) rather than
// approximated, for the reason above.
export function globToRegExp(pattern) {
  if (/[![\]{}+]/.test(pattern)) return null;
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 1;
    } else if (ch === '*') {
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += ch.replace(/[.\\^$()|]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesFilter(files, paths) {
  if (paths === null) return { due: true, matched: [] };
  const matched = [];
  for (const pattern of paths) {
    const re = globToRegExp(pattern);
    if (re === null) return { due: true, matched: [], unparsed: pattern };
    for (const file of files) if (re.test(file)) matched.push(`${file} (${pattern})`);
  }
  return { due: matched.length > 0, matched };
}
