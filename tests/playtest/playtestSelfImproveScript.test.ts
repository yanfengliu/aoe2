import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('playtest-self-improve script', () => {
  it('writes a standardized ledger and captures replay-self-check errors as evidence', () => {
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

      const npmCli = process.env.npm_execpath;
      if (!npmCli) throw new Error('npm_execpath was not set by the test runner');
      const result = spawnSync(
        process.execPath,
        [npmCli, 'run', 'playtest:self-improve', '--', '--current', prefix, '--out', out],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 },
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
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

  it('can build a ledger from deterministic playtest artifacts and oracle violations without an LLM trace', () => {
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

      const npmCli = process.env.npm_execpath;
      if (!npmCli) throw new Error('npm_execpath was not set by the test runner');
      const result = spawnSync(
        process.execPath,
        [
          npmCli,
          'run',
          'playtest:self-improve',
          '--',
          '--current',
          prefix,
          '--out',
          out,
          '--oracles',
          '--thresholds',
          '{"matchCompleteRequired":true}',
        ],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 },
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
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
});
