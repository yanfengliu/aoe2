// The logic behind scripts/verify-receipt.mjs, whose header is the documentation. It lives apart from the command
// so that a test can import it while the command runs `main` unconditionally: a "was I run directly?" guard
// compares two spellings of the script's path, and through a junction they differ, so the guarded command
// exited 0 having done nothing (review of work 124, finding 2).

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const RECEIPT = 'tmp/verify-receipt.json';
export const START_RECORD = 'tmp/verify-receipt.start.json';
const FORMAT = 1;
const HASH = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const DOCS_CHECK = 'npx vitest run tests/architecture';
const USAGE = 'usage: node scripts/verify-receipt.mjs start | write | check [<rev>]';

/**
 * Whether a change to this repository-relative path leaves the gate's verdict on code standing.
 * @param {string} path
 * @returns {boolean}
 */
export function isDocsOnlyPath(path) {
  return path.startsWith('docs/') || path === 'design/spec-final.md';
}

class Refusal extends Error {}

/** @param {string[]} args @param {{ cwd: string, env: NodeJS.ProcessEnv }} ctx */
function git(args, ctx) {
  const r = spawnSync('git', ['--no-optional-locks', ...args], { cwd: ctx.cwd, env: ctx.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw new Refusal(`could not run git ${args.join(' ')} in ${ctx.cwd}: ${r.error.message}`);
  if (r.status !== 0) throw new Refusal(`git ${args.join(' ')} failed in ${ctx.cwd} (exit ${String(r.status)}): ${r.stderr.trim()}`);
  return r.stdout;
}

// Every later git call runs at the top of the checkout, whatever directory the command was started in.
function head(ctx) {
  const [top, commit, tree] = git(['rev-parse', '--show-toplevel', 'HEAD', 'HEAD^{tree}'], ctx).trim().split(/\r?\n/);
  return { top, commit, tree, at: { ...ctx, cwd: top } };
}

// Every path `git status` reports, ignored files aside: changed, staged, unmerged and untracked. From porcelain v1
// with -z, "XY path", where a rename or a copy adds its source.
function dirtyPaths(ctx) {
  const fields = git(['status', '--porcelain=v1', '-z', '--untracked-files=normal'], ctx).split('\0');
  const dirty = [];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (!field) continue;
    const status = field.slice(0, 2);
    if (status === '??') {
      dirty.push(`${field.slice(3)} (untracked)`);
      continue;
    }
    dirty.push(field.slice(3));
    if (/[RC]/.test(status)) {
      i += 1;
      dirty.push(fields[i]);
    }
  }
  return dirty;
}

// Plumbing, so no diff setting in anyone's config (diff.relative, say) can hide a path.
function changedPaths(ctx, fromTree, toTree) {
  const paths = git(['diff-tree', '-r', '--name-only', '-z', '--no-renames', fromTree, toTree], ctx).split('\0').filter(Boolean);
  if (fromTree !== toTree && !paths.length) {
    throw new Refusal(`trees ${fromTree} and ${toTree} differ, yet git listed no changed path between them, so the receipt cannot be compared.`);
  }
  return paths;
}

const short = (hash) => hash.slice(0, 12);
const list = (paths) => (paths.length <= 10 ? paths.join(', ') : `${paths.slice(0, 10).join(', ')} and ${String(paths.length - 10)} more`);

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.partial`;
  writeFileSync(partial, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(partial, path);
}

/**
 * Why a recorded run does not certify its tree; empty when it does.
 * @param {{ tree: string, commit: string, endTree: string, endCommit: string, dirtyAtStart: string[], dirtyAtEnd: string[], movedPaths: string[] }} r
 * @returns {string[]}
 */
export function refusalsOf(r) {
  const out = [];
  if (r.dirtyAtStart.length) out.push(`the checkout did not match HEAD when the gate started: ${list(r.dirtyAtStart)}`);
  if (r.dirtyAtEnd.length) out.push(`the checkout did not match HEAD when the gate finished: ${list(r.dirtyAtEnd)}`);
  if (r.endTree !== r.tree) {
    out.push(`HEAD's tree moved while the gate ran, from ${short(r.tree)} (commit ${short(r.commit)}) to ${short(r.endTree)} `
      + `(commit ${short(r.endCommit)}), changing ${list(r.movedPaths)}`);
  }
  return out;
}

