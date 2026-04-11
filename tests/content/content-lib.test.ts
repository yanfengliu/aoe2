import { describe, expect, it } from 'vitest';

import {
  buildContentBundle,
  collectValidationIssues,
  parseCostBlob,
  parseCsv,
  splitList,
} from '../../scripts/content-lib.mjs';

type ContentBundleLike = {
  units: Array<{ id: string; name: string; sourceKind: string }>;
  civilizations: Array<{
    name: string;
    playable: boolean;
    missingUniqueUnits: string[];
  }>;
  coverage: {
    supportedCivilizationCount: number;
    unsupportedCivilizationCount: number;
  };
};

type ValidationIssueLike = { code: string };

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
    const bundle: ContentBundleLike = buildContentBundle();
    const scoutVariants = bundle.units.filter(
      (entry: { name: string }) => entry.name === 'Scout Cavalry',
    );
    const issues: ValidationIssueLike[] = collectValidationIssues(bundle);

    expect(scoutVariants.map((entry) => entry.id)).toEqual([
      'scout-cavalry-starting',
      'scout-cavalry',
    ]);
    expect(scoutVariants.map((entry) => entry.sourceKind)).toEqual([
      'starting-unit',
      'trainable',
    ]);
    expect(bundle.coverage.supportedCivilizationCount).toBe(18);
    expect(bundle.coverage.unsupportedCivilizationCount).toBe(12);
    expect(
      bundle.civilizations.find(
        (entry: { name: string }) => entry.name === 'Aztecs',
      )?.playable,
    ).toBe(true);
    expect(
      bundle.civilizations.find(
        (entry: { name: string }) => entry.name === 'Italians',
      )?.missingUniqueUnits,
    ).toEqual(['Genoese Crossbowman', 'Condottiero']);
    expect(
      issues.some((issue: ValidationIssueLike) => issue.code === 'duplicate-unit-id'),
    ).toBe(false);
    expect(
      issues.some(
        (issue: ValidationIssueLike) => issue.code === 'missing-civ-unique-unit',
      ),
    ).toBe(false);
  });
});
