import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import { placeBuildingNearTownCenter, stepBridgeUntil } from './createSimulationBridge.helpers';

describe('createSimulationBridge dark age economy progression', () => {
  it('queues a villager at the Town Center and increases population when training completes', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      trainOptions: ['villager'],
    });
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    // Phase 1B queue.train: handler spends resources at start of next step's
    // processCommands. Step once so the spend + queue insert land.
    bridge.step(100);
    expect(bridge.getHudState().playerResources.food).toBe(150);
    expect(bridge.getSelectionState().queue).toHaveLength(1);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    const economyState = bridge.getEconomyState();
    expect(
      economyState.units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager'),
    ).toHaveLength(4);
    expect(bridge.getHudState().population).toEqual({
      current: 5,
      cap: 5,
    });
    expect(bridge.getSelectionState().queue).toHaveLength(0);
  }, 30_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('lets a selected villager place and complete a House that raises population cap', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'villager',
      // palisade-wall is a Dark-Age defensive building (AoE2; no prerequisite);
      // farm is the Dark-Age renewable food source (M1 Farms slice 1).
      buildOptions: ['house', 'mill', 'lumber-camp', 'mining-camp', 'barracks', 'palisade-wall', 'farm'],
    });
    const housePosition = placeBuildingNearTownCenter(bridge, 'house');
    expect(bridge.getHudState().playerResources.wood).toBe(175);
    expect(bridge.getHudState().population.cap).toBe(5);

    const placedHouse = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    expect(placedHouse).toMatchObject({
      owner: 1,
      buildingType: 'house',
      x: housePosition.x,
      y: housePosition.y,
      isComplete: false,
    });

    for (let index = 0; index < 400; index += 1) {
      bridge.step(100);
    }

    const completedHouse = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    expect(completedHouse?.isComplete).toBe(true);
    expect(bridge.getHudState().population.cap).toBe(10);
  }, 40_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('projects construction and completion building visuals into render state for newly placed buildings', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    const housePosition = placeBuildingNearTownCenter(bridge, 'house');

    bridge.step(100);

    const constructingHouse = bridge
      .getRenderState()
      .entities.find(
        (entity) =>
          entity.owner === 1
          && entity.entityType === 'house'
          && entity.x === housePosition.x
          && entity.y === housePosition.y,
      );
    expect(constructingHouse).toMatchObject({
      footprintWidth: 2,
      footprintHeight: 2,
      visualVariant: 'construction',
    });

    for (let index = 0; index < 400; index += 1) {
      bridge.step(100);
    }

    const completedHouse = bridge
      .getRenderState()
      .entities.find(
        (entity) =>
          entity.owner === 1
          && entity.entityType === 'house'
          && entity.x === housePosition.x
          && entity.y === housePosition.y,
      );
    expect(completedHouse).toMatchObject({
      footprintWidth: 2,
      footprintHeight: 2,
      visualVariant: 'complete',
    });
  }, 40_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('ramps building HP from low at placement to full at construction completion', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    const housePosition = placeBuildingNearTownCenter(bridge, 'house');

    const findHouse = () =>
      bridge
        .getEconomyState()
        .buildings.find(
          (building) =>
            building.owner === 1
            && building.buildingType === 'house'
            && building.x === housePosition.x
            && building.y === housePosition.y,
        );

    const placed = findHouse();
    expect(placed).toBeDefined();
    expect(placed!.isComplete).toBe(false);

    const initialHealth = bridge.getEntityHealth(placed!.id);
    expect(initialHealth).not.toBeNull();
    expect(initialHealth!.maxHp).toBe(75);
    expect(initialHealth!.currentHp).toBeGreaterThan(0);
    expect(initialHealth!.currentHp).toBeLessThan(initialHealth!.maxHp * 0.2);

    const totalTicks = placed!.totalBuildTicks;
    expect(
      stepBridgeUntil(
        bridge,
        () => (findHouse()?.buildProgressTicks ?? 0) >= totalTicks * 0.5,
        { maxSteps: 600 },
      ),
    ).toBe(true);
    const midHouse = findHouse()!;
    expect(midHouse.isComplete).toBe(false);
    const midHealth = bridge.getEntityHealth(midHouse.id)!;
    expect(midHealth.currentHp).toBeGreaterThan(initialHealth!.currentHp);
    expect(midHealth.currentHp).toBeLessThan(midHealth.maxHp);

    expect(
      stepBridgeUntil(bridge, () => findHouse()?.isComplete === true, { maxSteps: 600 }),
    ).toBe(true);
    const finishedHouse = findHouse()!;
    const finalHealth = bridge.getEntityHealth(finishedHouse.id);
    expect(finalHealth).toEqual({ currentHp: 75, maxHp: 75 });
  }, 40_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('preserves mid-construction HP across save/load round-trip', () => {
    const original = createSimulationBridge(DEFAULT_SEED);
    expect(original.selectEntityAtCell(6, 8)).toBe(true);
    const housePosition = placeBuildingNearTownCenter(original, 'house');

    const findHouseIn = (bridge: ReturnType<typeof createSimulationBridge>) =>
      bridge
        .getEconomyState()
        .buildings.find(
          (b) =>
            b.owner === 1
            && b.buildingType === 'house'
            && b.x === housePosition.x
            && b.y === housePosition.y,
        );

    expect(
      stepBridgeUntil(
        original,
        () => {
          const house = findHouseIn(original);
          return house !== undefined && house.buildProgressTicks > house.totalBuildTicks * 0.3
            && house.buildProgressTicks < house.totalBuildTicks * 0.7;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);
    const midHouse = findHouseIn(original)!;
    const savedHealth = original.getEntityHealth(midHouse.id)!;
    expect(savedHealth.currentHp).toBeGreaterThan(7);
    expect(savedHealth.currentHp).toBeLessThan(75);

    const blob = original.saveGame();
    const restored = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    const restoredHouse = findHouseIn(restored)!;
    expect(restoredHouse.buildProgressTicks).toBe(midHouse.buildProgressTicks);
    const restoredHealth = restored.getEntityHealth(restoredHouse.id)!;
    expect(restoredHealth.currentHp).toBe(savedHealth.currentHp);
    expect(restoredHealth.maxHp).toBe(savedHealth.maxHp);
  }, 40_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('redirects a selected villager to gather gold through an explicit context order', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    const goldMine = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'gold-mine' && resource.baseOwner === 1);
    expect(goldMine).toBeDefined();
    expect(bridge.issueContextCommand(goldMine!.x, goldMine!.y)).toBe(true);

    // Gather enough ticks to cover one full path-to-gold + gather + return
    // cycle under the procedural layout, which may place the gold slightly
    // farther from the starting villager than the pre-procedural layout.
    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().playerResources.gold).toBeGreaterThan(100);
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('auto-gathers when a Town Center rally point is set on a resource', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    // A tree near the Town Center (8,8) to rally onto. The trained villager
    // (ordinal 6) defaults to a non-wood gather role (food) via
    // assignVillagerRole, so without the fix training it cannot raise the
    // wood-gatherer count — making "wood count rose AND one works it" an
    // unambiguous, delta-robust signal that the rally drove the gather order.
    const tree = bridge
      .getEconomyState()
      .resources.filter((resource) => resource.resourceType === 'tree')
      .sort(
        (left, right) =>
          Math.abs(left.x - 8) + Math.abs(left.y - 8)
          - (Math.abs(right.x - 8) + Math.abs(right.y - 8)),
      )[0];
    expect(tree).toBeDefined();

    const woodGatherers = () =>
      bridge
        .getEconomyState()
        .villagers.filter((villager) => villager.owner === 1 && villager.desiredResource === 'wood');
    const woodBefore = woodGatherers().length;

    // Select the Town Center and set its rally point onto the tree cell.
    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('town-center');
    expect(bridge.issueContextCommand(tree!.x, tree!.y)).toBe(true);

    // Train a villager; once it spawns it should auto-gather wood (the rally
    // resource's kind) and actively work it, not idle at the rally cell.
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    bridge.step(100);

    const reached = stepBridgeUntil(
      bridge,
      () => {
        const wood = woodGatherers();
        return wood.length > woodBefore && wood.some((villager) => villager.task !== 'idle');
      },
      { maxSteps: 500 },
    );
    expect(reached).toBe(true);
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)
});
