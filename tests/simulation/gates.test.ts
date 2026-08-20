import { describe, expect, it } from 'vitest';

import { buildOptionsFor } from '../../src/game/simulation/bridge/buildOptions';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

import { getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import { buildingMaxHp } from '../../src/game/simulation/prototypeBuildingRules';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';
import {
  gateAdmits, gateWallCounterpart, isGateBuilding, isWallLineBuilding,
} from '../../src/game/simulation/gates';

describe('a gate', () => {
  // A wall you cannot open is a wall you have to demolish to leave. Gates are
  // what make a walled base playable: your own units walk through, the enemy's
  // do not.
  it('is part of a wall line, so everything walls already do applies to it', () => {
    expect(isWallLineBuilding('palisade-gate')).toBe(true);
    expect(isWallLineBuilding('stone-gate')).toBe(true);
    expect(isWallLineBuilding('palisade-wall')).toBe(true);
    expect(isWallLineBuilding('castle')).toBe(false);
  });

  it('is recognised as a gate, and ordinary walls are not', () => {
    expect(isGateBuilding('palisade-gate')).toBe(true);
    expect(isGateBuilding('stone-gate')).toBe(true);
    expect(isGateBuilding('palisade-wall')).toBe(false);
    expect(isGateBuilding('stone-wall')).toBe(false);
    expect(isGateBuilding('castle')).toBe(false);
  });

  it('pairs with the wall it belongs in', () => {
    expect(gateWallCounterpart('palisade-gate')).toBe('palisade-wall');
    expect(gateWallCounterpart('stone-gate')).toBe('stone-wall');
  });

  it('occupies one cell, like the wall it sits in', () => {
    for (const gate of ['palisade-gate', 'stone-gate'] as const) {
      expect(getBuildingFootprint(gate)).toEqual({ width: 1, height: 1 });
    }
  });

  it('costs what the data says and outlasts its own wall', () => {
    // structures.csv: Gate — 30 stone, 2750 HP. The Palisade Gate is its
    // wooden counterpart at 30 wood.
    expect(constructionCost('stone-gate')).toEqual({ stone: 30 });
    expect(constructionCost('palisade-gate')).toEqual({ wood: 30 });
    expect(buildingMaxHp('stone-gate')).toBe(2750);
    expect(buildingMaxHp('stone-gate')).toBeGreaterThan(buildingMaxHp('stone-wall'));
    expect(buildingMaxHp('palisade-gate')).toBe(250);
  });
});

describe('who may walk through a gate', () => {
  // This is the whole point of the building, and the only way to see it is to
  // walk a unit at it. Player 1 holds a stone wall line across x=20 with a Gate
  // at (20,12); its own scout stands west of the line and an enemy scout east.
  // The gate's owner crosses; the enemy has to go around or break it down.
  function walkAcross(owner: number, from: number, to: number): boolean {
    const bridge = createSimulationBridge('gate-fixture');
    const scout = bridge.getEconomyState().units.find(
      (u) => u.owner === owner && u.unitType === 'scout',
    );
    if (!scout) throw new Error(`the gate fixture has no scout for owner ${String(owner)}`);

    const accepted = bridge.world.submitWithResult('unit.move', {
      unitId: scout.id,
      target: { x: to, y: 12 },
    });
    expect(accepted.accepted).toBe(true);

    // Long enough for a scout to cross four cells many times over, so a unit
    // that has not crossed is one that cannot.
    return stepBridgeUntil(
      bridge,
      () => {
        const now = bridge.getEconomyState().units.find((u) => u.id === scout.id);
        if (!now) return false;
        return from < to ? now.x > 20 : now.x < 20;
      },
      { maxSteps: 3000 },
    );
  }

  it('opens for the player who built it', () => {
    expect(walkAcross(1, 18, 24), 'the gate did not open for its owner').toBe(true);
  });

  it('stays shut to everyone else', () => {
    expect(walkAcross(2, 22, 16), 'an enemy walked through a closed gate').toBe(false);
  });
});

describe('the rule a gate opens by', () => {
  it('admits its owner once it is finished', () => {
    expect(gateAdmits('stone-gate', 1, true, 1)).toBe(true);
    expect(gateAdmits('palisade-gate', 2, true, 2)).toBe(true);
  });

  it('admits nobody else', () => {
    expect(gateAdmits('stone-gate', 1, true, 2)).toBe(false);
    expect(gateAdmits('stone-gate', 1, true, null)).toBe(false);
    expect(gateAdmits('stone-gate', null, true, 1)).toBe(false);
  });

  it('admits nobody while it is still being built', () => {
    // A construction site is a hole its builder has not closed yet, not a door.
    expect(gateAdmits('stone-gate', 1, false, 1)).toBe(false);
    expect(gateAdmits('palisade-gate', 1, false, 1)).toBe(false);
  });

  it('admits nobody through a plain wall', () => {
    expect(gateAdmits('stone-wall', 1, true, 1)).toBe(false);
    expect(gateAdmits('palisade-wall', 1, true, 1)).toBe(false);
    expect(gateAdmits('castle', 1, true, 1)).toBe(false);
  });
});

describe('building a gate', () => {
  it('is offered wherever its own wall is', () => {
    const dark = buildOptionsFor(1, 'villager', () => 'dark-age',
      () => true, () => false, () => false);
    expect(dark).toContain('palisade-wall');
    expect(dark, 'a palisade wall with no gate cannot be walked out of')
      .toContain('palisade-gate');
    expect(dark).not.toContain('stone-gate');

    const castle = buildOptionsFor(1, 'villager', () => 'castle-age',
      () => true, () => false, () => false);
    expect(castle).toContain('stone-wall');
    expect(castle).toContain('stone-gate');
  });
});
