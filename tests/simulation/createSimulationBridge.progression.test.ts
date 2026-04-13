import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge progression systems', () => {
  it('does not offer Feudal Age research until two qualifying Dark Age buildings are complete', () => {
    const bridge = createSimulationBridge('feudal-missing-prereq-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: [],
    });
    expect(bridge.queueResearch('feudal-age')).toBe(false);
  });

  it('can research Feudal Age, build an Archery Range, and train an Archer', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: ['feudal-age'],
    });
    expect(bridge.queueResearch('feudal-age')).toBe(true);
    expect(bridge.getHudState().playerResources.food).toBe(200);

    for (let index = 0; index < 1320; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().currentAge).toBe('feudal-age');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('archery-range');
    placeBuildingNearTownCenter(bridge, 'archery-range');

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'archery-range',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('archer');
    expect(bridge.queueTrainUnit('archer')).toBe(true);

    for (let index = 0; index < 380; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toHaveLength(1);
  }, 15_000);

  it('does not offer Castle Age research until two qualifying Feudal buildings are complete', () => {
    const bridge = createSimulationBridge('feudal-stable-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: [],
    });
    expect(bridge.queueResearch('castle-age')).toBe(false);
  });

  it('can research Castle Age and train a Knight', () => {
    const bridge = createSimulationBridge('castle-age-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: ['castle-age'],
    });
    expect(bridge.queueResearch('castle-age')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 200,
      gold: 200,
    });

    for (let index = 0; index < 1620; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().currentAge).toBe('castle-age');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'stable',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('knight');
    expect(bridge.queueTrainUnit('knight')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 140,
      gold: 125,
    });

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    const playerKnights = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'knight');
    expect(playerKnights).toHaveLength(1);
    expect(playerKnights[0]).toMatchObject({
      attackDamage: 10,
      attackRange: 1,
    });
  }, 15_000);

  it('can build an additional Town Center in Castle Age and use it to train a Villager', () => {
    const bridge = createSimulationBridge('castle-town-center-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('town-center');
    expect(bridge.beginBuildingPlacement('town-center')).toBe(true);
    expect(bridge.confirmBuildingPlacement(14, 8)).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      wood: 425,
      stone: 250,
    });

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge.getEconomyState().buildings.some(
            (building) =>
              building.owner === 1
              && building.buildingType === 'town-center'
              && building.x === 14
              && building.y === 8
              && building.isComplete,
          ),
        { maxSteps: 420 },
      ),
    ).toBe(true);

    expect(
      bridge.getEconomyState().buildings.filter(
        (building) => building.owner === 1 && building.buildingType === 'town-center',
      ),
    ).toHaveLength(2);

    expect(bridge.issueMoveCommand(16, 10)).toBe(true);
    for (let index = 0; index < 40; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(14, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
    });
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    expect(bridge.getHudState().playerResources.food).toBe(150);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);
  }, 15_000);

  it('can research Fletching and apply it to existing and newly trained Archers', () => {
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    const startingArcher = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'archer');
    expect(startingArcher).toMatchObject({
      attackDamage: 4,
      attackRange: 4,
    });

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'blacksmith',
      researchOptions: ['fletching'],
    });
    expect(bridge.queueResearch('fletching')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 150,
      gold: 200,
    });

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    const upgradedArcher = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'archer');
    expect(upgradedArcher).toMatchObject({
      attackDamage: 5,
      attackRange: 5,
    });

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueTrainUnit('archer')).toBe(true);

    for (let index = 0; index < 380; index += 1) {
      bridge.step(100);
    }

    const playerArchers = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'archer');
    expect(playerArchers).toHaveLength(2);
    expect(
      playerArchers.every((unit) => unit.attackDamage === 5 && unit.attackRange === 5),
    ).toBe(true);
  }, 15_000);

  it('can build a Stable in Feudal Age and train a Scout Cavalry from it', () => {
    const bridge = createSimulationBridge('feudal-stable-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('stable');
    placeBuildingNearTownCenter(bridge, 'stable', 1, [{ x: 17, y: 8 }]);
    expect(bridge.getHudState().playerResources.wood).toBe(75);

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'stable',
      trainOptions: ['scout'],
    });
    expect(bridge.queueTrainUnit('scout')).toBe(true);
    expect(bridge.getHudState().playerResources.food).toBe(170);

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    const playerScouts = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'scout');
    expect(playerScouts).toHaveLength(1);
    expect(playerScouts[0]).toMatchObject({
      attackDamage: 3,
      attackRange: 1,
    });

    const scout = playerScouts[0];
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(21, 12)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const movedScout = bridge
            .getEconomyState()
            .units.find((unit) => unit.id === scout.id);
          return (
            movedScout !== undefined
            && Math.abs(movedScout.x - 21) + Math.abs(movedScout.y - 12) <= 1
          );
        },
        { maxSteps: 240 },
      ),
    ).toBe(true);
  }, 15_000);

  it('blocks Stable production when no safe spawn tile is available', () => {
    const bridge = createSimulationBridge('blocked-stable-spawn-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueTrainUnit('scout')).toBe(true);

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 1 && unit.unitType === 'scout',
      ),
    ).toBe(false);
    expect(bridge.getSelectionState().queue).toHaveLength(1);
    expect(bridge.getSelectionState().queue[0]).toMatchObject({
      kind: 'unit',
      unitType: 'scout',
      isBlocked: true,
      remainingTicks: 0,
    });
  }, 15_000);

  it('can train a Spearman in Feudal Age and use its anti-scout bonus to kill a visible Scout quickly', () => {
    const bridge = createSimulationBridge('feudal-spearman-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'barracks',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('spearman');
    expect(bridge.queueTrainUnit('spearman')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 215,
      wood: 125,
    });

    for (let index = 0; index < 240; index += 1) {
      bridge.step(100);
    }

    const spearman = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'spearman');
    expect(spearman).toBeDefined();
    expect(bridge.selectEntityAtCell(spearman?.x ?? 0, spearman?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(14, 10)).toBe(true);

    for (let index = 0; index < 80; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  }, 15_000);

  it('can train a Skirmisher in Feudal Age and use its anti-archer bonus to kill a visible Archer quickly', () => {
    const bridge = createSimulationBridge('feudal-skirmisher-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'archery-range',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('skirmisher');
    expect(bridge.queueTrainUnit('skirmisher')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 215,
      wood: 225,
    });

    for (let index = 0; index < 240; index += 1) {
      bridge.step(100);
    }

    const skirmisher = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'skirmisher');
    expect(skirmisher).toBeDefined();
    expect(bridge.selectEntityAtCell(skirmisher?.x ?? 0, skirmisher?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(14, 10)).toBe(true);

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      ),
    ).toBe(false);
  }, 15_000);

  it('can build a Watch Tower in Feudal Age and let it automatically kill a nearby visible Scout', () => {
    const bridge = createSimulationBridge('feudal-watch-tower-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('watch-tower');
    placeBuildingNearTownCenter(bridge, 'watch-tower', 1, [
      { x: 14, y: 11 },
      { x: 12, y: 10 },
      { x: 12, y: 11 },
      { x: 16, y: 10 },
    ]);
    expect(bridge.getHudState().playerResources.stone).toBe(75);

    for (let index = 0; index < 520; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'watch-tower'
          && building.isComplete,
      ),
    ).toBe(true);
    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  }, 15_000);

  it('can garrison and ungarrison a villager through the Town Center', () => {
    const bridge = createSimulationBridge('aoe2-prototype');

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.issueContextCommand(8, 8)).toBe(true);
    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      actionOptions: ['ungarrison'],
    });
    expect(bridge.issueAction('ungarrison')).toBe(true);

    const villagersAfterUngarrison = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villagersAfterUngarrison).toHaveLength(3);
    expect(
      villagersAfterUngarrison.some(
        (villager) =>
          villager.x !== 6 && villager.y !== 8 && Math.abs(villager.x - 8) <= 2 && Math.abs(villager.y - 8) <= 2,
      ),
    ).toBe(true);
  });

  it('can garrison and ungarrison a villager through a completed Watch Tower', () => {
    const bridge = createSimulationBridge('feudal-watch-tower-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const watchTowerAnchor = placeBuildingNearTownCenter(bridge, 'watch-tower', 1, [
      { x: 14, y: 11 },
      { x: 12, y: 10 },
      { x: 12, y: 11 },
      { x: 16, y: 10 },
    ]);

    for (let index = 0; index < 360; index += 1) {
      bridge.step(100);
    }

    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villager).toBeDefined();

    expect(bridge.selectEntityAtCell(villager?.x ?? 0, villager?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(watchTowerAnchor.x, watchTowerAnchor.y)).toBe(true);
    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(0);

    expect(bridge.selectEntityAtCell(watchTowerAnchor.x, watchTowerAnchor.y)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'watch-tower',
      actionOptions: ['ungarrison'],
    });
    expect(bridge.issueAction('ungarrison')).toBe(true);

    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(1);
  }, 15_000);

  it('lets a garrisoned Town Center automatically kill a nearby enemy scout', () => {
    const bridge = createSimulationBridge('town-center-defense-fixture');

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.issueContextCommand(8, 8)).toBe(true);

    for (let index = 0; index < 80; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  it('can build a Market in Feudal Age and exchange resources through market actions', () => {
    const bridge = createSimulationBridge('feudal-market-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('market');
    placeBuildingNearTownCenter(bridge, 'market', 1, [{ x: 17, y: 8 }]);
    expect(bridge.getHudState().playerResources.wood).toBe(275);

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'market',
      marketOptions: [
        'buy-food',
        'sell-food',
        'buy-wood',
        'sell-wood',
        'buy-stone',
        'sell-stone',
      ],
    });

    const resourcesAfterBuild = bridge.getHudState().playerResources;
    expect(bridge.issueMarketAction('sell-wood')).toBe(true);

    const resourcesAfterFirstSale = bridge.getHudState().playerResources;
    expect(resourcesAfterFirstSale.wood).toBe(resourcesAfterBuild.wood - 100);
    expect(resourcesAfterFirstSale.gold).toBeGreaterThan(resourcesAfterBuild.gold);

    expect(bridge.issueMarketAction('sell-wood')).toBe(true);

    const resourcesAfterSecondSale = bridge.getHudState().playerResources;
    expect(resourcesAfterSecondSale.wood).toBe(resourcesAfterFirstSale.wood - 100);
    expect(resourcesAfterSecondSale.gold - resourcesAfterFirstSale.gold).toBeLessThan(
      resourcesAfterFirstSale.gold - resourcesAfterBuild.gold,
    );

    expect(bridge.issueMarketAction('buy-food')).toBe(true);

    const resourcesAfterFirstBuy = bridge.getHudState().playerResources;
    expect(resourcesAfterFirstBuy.food).toBe(resourcesAfterSecondSale.food + 100);
    expect(resourcesAfterSecondSale.gold - resourcesAfterFirstBuy.gold).toBeGreaterThan(0);

    expect(bridge.issueMarketAction('buy-food')).toBe(true);

    const resourcesAfterSecondBuy = bridge.getHudState().playerResources;
    expect(resourcesAfterSecondBuy.food).toBe(resourcesAfterFirstBuy.food + 100);
    expect(resourcesAfterFirstBuy.gold - resourcesAfterSecondBuy.gold).toBeGreaterThan(
      resourcesAfterSecondSale.gold - resourcesAfterFirstBuy.gold,
    );
  }, 15_000);

  it('can set a rally point on a selected Archery Range so newly trained units move to it automatically', () => {
    const bridge = createSimulationBridge('feudal-skirmisher-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.issueContextCommand(15, 10)).toBe(true);
    expect(bridge.queueTrainUnit('skirmisher')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge.getEconomyState().units.some(
            (unit) =>
              unit.owner === 1
              && unit.unitType === 'skirmisher'
              && Math.abs(unit.x - 15) + Math.abs(unit.y - 10) <= 1,
          ),
        { maxSteps: 360 },
      ),
    ).toBe(true);

    expect(
      bridge.getEconomyState().units.some(
        (unit) =>
          unit.owner === 1
          && unit.unitType === 'skirmisher'
          && Math.abs(unit.x - 15) + Math.abs(unit.y - 10) <= 1,
      ),
    ).toBe(true);
  }, 15_000);
});
