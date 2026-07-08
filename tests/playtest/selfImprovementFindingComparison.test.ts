import {
  IMPROVEMENT_FINDING_SCHEMA_VERSION,
  type ImprovementFinding,
} from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { compareSelfImprovementFindings } from '../../src/game/playtest/selfImprovementFindingComparison';

function finding(id: string, overrides: Partial<ImprovementFinding> = {}): ImprovementFinding {
  return {
    schemaVersion: IMPROVEMENT_FINDING_SCHEMA_VERSION,
    id,
    title: id,
    severity: 'low',
    category: 'performance',
    observed: 'tick 430 duration outlier',
    expected: 'tick duration should stay inside budget',
    suggestion: 'inspect tick duration',
    verificationStatus: 'verified',
    nextAction: 'observeMore',
    ...overrides,
  };
}

describe('compareSelfImprovementFindings', () => {
  it('matches oracle findings by stable oracle/tick/message identity when generated ids shift', () => {
    const baseline = finding('aoe2-oracle-no-perf-regression-430-4', {
      data: {
        aoe2OracleViolation: {
          oracle: 'no-perf-regression',
          severity: 'low',
          tick: 430,
          message: 'tick 430 duration outlier',
        },
      },
    });
    const current = finding('aoe2-oracle-no-perf-regression-430-1', {
      data: {
        aoe2OracleViolation: {
          oracle: 'no-perf-regression',
          severity: 'low',
          tick: 430,
          message: 'tick 430 duration outlier',
        },
      },
    });

    expect(compareSelfImprovementFindings([baseline], [current])).toEqual({
      baselineCount: 1,
      currentCount: 1,
      resolved: [],
      persisted: ['aoe2-oracle-no-perf-regression-430-1'],
      introduced: [],
    });
  });
});
