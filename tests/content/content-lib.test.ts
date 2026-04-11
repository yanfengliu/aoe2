import { describe, expect, it } from 'vitest';

import {
  buildContentBundle,
  collectValidationIssues,
  parseCostBlob,
  parseCsv,
  splitList,
} from '../../scripts/content-lib.mjs';

describe('content-lib', () => {
  it('parses semicolon-delimited lists into trimmed arrays', () => {
    expect(splitList(' Kamayuk; Slinger ;Andean Sling ')).toEqual([
      'Kamayuk',
      'Slinger',
      'Andean Sling',
    ]);
  });

  it('parses the stats cost blob format', () => {
    expect(
      parseCostBlob(
        '{"Cost":"No cost"; "Provides":{"Food": 340; "Resource Decay": 0.25 } }',
      ),
    ).toEqual({
      Cost: 'No cost',
      Provides: {
        Food: 340,
        'Resource Decay': 0.25,
      },
    });
  });

  it('parses quoted csv rows with commas', () => {
    const rows = parseCsv('name,bonus\nIncas,"Houses support 10 population, free llama"\n');
    expect(rows).toEqual([
      {
        name: 'Incas',
        bonus: 'Houses support 10 population, free llama',
      },
    ]);
  });

  it('normalizes starter-only unit variants without duplicate-id errors', () => {
    const bundle = buildContentBundle();
    const scoutVariants: Array<{ id: string; sourceKind: string }> = bundle.units.filter(
      (entry: { name: string }) => entry.name === 'Scout Cavalry',
    );
    const issues: Array<{ code: string }> = collectValidationIssues(bundle);

    expect(scoutVariants.map((entry) => entry.id)).toEqual([
      'scout-cavalry-starting',
      'scout-cavalry',
    ]);
    expect(scoutVariants.map((entry) => entry.sourceKind)).toEqual([
      'starting-unit',
      'trainable',
    ]);
    expect(issues.some((issue) => issue.code === 'duplicate-unit-id')).toBe(false);
  });
});