function start(ctx) {
  const { top, commit, tree, at } = head(ctx);
  const receipt = join(top, RECEIPT);
  try {
    rmSync(receipt, { force: true });
  } catch (error) {
    throw new Refusal(`could not remove the last receipt, ${receipt} (${error.message}), so this run could leave it standing. `
      + 'Close whatever holds the file and run `npm run verify` again.');
  }
  const dirty = dirtyPaths(at);
  writeJson(join(top, START_RECORD), { format: FORMAT, commit, tree, dirty, startedAt: new Date().toISOString() });
  const lines = [`verify-receipt: the gate starts on tree ${short(tree)} (commit ${short(commit)}); ${RECEIPT} is removed until it finishes.`];
  if (dirty.length) {
    lines.push(`verify-receipt: the checkout does not match HEAD, so this run cannot earn a receipt: ${list(dirty)}.`);
  }
  return { code: 0, out: lines.join('\n') };
}

function write(ctx) {
  const event = ctx.env.npm_lifecycle_event;
  if (event !== 'verify') {
    throw new Refusal(`write runs only as the last step of \`npm run verify\` (npm_lifecycle_event is ${JSON.stringify(event ?? null)}, `
      + 'not "verify"), because a receipt says that every step before it passed. No receipt was written. Run `npm run verify`.');
  }
  const { top, commit, tree, at } = head(ctx);
  const startPath = join(top, START_RECORD);
  let started;
  try {
    started = JSON.parse(readFileSync(startPath, 'utf8'));
  } catch (error) {
    throw new Refusal(`no readable start record at ${startPath} (${error.code ?? error.message}): \`npm run verify\` must begin with `
      + '`node scripts/verify-receipt.mjs start`, and nothing may remove the record while the gate runs. No receipt was written.');
  }
  if (started?.format !== FORMAT || !HASH.test(started.tree ?? '') || !HASH.test(started.commit ?? '') || !Array.isArray(started.dirty)) {
    throw new Refusal(`${startPath} is not a start record this script wrote. No receipt was written. Run \`npm run verify\` again.`);
  }
  const receipt = {
    format: FORMAT,
    tree: started.tree,
    commit: started.commit,
    endTree: tree,
    endCommit: commit,
    dirtyAtStart: started.dirty,
    dirtyAtEnd: dirtyPaths(at),
    movedPaths: started.tree === tree ? [] : changedPaths(at, started.tree, tree),
    startedAt: started.startedAt,
    finishedAt: new Date().toISOString(),
    script: ctx.env.npm_lifecycle_script ?? null,
  };
  writeJson(join(top, RECEIPT), receipt);
  rmSync(startPath, { force: true });
  const refusals = refusalsOf(receipt);
  // Exit 0 all the same: the exit code of `npm run verify` keeps saying whether every stage exited 0, which is what
  // a run on uncommitted work before a commit asks, and `check` is what a landing asks.
  if (refusals.length) {
    return {
      code: 0,
      err: `verify-receipt: NOT CERTIFIED. Every stage before this step exited 0, but ${refusals.join('; and ')}. `
        + `${RECEIPT} records this, and \`check\` refuses it: a receipt names one committed tree. Before a landing, commit, `
        + 'discard or ignore those files, commit nothing in this checkout while the gate runs, and run `npm run verify` again.',
    };
  }
  return { code: 0, out: `verify-receipt: wrote ${RECEIPT}: \`npm run verify\` reached its last step on tree ${short(tree)} (commit ${short(commit)}).` };
}

