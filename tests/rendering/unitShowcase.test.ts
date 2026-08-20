import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createUnitShowcaseFixture } from '../../src/game/simulation/fixtures/unitShowcase';
import type { UnitType } from '../../src/game/simulation/types';
import { ALL_UNIT_TYPES } from '../../src/input/unitTypeMap';

const UNIT_TYPES = Object.keys(ALL_UNIT_TYPES) as UnitType[];

const ORIGINAL_ROOTS = {
  villager: { x: 5, y: 12 },
  champion: { x: 8, y: 12 },
  arbalest: { x: 11, y: 12 },
  knight: { x: 14, y: 12 },
  'cavalry-archer': { x: 17, y: 12 },
  mangonel: { x: 20, y: 12 },
  monk: { x: 23, y: 12 },
} as const satisfies Partial<Record<UnitType, { readonly x: number; readonly y: number }>>;

describe('unit visual showcase', () => {
  it('contains every UnitType exactly once at a unique P1 root while preserving the original seven', () => {
    const scenario = createUnitShowcaseFixture('unit-showcase-fixture');
    const units = scenario.spawns.filter((spawn): spawn is typeof spawn & { kind: UnitType } => (
      spawn.owner === 1 && Object.hasOwn(ALL_UNIT_TYPES, spawn.kind)
    ));

    expect(units.map(({ kind }) => kind).sort()).toEqual([...UNIT_TYPES].sort());
    // Derived from the roster: a frozen count here just becomes a chore
    // every time a unit ships, and the sorted-equality above already
    // proves the SET matches. What this adds is that no two units share
    // a cell, which is what makes the capture readable.
    expect(units).toHaveLength(UNIT_TYPES.length);
    expect(new Set(units.map(({ x, y }) => `${String(x)}:${String(y)}`)).size)
      .toBe(UNIT_TYPES.length);
    for (const [unitType, expectedRoot] of Object.entries(ORIGINAL_ROOTS)) {
      expect(units.find(({ kind }) => kind === unitType)).toMatchObject(expectedRoot);
    }
  });

  it('keeps an inert opponent outside P1 fog so the evidence match stays live', () => {
    const scenario = createUnitShowcaseFixture('unit-showcase-fixture');
    expect(scenario.starts.find(({ owner }) => owner === 2)).toMatchObject({ disableAi: true });
    expect(scenario.spawns.filter(({ owner }) => owner === 2)).toEqual([
      expect.objectContaining({ kind: 'town-center', x: 53, y: 29 }),
    ]);

    const bridge = createSimulationBridge('unit-showcase-fixture');
    bridge.step(100);

    expect(bridge.getHudState().matchState.outcome).toBe('running');
    expect(bridge.getRenderState().entities.some(({ owner }) => owner === 2)).toBe(false);
  });
});
