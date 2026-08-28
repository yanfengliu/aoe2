// Civilization-bonus DERIVED layer (v0.1.81), first slice: Britons villagers
// gather SHEEP 25% faster ("Shepherds work 25% faster", civilizations.csv).
// The pure helper mirrors economyTechEffects/visionTechEffects — a multiplier
// derived from the owner's civilization + the resource kind, read at the
// villager gather-tick site alongside the tech gather-rate multiplier.

import { ageScaledUnitHpFactor } from '../../src/game/simulation/ageScaledHp';
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  AZTECS_MILITARY_TRAIN_TIME_MULTIPLIER,
  BRITONS_SHEEP_GATHER_MULTIPLIER,
  MONGOLS_BOAR_GATHER_MULTIPLIER,
  civBuildingAttackBonus,
  civGatherRateMultiplier,
  civTrainTimeMultiplier,
  civUnitHpMultiplier,
  effectiveTrainingCost,
} from '../../src/game/simulation/civBonusEffects';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';

// Total sheep-food owner 1 has harvested = deposited-since-start + currently
// carried. Monotonic across deposit trips, so it cleanly reflects gather rate.
function ownerOneHarvested(bridge: ReturnType<typeof createSimulationBridge>): number {
  const econ = bridge.getEconomyState();
  const depositedDelta = econ.playerResources[1].food - 200; // standard start
  const villager = econ.villagers.find((v) => v.owner === 1);
  return depositedDelta + (villager?.carriedAmount ?? 0);
}

const NO_TECHS: ReadonlySet<import('../../src/game/simulation/types').ResearchableTechnologyType> = new Set();

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

// v0.1.98: Mongols "Hunters work 50% faster" (civilizations.csv). Mirrors the
// Britons shepherd bonus on the SAME gather-tick site — a gather-rate multiplier
// keyed on (civ, kind), here Mongols + boar (the sim's huntable food; sheep is
// a herdable owned by Britons, fish is fished). The site is kind-agnostic, so
// the integration path is the one the Britons sheep live-race already validates.
describe('civGatherRateMultiplier — Mongols hunter bonus', () => {
  it('gives Mongols +40% ONLY on boar (sourced v0.3.144)', () => {
    expect(civGatherRateMultiplier('Mongols', 'boar')).toBe(MONGOLS_BOAR_GATHER_MULTIPLIER);
    expect(MONGOLS_BOAR_GATHER_MULTIPLIER).toBe(1.4);
  });

  it('does not touch Mongols gathering herded sheep, berries, farms, or non-food kinds', () => {
    // "Hunters" is boar-specific — sheep (herded, Britons' bonus), berries,
    // farms, wood, and gold are unaffected.
    expect(civGatherRateMultiplier('Mongols', 'sheep')).toBe(1);
    expect(civGatherRateMultiplier('Mongols', 'berry-bush')).toBe(1);
    expect(civGatherRateMultiplier('Mongols', 'farm')).toBe(1);
    expect(civGatherRateMultiplier('Mongols', 'tree')).toBe(1);
    expect(civGatherRateMultiplier('Mongols', 'gold-mine')).toBe(1);
  });

  it('gives no boar bonus to any other civilization or an unknown civ', () => {
    expect(civGatherRateMultiplier('Britons', 'boar')).toBe(1);
    expect(civGatherRateMultiplier('Franks', 'boar')).toBe(1);
    expect(civGatherRateMultiplier('Goths', 'boar')).toBe(1);
    expect(civGatherRateMultiplier(undefined, 'boar')).toBe(1);
  });
});

