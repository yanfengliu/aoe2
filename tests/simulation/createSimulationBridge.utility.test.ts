import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
  stepUntilBuildingComplete,
  stepUntilGarrisoned,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge utility progression', () => {
  it('can train a Spearman in Feudal Age and use its anti-scout bonus to kill a visible Scout quickly', () => {
    const bridge = createSimulationBridge('feudal-spearman-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'barracks',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('spearman');
    expect(bridge.queueTrainUnit('spearman')).toBe(true);
    // Phase 1B queue.train: spend lands at start of next step's processCommands.
    bridge.step(100);
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
  }, 45_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)

  it('can train a Skirmisher in Feudal Age and use its anti-archer bonus to kill a visible Archer quickly', () => {
    const bridge = createSimulationBridge('feudal-skirmisher-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'archery-range',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('skirmisher');
    expect(bridge.queueTrainUnit('skirmisher')).toBe(true);
    // Phase 1B queue.train: spend lands at start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 215,
      wood: 225,
    });

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().units.some(
          (unit) => unit.owner === 1 && unit.unitType === 'skirmisher',
        ),
        { maxSteps: 240 },
      ),
    ).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getRenderState().entities.some(
          (entity) => entity.owner === 2 && entity.entityType === 'archer',
        ),
        { maxSteps: 20 },
      ),
    ).toBe(true);
    expect(selectOwnedUnitDirect(bridge, 1, 'skirmisher')).toBe(true);
    expect(bridge.issueContextCommand(18, 7)).toBe(true);

    const didKillArcher = stepBridgeUntil(
      bridge,
      () => !bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      ),
      { maxSteps: 240 },
    );
    expect(didKillArcher).toBe(true);
  }, 45_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)

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

    expect(stepUntilBuildingComplete(bridge, 1, 'watch-tower')).toBe(true);

    expect(
      bridge.getEconomyState().buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'watch-tower'
          && building.isComplete,
      ),
    ).toBe(true);
    // Completion is the START of the tower's job, not the end: it still has to
    // see the Scout and shoot it. Waiting on the KILL rather than on a fixed
    // tick count keeps this honest whatever the tower's build time becomes.
    expect(
      stepBridgeUntil(
        bridge,
        () => !bridge.getEconomyState().units.some(
          (unit) => unit.owner === 2 && unit.unitType === 'scout',
        ),
        { maxSteps: 600 },
      ),
    ).toBe(true);
  }, 45_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)

  it('can garrison and ungarrison a villager through the Town Center', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const garrisonedVillager = bridge
      .getEconomyState()
      .units.find((unit) => (
        unit.owner === 1
        && unit.unitType === 'villager'
        && unit.x === 6
        && unit.y === 8
      ));
    expect(garrisonedVillager).toBeDefined();
    const garrisonedVillagerView = bridge
      .getRenderState()
      .entities.find((entity) => entity.id === garrisonedVillager?.id);
    expect(garrisonedVillagerView).toBeDefined();

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.issueContextCommand(8, 8, true)).toBe(true);
    // v0.3.42: garrisoning is an ORDER — the villager walks to the Town Center
    // and goes in when it arrives, so this waits for the walk rather than for
    // one tick of command processing.
    expect(stepUntilGarrisoned(bridge, garrisonedVillager!.id)).toBe(true);
    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);
    expect(
      bridge.getRenderState().entities.some((entity) => entity.id === garrisonedVillager?.id),
    ).toBe(false);

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      actionOptions: ['ungarrison', 'ring-town-bell', 'back-to-work'],
      stanceOptions: [],
      stance: null,
    });
    expect(bridge.issueAction('ungarrison')).toBe(true);
    // Phase 1B building.action: handler runs at start of next step's
    // processCommands. Step once so the ungarrison mutation lands.
    bridge.step(100);

    const villagersAfterUngarrison = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villagersAfterUngarrison).toHaveLength(3);
    const releasedVillager = villagersAfterUngarrison.find(
      (villager) => villager.id === garrisonedVillager?.id,
    );
    expect(releasedVillager).toBeDefined();
    // The authored Town Center exit is on its south/east perimeter, keeping a
    // released villager in front of rather than hidden by the building.
    expect(releasedVillager?.x === 12 || releasedVillager?.y === 12).toBe(true);
    expect(
      villagersAfterUngarrison.some(
        (villager) =>
          villager.x !== 6 && villager.y !== 8 && Math.abs(villager.x - 8) <= 2 && Math.abs(villager.y - 8) <= 2,
      ),
    ).toBe(true);
    expect(
      bridge
        .getRenderState()
        .entities.find((entity) => entity.id === garrisonedVillager?.id)?.generation,
    ).toBe(garrisonedVillagerView?.generation);
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

    expect(stepUntilBuildingComplete(bridge, 1, 'watch-tower')).toBe(true);

    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villager).toBeDefined();

    expect(bridge.selectEntityAtCell(villager?.x ?? 0, villager?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(watchTowerAnchor.x, watchTowerAnchor.y, true)).toBe(true);
    // Phase 1B unit.context: handler routes to garrisonUnit at start of next
    // step's processCommands. Step once so the garrison mutation lands.
    bridge.step(100);
    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(0);

    expect(bridge.selectEntityAtCell(watchTowerAnchor.x, watchTowerAnchor.y)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'watch-tower',
      actionOptions: ['ungarrison'],
      stanceOptions: [],
      stance: null,
    });
    expect(bridge.issueAction('ungarrison')).toBe(true);
    // Phase 1B building.action: ungarrison mutation lands at next step.
    bridge.step(100);

    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(1);
  }, 45_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)

  it('lets a garrisoned Town Center automatically kill a nearby enemy scout', () => {
    const bridge = createSimulationBridge('town-center-defense-fixture');

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.issueContextCommand(8, 8, true)).toBe(true);

    // The TC fires PIERCE arrows (attack 5) and a Scout carries 2 pierce armor
    // (units.csv 0/2), so each arrow deals 3. §12.4.2 clock: the garrisoning
    // villager WALKS in first, so the boosted volleys start tens of ticks in;
    // 300 ticks covers the walk plus the ~8 reloads that clear 45 HP.
    for (let index = 0; index < 300; index += 1) {
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

    expect(stepUntilBuildingComplete(bridge, 1, 'market')).toBe(true);

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
    // Phase 1B market.action: handler applies trade at start of next step's
    // processCommands. Step between each market action so the test reads
    // the post-trade stockpile + post-trade exchange-rate.
    bridge.step(100);

    const resourcesAfterFirstSale = bridge.getHudState().playerResources;
    expect(resourcesAfterFirstSale.wood).toBe(resourcesAfterBuild.wood - 100);
    expect(resourcesAfterFirstSale.gold).toBeGreaterThan(resourcesAfterBuild.gold);

    expect(bridge.issueMarketAction('sell-wood')).toBe(true);
    bridge.step(100);

    const resourcesAfterSecondSale = bridge.getHudState().playerResources;
    expect(resourcesAfterSecondSale.wood).toBe(resourcesAfterFirstSale.wood - 100);
    expect(resourcesAfterSecondSale.gold - resourcesAfterFirstSale.gold).toBeLessThan(
      resourcesAfterFirstSale.gold - resourcesAfterBuild.gold,
    );

    expect(bridge.issueMarketAction('buy-food')).toBe(true);
    bridge.step(100);

    const resourcesAfterFirstBuy = bridge.getHudState().playerResources;
    expect(resourcesAfterFirstBuy.food).toBe(resourcesAfterSecondSale.food + 100);
    expect(resourcesAfterSecondSale.gold - resourcesAfterFirstBuy.gold).toBeGreaterThan(0);

    expect(bridge.issueMarketAction('buy-food')).toBe(true);
    bridge.step(100);

    const resourcesAfterSecondBuy = bridge.getHudState().playerResources;
    expect(resourcesAfterSecondBuy.food).toBe(resourcesAfterFirstBuy.food + 100);
    expect(resourcesAfterFirstBuy.gold - resourcesAfterSecondBuy.gold).toBeGreaterThan(
      resourcesAfterSecondSale.gold - resourcesAfterFirstBuy.gold,
    );
  }, 45_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)

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
  }, 45_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});
