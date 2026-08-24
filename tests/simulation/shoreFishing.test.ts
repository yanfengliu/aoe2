import { describe, expect, it } from 'vitest';

import { canGathererHarvest } from '../../src/game/simulation/gatherDomain';
import { isShoreFish } from '../../src/game/simulation/shoreFishing';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEEP_FISH, SHORE_FISH } from '../../src/game/simulation/fixtures/shoreFishing';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

// Age of Empires II gathers SHORE fish with villagers standing on the land
// beside them — no Dock, no Fishing Ship — and leaves open water to boats. This
// build models fish as one water resource, so the difference is geometric: a
// fish with land next to it is a shore fish.
//
// A player could already do it by hand (right-click a shore fish with a
// villager and it walks over and works it). What could not happen was the
// AUTOMATIC half — the domain filter vetoed fish for every land gatherer, so no
// AI and no un-ordered villager ever took one, and fourteen fish sat untouched
// beside the shore in the 36000-tick match that froze.

describe('isShoreFish — the geometry', () => {
  it('is true when any of the eight neighbours is land', () => {
    const landAt = (cells: ReadonlyArray<readonly [number, number]>) =>
      (x: number, y: number) => cells.some(([cx, cy]) => cx === x && cy === y);
    // Orthogonal.
    expect(isShoreFish({ x: 20, y: 12 }, landAt([[19, 12]]))).toBe(true);
    // Diagonal — a villager can stand there too.
    expect(isShoreFish({ x: 20, y: 12 }, landAt([[19, 11]]))).toBe(true);
    // Two cells out is open water.
    expect(isShoreFish({ x: 20, y: 12 }, landAt([[18, 12]]))).toBe(false);
  });

  it('is false in open water', () => {
    expect(isShoreFish({ x: 25, y: 16 }, () => false)).toBe(false);
  });

  it('floors a fractional position, because units interpolate', () => {
    expect(isShoreFish({ x: 20.7, y: 12.4 }, (x, y) => x === 19 && y === 12)).toBe(true);
  });
});

describe('canGathererHarvest — the domain rule with its one exception', () => {
  it('lets a villager work a fish only when it is on the shore', () => {
    expect(canGathererHarvest('villager', 'fish', { onShore: true })).toBe(true);
    expect(canGathererHarvest('villager', 'fish', { onShore: false })).toBe(false);
    expect(canGathererHarvest('villager', 'fish')).toBe(false);
  });

  it('leaves the rest of the domain rule alone', () => {
    expect(canGathererHarvest('fishing-ship', 'fish')).toBe(true);
    expect(canGathererHarvest('fishing-ship', 'tree')).toBe(false);
    expect(canGathererHarvest('villager', 'tree')).toBe(true);
    expect(canGathererHarvest('villager', 'berry-bush')).toBe(true);
  });

  it('lets a fishing ship work a shore fish too, as AoE2 does', () => {
    expect(canGathererHarvest('fishing-ship', 'fish', { onShore: true })).toBe(true);
  });
});

describe('villagers fish the shore on their own', () => {
  it('gathers the shore fish and never targets the deep one', () => {
    const bridge = createSimulationBridge('shore-fishing-fixture', {
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    });
    // The fixture's premise: no food on land at all, one fish against the
    // shore and one in open water.
    const before = bridge.getEconomyState();
    expect(before.playerResources[1]!.food).toBe(0);
    const fish = (before.resources ?? []).filter((r) => r.resourceType === 'fish');
    expect(fish).toHaveLength(2);

    for (let step = 0; step < 1_200; step += 1) bridge.step(100);

    const after = bridge.getEconomyState();
    const shore = (after.resources ?? []).find(
      (r) => r.x === SHORE_FISH.x && r.y === SHORE_FISH.y,
    );
    const deep = (after.resources ?? []).find(
      (r) => r.x === DEEP_FISH.x && r.y === DEEP_FISH.y,
    );
    // The shore fish is being eaten and the food is arriving.
    expect((shore?.amount ?? 0)).toBeLessThan(200);
    expect(after.playerResources[1]!.food).toBeGreaterThan(0);
    // The deep one is untouched: no villager can stand beside it, and sending
    // one is the walk-to-the-coast-forever failure this rule exists to avoid.
    expect(deep?.amount).toBe(200);
  }, 60_000);
});
