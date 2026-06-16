import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
  placeBuildingNearTownCenter,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// Farms — M1 food backbone (slice 1). A villager BUILDS a farm (60 wood, Dark
// Age, 480 HP); on construction-complete it becomes a gatherable 175-food
// resource that the existing villager economy harvests as food; when its food
// hits 0 it is removed from the map. Reseed + farm-upgrade techs are deferred.
describe('createSimulationBridge farms', () => {
  it('offers Farm as a Dark-Age villager build option and charges 60 wood to place it', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('villager');
    expect(bridge.getSelectionState().buildOptions).toContain('farm');

    const woodBefore = bridge.getHudState().playerResources.wood;
    const farmPosition = placeBuildingNearTownCenter(bridge, 'farm');
    expect(bridge.getHudState().playerResources.wood).toBe(woodBefore - 60);

    const placedFarm = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'farm');
    expect(placedFarm).toMatchObject({
      owner: 1,
      buildingType: 'farm',
      x: farmPosition.x,
      y: farmPosition.y,
      footprintWidth: 1,
      footprintHeight: 1,
      isComplete: false,
    });

    // 480 HP per structures.csv, ramping from low at placement.
    const placedHealth = bridge.getEntityHealth(placedFarm!.id)!;
    expect(placedHealth.maxHp).toBe(480);
    expect(placedHealth.currentHp).toBeGreaterThan(0);
    expect(placedHealth.currentHp).toBeLessThan(480);
  }, 30_000);

  it('becomes a gatherable 175-food resource on construction completion and feeds food into the stockpile', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    const farmPosition = placeBuildingNearTownCenter(bridge, 'farm');

    const findFarmBuilding = () =>
      bridge
        .getEconomyState()
        .buildings.find(
          (building) =>
            building.owner === 1
            && building.buildingType === 'farm'
            && building.x === farmPosition.x
            && building.y === farmPosition.y,
        );

    // Drive construction to completion.
    expect(
      stepBridgeUntil(bridge, () => findFarmBuilding()?.isComplete === true, { maxSteps: 600 }),
    ).toBe(true);

    // On completion the farm carries a 175-food gatherable resource at the
    // same cell as the building (hybrid building+resource entity).
    const farmResource = bridge
      .getEconomyState()
      .resources.find(
        (resource) =>
          resource.resourceType === 'farm'
          && resource.x === farmPosition.x
          && resource.y === farmPosition.y,
      );
    expect(farmResource).toBeDefined();
    expect(farmResource).toMatchObject({
      resourceType: 'farm',
      amount: 175,
      maxAmount: 175,
      baseOwner: 1,
    });

    // Send a villager to gather the farm; the owner's food stockpile rises.
    // The original builder villager has walked to the farm site, so select a
    // villager by its CURRENT position from the economy snapshot rather than
    // assuming it is still at its spawn cell.
    const foodBefore = bridge.getHudState().playerResources.food;
    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villager).toBeDefined();
    expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('villager');
    expect(bridge.issueContextCommand(farmPosition.x, farmPosition.y)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getHudState().playerResources.food > foodBefore,
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // The farm's stored food has been drawn down by the harvest.
    const farmAfter = bridge
      .getEconomyState()
      .resources.find(
        (resource) =>
          resource.resourceType === 'farm'
          && resource.x === farmPosition.x
          && resource.y === farmPosition.y,
      );
    expect(farmAfter).toBeDefined();
    expect(farmAfter!.amount).toBeLessThan(175);
  }, 60_000);

  it('removes the farm entirely from the map once its stored food is depleted', () => {
    // Seed a farm that is already complete but nearly depleted so the test
    // reaches the depletion path quickly. The farm fixture starts a Dark-Age
    // economy with one farm holding a small amount of food.
    const bridge = createSimulationBridge('farm-depletion-fixture');

    const farmBefore = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'farm');
    expect(farmBefore).toBeDefined();
    expect(farmBefore!.amount).toBeLessThanOrEqual(10);
    const farmId = farmBefore!.id;

    // It is a real building too (hybrid): the SAME entity id appears in both
    // the buildings and resources snapshots (fog-independent — the farm
    // belongs to the AI player so a click select would be fogged for P1).
    expect(
      bridge
        .getEconomyState()
        .buildings.some((building) => building.id === farmId && building.buildingType === 'farm'),
    ).toBe(true);

    // Villagers in the fixture gather the farm down to 0.
    const farmGone = stepBridgeUntil(
      bridge,
      () =>
        !bridge
          .getEconomyState()
          .resources.some((resource) => resource.id === farmId),
      { maxSteps: 800 },
    );
    expect(farmGone).toBe(true);

    // The building shell is removed with the resource — no orphaned farm
    // building lingers on the map.
    expect(
      bridge.getEconomyState().buildings.some((building) => building.id === farmId),
    ).toBe(false);
  }, 60_000);

  it("does not let an enemy/AI villager gather another player's farm (no food theft)", () => {
    // Player 1 (human) owns a farm; player 2 (AI economy, planner off) has a
    // food villager whose only nearby food is player 1's farm.
    const bridge = createSimulationBridge('farm-ownership-fixture');

    const farm = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'farm' && resource.baseOwner === 1);
    expect(farm).toBeDefined();
    expect(farm!.amount).toBe(175);

    // Step long enough for a villager to walk to the adjacent farm and gather
    // many cycles if it were allowed to. The player-2 villager must NOT touch
    // the farm: its food stays 0 and the farm's stored food stays full.
    for (let index = 0; index < 250; index += 1) {
      bridge.step(100);
    }

    const farmAfter = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'farm' && resource.baseOwner === 1);
    expect(farmAfter).toBeDefined();
    expect(farmAfter!.amount).toBe(175); // untouched by the enemy villager
    expect(bridge.getEconomyState().playerResources[2]?.food ?? 0).toBe(0); // no theft

    // The OWNER's villager CAN gather its own farm — issue an explicit gather
    // order from player 1's villager and confirm the farm draws down.
    const ownVillager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(ownVillager).toBeDefined();
    expect(bridge.selectEntityAtCell(ownVillager!.x, ownVillager!.y)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('villager');
    expect(bridge.issueContextCommand(farm!.x, farm!.y)).toBe(true);

    const ownerGathered = stepBridgeUntil(
      bridge,
      () => {
        const f = bridge
          .getEconomyState()
          .resources.find((resource) => resource.resourceType === 'farm' && resource.baseOwner === 1);
        return f !== undefined && f.amount < 175;
      },
      { maxSteps: 600 },
    );
    expect(ownerGathered).toBe(true);
  }, 90_000);

  it('projects a human-owned farm as owned (keeps its building owner, not null)', () => {
    // Regression for the visibility owner-overwrite bug: a farm is a
    // resource+building hybrid; the projector must keep the BUILDING owner so
    // the own-entity LOS bypass treats the player's farm as owned (live, not
    // fogged) instead of overwriting it with the resource's null owner.
    const bridge = createSimulationBridge('farm-ownership-fixture');

    const farm = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'farm' && resource.baseOwner === 1);
    expect(farm).toBeDefined();

    const projected = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.entityType === 'farm' && entity.x === farm!.x && entity.y === farm!.y,
      );
    expect(projected).toBeDefined();
    // Owner is the human builder (1), NOT null, and it is live (not a memory
    // ghost) because the own-entity bypass keeps an owned building visible.
    expect(projected!.owner).toBe(1);
    expect(projected!.isMemory).toBe(false);
  }, 30_000);
});
