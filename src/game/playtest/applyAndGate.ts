// Phase-6.E.1: shared `applyAndGate` helper.
//
// Takes a unified-diff patch, applies it on a fresh branch, runs the
// repository gates, and reports success / which gate failed. On any
// gate failure, cleanly reverts the working tree so the caller can
// roll forward without manual cleanup.
//
// Keeps the spawn / git work behind a callable function so both the
// auto-fix runner (Phase-6.E.1) and the existing `propose-fix.mjs`
// can share the validate+apply+gate pipeline. Gate execution is
// CWD-relative; the caller is responsible for pwd discipline.
//
// All shell I/O routes through a `runFn` injection point so unit
// tests can verify the pipeline without forking real subprocesses.

export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type RunCommandFn = (
  cmd: string,
  args: readonly string[],
  options?: { stdin?: string },
) => Promise<RunCommandResult>;

export interface ApplyAndGateInput {
  /** Unified-diff text to apply via `git apply`. */
  patch: string;
  /** Optional branch to create + check out before applying. When
   *  undefined, the patch is applied on the current branch (caller
   *  is responsible for ensuring this is what they want). */
  branchName?: string;
  /** Gates to run after a successful apply, in order. Each is a
   *  `{ cmd, args }` pair. Stops on first failure. */
  gates: Array<{ cmd: string; args: readonly string[] }>;
  /** Subprocess runner. Tests pass a stub. */
  runFn: RunCommandFn;
  /** Refuse to apply when the working tree is dirty. Default true.
   *  Set false in tests. */
  enforceCleanWorktree?: boolean;
  /** Commit message for the post-gate-pass commit. When supplied
   *  AND `branchName` was provided AND all gates pass, the helper
   *  runs `git add -A && git commit -m <message>` so the branch is
   *  push-ready and counterfactual re-runs see a committed fix.
   *  When undefined, the worktree is left dirty post-success — the
   *  caller is responsible for any commit. (Codex impl-1 H1.) */
  commitMessage?: string;
  /** H9 (security): when false (default) a patch that touches gate-executing
   *  or dependency-surface files (package.json / lockfile / npm/CI config /
   *  git hooks) is REFUSED before apply — running the npm gates on such a
   *  patch would execute model-authored lifecycle scripts / altered build
   *  config with the operator's privileges, before any human review. Set true
   *  only for a human-supervised caller that has already reviewed the diff. */
  allowSensitivePaths?: boolean;
}

// H9: files whose modification lets a model-authored patch EXECUTE code when the
// gates run (npm lifecycle scripts, altered build/test config, CI, git hooks) or
// change the resolved dependency graph. A recursive/auto-fix patch touching any
// of these is refused — such a change must go through human review, not the loop.
// Patterns are CASE-INSENSITIVE: the loop runs on Windows/macOS, whose default
// filesystems are case-insensitive, so `git apply` of `--- a/Vite.config.ts`
// writes the real `vite.config.ts`. A case-sensitive classifier was a complete
// bypass (iter-4 review, confirmed by both CLIs with a live git-apply repro).
const SENSITIVE_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)package\.json$/i,
  /(^|\/)package-lock\.json$/i,
  /(^|\/)npm-shrinkwrap\.json$/i,
  /(^|\/)yarn\.lock$/i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.github\/workflows\//i,
  /(^|\/)\.husky\//i,
  /(^|\/)(vite|vitest|playwright|eslint|jest|rollup|webpack|babel|tsconfig)[^/]*\.(c?[jt]s|json|mjs|cjs)$/i,
];

