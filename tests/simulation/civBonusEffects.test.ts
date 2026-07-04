// Civilization-bonus DERIVED layer (v0.1.81), first slice: Britons villagers
// gather SHEEP 25% faster ("Shepherds work 25% faster", civilizations.csv).
// The pure helper mirrors economyTechEffects/visionTechEffects — a multiplier
// derived from the owner's civilization + the resource kind, read at the
// villager gather-tick site alongside the tech gather-rate multiplier.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BRITONS_SHEEP_GATHER_MULTIPLIER,
  civGatherRateMultiplier,
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
