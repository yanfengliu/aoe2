import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { IMPROVEMENT_FINDING_SCHEMA_VERSION } from 'civ-engine';
import { describe, expect, it } from 'vitest';

describe('propose-fix script', () => {
  it('keeps the legacy REPORT.md fallback path working in dry-run mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-propose-fix-report-'));
    try {
      const prefix = join(dir, 'run');
      const proposalRoot = join(dir, 'proposals');
      writeFileSync(
        `${prefix}.json`,
        JSON.stringify({
          metadata: { sessionId: 'report-proposal-test' },
          ticks: [],
        }),
      );
      writeFileSync(
        `${prefix}.envelope.json`,
        JSON.stringify({
          stopReason: 'maxTicks',
          ticksRun: 700,
          seed: 'legacy-report',
        }),
      );
      const reportDir = `${prefix}-report`;
      mkdirSync(reportDir);
      writeFileSync(
        join(reportDir, 'REPORT.md'),
        [
          '# Oracle report',
          '',
          '| Oracle | Severity | Tick | Message |',
          '|---|---|---|---|',
          '| match-completes | high | - | match did not complete: stopReason=maxTicks |',
          '',
        ].join('\n'),
        { flag: 'wx' },
      );

      const npmCli = process.env.npm_execpath;
      if (!npmCli) throw new Error('npm_execpath was not set by the test runner');
      const result = spawnSync(
        process.execPath,
        [
          npmCli,
          'run',
          'propose-fix',
          '--',
          '--in',
          prefix,
          '--dry-run',
          '--proposal-root',
          proposalRoot,
        ],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 },
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const target = JSON.parse(
        readFileSync(join(proposalRoot, 'run', 'match-completes', 'TARGET.json'), 'utf8'),
      );
      expect(target).toMatchObject({
        prefix,
        violation: {
          oracle: 'match-completes',
          severity: 'high',
          tick: null,
        },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can dry-run a fix proposal prompt directly from a self-improvement ledger', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-propose-fix-ledger-'));
    try {
      const prefix = join(dir, 'run');
      const proposalRoot = join(dir, 'proposals');
      const ledgerPath = join(dir, 'ledger.json');
      writeFileSync(
        `${prefix}.json`,
        JSON.stringify({
          metadata: { sessionId: 'ledger-proposal-test' },
          ticks: [],
        }),
      );
      writeFileSync(
        `${prefix}.envelope.json`,
        JSON.stringify({
          stopReason: 'maxTicks',
          ticksRun: 700,
          seed: 'self-improve-smoke',
        }),
      );
      writeFileSync(
        ledgerPath,
        JSON.stringify({
          schemaVersion: 1,
          current: {
            id: 'run',
            prefix,
          },
          findings: [{
            id: 'aoe2-oracle-match-completes-run-0',
            title: 'match-completes',
            severity: 'high',
            category: 'regression',
            area: 'match-completes',
            observed: 'match did not complete: stopReason=maxTicks',
            expected: 'match should complete',
            verificationStatus: 'verified',
            nextAction: 'manualFix',
            disposition: 'candidate',
            classification: { kind: 'fix', autoFixEligible: false },
            finding: {
              schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
              id: 'aoe2-oracle-match-completes-run-0',
              title: 'match-completes',
              severity: 'high',
              category: 'regression',
              area: 'match-completes',
              observed: 'match did not complete: stopReason=maxTicks',
              expected: 'match should complete',
              suggestion: 'inspect match completion',
              verificationStatus: 'verified',
              nextAction: 'manualFix',
              data: {
                aoe2OracleViolation: {
                  oracle: 'match-completes',
                  severity: 'high',
                  tick: null,
                  message: 'match did not complete: stopReason=maxTicks',
                  details: { stopReason: 'maxTicks', ticksRun: 700 },
                },
              },
            },
          }],
        }),
      );

      const npmCli = process.env.npm_execpath;
      if (!npmCli) throw new Error('npm_execpath was not set by the test runner');
      const result = spawnSync(
        process.execPath,
        [
          npmCli,
          'run',
          'propose-fix',
          '--',
          '--ledger',
          ledgerPath,
          '--dry-run',
          '--proposal-root',
          proposalRoot,
        ],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 },
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('status: dry-run');
      const target = JSON.parse(
        readFileSync(join(proposalRoot, 'run', 'match-completes', 'TARGET.json'), 'utf8'),
      );
      expect(target).toMatchObject({
        prefix,
        findingId: 'aoe2-oracle-match-completes-run-0',
        violation: {
          oracle: 'match-completes',
          severity: 'high',
          tick: null,
        },
      });
      expect(readFileSync(join(proposalRoot, 'run', 'match-completes', 'PROMPT.md'), 'utf8'))
        .toContain('match did not complete: stopReason=maxTicks');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
