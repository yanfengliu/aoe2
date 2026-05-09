// Phase-6.E.1 unit tests for the shared applyAndGate helper.
//
// All shell I/O is mocked via the `runFn` injection point so tests
// don't touch the real working tree. The helper's contract:
//   - clean-worktree precondition fails fast.
//   - branch creation respected when supplied.
//   - patch validated via `--check` before apply.
//   - gates run in order, stop on first failure, hard-revert on fail.
//   - success returns HEAD sha + gate pass-through trace.

import { describe, it, expect } from 'vitest';
import {
  applyAndGate,
  type RunCommandFn,
  type RunCommandResult,
} from '../../src/game/playtest/applyAndGate';

interface RecordedCall {
  cmd: string;
  args: string[];
  stdin?: string;
}

function makeRunFn(
  responses: Array<{ match: { cmd: string; argsContains?: string[] }; result: RunCommandResult }>,
  recorded: RecordedCall[],
): RunCommandFn {
  return async (cmd, args, options) => {
    recorded.push({ cmd, args: [...args], stdin: options?.stdin });
    for (const r of responses) {
      if (r.match.cmd !== cmd) continue;
      if (r.match.argsContains) {
        const allMatch = r.match.argsContains.every((a) => args.includes(a));
        if (!allMatch) continue;
      }
      return r.result;
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
}

const OK: RunCommandResult = { exitCode: 0, stdout: '', stderr: '' };
const FAIL: RunCommandResult = { exitCode: 1, stdout: '', stderr: 'simulated failure' };

describe('applyAndGate', () => {
  it('returns precondition-failed on dirty worktree by default', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'git', argsContains: ['status'] }, result: { exitCode: 0, stdout: ' M file.ts\n', stderr: '' } },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'diff',
      gates: [],
      runFn,
    });
    expect(result.kind).toBe('precondition-failed');
    if (result.kind === 'precondition-failed') {
      expect(result.message).toMatch(/dirty/);
    }
    // Only the status check ran; no apply attempted.
    expect(recorded.map((r) => r.cmd + ' ' + r.args.join(' ')).filter((s) => s.includes('apply'))).toHaveLength(0);
  });

  it('skips clean-worktree check when enforceCleanWorktree=false', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn([], recorded);
    const result = await applyAndGate({
      patch: 'diff',
      gates: [{ cmd: 'npm', args: ['test'] }],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('success');
    // git status was skipped — no precondition cmd in the trace.
    expect(recorded.find((r) => r.cmd === 'git' && r.args[0] === 'status')).toBeUndefined();
  });

  it('returns apply-failed when git apply --check rejects the patch', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'git', argsContains: ['apply', '--check'] }, result: { exitCode: 1, stdout: '', stderr: 'patch does not apply' } },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'broken-diff',
      gates: [],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('apply-failed');
    if (result.kind === 'apply-failed') {
      expect(result.stderr).toMatch(/patch does not apply/);
    }
    // Apply itself NOT attempted after check fails.
    expect(
      recorded.filter((r) => r.cmd === 'git' && r.args.includes('apply') && !r.args.includes('--check'))
    ).toHaveLength(0);
  });

  it('runs gates in order; stops on first failure; reverts the working tree', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        // Gates: typecheck OK, lint FAIL, test (never runs).
        { match: { cmd: 'npm', argsContains: ['run', 'lint'] }, result: FAIL },
        { match: { cmd: 'npm', argsContains: ['test'] }, result: OK },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'good-diff',
      gates: [
        { cmd: 'npm', args: ['run', 'typecheck'] },
        { cmd: 'npm', args: ['run', 'lint'] },
        { cmd: 'npm', args: ['test'] },
      ],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('gate-failed');
    if (result.kind === 'gate-failed') {
      expect(result.gateThatFailed.args).toEqual(['run', 'lint']);
      expect(result.reverted).toBe(true);
    }
    // npm test was NOT run (gate stopped on lint failure).
    expect(recorded.find((r) => r.cmd === 'npm' && r.args.includes('test'))).toBeUndefined();
    // Codex impl-2 H2: revert uses `git reset --hard HEAD` (covers
    // both staged + unstaged) rather than `git checkout -- .` (which
    // only restores worktree from index).
    expect(
      recorded.find((r) => r.cmd === 'git' && r.args[0] === 'reset' && r.args.includes('--hard')),
    ).toBeDefined();
    // Claude impl-1 H2: git clean -fd was invoked to remove untracked
    // files the patch may have created. Without this, untracked
    // artifacts persist past the cleanup.
    expect(
      recorded.find((r) => r.cmd === 'git' && r.args[0] === 'clean' && r.args.includes('-fd')),
    ).toBeDefined();
  });

  it('reverted=true requires both reset AND clean to succeed', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'npm', argsContains: ['run', 'lint'] }, result: FAIL },
        { match: { cmd: 'git', argsContains: ['clean', '-fd'] }, result: FAIL },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'diff',
      gates: [{ cmd: 'npm', args: ['run', 'lint'] }],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('gate-failed');
    if (result.kind === 'gate-failed') {
      expect(result.reverted).toBe(false);
    }
  });

  it('commits the patch when commitMessage is supplied + gates pass', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'git', argsContains: ['rev-parse', 'HEAD'] }, result: { exitCode: 0, stdout: 'sha-x\n', stderr: '' } },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'good-diff',
      branchName: 'auto-fix/foo',
      commitMessage: 'auto-fix: regression on seed bar',
      gates: [{ cmd: 'npm', args: ['test'] }],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('success');
    expect(recorded.find((r) => r.cmd === 'git' && r.args[0] === 'add' && r.args[1] === '-A')).toBeDefined();
    expect(
      recorded.find((r) => r.cmd === 'git' && r.args[0] === 'commit' && r.args.includes('-m')),
    ).toBeDefined();
  });

  it('skips commit when commitMessage is not supplied', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn([], recorded);
    await applyAndGate({
      patch: 'good-diff',
      branchName: 'auto-fix/foo',
      gates: [{ cmd: 'npm', args: ['test'] }],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(recorded.find((r) => r.cmd === 'git' && r.args[0] === 'add')).toBeUndefined();
    expect(recorded.find((r) => r.cmd === 'git' && r.args[0] === 'commit')).toBeUndefined();
  });

  it('returns precondition-failed when commit fails after gates pass', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'git', argsContains: ['commit'] }, result: { exitCode: 1, stdout: '', stderr: 'nothing to commit' } },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'noop-diff',
      branchName: 'auto-fix/foo',
      commitMessage: 'auto-fix: x',
      gates: [{ cmd: 'npm', args: ['test'] }],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('precondition-failed');
    if (result.kind === 'precondition-failed') {
      expect(result.message).toMatch(/commit failed/);
    }
  });

  it('reports reverted=false when the reset step itself fails', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'npm', argsContains: ['run', 'lint'] }, result: FAIL },
        { match: { cmd: 'git', argsContains: ['reset', '--hard'] }, result: FAIL },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'good-diff',
      gates: [{ cmd: 'npm', args: ['run', 'lint'] }],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('gate-failed');
    if (result.kind === 'gate-failed') {
      expect(result.reverted).toBe(false);
    }
  });

  it('creates the branch when branchName is supplied', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn([], recorded);
    const result = await applyAndGate({
      patch: 'diff',
      branchName: 'auto-fix/abc123',
      gates: [],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('success');
    expect(
      recorded.find((r) =>
        r.cmd === 'git' && r.args[0] === 'checkout' && r.args[1] === '-b' && r.args[2] === 'auto-fix/abc123',
      ),
    ).toBeDefined();
  });

  it('returns precondition-failed when branch creation fails', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'git', argsContains: ['checkout', '-b', 'auto-fix/dup'] }, result: { exitCode: 1, stdout: '', stderr: 'branch already exists' } },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'diff',
      branchName: 'auto-fix/dup',
      gates: [],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('precondition-failed');
    if (result.kind === 'precondition-failed') {
      expect(result.message).toMatch(/branch already exists/);
    }
  });

  it('forwards the patch via stdin to both --check and apply', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn([], recorded);
    await applyAndGate({
      patch: '--- a/foo\n+++ b/foo\n@@ -1 +1 @@\n-old\n+new\n',
      gates: [],
      runFn,
      enforceCleanWorktree: false,
    });
    const checkCall = recorded.find((r) => r.cmd === 'git' && r.args.includes('--check'));
    const applyCall = recorded.find((r) => r.cmd === 'git' && r.args[0] === 'apply' && !r.args.includes('--check'));
    expect(checkCall?.stdin).toContain('+new');
    expect(applyCall?.stdin).toContain('+new');
  });

  it('returns success with HEAD sha + gate trace on full pass', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn(
      [
        { match: { cmd: 'git', argsContains: ['rev-parse', 'HEAD'] }, result: { exitCode: 0, stdout: 'abc123\n', stderr: '' } },
      ],
      recorded,
    );
    const result = await applyAndGate({
      patch: 'diff',
      gates: [
        { cmd: 'npm', args: ['test'] },
        { cmd: 'npm', args: ['run', 'lint'] },
      ],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.sha).toBe('abc123');
      expect(result.gatePassThrough).toHaveLength(2);
      expect(result.gatePassThrough[0]!.cmd).toBe('npm');
      expect(result.gatePassThrough[1]!.args).toEqual(['run', 'lint']);
    }
  });
});
