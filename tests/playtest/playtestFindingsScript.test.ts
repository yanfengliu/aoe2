// The case runs the script package.json names for `npm run playtest:findings`, as one node child
// with tsx's loader, so it still checks the files the script writes, the markers in them and its
// exit status. It used to launch npm, which started npm, a shell and tsx's CLI before that child;
// the self-improve script's first case took 28.9 s of its 30 s limit that way on a Windows runner
// (CI run 42105898172, 2026-11-05). tsx compiles 11 modules for this script, where it compiles 521
// for that one, so here the one child stays cheap.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

/** The script `npm run <name>` runs, from package.json, where the command must be `tsx <script>`. */
function packageScript(name: string): string {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  const script = /^tsx (\S+\.mjs)$/.exec(pkg.scripts[name] ?? '')?.[1];
  if (!script) throw new Error(`package.json's ${name} is ${JSON.stringify(pkg.scripts[name])}, not \`tsx <script>\``);
  return script;
}

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

      const script = packageScript('playtest:findings');
      const result = spawnSync(process.execPath, ['--import', 'tsx', script, prefix, '--reuse-findings'], {
        cwd: REPO,
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