function readReceipt(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Refusal(`cannot read ${path}: ${error.message}`);
    throw new Refusal(`REFUSED. No receipt at ${path}. \`npm run verify\` writes one as its last step, after every other step `
      + 'has exited 0, and its first step removes the last one. So none means the last run in this checkout was cut short, '
      + 'failed or never ran, and a run cut short can still exit 0 (docs/learning/defect-register.md, 2026-10-11). '
      + 'Run `npm run verify` on the commit you push, and let it finish.');
  }
  let receipt;
  try {
    receipt = JSON.parse(text);
  } catch (error) {
    throw new Refusal(`REFUSED. ${path} is not valid JSON (${error.message}). Run \`npm run verify\` to write a new receipt.`);
  }
  const problems = [];
  if (receipt?.format !== FORMAT) problems.push(`format ${JSON.stringify(receipt?.format ?? null)}, where this script reads ${String(FORMAT)}`);
  for (const key of ['tree', 'commit', 'endTree', 'endCommit']) {
    if (!HASH.test(receipt?.[key] ?? '')) problems.push(`${key} ${JSON.stringify(receipt?.[key] ?? null)}`);
  }
  for (const key of ['dirtyAtStart', 'dirtyAtEnd', 'movedPaths']) {
    if (!Array.isArray(receipt?.[key])) problems.push(`${key} is not a list`);
  }
  if (problems.length) {
    throw new Refusal(`REFUSED. ${path} is not a receipt this script wrote: ${problems.join('; ')}. Run \`npm run verify\` to write a new one.`);
  }
  return receipt;
}

function check(ctx, rev) {
  const top = git(['rev-parse', '--show-toplevel'], ctx).trim();
  const at = { ...ctx, cwd: top };
  const path = join(top, RECEIPT);
  const receipt = readReceipt(path);
  const refusals = refusalsOf(receipt);
  if (refusals.length) {
    throw new Refusal(`REFUSED. The last run of \`npm run verify\` in this checkout earned no receipt: ${refusals.join('; and ')}. `
      + 'Commit, discard or ignore those files, then run `npm run verify` again and commit nothing in this checkout while it runs.');
  }
  const resolved = spawnSync('git', ['--no-optional-locks', 'rev-parse', '--verify', '--quiet', `${rev}^{tree}`], { cwd: top, env: ctx.env, encoding: 'utf8' });
  const target = resolved.status === 0 ? resolved.stdout.trim() : '';
  if (!target) throw new Refusal(`REFUSED. ${JSON.stringify(rev)} does not name a commit in this repository, so there is no tree to compare the receipt with.`);
  const ran = `\`npm run verify\` reached its last step on tree ${short(receipt.tree)} (commit ${short(receipt.commit)}, finished ${String(receipt.finishedAt)})`;
  if (target === receipt.tree) return { code: 0, out: `verify-receipt: OK. ${ran}, and that is ${rev}'s tree.` };
  const changed = changedPaths(at, receipt.tree, target);
  const code = changed.filter((p) => !isDocsOnlyPath(p));
  if (code.length) {
    throw new Refusal(`REFUSED. ${ran}, but ${rev}'s tree is ${short(target)}, and ${String(code.length)} of the paths that differ `
      + `are outside docs/ and design/spec-final.md: ${list(code)}. Run \`npm run verify\` on this tree.`);
  }
  return {
    code: 0,
    out: `verify-receipt: OK. ${ran}. ${rev}'s tree ${short(target)} differs from it only in docs/ and design/spec-final.md: `
      + `${list(changed)}. Those files' own checks still apply: run \`${DOCS_CHECK}\` before the push.`,
  };
}

/**
 * @param {string[]} argv
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} ctx
 * @returns {{ code: number, out?: string, err?: string }}
 */
export function main(argv, ctx) {
  const [mode, ...rest] = argv;
  const arity = { start: 0, write: 0, check: 1 };
  if (!Object.hasOwn(arity, mode ?? '') || rest.length > arity[mode]) return { code: 2, err: `verify-receipt: ${USAGE}` };
  try {
    if (mode === 'start') return start(ctx);
    if (mode === 'write') return write(ctx);
    return check(ctx, rest[0] ?? 'HEAD');
  } catch (error) {
    if (error instanceof Refusal) return { code: 1, err: `verify-receipt: ${error.message}` };
    throw error;
  }
}
