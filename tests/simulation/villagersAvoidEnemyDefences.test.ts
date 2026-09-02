// The 2026-09-02 register entry, reproduced at its cheapest: one villager, one
// enemy Town Centre, and the resource it would have walked under. Through the
// real bridge — the fixture's only moving part is the villager-economy
// system's own assignment (the AI planner is off), and the hunt case runs the
// AI's hunt phase with nothing else to do.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { distanceFromBuildingFootprint } from '../../src/game/simulation/bridge/pureHelpers';
import {
  ENEMY_DEFENCE_DANGEROUS_BOAR,
  ENEMY_DEFENCE_DANGEROUS_BUSH,
  ENEMY_DEFENCE_SAFE_BOAR,
  ENEMY_DEFENCE_SAFE_BUSH,
  ENEMY_DEFENCE_SAFE_TREE,
} from '../../src/game/simulation/fixtures/enemyDefences';
import type { GathererComponent } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

function resourceAt(bridge: Bridge, at: { x: number; y: number }): number {
  const resource = bridge.getEconomyState().resources.find((r) => r.x === at.x && r.y === at.y);
  expect(resource, `fixture has no resource at ${at.x},${at.y}`).toBeDefined();
  return resource!.id;
}

function firstAssignment(seed: string) {
  const bridge = createSimulationBridge(seed);
  // The villager spawns idle and the economy system assigns it on its first
  // pass; a few ticks leave no doubt the assignment has run.
  for (let i = 0; i < 3; i += 1) bridge.step(100);
  const villager = bridge.getEconomyState().units.find((u) => u.owner === 2 && u.unitType === 'villager');
  expect(villager).toBeDefined();
  const gatherer = bridge.world.getComponent<GathererComponent>(villager!.id, 'gatherer');
  expect(gatherer).toBeDefined();
  return { bridge, gatherer: gatherer! };
}

describe('automatic gather assignment keeps out of an enemy Town Centre\'s reach', () => {
  it('sends the villager to the far bush rather than the nearer one under the enemy Town Centre', () => {
    const { bridge, gatherer } = firstAssignment('enemy-defence-gather-fixture');
    expect(gatherer.desiredResource).toBe('food');
    expect(gatherer.task).toBe('to-resource');
    expect(gatherer.targetResourceId).toBe(resourceAt(bridge, ENEMY_DEFENCE_SAFE_BUSH));
  });

  it('still gathers the dangerous bush when nothing else of any kind exists — the exception', () => {
    const { bridge, gatherer } = firstAssignment('enemy-defence-gather-only-fixture');
    expect(gatherer.task).toBe('to-resource');
    expect(gatherer.targetResourceId).toBe(resourceAt(bridge, ENEMY_DEFENCE_DANGEROUS_BUSH));
  });

  it('falls back to a safe resource of another kind before accepting the exception', () => {
    // Seed-2's version of the defect: the home gold is gone, the only gold
    // left is in the enemy base. A villager that can chop wood safely is
    // worth more than one that dies mining under a tower, so the kind
    // fallback runs BEFORE the exception.
    const { bridge, gatherer } = firstAssignment('enemy-defence-gather-fallback-fixture');
    expect(gatherer.task).toBe('to-resource');
    expect(gatherer.targetResourceId).toBe(resourceAt(bridge, ENEMY_DEFENCE_SAFE_TREE));
  });
});

// Owner 1's Town Centre: 4x4 at (8,8), range 6, plus the rule's one-cell margin.
const ENEMY_TOWN_CENTER = { anchor: { x: 8, y: 8 }, footprint: { width: 4, height: 4 } };
const ENEMY_REACH_WITH_MARGIN = 6 + 1;

function huntOutcome(seed: string, ticks: number) {
  const bridge = createSimulationBridge(seed);
  let closestToEnemyTownCenter = Number.POSITIVE_INFINITY;
  let closestToSafeBoar = Number.POSITIVE_INFINITY;
  let closestToDangerousBoar = Number.POSITIVE_INFINITY;
  for (let tick = 1; tick <= ticks; tick += 1) {
    bridge.step(100);
    if (tick % 5 !== 0) continue;
    for (const unit of bridge.getEconomyState().units) {
      if (unit.owner !== 2 || unit.unitType !== 'villager') continue;
      closestToEnemyTownCenter = Math.min(
        closestToEnemyTownCenter,
        distanceFromBuildingFootprint(ENEMY_TOWN_CENTER.anchor, ENEMY_TOWN_CENTER.footprint, unit),
      );
      closestToSafeBoar = Math.min(
        closestToSafeBoar,
        Math.abs(unit.x - ENEMY_DEFENCE_SAFE_BOAR.x) + Math.abs(unit.y - ENEMY_DEFENCE_SAFE_BOAR.y),
      );
      closestToDangerousBoar = Math.min(
        closestToDangerousBoar,
        Math.abs(unit.x - ENEMY_DEFENCE_DANGEROUS_BOAR.x) + Math.abs(unit.y - ENEMY_DEFENCE_DANGEROUS_BOAR.y),
      );
    }
  }
  return { closestToEnemyTownCenter, closestToSafeBoar, closestToDangerousBoar };
}

describe('the AI hunt phase keeps its party out of an enemy Town Centre\'s reach', () => {
  it('hunts the far boar rather than the nearer one beside the enemy Town Centre', () => {
    const outcome = huntOutcome('enemy-defence-hunt-fixture', 2_000);
    // The party closed on the safe boar (a hunter stands adjacent to it)...
    expect(outcome.closestToSafeBoar).toBeLessThanOrEqual(2);
    // ...and no villager ever came within the enemy Town Centre's reach.
    expect(outcome.closestToEnemyTownCenter).toBeGreaterThan(ENEMY_REACH_WITH_MARGIN);
  }, 120_000);

  it('still hunts the dangerous boar when it is the only one — the exception', () => {
    const outcome = huntOutcome('enemy-defence-hunt-only-fixture', 2_000);
    expect(outcome.closestToDangerousBoar).toBeLessThanOrEqual(3);
  }, 120_000);
});
