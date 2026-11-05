// The cases run the script's `main` in this process (scripts/playtest-self-improve-lib.mjs, which
// scripts/playtest-self-improve.mjs only runs). They used to launch `npm run playtest:self-improve`:
// npm, a shell, tsx's CLI, and a node child that compiled the 521 modules the script loads. On a
// Windows runner the first case took 28.9 s of its 30 s limit that way (CI run 42105898172, 2026-11-05).
// Here the modules load once, when this file is imported, and a case's time is the script's own work.
//
// Each case checks what it checked through npm: the files the script writes and the evidence in
// them, and that the run succeeds. The script exits 0 exactly when `main` resolves; a usage error's
// `process.exit` throws under vitest, so it fails the case. The last case keeps the npm command
// reaching this `main`, which the npm launch used to prove at the cost of the launch.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { main } from '../../scripts/playtest-self-improve-lib.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

/** Runs the script on `args` in this process, holding back its console output and adding it to a failure. */
async function runSelfImprove(args: string[]): Promise<void> {
  const said: string[] = [];
  const keep = (...parts: unknown[]) => {
    said.push(parts.map(String).join(' '));
  };
  const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
  for (const spy of spies) spy.mockImplementation(keep);
  try {
    await main([process.execPath, join(REPO, 'scripts/playtest-self-improve.mjs'), ...args]);
  } catch (err) {
    throw new Error(`playtest-self-improve failed: ${err instanceof Error ? err.message : String(err)}\n${said.join('\n')}`, {
      cause: err,
    });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

describe('playtest-self-improve script', () => {
  it('writes a standardized ledger and captures replay-self-check errors as evidence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-self-improve-'));
    try {
      const prefix = join(dir, 'run');
      const out = join(dir, 'ledger.json');
      writeFileSync(
        `${prefix}.envelope.json`,
        JSON.stringify({
          stopReason: 'maxTicks',
          ticksRun: 500,
          decisionsRun: 1,
          totalCostUsd: 0.25,
          maxTicks: 1000,
          findings: [
            {
              category: 'functional-bug',
              area: 'pathing',
              observed: 'The player reported stuck villagers.',
              expected: 'Villagers should reach nearby resources.',
              severity: 'high',
              suggestion: 'Replay the bundle and inspect villager target state.',
            },
          ],
        }),
      );
      writeFileSync(
        `${prefix}.llm-trace.jsonl`,
        `${JSON.stringify({
          decisionIndex: 0,
          tickBefore: 250,
          tickAfter: 500,
          thought: 'Inspect pathing.',
          commands: [{ type: 'unit.move' }],
          costUsd: 0.25,
          stopReason: 'normal',
          dispatchEvents: [{ commandType: 'unit.move', accepted: true }],
        })}\n`,
      );
      writeFileSync(
        `${prefix}.json`,
        JSON.stringify({
          schemaVersion: 1,
          metadata: {
            sessionId: 'self-improve-test',
            startTick: 0,
            endTick: 500,
            durationTicks: 500,
            engineVersion: '1.4.0',
            nodeVersion: process.version,
          },
          initialSnapshot: {},
          ticks: [],
          commands: [],
          executions: [],
          failures: [],
          snapshots: [],
          markers: [],
          attachments: [],
        }),
      );

      await runSelfImprove(['--current', prefix, '--out', out]);

      const ledger = JSON.parse(readFileSync(out, 'utf8'));
      expect(ledger.current).toMatchObject({
        id: 'run',
        findingSource: 'envelope-findings',
        standardizedFindingCount: 1,
      });
      expect(ledger.verification.current).toMatchObject({
        kind: 'replay-self-check',
        ok: false,
      });
      expect(ledger.findings[0]).toMatchObject({
        id: 'aoe2-conformance-functional-bug-pathing-500-0',
        classification: { kind: 'proposal' },
      });
      expect(readFileSync(out.replace(/\.json$/, '.md'), 'utf8')).toContain('Replay self-check: failed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can build a ledger from deterministic playtest artifacts and oracle violations without an LLM trace', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-self-improve-oracles-'));
    try {
      const prefix = join(dir, 'run');
      const out = join(dir, 'ledger.json');
      writeFileSync(
        `${prefix}.envelope.json`,
        JSON.stringify({
          stopReason: 'maxTicks',
          ticksRun: 500,
          seed: 'self-improve-smoke',
          scenario: 'self-improve-smoke',
          runStartedAt: '2026-07-08T00:00:00.000Z',
          runCompletedAt: '2026-07-08T00:01:00.000Z',
        }),
      );
      writeFileSync(
        `${prefix}.json`,
        JSON.stringify({
          schemaVersion: 1,
          metadata: {
            sessionId: 'self-improve-oracle-test',
            startTick: 0,
            endTick: 0,
            durationTicks: 0,
            engineVersion: '1.4.0',
            nodeVersion: process.version,
            failedTicks: [],
          },
          initialSnapshot: {
            version: 5,
            config: { gridWidth: 16, gridHeight: 16, tps: 10 },
            tick: 0,
            entities: { generations: [], alive: [], freeList: [] },
            components: {},
            resources: {},
            state: {},
            tags: [],
            rng: { state: 0 },
            componentOptions: {},
            metadata: {},
          },
          ticks: [],
          commands: [],
          executions: [],
          failures: [],
          snapshots: [],
          markers: [],
          attachments: [],
        }),
      );

      await runSelfImprove([
        '--current',
        prefix,
        '--out',
        out,
        '--oracles',
        '--thresholds',
        '{"matchCompleteRequired":true}',
      ]);

      const ledger = JSON.parse(readFileSync(out, 'utf8'));
      expect(ledger.current).toMatchObject({
        id: 'run',
        findingSource: 'oracle-violations',
        standardizedFindingCount: 1,
        decisionsRun: 0,
      });
      expect(ledger.findings[0]).toMatchObject({
        id: 'aoe2-oracle-match-completes-run-0',
        classification: { kind: 'fix', autoFixEligible: false },
        // The fixture bundle has no commands, so replay self-check evidence is
        // weak and the oracle finding's authored 'verified' status is downgraded.
        verificationStatus: 'unverified',
        nextAction: 'manualFix',
      });
      expect(readFileSync(out.replace(/\.json$/, '.md'), 'utf8')).toContain(
        'Standardized improvement findings: 1 (source: oracle-violations)',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The documented command, `npm run playtest:self-improve -- <args>`, must reach the `main` the cases
  // above run. Read from the two files, not by launching npm: package.json names the entry, and the
  // entry's code is exactly "run main on the process's arguments, and exit 1 if it rejects".
  it('npm run playtest:self-improve runs this main on the process arguments', () => {
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['playtest:self-improve']).toBe('tsx scripts/playtest-self-improve.mjs');
    const code = readFileSync(join(REPO, 'scripts/playtest-self-improve.mjs'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#!') && !line.trimStart().startsWith('//'));
    expect(code).toEqual([
      "import { main } from './playtest-self-improve-lib.mjs';",
      'main(process.argv).catch((err) => {',
      "  console.error('[playtest-self-improve] fatal:', err instanceof Error ? err.message : String(err));",
      '  process.exit(1);',
      '});',
    ]);
  });
});
