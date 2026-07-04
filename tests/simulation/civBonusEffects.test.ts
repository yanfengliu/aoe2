// Civilization-bonus DERIVED layer (v0.1.81), first slice: Britons villagers
// gather SHEEP 25% faster ("Shepherds work 25% faster", civilizations.csv).
// The pure helper mirrors economyTechEffects/visionTechEffects — a multiplier
// derived from the owner's civilization + the resource kind, read at the
// villager gather-tick site alongside the tech gather-rate multiplier.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BRITONS_SHEEP_GATHER_MULTIPLIER,
  FRANKS_KNIGHT_HP_MULTIPLIER,
  civGatherRateMultiplier,
  civUnitHpMultiplier,
} from '../../src/game/simulation/civBonusEffects';

// Total sheep-food owner 1 has harvested = deposited-since-start + currently
// carried. Monotonic across deposit trips, so it cleanly reflects gather rate.
function ownerOneHarvested(bridge: ReturnType<typeof createSimulationBridge>): number {
  const econ = bridge.getEconomyState();
  const depositedDelta = econ.playerResources[1].food - 200; // standard start
  const villager = econ.villagers.find((v) => v.owner === 1);
  return depositedDelta + (villager?.carriedAmount ?? 0);
}

describe('civGatherRateMultiplier — Britons shepherd bonus', () => {
  it('gives Britons +25% ONLY on sheep', () => {
    expect(civGatherRateMultiplier('Britons', 'sheep')).toBe(BRITONS_SHEEP_GATHER_MULTIPLIER);
    expect(BRITONS_SHEEP_GATHER_MULTIPLIER).toBe(1.25);
  });

  it('does not touch Britons gathering other food or non-food kinds', () => {
    // "Shepherds" is sheep-specific — berries, farms, boar, and wood are
    // unaffected (this is the conformance guard against an all-food bonus).
    expect(civGatherRateMultiplier('Britons', 'berry-bush')).toBe(1);
    expect(civGatherRateMultiplier('Britons', 'farm')).toBe(1);
    expect(civGatherRateMultiplier('Britons', 'boar')).toBe(1);
    expect(civGatherRateMultiplier('Britons', 'tree')).toBe(1);
    expect(civGatherRateMultiplier('Britons', 'gold-mine')).toBe(1);
  });

  it('gives no bonus to any other civilization on sheep', () => {
    expect(civGatherRateMultiplier('Franks', 'sheep')).toBe(1);
    expect(civGatherRateMultiplier('Mongols', 'sheep')).toBe(1);
    expect(civGatherRateMultiplier('Aztecs', 'sheep')).toBe(1);
  });

  it('treats an unknown/undefined civilization as no bonus (safe default)', () => {
    expect(civGatherRateMultiplier(undefined, 'sheep')).toBe(1);
    expect(civGatherRateMultiplier('', 'sheep')).toBe(1);
    expect(civGatherRateMultiplier('Player 3', 'sheep')).toBe(1);
  });
});

describe('civUnitHpMultiplier — Franks knight bonus', () => {
  it('gives Franks +20% HP to the knight line only', () => {
    expect(civUnitHpMultiplier('Franks', 'knight')).toBe(FRANKS_KNIGHT_HP_MULTIPLIER);
    expect(civUnitHpMultiplier('Franks', 'cavalier')).toBe(FRANKS_KNIGHT_HP_MULTIPLIER);
    expect(civUnitHpMultiplier('Franks', 'paladin')).toBe(FRANKS_KNIGHT_HP_MULTIPLIER);
    expect(FRANKS_KNIGHT_HP_MULTIPLIER).toBe(1.2);
  });

  it('does not touch Franks non-knight cavalry, camels, scouts, or other units', () => {
    // The bonus is the Knight line (knight/cavalier/paladin) only — NOT the
    // scout line, camels, or cavalry archers.
    expect(civUnitHpMultiplier('Franks', 'scout')).toBe(1);
    expect(civUnitHpMultiplier('Franks', 'light-cavalry')).toBe(1);
    expect(civUnitHpMultiplier('Franks', 'hussar')).toBe(1);
    expect(civUnitHpMultiplier('Franks', 'camel')).toBe(1);
    expect(civUnitHpMultiplier('Franks', 'cavalry-archer')).toBe(1);
    expect(civUnitHpMultiplier('Franks', 'militia')).toBe(1);
    expect(civUnitHpMultiplier('Franks', 'villager')).toBe(1);
  });

  it('gives no HP bonus to any other civilization or an unknown civ', () => {
    expect(civUnitHpMultiplier('Britons', 'knight')).toBe(1);
    expect(civUnitHpMultiplier('Goths', 'paladin')).toBe(1);
    expect(civUnitHpMultiplier(undefined, 'knight')).toBe(1);
    expect(civUnitHpMultiplier('', 'knight')).toBe(1);
  });
});

describe('Franks knight bonus — live twin-fixture HP', () => {
  it('a Franks knight has round(base × 1.2) maxHp; a control knight has the base', () => {
    const franks = createSimulationBridge('civ-franks-knight-fixture');
    const control = createSimulationBridge('civ-franks-knight-control-fixture');
    // One step so combat state is projected; HP is set at creation (no research).
    franks.step(100);
    control.step(100);

    const knightId = (bridge: ReturnType<typeof createSimulationBridge>) =>
      bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'knight')?.id;
    const franksId = knightId(franks);
    const controlId = knightId(control);
    expect(franksId).toBeDefined();
    expect(controlId).toBeDefined();

    const franksHp = franks.getEntityHealth(franksId!)!;
    const controlHp = control.getEntityHealth(controlId!)!;

    // Control is the raw base; Franks is +20% (rounded), applied to both current
    // and max since a freshly-created knight is at full HP.
    expect(controlHp.maxHp).toBeGreaterThan(0);
    expect(franksHp.maxHp).toBe(Math.round(controlHp.maxHp! * 1.2));
    expect(franksHp.currentHp).toBe(franksHp.maxHp);
  });
});

describe('Britons shepherd bonus — live twin-fixture sheep race', () => {
  it('a Britons villager harvests sheep faster than a non-Britons villager', () => {
    const britons = createSimulationBridge('civ-shepherd-britons-fixture');
    const control = createSimulationBridge('civ-shepherd-control-fixture');

    // Command each owner-1 villager (identical geometry) onto its sheep.
    for (const bridge of [britons, control]) {
      expect(bridge.selectEntityAtCell(9, 6)).toBe(true);
      expect(bridge.issueContextCommand(10, 6)).toBe(true);
    }

    // Step both the same window. Over many gather+deposit cycles the 25% edge
    // compounds past one carry-load of trip-phase noise (deterministic here:
    // control ~100 vs Britons ~110 harvested), short of exhausting the sheep.
    for (let i = 0; i < 600; i += 1) {
      britons.step(100);
      control.step(100);
    }

    const britonsHarvest = ownerOneHarvested(britons);
    const controlHarvest = ownerOneHarvested(control);

    // Both actually gathered (guards against a fixture/command regression that
    // would make BOTH zero and pass a naive greater-than by 0 === 0).
    expect(controlHarvest).toBeGreaterThan(0);
    // Britons gathers sheep 25% faster, so it harvests clearly more in the
    // same window (a real margin, not a tie).
    expect(britonsHarvest).toBeGreaterThan(controlHarvest + 5);
  }, 60_000);
});
