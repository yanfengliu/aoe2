// Garrison healing: a unit garrisoned inside a building slowly regenerates
// HP each tick (AoE2 passive garrison heal). These tests drive the real
// bridge — spawn a pre-wounded unit, garrison it via the context command,
// then step and read the garrisoned unit's currentHp out of the save blob
// (garrisoned units have no `position`, so getEconomyState()/cell lookups
// don't see them; the combat-state codec is the ground truth).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { combatStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import {
  GARRISON_HEAL_HP_PER_TICK,
  garrisonHealStep,
} from '../../src/game/simulation/bridge/systems/garrisonHealSystem';
import {
  HERBAL_MEDICINE_HEAL_MULTIPLIER,
  garrisonHealRateMultiplier,
} from '../../src/game/simulation/monasteryTechEffects';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { codecSlotValue } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;

interface CombatEntry {
  currentHp: number;
  maxHp: number;
}

// The combat-state slot serializes as an array of [entityId, value] pairs
// (flatMapCodec JSON form). Look a single entity's entry up out of that.
function combatEntryOf(bridge: Bridge, unitId: number): CombatEntry | null {
  const pairs = codecSlotValue(bridge.saveGame(), combatStatesCodec) as Array<
    [number, CombatEntry]
  >;
  const found = pairs.find(([id]) => id === unitId);
  return found ? found[1] : null;
}

// Read a single entity's currentHp from the combat-state slot of a save
// blob. Works for garrisoned units (no position) as well as field units.
function combatHpOf(bridge: Bridge, unitId: number): number | null {
  return combatEntryOf(bridge, unitId)?.currentHp ?? null;
}

function combatMaxHpOf(bridge: Bridge, unitId: number): number | null {
  return combatEntryOf(bridge, unitId)?.maxHp ?? null;
}

// Garrison the given unit into the given building and step once so the
// context command lands. Returns after the unit is confirmed garrisoned.
function garrison(bridge: Bridge, unitX: number, unitY: number, buildingId: number): void {
  expect(bridge.selectEntityAtCell(unitX, unitY)).toBe(true);
  expect(bridge.issueContextCommandAtEntity(buildingId)).toBe(true);
  bridge.step(100);
}

describe('garrison healing', () => {
  it('a damaged garrisoned unit heals over N ticks and never exceeds maxHp', () => {
    const bridge = createSimulationBridge('garrison-heal-fixture');
    const tc = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
    expect(tc).toBeDefined();

    // The pre-wounded villager sits at (12, 10) at startHp = 5.
    const wounded = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'villager' && u.x === 12 && u.y === 10);
    expect(wounded).toBeDefined();
    const woundedId = wounded!.id;

    const startHp = combatHpOf(bridge, woundedId);
    expect(startHp).toBe(5);
    const maxHp = combatMaxHpOf(bridge, woundedId);
    expect(maxHp).not.toBeNull();

    garrison(bridge, 12, 10, tc!.id);

    // Step a handful of ticks and confirm HP rose but never overshot max.
    bridge.step(100 * 20); // 20 ticks
    const hpAfter = combatHpOf(bridge, woundedId);
    expect(hpAfter).not.toBeNull();
    expect(hpAfter!).toBeGreaterThan(startHp!);
    expect(hpAfter!).toBeLessThanOrEqual(maxHp!);
  });

  it('heals up to exactly maxHp and then stops (no overheal)', () => {
    const bridge = createSimulationBridge('garrison-heal-fixture');
    const tc = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
    expect(tc).toBeDefined();

    const wounded = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'villager' && u.x === 12 && u.y === 10);
    expect(wounded).toBeDefined();
    const woundedId = wounded!.id;
    const maxHp = combatMaxHpOf(bridge, woundedId)!;

    garrison(bridge, 12, 10, tc!.id);

    // Step far past full heal (from 5 HP at 0.4/tick that is < 100 ticks;
    // step 500 to be safe), then confirm it settled at exactly maxHp.
    bridge.step(100 * 500);
    const hpFull = combatHpOf(bridge, woundedId);
    expect(hpFull).toBe(maxHp);

    // Step further; must not exceed max.
    bridge.step(100 * 100);
    const hpStill = combatHpOf(bridge, woundedId);
    expect(hpStill).toBe(maxHp);
  });

  it('does NOT heal a damaged unit standing on the field (only garrisoned units)', () => {
    const bridge = createSimulationBridge('garrison-heal-fixture');

    // The control villager sits at (14, 10) at startHp = 5 and is NEVER
    // garrisoned. There is no other passive-heal mechanism, so its HP must
    // stay flat across the same step budget that fully heals a garrisoned
    // unit.
    const control = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'villager' && u.x === 14 && u.y === 10);
    expect(control).toBeDefined();
    const controlId = control!.id;
    const startHp = combatHpOf(bridge, controlId);
    expect(startHp).toBe(5);

    bridge.step(100 * 500);

    const hpAfter = combatHpOf(bridge, controlId);
    expect(hpAfter).toBe(startHp);
  });

  it('garrisonHealStep: adds the heal rate, caps at maxHp, ignores dead/full units', () => {
    // Below max: adds exactly the rate.
    expect(garrisonHealStep(5, 40)).toBeCloseTo(5 + GARRISON_HEAL_HP_PER_TICK, 6);

    // One step below max would overshoot: clamps to max.
    expect(garrisonHealStep(40 - GARRISON_HEAL_HP_PER_TICK / 2, 40)).toBe(40);

    // Already at max: unchanged (returns max, no overheal).
    expect(garrisonHealStep(40, 40)).toBe(40);

    // At/below 0 (dead): unchanged — never revives.
    expect(garrisonHealStep(0, 40)).toBe(0);
    expect(garrisonHealStep(-3, 40)).toBe(-3);

    // The rate is a small deterministic fixed fraction, not zero/integer-only.
    expect(GARRISON_HEAL_HP_PER_TICK).toBeGreaterThan(0);
    expect(GARRISON_HEAL_HP_PER_TICK).toBeLessThan(1);
  });
});

