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
