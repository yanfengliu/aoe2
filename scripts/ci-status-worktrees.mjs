// The local half of `npm run ci:status`: worktrees of this repo left on this machine after their work merged.
//
// WHY. On 2026-11-04 the coordinator's repo review found 18 worktrees besides the primary checkout, every HEAD merged
// into main and idle for 4 to 34 days, 15 of them holding uncommitted work that main lacked. The command every
// session runs first read only the remote gates, so nothing had listed them (docs/learning/defect-register.md,
// 2026-11-04; work 138). A session that stops before its last step leaves its worktree, and this is where the next
// session hears of it.
//
// A LEFTOVER is a registered worktree, other than the primary checkout and the caller's own, whose HEAD main contains
// and that has had no activity for 24 hours. Activity is the newest mtime among its non-ignored files and folders,
// empty ones included (a deletion or a rename shows only on its folder), its index, its HEAD, its HEAD reflog and its
// branch's reflog. ci-status.mjs exits 2 when there is one and the remote gates are not red; a red remote gate keeps
// exit 1 and the leftovers are still printed. A check that cannot finish says UNKNOWN and fails the same way.
//
// Reported, never failing: an idle worktree whose HEAD main lacks (unfinished work), a worktree locked with a reason
// (`git worktree lock --reason`; a lock with no reason exempts nothing), a registered worktree whose folder is gone,
// a folder under ../<repo>-worktrees that git does not list, and each retained/* branch with the open plans
// (docs/work/*/plan.md, Status planned, active or blocked) that name it.
//
// READ-ONLY. Every git call passes --no-optional-locks. A plain `git status` rewrites the index of the worktree it
// reads, and an index write is activity here, so a check without that flag would make every worktree it read look
// active for a day: the coordinator's plain-status audit of 2026-11-04 rewrote two of the 18 indexes. Nothing here
// writes a file. tests/scripts/ciStatusWorktrees.test.ts holds all of this on sandboxed repositories.
//
// BOUND. Mtimes are the evidence. A write that keeps an old mtime, or a clock set back, reads as idle; any index
// write, including someone else's plain `git status`, reads as activity for 24 hours; a process that works in a
// worktree without writing a non-ignored file (a dev server, a reader) is not seen. Ignored files are not read, except
// where creating one changes the mtime of a non-ignored folder, and an ignored folder inside a wholly untracked one is
// read as one of its folders; both err toward activity. A branch counts as named by a plan where its whole name
// stands as a word of the plan's text. "Main" is the local refs/heads/main, as scripts/controlWorktree.mjs judges a
// removal.

import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export const IDLE_HOURS = 24;
const IDLE_MS = IDLE_HOURS * 3_600_000;
const MAIN = 'refs/heads/main';
const OPEN_PLAN = new Set(['planned', 'active', 'blocked']);
// Where a branch name ends in prose: whitespace, markdown and sentence punctuation, or a character git forbids in a
// ref name. Anything else (a letter, `-`, `+`, `/`, `.` before a letter) continues the name.
const EDGE = '[\\s`\'"()[\\]<>,;:|*?~^\\\\]';
const WIN = process.platform === 'win32';

const git = (args) => execFileSync('git', ['--no-optional-locks', ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
});
const gitIn = (dir, args) => git(['-C', dir, ...args]);

function reason(error) {
  const of = (value) => String(value ?? '').split('\n')[0].trim();
  return of(error?.stderr) || of(error?.message) || 'unknown error';
}

const shown = (path) => String(path).replace(/\\/g, '/');

function norm(path) {
  const s = shown(resolve(path)).replace(/\/+$/, '');
  return WIN ? s.toLowerCase() : s;
}

function samePath(a, b) {
  if (norm(a) === norm(b)) return true;
  try {
    return norm(realpathSync.native(a)) === norm(realpathSync.native(b));
  } catch {
    return false;
  }
}

