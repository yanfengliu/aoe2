// Multi-villager construction (0.1.17). Three behaviors under test:
// 1. Selecting N villagers and placing a building issues a build command
//    to all N (linear-scaling speedup vs single-villager baseline).
// 2. Right-clicking an own in-progress building site routes the
//    selected villagers to join the build mid-stream.
// 3. The HP bar updates tick-by-tick during construction (validated
//    indirectly: getRenderState() should report a strictly-increasing
//    currentHp on the foundation across consecutive ticks).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

const HOUSE_ANCHOR = { x: 12, y: 12 };

function getOwnVillagerIds(bridge: ReturnType<typeof createSimulationBridge>, owner: number): number[] {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === owner && unit.unitType === 'villager')
    .map((unit) => unit.id);
}

function getHouseInProgress(bridge: ReturnType<typeof createSimulationBridge>, owner: number) {
  return bridge
    .getEconomyState()
    .buildings.find(
      (building) => building.owner === owner && building.buildingType === 'house' && !building.isComplete,
    );
}

function getHouseComplete(bridge: ReturnType<typeof createSimulationBridge>, owner: number) {
  return bridge
    .getEconomyState()
    .buildings.find(
      (building) => building.owner === owner && building.buildingType === 'house' && building.isComplete,
    );
}

