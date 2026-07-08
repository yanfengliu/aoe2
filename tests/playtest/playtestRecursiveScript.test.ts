import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

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