function age(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'under a minute';
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} hours` : `${Math.floor(hours / 24)} days`;
}

// `git worktree list --porcelain -z`: records end in an empty field, fields in NUL. The first is the primary.
export function parseWorktreeList(text) {
  return text.split('\0\0').filter((record) => record.trim()).map((record) => {
    const wt = { path: '', head: null, branch: null, bare: false, locked: null, prunable: null };
    for (const field of record.split('\0')) {
      const space = field.indexOf(' ');
      const key = space < 0 ? field : field.slice(0, space);
      const value = space < 0 ? '' : field.slice(space + 1);
      if (key === 'worktree') wt.path = value;
      else if (key === 'HEAD') wt.head = value;
      else if (key === 'branch') wt.branch = value.replace(/^refs\/heads\//, '');
      else if (key === 'bare') wt.bare = true;
      else if (key === 'locked') wt.locked = value; // '' is a lock with no reason
      else if (key === 'prunable') wt.prunable = value || 'its folder is gone';
    }
    return wt;
  });
}

// A path that is gone counts for nothing: a deleted file shows on its folder. Any other failure is not a time, and
// the worktree is UNKNOWN rather than idle.
const mtime = (path) => {
  try {
    return lstatSync(path).mtimeMs;
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return 0;
    throw error;
  }
};

// Every folder from `rel` down, a wholly untracked one, read on disk without entering a link. An ignored folder in it
// counts too, which errs toward activity.
function subfolders(base, rel, into) {
  const stack = [rel];
  while (stack.length > 0) {
    const dir = stack.pop();
    into.add(dir);
    let entries = [];
    try {
      entries = readdirSync(join(base, dir), { withFileTypes: true });
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
    for (const entry of entries) if (entry.isDirectory() && !entry.isSymbolicLink()) stack.push(`${dir}/${entry.name}`);
  }
}

// The newest change among everything that counts as activity, in ms since the epoch. A deletion shows only on its
// folder, so every non-ignored folder is read: those that hold a listed file, the empty ones and the wholly untracked
// ones, which `--directory` lists with a trailing slash, and every folder inside the latter.
function lastActivity(wt) {
  const listed = gitIn(wt.path, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  const files = new Set(listed.split('\0').filter(Boolean));
  const folders = new Set(['.']);
  const withParents = (start) => {
    for (let dir = start; dir !== '.' && dir !== '' && !folders.has(dir); dir = dirname(dir)) folders.add(dir);
  };
  for (const file of files) withParents(dirname(file));
  for (const entry of gitIn(wt.path, ['ls-files', '-z', '--others', '--exclude-standard', '--directory']).split('\0')) {
    if (!entry.endsWith('/')) continue;
    withParents(dirname(entry.slice(0, -1)));
    subfolders(wt.path, entry.slice(0, -1), folders);
  }
  let newest = 0;
  for (const rel of [...files, ...folders]) newest = Math.max(newest, mtime(join(wt.path, rel)));
  const [gitDir, commonDir] = gitIn(wt.path, ['rev-parse', '--absolute-git-dir', '--git-common-dir'])
    .split(/\r?\n/).map((line) => resolve(wt.path, line.trim()));
  const admin = [join(gitDir, 'index'), join(gitDir, 'HEAD'), join(gitDir, 'logs', 'HEAD')];
  if (wt.branch) admin.push(join(commonDir, 'logs', 'refs', 'heads', ...wt.branch.split('/')));
  for (const path of admin) newest = Math.max(newest, mtime(path));
  return newest;
}

function uncommitted(wt) {
  const fields = gitIn(wt.path, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'])
    .split('\0').filter(Boolean);
  let staged = 0;
  let modified = 0;
  let untracked = 0;
  for (const field of fields) {
    const [x, y] = [field[0], field[1]];
    if (x === '?' && y === '?') untracked += 1;
    else {
      if (x !== ' ') staged += 1;
      if (y !== ' ') modified += 1;
    }
  }
  return `${staged} staged, ${modified} modified, ${untracked} untracked`;
}

function inMain(own, head) {
  try {
    gitIn(own, ['merge-base', '--is-ancestor', head, MAIN]);
    return true;
  } catch (error) {
    if (error?.status === 1) return false;
    throw error;
  }
}

function openPlans(own) {
  const root = join(own, 'docs', 'work');
  const plans = [];
  let folders = [];
  try {
    folders = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return plans;
  }
  for (const folder of folders) {
    let text;
    try {
      text = readFileSync(join(root, folder, 'plan.md'), 'utf8');
    } catch {
      continue;
    }
    const status = /^Status:\s*(\S+)/m.exec(text)?.[1]?.toLowerCase();
    if (OPEN_PLAN.has(status)) plans.push({ folder, text });
  }
  return plans;
}

function retainedLines(own) {
  const names = gitIn(own, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/retained/'])
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (names.length === 0) return [];
  const plans = openPlans(own);
  const named = [];
  const unnamed = [];
  for (const name of names) {
    // The whole name, as a word of prose or markdown: not inside a longer one (`other/retained/x`, `retained/x-v2`,
    // `retained/x+next`, `retained/x.y`), though `refs/heads/retained/x` names it. A branch name never ends in a dot,
    // so a dot that ends a sentence still counts.
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`(?<=^|${EDGE}|refs/heads/)${escaped}(?=$|${EDGE}|\\.(?:$|${EDGE}))`, 'm');
    const by = plans.filter((plan) => exact.test(plan.text)).map((plan) => plan.folder);
    if (by.length > 0) named.push(`${name} (${by.join(', ')})`);
    else unnamed.push(name);
  }
  const lines = [];
  if (named.length > 0) lines.push(`  retained/* branches named by an open plan (${named.length}): ${named.join(', ')}.`);
  if (unnamed.length > 0) {
    lines.push(`  retained/* branches no open plan names (${unnamed.length}): ${unnamed.join(', ')}.`
      + ' Each needs a decision, to land it or to drop it.');
  }
  return lines;
}

// Entries of ../<repo>-worktrees that no registered worktree is.
function unlistedFolders(primary, list) {
  const home = join(dirname(primary), `${basename(primary)}-worktrees`);
  let entries;
  try {
    entries = readdirSync(home, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.map((entry) => join(home, entry.name)).filter((path) => !list.some((wt) => samePath(wt.path, path)))
    .map((path) => `  not a registered worktree (reported, not failing): ${shown(path)}. Git does not list it, so`
      + ' controlWorktree.mjs cannot remove it; see what it holds before anyone deletes it.');
}

const UNKNOWN_CLOSING = 'Exit 2: the worktree check could not finish (above). Remote CI is not what failed.';

const RETIRE = '  To retire a leftover: keep anything only it holds on a commit first (a branch of its own, as work 138 did'
  + ' with retained/<name>), then run `node scripts/controlWorktree.mjs remove <path>`, with --dry-run first and'
  + ' --discard-changes only once that commit holds the changes. One that is still in use is kept by'
  + ' `git worktree lock --reason "<why>" <path>`, which exempts it.';
const NO_REASON = ' It is locked with no reason, which exempts nothing: `git worktree unlock` it to retire it, or lock it'
  + ' again with --reason.';

// One registered worktree that is neither the primary nor the caller's: which list it goes on, and its line.
function judge(own, wt, now) {
  const label = `${shown(wt.path)} [${wt.branch ?? `detached at ${String(wt.head).slice(0, 8)}`}]`;
  if (wt.prunable !== null) {
    return ['reported', `  registered but its folder is gone (reported, not failing): ${label}: ${wt.prunable};`
      + ' `git worktree prune` clears it.'];
  }
  if (wt.locked) return ['reported', `  exempt, locked with a reason: ${label}: "${wt.locked}".`];
  try {
    const idleMs = now - lastActivity(wt);
    if (idleMs < IDLE_MS) return ['reported', `  active: ${label}: last change ${age(idleMs)} ago.`];
    const state = `idle ${age(idleMs)}; HEAD ${String(wt.head).slice(0, 8)}`;
    if (inMain(own, wt.head)) {
      return ['leftover', `  LEFTOVER ${label}: ${state} is in main; uncommitted: ${uncommitted(wt)}.`
        + (wt.locked === '' ? NO_REASON : '')];
    }
    return ['reported', `  idle, HEAD not in main (unfinished work; reported, not failing): ${label}: ${state} is not`
      + ` in main; uncommitted: ${uncommitted(wt)}.`];
  } catch (error) {
    return ['unknown', `  UNKNOWN ${label}: could not read it (${reason(error)}).`];
  }
}

/**
 * Judges the worktrees of the repository the working directory is in.
 * @returns {{ lines: string[], failing: boolean, closing: string | null }} `closing` is the last line when failing
 */