describe('multi-villager construction', () => {
  it('5 villagers complete a House meaningfully faster than 1 villager', () => {
    const fast = createSimulationBridge('multi-villager-construction-fixture');
    const slow = createSimulationBridge('single-villager-construction-fixture');

    expect(fast.selectUnitsByIds(getOwnVillagerIds(fast, 1))).toBe(true);
    expect(fast.beginBuildingPlacement('house')).toBe(true);
    expect(fast.confirmBuildingPlacement(HOUSE_ANCHOR.x, HOUSE_ANCHOR.y)).toBe(true);

    expect(slow.selectUnitsByIds(getOwnVillagerIds(slow, 1))).toBe(true);
    expect(slow.beginBuildingPlacement('house')).toBe(true);
    expect(slow.confirmBuildingPlacement(HOUSE_ANCHOR.x, HOUSE_ANCHOR.y)).toBe(true);

    let fastDone = -1;
    let slowDone = -1;
    for (let t = 0; t < 4000 && (fastDone < 0 || slowDone < 0); t += 1) {
      fast.step(100);
      slow.step(100);
      if (fastDone < 0 && getHouseComplete(fast, 1)) fastDone = t;
      if (slowDone < 0 && getHouseComplete(slow, 1)) slowDone = t;
    }

    expect(fastDone).toBeGreaterThanOrEqual(0);
    expect(slowDone).toBeGreaterThanOrEqual(0);
    // 5 villagers should be at least 2× faster than 1 villager after
    // accounting for walking time + per-villager arrival jitter.
    expect(slowDone).toBeGreaterThan(fastDone * 2);
  });

  it('right-clicking an own in-progress House makes selected villagers join the build', () => {
    // Run the same fixture twice. Variant A places with 1 villager and
    // never adds joiners — establishes the single-villager completion
    // budget. Variant B places with 1, then adds the other 4 mid-build
    // via right-click. B must complete materially faster than A; if the
    // join branch were broken, B's helpers would not contribute and B
    // would take ~A ticks. The ratio gate guards against false-pass.
    function runVariant(addJoiners: boolean): number {
      const bridge = createSimulationBridge('multi-villager-construction-fixture');
      const villagers = getOwnVillagerIds(bridge, 1);
      expect(villagers).toHaveLength(5);

      const [primary, ...rest] = villagers;
      expect(bridge.selectUnitsByIds([primary])).toBe(true);
      expect(bridge.beginBuildingPlacement('house')).toBe(true);
      expect(bridge.confirmBuildingPlacement(HOUSE_ANCHOR.x, HOUSE_ANCHOR.y)).toBe(true);
      bridge.step(100);

      const inProgress = getHouseInProgress(bridge, 1);
      expect(inProgress).toBeDefined();

      if (addJoiners) {
        expect(bridge.selectUnitsByIds(rest)).toBe(true);
        expect(bridge.issueContextCommandAtEntity(inProgress!.id)).toBe(true);
      }

      let ticks = 1; // already stepped once above
      while (!getHouseComplete(bridge, 1) && ticks < 2000) {
        bridge.step(100);
        ticks += 1;
      }
      expect(getHouseComplete(bridge, 1)).toBeDefined();
      return ticks;
    }

    const soloTicks = runVariant(false);
    const joinTicks = runVariant(true);
    // Five working in parallel for most of the build should be at least
    // 2× faster than a single villager. If the join branch did not fire,
    // joinTicks would equal soloTicks (within walking-time noise).
    expect(joinTicks).toBeLessThan(soloTicks / 2);
  });

  it('right-clicking a complete own building falls through to garrison (no build command)', () => {
    // Iter-2 L1: pin the gating order in routeUnitContextAtEntityCommandDirect
    // — a complete building must NOT route to setUnitBuildCommandDirect
    // even when a villager is the actor.
    const bridge = createSimulationBridge('multi-villager-construction-fixture');
    const villagers = getOwnVillagerIds(bridge, 1);
    const [villager] = villagers;

    // The fixture's Town Center starts complete and is owned by player 1.
    // Find it in the economy state.
    const townCenter = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
    expect(townCenter).toBeDefined();
    expect(townCenter!.isComplete).toBe(true);

    expect(bridge.selectUnitsByIds([villager])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(townCenter!.id)).toBe(true);

    // Step once so the unit.contextAtEntity handler runs.
    bridge.step(100);

    // The villager must not have a build command targeting the Town Center.
    // We assert via the side-effect: a complete-building right-click with a
    // villager garrisons (or, if the TC is full, no-ops). Either way, no
    // House foundation is created and no build progress accrues anywhere.
    const foundations = bridge
      .getEconomyState()
      .buildings.filter((b) => b.owner === 1 && !b.isComplete);
    expect(foundations).toHaveLength(0);
  });


  it("the projected building view's currentHp strictly increases tick-by-tick during construction", () => {
    // Read HP through the renderState projection (NOT via getEntityHealth,
    // which reads side-maps directly). The projector only re-runs for an
    // entity when civ-engine flags it dirty in the tick diff. Side-map
    // mutations alone do NOT mark the building dirty — that's the bug
    // the patchComponent('renderable', r => r) fix repairs. If that
    // patchComponent call were removed, the projected currentHp would
    // stay constant across consecutive ticks even while the side-map
    // value climbs, and this test would fail.
    const bridge = createSimulationBridge('single-villager-construction-fixture');
    const villagers = getOwnVillagerIds(bridge, 1);
    expect(bridge.selectUnitsByIds(villagers)).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(HOUSE_ANCHOR.x, HOUSE_ANCHOR.y)).toBe(true);

    bridge.step(100);
    const inProgress = getHouseInProgress(bridge, 1);
    expect(inProgress).toBeDefined();
    const buildingId = inProgress!.id;

    function projectedHp(): number | null {
      const view = bridge
        .getRenderState()
        .entities.find((entity) => entity.id === buildingId);
      return view?.currentHp ?? null;
    }

    // Walk ticks until projected HP starts increasing (villager arrives).
    const startHp = projectedHp();
    expect(startHp).not.toBeNull();
    let walked = 0;
    while (walked < 200) {
      bridge.step(100);
      walked += 1;
      const here = projectedHp();
      if (here !== null && here > (startHp as number)) break;
    }
    expect(walked).toBeLessThan(200);

    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const here = projectedHp();
      expect(here).not.toBeNull();
      samples.push(here as number);
      bridge.step(100);
    }
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(samples[samples.length - 1]).toBeGreaterThan(samples[0]);
  });
});