// Herbal Medicine (v0.1.70): a Castle-Age Monastery tech (technologies.csv:65,
// 350 gold) that makes an owner's GARRISONED units heal 4× faster — a DERIVED
// multiplier on the v0.1.63 garrison-heal rate, read from the researched set at
// the garrison-heal site (monasteryTechEffects), no per-unit state, no save
// change.
const NO_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();
const HERBAL_ONLY: ReadonlySet<ResearchableTechnologyType> = new Set([
  'herbal-medicine',
] as ResearchableTechnologyType[]);

describe('Herbal Medicine — 4× garrison heal rate', () => {
  it('the rate multiplier is 4 with the tech and 1 without', () => {
    expect(HERBAL_MEDICINE_HEAL_MULTIPLIER).toBe(4);
    expect(garrisonHealRateMultiplier(NO_TECHS)).toBe(1);
    expect(garrisonHealRateMultiplier(HERBAL_ONLY)).toBe(4);
  });

  it('costs 350 gold and takes 350 ticks, researchable only at the Monastery (Castle)', () => {
    expect(researchCost('herbal-medicine')).toEqual({ gold: 350 });
    expect(researchTimeTicks('herbal-medicine')).toBe(350);
    expect(canResearchAt('monastery', 'herbal-medicine')).toBe(true);
    expect(canResearchAt('town-center', 'herbal-medicine')).toBe(false);
    expect(canResearchAt('barracks', 'herbal-medicine')).toBe(false);
  });

  it('a garrisoned unit with Herbal Medicine gains 4× the HP of a baseline over the same pre-cap window', () => {
    const HEAL_TICKS = 10; // from 5 HP: +4 (baseline) vs +16 (herbal); both < villager maxHp 25.

    function garrisonedGainOverTicks(fixture: string): number {
      const bridge = createSimulationBridge(fixture);
      const tc = bridge
        .getEconomyState()
        .buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
      expect(tc).toBeDefined();
      const wounded = bridge
        .getEconomyState()
        .units.find((u) => u.owner === 1 && u.unitType === 'villager' && u.x === 12 && u.y === 10);
      expect(wounded).toBeDefined();
      const id = wounded!.id;
      const start = combatHpOf(bridge, id)!;
      garrison(bridge, 12, 10, tc!.id);
      bridge.step(100 * HEAL_TICKS);
      const after = combatHpOf(bridge, id)!;
      expect(after).toBeLessThan(combatMaxHpOf(bridge, id)!); // stay below the cap so the ratio is clean
      return after - start;
    }

    const baselineGain = garrisonedGainOverTicks('garrison-heal-fixture');
    const herbalGain = garrisonedGainOverTicks('garrison-heal-herbal-fixture');
    expect(baselineGain).toBeGreaterThan(0);
    expect(herbalGain).toBeCloseTo(baselineGain * HERBAL_MEDICINE_HEAL_MULTIPLIER, 4);
  });
});
