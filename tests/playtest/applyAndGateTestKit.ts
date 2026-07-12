// Shared stub-runner harness for the applyAndGate tests. Extracted so the core
// pipeline tests (applyAndGate.test.ts) and the H9 sensitive-path guard tests
// (applyAndGate.sensitivePaths.test.ts) share ONE fake runFn and both stay under
// the 500-LOC budget.
import type { RunCommandFn, RunCommandResult } from '../../src/game/playtest/applyAndGate';

export interface RecordedCall {
  cmd: string;
  args: string[];
  stdin?: string;
}

export function makeRunFn(
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

export const OK: RunCommandResult = { exitCode: 0, stdout: '', stderr: '' };
export const FAIL: RunCommandResult = { exitCode: 1, stdout: '', stderr: 'simulated failure' };