// Normalize a path parsed from a diff header so the classifier sees the same
// string `git apply` will actually write. Hand-rolled diff parsing drifts from
// git in ways a malicious patch can weaponize: a trailing CR (CRLF headers) left
// every `$`-anchored pattern unmatched for EVERY path, and a `\t<timestamp>`
// suffix mangled the tail. Both are stripped here. (Quoted `"a/…"` headers are
// NOT a vector for the plain-named sensitive set — git only c-quotes paths with
// special chars, which none of these files can have and still be loaded by the
// toolchain. A fuller hardening would derive the touched set from
// `git apply --numstat --summary` to erase parser drift entirely.)
function normalizePatchPath(raw: string): string {
  return raw
    .replace(/\r$/, '')
    .replace(/\t.*$/, '')
    .trim()
    .replace(/^\.\//, '');
}

// Parse the file paths a unified diff touches (both a/ and b/ sides), so a
// rename/add/delete of a sensitive file is caught, not just an edit.
export function patchTouchedPaths(patch: string): string[] {
  const paths = new Set<string>();
  for (const rawLine of patch.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const gitHeader = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (gitHeader) {
      paths.add(normalizePatchPath(gitHeader[1]!));
      paths.add(normalizePatchPath(gitHeader[2]!));
      continue;
    }
    const plus = /^\+\+\+ b\/(.+)$/.exec(line);
    if (plus) {
      const path = normalizePatchPath(plus[1]!);
      if (path !== '/dev/null') paths.add(path);
      continue;
    }
    const minus = /^--- a\/(.+)$/.exec(line);
    if (minus) {
      const path = normalizePatchPath(minus[1]!);
      if (path !== '/dev/null') paths.add(path);
    }
  }
  paths.delete('');
  return [...paths];
}

export function patchTouchesSensitivePaths(patch: string): string[] {
  return patchTouchedPaths(patch).filter((p) =>
    SENSITIVE_PATH_PATTERNS.some((re) => re.test(p)),
  );
}

// Parse the touched paths out of `git apply --numstat -z` — git's OWN parser,
// so it is the AUTHORITATIVE list of what a real `git apply` will write. `-z`
// emits NUL-separated records with UNQUOTED paths, so c-quoted `"a/…"` headers,
// CRLF headers, and case are already resolved exactly as git resolves them (the
// hand-rolled regex classifier above missed all three — each a confirmed
// complete bypass, proven with live `git apply`). Record format per file is
// `<added>\t<deleted>\t<path>` (a rename emits `<a>\t<d>\t` then the old and new
// paths as their own records), so the path is the segment after the last tab,
// or the whole record when it has no tab (a rename's old/new path).
export function parseNumstatPaths(numstatZOutput: string): string[] {
  const paths: string[] = [];
  for (const record of numstatZOutput.split('\0')) {
    if (record.length === 0) continue;
    const lastTab = record.lastIndexOf('\t');
    const path = lastTab >= 0 ? record.slice(lastTab + 1) : record;
    if (path.length > 0) paths.push(path);
  }
  return paths;
}

export type ApplyAndGateResult =
  | {
      kind: 'success';
      sha: string;
      gatePassThrough: Array<{ cmd: string; args: readonly string[]; result: RunCommandResult }>;
    }
  | {
      kind: 'apply-failed';
      message: string;
      stderr: string;
    }
  | {
      kind: 'gate-failed';
      gateThatFailed: { cmd: string; args: readonly string[] };
      result: RunCommandResult;
      reverted: boolean;
    }
  | {
      kind: 'precondition-failed';
      message: string;
    }
  | {
      kind: 'sensitive-patch-rejected';
      message: string;
      paths: string[];
    };

export async function applyAndGate(input: ApplyAndGateInput): Promise<ApplyAndGateResult> {
  const enforceClean = input.enforceCleanWorktree !== false;
  if (enforceClean) {
    const status = await input.runFn('git', ['status', '--porcelain']);
    if (status.exitCode !== 0) {
      return {
        kind: 'precondition-failed',
        message: `git status failed: ${status.stderr.trim() || `exit ${status.exitCode}`}`,
      };
    }
    if (status.stdout.trim().length > 0) {
      return {
        kind: 'precondition-failed',
        message: 'working tree is dirty; commit or stash before auto-applying patches',
      };
    }
  }

  // H9 (security): refuse a model-authored patch that touches gate-executing /
  // dependency-surface files BEFORE apply — running the gates on it would run
  // injected lifecycle scripts / altered build config with our privileges. Done
  // before branch creation so a rejected patch leaves no trace.
  //
  // Path detection uses git's OWN parser as the source of truth: `git apply
  // --numstat -z` reports exactly what a real apply would write (doesn't touch
  // the tree), so it resolves c-quoted / CRLF / mixed-case headers the way git
  // actually resolves them. The regex classifier is kept as defense-in-depth
  // (covers a patch --numstat can't parse but a later apply might still write);
  // we reject on the UNION, so a hit from EITHER source is fatal.
  if (!input.allowSensitivePaths) {
    const numstat = await input.runFn('git', ['apply', '--numstat', '-z', '-'], { stdin: input.patch });
    const gitTouchedSensitive = (numstat.exitCode === 0 ? parseNumstatPaths(numstat.stdout) : [])
      .filter((p) => SENSITIVE_PATH_PATTERNS.some((re) => re.test(p)));
    const sensitive = [...new Set([...gitTouchedSensitive, ...patchTouchesSensitivePaths(input.patch)])];
    if (sensitive.length > 0) {
      return {
        kind: 'sensitive-patch-rejected',
        message:
          'patch touches gate-executing / dependency-surface files; refusing to '
          + 'auto-apply model-authored code (requires human review): '
          + sensitive.join(', '),
        paths: sensitive,
      };
    }
  }

  // Branch: create if requested. Failure to create is precondition-failed
  // (branch already exists, or git is in a bad state).
  if (input.branchName) {
    const checkout = await input.runFn('git', ['checkout', '-b', input.branchName]);
    if (checkout.exitCode !== 0) {
      return {
        kind: 'precondition-failed',
        message: `git checkout -b ${input.branchName} failed: ${checkout.stderr.trim() || `exit ${checkout.exitCode}`}`,
      };
    }
  }

  // Validate the patch via --check before applying. Cheap, surfaces
  // the actual reason for the failure rather than letting the apply
  // partially mutate the tree.
  const check = await input.runFn(
    'git',
    ['apply', '--check', '-'],
    { stdin: input.patch },
  );
  if (check.exitCode !== 0) {
    return {
      kind: 'apply-failed',
      message: 'git apply --check rejected the patch',
      stderr: check.stderr,
    };
  }
  const apply = await input.runFn('git', ['apply', '-'], { stdin: input.patch });
  if (apply.exitCode !== 0) {
    return {
      kind: 'apply-failed',
      message: 'git apply failed despite --check passing (worktree may be partially modified)',
      stderr: apply.stderr,
    };
  }

  const passThrough: Array<{ cmd: string; args: readonly string[]; result: RunCommandResult }> = [];
  for (const gate of input.gates) {
    const result = await input.runFn(gate.cmd, gate.args);
    passThrough.push({ cmd: gate.cmd, args: gate.args, result });
    if (result.exitCode !== 0) {
      // Hard-revert the worktree + index so the next iteration starts
      // clean. `git reset --hard HEAD` covers both staged + unstaged
      // changes (Codex impl-2 H2: `git checkout -- .` only restores
      // worktree from index, leaving any staged patch alive); `git
      // clean -fd` sweeps any untracked files the patch created
      // (Claude impl-1 H2). `reverted: true` requires both succeed.
      const revert = await input.runFn('git', ['reset', '--hard', 'HEAD']);
      const clean = await input.runFn('git', ['clean', '-fd']);
      const reverted = revert.exitCode === 0 && clean.exitCode === 0;
      return {
        kind: 'gate-failed',
        gateThatFailed: { cmd: gate.cmd, args: gate.args },
        result,
        reverted,
      };
    }
  }

  // Codex impl-1 H1: optionally commit the patch so the branch is
  // push-ready and counterfactual re-runs see a clean tree with a
  // committed fix. Without this step the worktree stays dirty;
  // counterfactual playtest:llm runs would see the patch but downstream
  // git operations (push, branch checkout) would fail or leak.
  if (input.branchName && input.commitMessage) {
    const stage = await input.runFn('git', ['add', '-A']);
    if (stage.exitCode !== 0) {
      return {
        kind: 'precondition-failed',
        message: `git add -A failed after gates passed: ${stage.stderr.trim() || `exit ${stage.exitCode}`}`,
      };
    }
    const commit = await input.runFn('git', ['commit', '-m', input.commitMessage]);
    if (commit.exitCode !== 0) {
      return {
        kind: 'precondition-failed',
        message: `git commit failed after gates passed: ${commit.stderr.trim() || `exit ${commit.exitCode}`}`,
      };
    }
  }

  // Capture HEAD SHA for the caller (PR creation, log line, etc).
  const head = await input.runFn('git', ['rev-parse', 'HEAD']);
  const sha = head.exitCode === 0 ? head.stdout.trim() : '(unknown)';
  return { kind: 'success', sha, gatePassThrough: passThrough };
}
