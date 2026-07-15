// Automatic post-construction mining (spec §6.2, user directive 2026-07-14):
// when a Mining Camp finishes construction, every villager that was actively
// building it (its `build` unit command targets the camp at the completion
// tick) automatically receives a NORMAL `unit.gather` command on the nearest
// gold or stone mine — nearest by straight-line (Euclidean) distance from the
// completed camp among harvestable mines within a 7-cell radius, ties broken
// by lowest entity id. No mine in radius -> the builders go idle exactly as
// before. The auto-order flows through the pending-intention queue (drained,
// validated, recorded), never preempts an explicit queued player order, and
// applies to human and AI-owned villagers identically.
//
// Geometry lives in `auto-mine-camp-fixture` (fixtures/construction.ts); the
// camp anchor chosen per test steers nearest/tie/depleted/no-mine cases.
// Save/load + replay coverage: postConstructionAutoGatherPersistence.test.ts.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  CAMP_NEAREST_ANCHOR,
  CAMP_NO_MINE_ANCHOR,
  CAMP_OWNER2_ANCHOR,
  CAMP_TIE_ANCHOR,
  gathererOf,
  mineIdAt,
  placeCampWithVillagers,
  stepUntil,
  stepUntilCampComplete,
  villagerIdsOf,
} from './postConstructionAutoGatherTestKit';

