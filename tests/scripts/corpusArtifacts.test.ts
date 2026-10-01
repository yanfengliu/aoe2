// BOUND: static corpus upload selection, not GitHub delivery or oracle correctness.
// The 2026-10-01 hosted artifact retained SUMMARY.md but lost each run's REPORT.md.
// Independent YAML parsing and representative output names catch that omission and
// accidental expansion into bundles, envelopes, thresholds or raw captures.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load(source: string): unknown };
const minimatch = require('minimatch') as (path: string, pattern: string) => boolean;

it('retains corpus summaries and per-run reports without full recording outputs', () => {
  const workflow = yaml.load(readFileSync(new URL('../../.github/workflows/playtest.yml', import.meta.url), 'utf8')) as {
    jobs: { corpus: { steps: Array<{ uses?: string; if?: string; with?: { name?: string; path?: string } }> } };
  };
  const uploads = workflow.jobs.corpus.steps.filter((step) => step.uses === 'actions/upload-artifact@v4');
  expect(uploads).toHaveLength(1);
  const upload = uploads[0];
  expect(upload.if).toBe('always()');
  expect(upload.with?.name).toBe('corpus-${{ github.run_id }}');
  const patterns = upload.with?.path?.trim().split(/\r?\n/).map((path) => path.trim()) ?? [];
  const retained = (path: string) => patterns.some((pattern) => minimatch(path, pattern.endsWith('/') ? `${pattern}**` : pattern));
  for (const path of [
    'output/corpus/2026-10-01/SUMMARY.md',
    'output/playtests/2026-10-01-arabia-report/REPORT.md',
    'output/playtests/2026-10-01-islands-report/REPORT.md',
  ]) expect(retained(path), `corpus artifact must retain ${path}`).toBe(true);
  for (const path of [
    'output/playtests/2026-10-01-arabia.json',
    'output/playtests/2026-10-01-arabia.envelope.json',
    'output/playtests/2026-10-01-arabia.thresholds.json',
    'output/playtests/2026-10-01-arabia-report/findings.json',
    'output/playtests/2026-10-01-arabia-report/raw/capture.png',
  ]) expect(retained(path), `corpus artifact must exclude ${path}`).toBe(false);
});
