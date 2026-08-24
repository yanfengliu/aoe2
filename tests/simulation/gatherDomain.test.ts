import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { canGathererHarvest } from '../../src/game/simulation/gatherDomain';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

describe('who can harvest what', () => {
  it('keeps a land villager off fish and a fishing ship off trees', () => {
    // A fish is FOOD, so nothing in the resource-kind filter stopped a villager
    // choosing one. It then walked to the shoreline and stood there forever,
    // which is what froze the AI's whole economy in a real match: its food
    // villagers pinned at the coast and its stockpile stopped moving.
    expect(canGathererHarvest('villager', 'fish')).toBe(false);
    expect(canGathererHarvest('villager', 'berry-bush')).toBe(true);
    expect(canGathererHarvest('villager', 'tree')).toBe(true);
    expect(canGathererHarvest('fishing-ship', 'fish')).toBe(true);
    expect(canGathererHarvest('fishing-ship', 'tree')).toBe(false);
    expect(canGathererHarvest('fishing-ship', 'berry-bush')).toBe(false);
  });
});

describe('an AI economy on a map with water', () => {
  it('keeps gathering instead of pinning its villagers at the shoreline', () => {
    // The regression this guards: on the default map the AI's resources stopped
    // changing entirely after roughly tick 6000, because villagers assigned to
    // fish walked to the coast and never arrived. The check is simply that the
    // stockpile keeps MOVING.
    const bridge: Bridge = createSimulationBridge('aoe2-prototype');
    const stockpileOf = (owner: number) => {
      const all = (bridge.world.getState('aoe2.playerResources')
        ?? []) as Array<[number, { food: number; wood: number; gold: number; stone: number }]>;
      const entry = all.find(([id]) => id === owner)?.[1];
      return entry ? entry.food + entry.wood + entry.gold + entry.stone : 0;
    };

    expect(stepBridgeUntil(bridge, () => bridge.getDebugSnapshot().tick >= 6000,
      { maxSteps: 6100 })).toBe(true);
    const atSixThousand = stockpileOf(2);

    // Step on, but tolerate the match ENDING first: this AI now conquers the
    // idle human around tick 8000 (measured 2026-08-24, after villagers learned
    // to fish the shore fed it faster), and once the match resolves the world
    // stops advancing. Insisting on tick 9000 made a stronger AI look like a
    // broken test.
    let previousTick = -1;
    for (let step = 0; step < 3_100; step += 1) {
      bridge.step(100);
      const tick = bridge.getDebugSnapshot().tick;
      if (tick === previousTick || tick >= 9000) break;
      previousTick = tick;
    }
    expect(bridge.getDebugSnapshot().tick).toBeGreaterThan(6000);
    const atNineThousand = stockpileOf(2);

    // NOTE: this passes on GOLD alone. Food and wood are still stalled by a
    // separate pathing defect; what it pins is that the stockpile is not
    // completely frozen, which is what a villager pinned at the shoreline did.
    expect(
      atNineThousand,
      `AI stockpile frozen at ${String(atSixThousand)} across the window`,
    ).not.toBe(atSixThousand);
  }, 180_000);

  it('never leaves a villager walking to a resource it cannot reach', () => {
    const bridge: Bridge = createSimulationBridge('aoe2-prototype');
    expect(stepBridgeUntil(bridge, () => bridge.getDebugSnapshot().tick >= 7000,
      { maxSteps: 7100 })).toBe(true);

    const world = bridge.world as unknown as {
      getComponent<T>(id: number, kind: string): T | null;
    };
    for (const unit of bridge.getEconomyState().units) {
      if (unit.unitType !== 'villager') continue;
      const gatherer = world.getComponent<{ targetResourceId: number | null }>(
        unit.id, 'gatherer',
      );
      const targetId = gatherer?.targetResourceId;
      if (targetId === null || targetId === undefined) continue;
      const target = bridge.getEconomyState().resources.find((r) => r.id === targetId);
      if (!target) continue;
      expect(
        canGathererHarvest('villager', target.resourceType),
        `villager ${String(unit.id)} was sent to a ${target.resourceType}`,
      ).toBe(true);
    }
  }, 180_000);
});

describe('an AI whose wild food runs out', () => {
  it('builds farms instead of starving', () => {
    // Berries and sheep are finite. Without farms the AI's food income falls to
    // zero the moment its opening patch is eaten, and it can never afford the
    // 800 food for Castle Age — which is exactly where every observed match
    // stalled: Feudal Age, food 14, forever.
    const bridge: Bridge = createSimulationBridge('aoe2-prototype');
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().buildings.some(
        (building) => building.owner === 2 && building.buildingType === 'farm',
      ),
      { maxSteps: 14000 },
    ), 'the AI never built a farm').toBe(true);
  }, 300_000);

  it('keeps growing its villager force instead of losing it', () => {
    // Before these fixes the AI's villager count PEAKED around ten and then
    // fell as it spent food it could no longer replace. This is deliberately a
    // low bar — the food and wood routes are still broken (see the devlog and
    // the roadmap) — but it separates "the economy runs" from "the economy is
    // dead", which is what the fixed bugs were the difference between.
    const bridge: Bridge = createSimulationBridge('aoe2-prototype');
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units
        .filter((unit) => unit.owner === 2 && unit.unitType === 'villager').length >= 15,
      { maxSteps: 14000 },
    ), 'the AI never got past 14 villagers').toBe(true);
  }, 300_000);
});
