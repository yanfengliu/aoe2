import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultKnownFindings, parseArgs, planRerunBudget } from '../../scripts/playtest-recursive.mjs';

const useShell = process.platform === 'win32';
const npxBin = useShell ? 'npx.cmd' : 'npx';

function runScript(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(npxBin, ['tsx', 'scripts/playtest-recursive.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60_000,
    shell: useShell,
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('playtest-recursive script', () => {
  it('prints usage and exits 0 on --help', () => {
    const r = runScript(['--help']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('recursive self-improvement pass');
  });

  it('rejects unknown flags with exit 2', () => {
    const r = runScript(['--bogus']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("unknown argument '--bogus'");
  });

  it('rejects a non-positive --max-ticks with exit 2', () => {
    const r = runScript(['--max-ticks', '0']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--max-ticks must be a positive integer');
  });
});

describe('full-loop default (2.0 mandatory behavior)', () => {
  it('defaults to the full loop; --propose-only and --apply set the explicit modes', () => {
    expect(parseArgs(['node', 'x']).apply).toBe('auto');
    expect(parseArgs(['node', 'x', '--propose-only']).apply).toBe(false);
    expect(parseArgs(['node', 'x', '--apply']).apply).toBe(true);
  });

  it('auto-discovers the newest prior ledger as episodic memory', () => {
    const root = mkdtempSync(join(tmpdir(), 'recursive-out-'));
    try {
      mkdirSync(join(root, '20260701000000-1'), { recursive: true });
      writeFileSync(join(root, '20260701000000-1', 'ledger.json'), '{}');
      mkdirSync(join(root, '20260708000000-9'), { recursive: true });
      writeFileSync(join(root, '20260708000000-9', 'ledger.json'), '{}');
      mkdirSync(join(root, '20260709000000-2'), { recursive: true }); // newest, but no ledger
      expect(defaultKnownFindings(root)).toBe(join(root, '20260708000000-9', 'ledger.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('caps the prove rerun at the unspent remainder and refuses an underfunded rerun', () => {
    expect(planRerunBudget(5, 2)).toBe(3);
    expect(planRerunBudget(1, 0.5)).toBe(0.5); // exactly at the viability floor
    // An underfunded rerun is worse than none: a near-empty rerun has no
    // findings and would false-prove any candidate.
    expect(planRerunBudget(5, 4.8)).toBeNull();
    expect(planRerunBudget(5, 5.2)).toBeNull(); // never exceeds the pass budget
  });

  it('returns null when no prior ledger exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'recursive-empty-'));
    try {
      expect(defaultKnownFindings(root)).toBeNull();
      expect(defaultKnownFindings(join(root, 'missing'))).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
