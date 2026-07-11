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
          // M6-#5: match-completes is now excluded from auto-fix selection, so a
          // ledger whose only candidate is a code-fixable oracle is used here.
          findings: [{
            id: 'aoe2-oracle-no-pinned-or-oscillating-units-run-0',
            title: 'no-pinned-or-oscillating-units',
            severity: 'high',
            category: 'regression',
            area: 'no-pinned-or-oscillating-units',
            observed: 'unit 99 stayed pinned near its base',
            expected: 'units should make net progress',
            verificationStatus: 'verified',
            nextAction: 'manualFix',
            disposition: 'candidate',
            classification: { kind: 'fix', autoFixEligible: false },
            finding: {
              schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
              id: 'aoe2-oracle-no-pinned-or-oscillating-units-run-0',
              title: 'no-pinned-or-oscillating-units',
              severity: 'high',
              category: 'regression',
              area: 'no-pinned-or-oscillating-units',
              observed: 'unit 99 stayed pinned near its base',
              expected: 'units should make net progress',
              suggestion: 'inspect unit pathing',
              verificationStatus: 'verified',
              nextAction: 'manualFix',
              data: {
                aoe2OracleViolation: {
                  oracle: 'no-pinned-or-oscillating-units',
                  severity: 'high',
                  tick: null,
                  message: 'unit 99 stayed pinned near its base',
                  details: { unitId: 99 },
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
        readFileSync(join(proposalRoot, 'run', 'no-pinned-or-oscillating-units', 'TARGET.json'), 'utf8'),
      );
      expect(target).toMatchObject({
        prefix,
        findingId: 'aoe2-oracle-no-pinned-or-oscillating-units-run-0',
        violation: {
          oracle: 'no-pinned-or-oscillating-units',
          severity: 'high',
          tick: null,
        },
      });
      expect(readFileSync(join(proposalRoot, 'run', 'no-pinned-or-oscillating-units', 'PROMPT.md'), 'utf8'))
        .toContain('unit 99 stayed pinned near its base');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