describe('civUnitHpMultiplier — Franks knight bonus', () => {
  it('moved the Franks mounted HP to the Feudal-gated age ladder (v0.3.148)', () => {
    expect(civUnitHpMultiplier('Franks', 'knight')).toBe(1);
    expect(ageScaledUnitHpFactor('Franks', 'knight', 'feudal-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Franks', 'camel', 'castle-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Franks', 'scout', 'dark-age')).toBe(1);
  });

  it('does not touch Franks foot units, and mounted only from Feudal', () => {
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

describe('civBuildingAttackLadder — Goths per-age anti-building (sourced v0.3.152)', () => {
  it('steps +1/+2/+3 for infantry only, and the flat table entry is retired', async () => {
    const { civBuildingAttackLadder } = await import('../../src/game/simulation/civBonusEffects');
    expect(civBuildingAttackBonus('Goths', 'militia')).toBe(0);
    expect(civBuildingAttackLadder('Goths', 'spearman', 'castle-age')).toBe(2);
    expect(civBuildingAttackLadder('Goths', 'archer', 'imperial-age')).toBe(0);
    expect(civBuildingAttackLadder('Britons', 'militia', 'imperial-age')).toBe(0);
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

// v0.1.99: Mongols "Light Cavalry and Hussars have +30% HP" (civilizations.csv),
// the same civUnitHpMultiplier seam as the Franks knight bonus. Scoped to the
// UPGRADED scout line (light-cavalry, hussar); the base Scout Cavalry is excluded
// per the CSV (it carries the +2 LoS instead).
describe('civUnitHpMultiplier — Mongols scout-line HP bonus', () => {
  it('moved the Mongol scout-line HP to the Castle/Imperial ladder (v0.3.148)', () => {
    expect(civUnitHpMultiplier('Mongols', 'light-cavalry')).toBe(1);
    expect(ageScaledUnitHpFactor('Mongols', 'light-cavalry', 'castle-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Mongols', 'hussar', 'imperial-age')).toBeCloseTo(1.3, 5);
    expect(ageScaledUnitHpFactor('Mongols', 'scout', 'feudal-age')).toBe(1);
    expect(ageScaledUnitHpFactor('Mongols', 'knight', 'imperial-age')).toBe(1);
  });

  it('does not touch the base Scout Cavalry or other Mongols units', () => {
    // The CSV bonus is "Light Cavalry and Hussars" — the base scout is excluded.
    expect(civUnitHpMultiplier('Mongols', 'scout')).toBe(1);
    expect(civUnitHpMultiplier('Mongols', 'knight')).toBe(1);
    expect(civUnitHpMultiplier('Mongols', 'villager')).toBe(1);
  });

  it('gives no scout-line HP bonus to any other civilization or an unknown civ', () => {
    expect(civUnitHpMultiplier('Franks', 'light-cavalry')).toBe(1);
    expect(civUnitHpMultiplier('Byzantines', 'hussar')).toBe(1);
    expect(civUnitHpMultiplier(undefined, 'light-cavalry')).toBe(1);
  });
});

describe('Mongols scout-line bonus — live twin-fixture HP', () => {
  it('a Mongols light cavalry has round(base × 1.2) maxHp at Castle Age (the sourced ladder); a control has the base', () => {
    const mongols = createSimulationBridge('civ-mongols-scout-fixture');
    const control = createSimulationBridge('civ-mongols-scout-control-fixture');
    // One step so combat state is projected; HP is set at creation (no research).
    mongols.step(100);
    control.step(100);

    const lightCavId = (bridge: ReturnType<typeof createSimulationBridge>) =>
      bridge.getEconomyState().units.find(
        (u) => u.owner === 1 && u.unitType === 'light-cavalry',
      )?.id;
    const mongolsId = lightCavId(mongols);
    const controlId = lightCavId(control);
    expect(mongolsId).toBeDefined();
    expect(controlId).toBeDefined();

    const mongolsHp = mongols.getEntityHealth(mongolsId!)!;
    const controlHp = control.getEntityHealth(controlId!)!;

    // Control is the raw base; Mongols is +30% (rounded), on both current and
    // max since a freshly-created unit is at full HP.
    expect(controlHp.maxHp).toBeGreaterThan(0);
    // Castle Age rung of the +20/30% ladder (v0.3.148).
    expect(mongolsHp.maxHp).toBe(Math.round(controlHp.maxHp! * 1.2));
    expect(mongolsHp.currentHp).toBe(mongolsHp.maxHp);
  });
});

describe('effectiveTrainingCost — Goths infantry ladder (sourced v0.3.146)', () => {
  it('discounts Goths infantry -15/20/25/30% by age, Dark included', () => {
    // Militia base 60 food / 20 gold.
    expect(effectiveTrainingCost('Goths', 'dark-age', 'militia', NO_TECHS)).toEqual({ food: 51, gold: 17 });
    expect(effectiveTrainingCost('Goths', 'feudal-age', 'militia', NO_TECHS)).toEqual({ food: 48, gold: 16 });
    // Spearman base 35 food / 25 wood → ×0.75 Castle = 26 / 19.
    expect(effectiveTrainingCost('Goths', 'castle-age', 'spearman', NO_TECHS)).toEqual({ food: 26, wood: 19 });
    expect(effectiveTrainingCost('Goths', 'imperial-age', 'militia', NO_TECHS)).toEqual({ food: 42, gold: 14 });
  });

  it('does NOT discount Goths non-infantry (archers, cavalry, siege, villagers)', () => {
    expect(effectiveTrainingCost('Goths', 'imperial-age', 'archer', NO_TECHS)).toEqual(trainingCost('archer'));
    expect(effectiveTrainingCost('Goths', 'imperial-age', 'knight', NO_TECHS)).toEqual(trainingCost('knight'));
    expect(effectiveTrainingCost('Goths', 'feudal-age', 'villager', NO_TECHS)).toEqual(trainingCost('villager'));
  });

  it('returns the base cost for any other civilization or an unknown civ', () => {
    expect(effectiveTrainingCost('Franks', 'feudal-age', 'militia', NO_TECHS)).toEqual(trainingCost('militia'));
    expect(effectiveTrainingCost(undefined, 'castle-age', 'spearman', NO_TECHS)).toEqual(trainingCost('spearman'));
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

describe('Goths −35% infantry cost — live twin-fixture (gate + charge agree)', () => {
  it('a Goths Barracks trains a Militia the control cannot afford, charging the discount', () => {
    const goths = createSimulationBridge('civ-goths-cost-fixture');
    const control = createSimulationBridge('civ-goths-cost-control-fixture');

    // Both start with 55 food / 18 gold — enough for the Goths-discounted
    // Feudal Militia (48/16, sourced ladder) but not the base one (60/20).
    for (const bridge of [goths, control]) {
      expect(bridge.selectEntityAtCell(4, 10)).toBe(true); // Barracks
      expect(bridge.getSelectionState().selectedEntityType).toBe('barracks');
    }

    // Goths: the affordability GATE accepts (validator uses the discount); a
    // step processes the queued command and the CHARGE spends the discounted
    // 39/13 (both gate and charge use effectiveTrainingCost), leaving 11/2.
    expect(goths.queueTrainUnit('militia')).toBe(true);
    goths.step(100);
    const gothsRes = goths.getEconomyState().playerResources[1];
    expect(gothsRes.food).toBe(7);
    expect(gothsRes.gold).toBe(2);

    // Control (non-Goths): can't afford the base Militia (60/20), so the gate
    // rejects synchronously and nothing is charged.
    expect(control.queueTrainUnit('militia')).toBe(false);
    control.step(100);
    const controlRes = control.getEconomyState().playerResources[1];
    expect(controlRes.food).toBe(55);
    expect(controlRes.gold).toBe(18);
  });
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
    // compounds past one carry-load of trip-phase noise, short of exhausting
    // the sheep. Window re-derived for the §6.3 pacing retune (v0.3.159):
    // sheep is 1 food/30 ticks now, so 2400 ticks gives control ~75 vs
    // Britons ~95 — a margin far past the +5 assertion.
    for (let i = 0; i < 2400; i += 1) {
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

// NOTE: unlike the Britons SHEEP live-race, there is no Mongols BOAR live-race.
// A boar is huntable wildlife that fights back (wildlifeCombatSystem), so a lone
// villager commanded onto a live boar is killed before it harvests any meat —
// a faithful AoE2 behavior (you cannot solo a boar). The pure cases above fully
// cover the multiplier, and its single use-site — the kind-agnostic
// `civGatherRateMultiplier(civ, kind)` call in villagerEconomySystem — is the
// exact integration path proven by the Britons sheep race, so a boar-specific
// live race would only re-exercise already-validated code through an infeasible
// scenario.
