import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('playtest-findings script', () => {
  it('can reuse existing envelope findings to refresh marker payloads without an LLM call', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-findings-reuse-'));
    try {
      const prefix = join(dir, 'run');
      writeFileSync(
        `${prefix}.envelope.json`,
        JSON.stringify({
          stopReason: 'maxTicks',
          ticksRun: 500,
          decisionsRun: 1,
          totalCostUsd: 0.25,
          findings: [
            {
              category: 'ux-gap',
              area: 'command-card',
              observed: 'No visible age-up command.',
              expected: 'The Town Center exposes an age-up command.',
              severity: 'medium',
              suggestion: 'Expose the age-up command in the card.',
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
          thought: 'Inspect command card.',
          commands: [],
          costUsd: 0.25,
          stopReason: 'normal',
          dispatchEvents: [],
        })}\n`,
      );
      writeFileSync(
        `${prefix}.json`,
        JSON.stringify({
          schemaVersion: 1,
          metadata: { sessionId: 'reuse-test', startTick: 0, endTick: 500 },
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
      const result = spawnSync(process.execPath, [npmCli, 'run', 'playtest:findings', '--', prefix, '--reuse-findings'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 30_000,
      });

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const envelope = JSON.parse(readFileSync(`${prefix}.envelope.json`, 'utf8'));
      expect(envelope.findings).toHaveLength(1);
      const bundle = JSON.parse(readFileSync(`${prefix}.json`, 'utf8'));
      expect(bundle.markers).toHaveLength(1);
      expect(bundle.markers[0].data.improvementLoop).toMatchObject({
        schemaVersion: 1,
        type: 'finding',
        finding: {
          id: 'aoe2-conformance-ux-gap-command-card-500-0',
          verificationStatus: 'unverified',
          nextAction: 'proposalOnly',
          evidence: [{ kind: 'tick', tick: 500 }],
        },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
