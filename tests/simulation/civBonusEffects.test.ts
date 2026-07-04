// Civilization-bonus DERIVED layer (v0.1.81), first slice: Britons villagers
// gather SHEEP 25% faster ("Shepherds work 25% faster", civilizations.csv).
// The pure helper mirrors economyTechEffects/visionTechEffects — a multiplier
// derived from the owner's civilization + the resource kind, read at the
// villager gather-tick site alongside the tech gather-rate multiplier.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  AZTECS_MILITARY_TRAIN_TIME_MULTIPLIER,
  BRITONS_SHEEP_GATHER_MULTIPLIER,
  FRANKS_KNIGHT_HP_MULTIPLIER,
  GOTHS_INFANTRY_BUILDING_ATTACK_BONUS,
  civBuildingAttackBonus,
  civGatherRateMultiplier,
  civTrainTimeMultiplier,
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

describe('civBuildingAttackBonus — Goths infantry-vs-buildings bonus', () => {
  it('gives Goths infantry +1 attack vs buildings', () => {
    expect(civBuildingAttackBonus('Goths', 'militia')).toBe(GOTHS_INFANTRY_BUILDING_ATTACK_BONUS);
    expect(civBuildingAttackBonus('Goths', 'spearman')).toBe(1);
    expect(civBuildingAttackBonus('Goths', 'champion')).toBe(1);
    expect(civBuildingAttackBonus('Goths', 'halberdier')).toBe(1);
    expect(GOTHS_INFANTRY_BUILDING_ATTACK_BONUS).toBe(1);
  });

  it('does not touch Goths non-infantry attackers', () => {
    expect(civBuildingAttackBonus('Goths', 'archer')).toBe(0);
    expect(civBuildingAttackBonus('Goths', 'knight')).toBe(0);
    expect(civBuildingAttackBonus('Goths', 'battering-ram')).toBe(0);
    expect(civBuildingAttackBonus('Goths', 'villager')).toBe(0);
  });

  it('gives no bonus to any other civilization or an unknown civ', () => {
    expect(civBuildingAttackBonus('Franks', 'militia')).toBe(0);
    expect(civBuildingAttackBonus('Britons', 'champion')).toBe(0);
    expect(civBuildingAttackBonus(undefined, 'militia')).toBe(0);
    expect(civBuildingAttackBonus('', 'militia')).toBe(0);
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

describe('civTrainTimeMultiplier — Aztecs military creation speed', () => {
  it('trains Aztecs military units 15% faster (×0.85)', () => {
    expect(civTrainTimeMultiplier('Aztecs', 'militia')).toBe(AZTECS_MILITARY_TRAIN_TIME_MULTIPLIER);
    expect(civTrainTimeMultiplier('Aztecs', 'archer')).toBe(0.85);
    expect(civTrainTimeMultiplier('Aztecs', 'knight')).toBe(0.85);
    expect(civTrainTimeMultiplier('Aztecs', 'monk')).toBe(0.85);
    expect(AZTECS_MILITARY_TRAIN_TIME_MULTIPLIER).toBe(0.85);
  });

  it('does NOT speed up Aztecs villager training (military only)', () => {
    expect(civTrainTimeMultiplier('Aztecs', 'villager')).toBe(1);
  });

  it('gives no bonus to any other civilization or an unknown civ', () => {
    expect(civTrainTimeMultiplier('Franks', 'militia')).toBe(1);
    expect(civTrainTimeMultiplier('Goths', 'knight')).toBe(1);
    expect(civTrainTimeMultiplier(undefined, 'militia')).toBe(1);
    expect(civTrainTimeMultiplier('', 'militia')).toBe(1);
  });
});

describe('Aztecs creation-speed bonus — live twin-fixture train race', () => {
  it('an Aztecs Barracks trains a Militia in fewer ticks than a control', () => {
    const ticksToMilitia = (fixtureName: string): number => {
      const bridge = createSimulationBridge(fixtureName);
      expect(bridge.selectEntityAtCell(4, 10)).toBe(true); // the Barracks
      expect(bridge.getSelectionState().selectedEntityType).toBe('barracks');
      expect(bridge.queueTrainUnit('militia')).toBe(true);
      const militiaCount = () =>
        bridge.getEconomyState().units.filter((u) => u.owner === 1 && u.unitType === 'militia').length;
      let ticks = 0;
      while (militiaCount() < 1 && ticks < 600) {
        bridge.step(100);
        ticks += 1;
      }
      expect(militiaCount()).toBe(1);
      return ticks;
    };

    const aztecs = ticksToMilitia('civ-aztecs-train-fixture');
    const control = ticksToMilitia('civ-aztecs-train-control-fixture');
    // Aztecs train military 15% faster → the Militia appears in strictly fewer
    // ticks (both trained the same unit from the same base time).
    expect(control).toBeGreaterThan(0);
    expect(aztecs).toBeLessThan(control);
  }, 30_000);
});

describe('Goths infantry-vs-buildings bonus — live twin-fixture raze race', () => {
  it('a Goths militia razes a building faster than a non-Goths militia', () => {
    const goths = createSimulationBridge('civ-goths-infantry-fixture');
    const control = createSimulationBridge('civ-goths-infantry-control-fixture');

    const houseId = (bridge: ReturnType<typeof createSimulationBridge>) =>
      bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === 'house')?.id;
    const gHouse = houseId(goths);
    const cHouse = houseId(control);
    expect(gHouse).toBeDefined();
    expect(cHouse).toBeDefined();

    // Command each owner-1 militia (identical geometry) onto the enemy house.
    for (const [bridge, id] of [[goths, gHouse], [control, cHouse]] as const) {
      expect(bridge.selectEntityAtCell(13, 8)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(id!)).toBe(true);
    }

    // Step a fixed window: the militia lands the same number of hits in each
    // run, and the Goths militia deals +1 vs the building per hit.
    for (let i = 0; i < 120; i += 1) {
      goths.step(100);
      control.step(100);
    }

    // Destroyed → 0 remaining HP.
    const remaining = (bridge: ReturnType<typeof createSimulationBridge>, id: number) =>
      bridge.getEntityHealth(id)?.currentHp ?? 0;
    const gHp = remaining(goths, gHouse!);
    const cHp = remaining(control, cHouse!);

    // The control militia actually damaged the house (guards a no-op fixture).
    expect(cHp).toBeGreaterThan(0);
    // Goths' +1/hit leaves the house strictly lower after the same window.
    expect(gHp).toBeLessThan(cHp);
  }, 30_000);
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