describe('automatic post-construction mining (spec §6.2)', () => {
  it('gives every active builder a normal gather order on the nearest harvestable mine, skipping a nearer depleted one', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const builders = villagerIdsOf(bridge, 1);
    expect(builders).toHaveLength(3);

    // Camp (16,15): depleted gold (16,17) is at distance 2.0 but amount 0;
    // gold (18,14) at sqrt(5) ~ 2.24 is the nearest harvestable mine.
    const depletedMine = mineIdAt(bridge, 16, 17);
    const nearestMine = mineIdAt(bridge, 18, 14);

    placeCampWithVillagers(bridge, builders, CAMP_NEAREST_ANCHOR);
    stepUntilCampComplete(bridge, CAMP_NEAREST_ANCHOR);

    // The auto-order is a real command: it drains and applies at the start
    // of the next step, exactly like an AI intention or a human right-click.
    bridge.step(100);

    for (const id of builders) {
      const gatherer = gathererOf(bridge, id);
      expect(gatherer.targetResourceId).toBe(nearestMine);
      expect(gatherer.targetResourceId).not.toBe(depletedMine);
      expect(gatherer.desiredResource).toBe('gold');
      // Same semantics as an explicit right-click gather: the standing
      // order persists across depletion/re-assign like any player order.
      expect(gatherer.hasExplicitGatherOrder).toBe(true);
      expect(['to-resource', 'gathering']).toContain(gatherer.task);
    }

    // Same drop-off rules as any gather order: the completed camp accepts
    // gold, so the owner's stockpile rises once the cycle completes.
    const goldBefore = bridge.getEconomyState().playerResources[1]!.gold;
    const deposited = stepUntil(
      bridge,
      () => bridge.getEconomyState().playerResources[1]!.gold > goldBefore,
      600,
    );
    expect(deposited).toBe(true);
  });

  it('breaks an exact distance tie by the lowest mine entity id', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const builders = villagerIdsOf(bridge, 1);

    // Camp (14,14): stone (14,18) and gold (18,14) are both at exactly 4.0.
    // The stone mine spawns first in the fixture, so it holds the lower id
    // and must win the tie. The depleted gold (16,17) at ~3.61 is nearer
    // than both but must be skipped.
    const stoneMine = mineIdAt(bridge, 14, 18);
    const tiedGoldMine = mineIdAt(bridge, 18, 14);
    expect(stoneMine).toBeLessThan(tiedGoldMine);

    placeCampWithVillagers(bridge, builders, CAMP_TIE_ANCHOR);
    stepUntilCampComplete(bridge, CAMP_TIE_ANCHOR);
    bridge.step(100);

    for (const id of builders) {
      const gatherer = gathererOf(bridge, id);
      expect(gatherer.targetResourceId).toBe(stoneMine);
      expect(gatherer.desiredResource).toBe('stone');
    }
  });

  it('leaves the builders idle exactly as before when no mine is within the 7-cell radius', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const builders = villagerIdsOf(bridge, 1);

    // Camp (10,26): nearest mine of any kind is the stone at (14,18),
    // distance sqrt(16+64) ~ 8.94 > 7. No auto-order fires.
    placeCampWithVillagers(bridge, builders, CAMP_NO_MINE_ANCHOR);
    stepUntilCampComplete(bridge, CAMP_NO_MINE_ANCHOR);

    for (let i = 0; i < 20; i += 1) {
      bridge.step(100);
    }

    for (const id of builders) {
      const gatherer = gathererOf(bridge, id);
      expect(gatherer.task).toBe('idle');
      expect(gatherer.targetResourceId).toBeNull();
      expect(gatherer.hasExplicitGatherOrder).toBe(false);
    }
  });

  it('never preempts an explicit player order queued for a builder at the completion boundary', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const builders = villagerIdsOf(bridge, 1);
    const nearestMine = mineIdAt(bridge, 18, 14);
    const moveTarget = { x: 24, y: 24 };

    placeCampWithVillagers(bridge, builders, CAMP_NEAREST_ANCHOR);
    stepUntilCampComplete(bridge, CAMP_NEAREST_ANCHOR);

    // The camp completed during the last step, so the auto-gather intentions
    // are queued but NOT yet drained. Issue an explicit player move for one
    // builder in the same between-ticks window — the explicit order must win.
    const [overridden, ...autoOrdered] = builders;
    expect(bridge.selectUnitsByIds([overridden!])).toBe(true);
    expect(bridge.issueMoveCommand(moveTarget.x, moveTarget.y)).toBe(true);

    // Across the entire walk, the overridden builder must never pick up the
    // auto mine order the other builders received.
    const arrived = stepUntil(
      bridge,
      () => {
        expect(gathererOf(bridge, overridden!).targetResourceId).not.toBe(nearestMine);
        const unit = bridge
          .getEconomyState()
          .units.find((candidate) => candidate.id === overridden);
        return unit !== undefined
          && unit.x === moveTarget.x
          && unit.y === moveTarget.y
          && unit.task === 'idle';
      },
      400,
    );
    expect(arrived).toBe(true);

    for (const id of autoOrdered) {
      expect(gathererOf(bridge, id).targetResourceId).toBe(nearestMine);
    }
  });

  it('never preempts a same-window explicit chain-build placement', () => {
    // Review iter-1 (HIGH, lead-adjudicated after verifier loss): placeConfirm
    // was the one human path that neither evicted pending intentions nor could
    // be seen by the submit-time validator — a routine chain-build click after
    // camp completion stranded the paid foundation while all builders left
    // for the mine.
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const builders = villagerIdsOf(bridge, 1);
    placeCampWithVillagers(bridge, builders, CAMP_NEAREST_ANCHOR);
    stepUntilCampComplete(bridge, CAMP_NEAREST_ANCHOR);

    // Same inter-tick window as the queued auto-orders: chain-place a house
    // with the still-selected trio. The explicit paid order must win.
    placeCampWithVillagers(bridge, builders, { x: 20, y: 20 }, 'house');
    bridge.step(100);

    for (const id of builders) {
      expect(gathererOf(bridge, id).targetResourceId).toBeNull();
    }
    const houseDone = stepUntil(
      bridge,
      () => bridge.getEconomyState().buildings.some(
        (building) => building.buildingType === 'house'
          && building.x === 20 && building.y === 20 && building.isComplete,
      ),
      800,
    );
    expect(houseDone).toBe(true);
  });

  it('applies the identical auto-order to non-human (AI-owned) builders', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const aiVillagers = villagerIdsOf(bridge, 2);
    expect(aiVillagers).toHaveLength(2);
    const aiMine = mineIdAt(bridge, 34, 14);

    // Owner 2 places through the same recorded command surface the AI
    // planner uses (building.placeConfirm with additional builders).
    const [primary, helper] = aiVillagers;
    const result = bridge.world.submitWithResult('building.placeConfirm', {
      builderId: primary!,
      buildingType: 'mining-camp',
      position: CAMP_OWNER2_ANCHOR,
      additionalBuilderIds: [helper!],
    });
    expect(result.accepted).toBe(true);

    stepUntilCampComplete(bridge, CAMP_OWNER2_ANCHOR);
    bridge.step(100);

    for (const id of aiVillagers) {
      const gatherer = gathererOf(bridge, id);
      expect(gatherer.targetResourceId).toBe(aiMine);
      expect(gatherer.desiredResource).toBe('gold');
      expect(['to-resource', 'gathering']).toContain(gatherer.task);
    }
  });
});