export function worktreeCheck() {
  const now = Date.now();
  let own;
  let list;
  try {
    own = git(['rev-parse', '--show-toplevel']).trim();
    list = parseWorktreeList(gitIn(own, ['worktree', 'list', '--porcelain', '-z']));
    if (list.length === 0) throw new Error('git listed no worktree, not even the primary checkout');
  } catch (error) {
    return {
      lines: [`Worktrees: UNKNOWN — could not list this repo's worktrees (${reason(error)}).`],
      failing: true,
      closing: UNKNOWN_CLOSING,
    };
  }
  const found = { leftover: [], unknown: [], reported: [] };
  for (const wt of list.slice(1)) {
    if (samePath(wt.path, own)) continue;
    const [kind, line] = judge(own, wt, now);
    found[kind].push(line);
  }
  for (const [what, extra] of [['the folders beside the primary', () => unlistedFolders(list[0].path, list)],
    ['the retained/* branches', () => retainedLines(own)]]) {
    try {
      found.reported.push(...extra());
    } catch (error) {
      found.unknown.push(`  UNKNOWN: could not read ${what} (${reason(error)}).`);
    }
  }
  const leftovers = found.leftover.length;
  const exempt = samePath(own, list[0].path) ? 'the primary checkout, which is this checkout, is never counted'
    : 'the primary checkout and this checkout are never counted';
  let head = `Worktrees: no leftover among ${list.length} registered (${exempt}).`;
  if (leftovers > 0) {
    head = `Worktrees: ${leftovers} LEFTOVER${leftovers === 1 ? ' — a worktree' : 'S — worktrees'} whose HEAD main`
      + ` contains, with no activity for ${IDLE_HOURS} hours (${exempt}).`;
  } else if (found.unknown.length > 0) head = 'Worktrees: UNKNOWN — the check could not read everything it needs.';
  const lines = [head, ...found.leftover, ...(leftovers > 0 ? [RETIRE] : []), ...found.unknown, ...found.reported];
  if (leftovers === 0 && found.unknown.length === 0) return { lines, failing: false, closing: null };
  return {
    lines,
    failing: true,
    closing: leftovers > 0 ? 'Exit 2: leftover worktrees on this machine (above). Remote CI is not what failed.'
      : UNKNOWN_CLOSING,
  };
}
