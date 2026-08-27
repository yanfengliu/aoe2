import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
  stepUntilGarrisoned,
} from './createSimulationBridge.helpers';

type ScenarioBuilding = ReturnType<ReturnType<typeof createSimulationBridge>['getEconomyState']>['buildings'][number];

function findBuildingById(
  bridge: ReturnType<typeof createSimulationBridge>,
  id: number,
): ScenarioBuilding | undefined {
  return bridge.getEconomyState().buildings.find((b) => b.id === id);
}

type Bridge = ReturnType<typeof createSimulationBridge>;

function countOwnedUnits(bridge: Bridge, owner: number, unitType: string): number {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === owner && unit.unitType === unitType).length;
}

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findOwnedBuilding(bridge: Bridge, owner: number, buildingType: string) {
  return bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === owner && b.buildingType === buildingType);
}

describe('Slice 6 Castle + Longbowman', () => {
  it('exposes Castle in a villager placement menu at Castle Age', () => {
    const bridge = createSimulationBridge('castle-unique-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).toContain('castle');
  });

  it('does not offer Castle while still in Feudal Age', () => {
    // feudal-blacksmith-fixture keeps the human player in Feudal Age with a
    // completed Barracks, so Castle (Castle-age-or-later) must stay hidden.
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).not.toContain('castle');
  });

  it('Castle under a Britons owner exposes Longbowman in its train menu', () => {
    const bridge = createSimulationBridge('castle-unique-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toEqual(['longbowman', 'petard']);
  });

  it('Castle under a non-Britons owner exposes that civ unique unit, not the Longbowman', () => {
    // castle-non-britons-fixture sets the HUMAN player's civilization to Franks
    // with a completed Castle. Before v0.3.20 only the Britons had a unique
    // unit and this asserted an EMPTY menu; the Franks now train the Throwing
    // Axeman, so the contract is that a Castle shows its OWN civ's unit and
    // never another's.
    const bridge = createSimulationBridge('castle-non-britons-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toEqual(['throwing-axeman', 'petard']);
  });

  it('Longbowman hits a target at range 6 without closing', () => {
    // longbowman-ranged-fixture plants a player-1 Longbowman at (14, 8)
    // and an enemy Spearman at (20, 8) — distance exactly 6. Assert the
    // Longbow lands damage without moving from its starting cell.
    const bridge = createSimulationBridge('longbowman-ranged-fixture');

    const longbow = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbow).toBeDefined();
    const spearmanBefore = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearmanBefore).toBeDefined();
    expect(Math.abs(longbow!.x - spearmanBefore!.x) + Math.abs(longbow!.y - spearmanBefore!.y)).toBe(6);

    expect(selectOwnedUnitDirect(bridge, 1, 'longbowman')).toBe(true);
    expect(bridge.issueContextCommand(spearmanBefore!.x, spearmanBefore!.y)).toBe(true);

    // Longbow attack 6 pierce / reload 20. Spearman 45 HP → ~8 shots
    // dead. Assert at minimum damage lands and the Longbow did not move.
    const hitLanded = stepBridgeUntil(
      bridge,
      () => {
        const s = findFirstOwnedUnit(bridge, 2, 'spearman');
        if (!s) {
          return true;
        }
        const hp = getHealthOfUnitAtCell(bridge, s.x, s.y);
        return hp !== null && hp < 45;
      },
      { maxSteps: 120 },
    );
    expect(hitLanded).toBe(true);

    const longbowAfter = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbowAfter?.x).toBe(longbow!.x);
    expect(longbowAfter?.y).toBe(longbow!.y);
  }, 20_000);

  it('Fletching researched before training a Longbowman applies +1/+1 to the Longbowman', () => {
    // castle-fletching-fixture puts Britons Castle + Blacksmith under the
    // human player. Research Fletching first, then train a Longbowman,
    // then assert the Longbow spawns with damage 7 / range 7 (6+1 / 6+1).
    const bridge = createSimulationBridge('castle-fletching-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);
    // Phase 1B queue.research: step once so handler enqueues before polling.
    bridge.step(100);

    expect(
      stepBridgeUntil(bridge, () => {
        return bridge
          .getEconomyState()
          .buildings.find((b) => b.owner === 1 && b.buildingType === 'blacksmith')
          ?.queue.length === 0;
      }, { maxSteps: 500 }),
    ).toBe(true);

    // Now train a Longbowman.
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueTrainUnit('longbowman')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'longbowman') === 1,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    const longbow = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbow).toMatchObject({
      unitType: 'longbowman',
      attackDamage: 7,
      // 6 base + 1 Fletching + 1 Britons Castle-Age range ladder (v0.3.145).
      attackRange: 8,
    });
  }, 40_000);

  it('Fletching researched after training a Longbowman upgrades the existing Longbowman to 7 attack / 8 range', () => {
    // Same Britons Castle + Blacksmith fixture, but train the Longbow
    // first (base 6/6), then research Fletching, and assert the Longbow
    // was updated in place.
    const bridge = createSimulationBridge('castle-fletching-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueTrainUnit('longbowman')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'longbowman') === 1,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    const longbowBefore = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbowBefore).toMatchObject({
      unitType: 'longbowman',
      attackDamage: 6,
      // 6 base + 1 Britons Castle-Age range ladder (v0.3.145).
      attackRange: 7,
    });

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);
    // Phase 1B queue.research: handler enqueues at start of next step's
    // processCommands. Step once so the queue insert lands before the
    // `queue empty` polling predicate would return true on a still-empty queue.
    bridge.step(100);

    expect(
      stepBridgeUntil(bridge, () => {
        return bridge
          .getEconomyState()
          .buildings.find((b) => b.owner === 1 && b.buildingType === 'blacksmith')
          ?.queue.length === 0;
      }, { maxSteps: 500 }),
    ).toBe(true);

    const longbowAfter = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbowAfter).toMatchObject({
      unitType: 'longbowman',
      attackDamage: 7,
      // 6 base + 1 Fletching + 1 Britons Castle-Age range ladder (v0.3.145).
      attackRange: 8,
    });
  }, 40_000);

  it('Castle accepts up to 20 villagers as garrisoned units (well above the 5-cap of TC / Watch Tower)', () => {
    // castle-garrison-fixture spawns a completed Castle plus 20 villagers
    // under the human player (Britons). Since v0.3.42 garrisoning is an ORDER
    // — the villager walks to the building and goes in on arrival — so each
    // one is ordered and then given time to get there. Selecting the Castle
    // afterwards should read "15 / 20 garrisoned" via its inventory line.
    const bridge = createSimulationBridge('castle-garrison-fixture');

    const castle = findOwnedBuilding(bridge, 1, 'castle');
    expect(castle).toBeDefined();

    const villagerIds = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'villager')
      .map((u) => u.id);
    expect(villagerIds.length).toBeGreaterThanOrEqual(15);

    // Garrison 15 villagers (above the TC / Watch Tower cap of 5) — all
    // should succeed under the Castle's 20 capacity.
    // Phase 1B unit.contextAtEntity: each issueContextCommandAtEntity call
    // submits unit.contextAtEntity; handler runs at start of next step.
    // Step inside the loop so each garrison lands before the next select.
    for (let i = 0; i < 15; i += 1) {
      const id = villagerIds[i];
      // Select the single villager by its id, then issue the garrison
      // context command against the Castle.
      const villager = bridge.getEconomyState().units.find((u) => u.id === id);
      expect(villager).toBeDefined();
      expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(castle!.id, { garrison: true })).toBe(true);
      expect(stepUntilGarrisoned(bridge, id!)).toBe(true);
    }

    // Re-select the Castle via direct bridge and read garrison count.
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const inventory = bridge.getSelectionState().inventory ?? '';
    expect(inventory).toContain('15 / 20 garrisoned');
  });

  it('ungarrisons a full Castle without stacking released villagers onto identical roots', () => {
    const bridge = createSimulationBridge('castle-garrison-fixture');
    const castle = findOwnedBuilding(bridge, 1, 'castle');
    expect(castle).toBeDefined();

    const villagerIds = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
      .map((unit) => unit.id);
    expect(villagerIds).toHaveLength(20);
    const originalPresentedIdentities = bridge
      .getRenderState()
      .entities.filter((entity) => villagerIds.includes(entity.id))
      .map(({ id, generation }) => ({ id, generation }))
      .sort((left, right) => left.id - right.id);
    expect(originalPresentedIdentities).toHaveLength(20);

    for (const villagerId of villagerIds) {
      expect(bridge.selectEntityById(villagerId)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(castle!.id, { garrison: true })).toBe(true);
      // v0.3.42: the villager walks to the Castle and goes in on arrival.
      expect(stepUntilGarrisoned(bridge, villagerId)).toBe(true);
    }
    expect(
      bridge.getEconomyState().units.filter((unit) => villagerIds.includes(unit.id)),
    ).toHaveLength(0);
    expect(
      bridge.getRenderState().entities.filter((entity) => villagerIds.includes(entity.id)),
    ).toHaveLength(0);
    expect(bridge.selectEntityById(castle!.id)).toBe(true);
    expect(bridge.getSelectionState().inventory).toContain('20 / 20 garrisoned');

    const restored = createSimulationBridge('ignored', {
      savedGame: structuredClone(bridge.saveGame()),
    });
    for (const candidate of [bridge, restored]) {
      expect(candidate.selectEntityById(castle!.id)).toBe(true);
      expect(candidate.issueAction('ungarrison')).toBe(true);
      candidate.step(100);
    }

    const releasedVillagers = bridge
      .getEconomyState()
      .units.filter((unit) => villagerIds.includes(unit.id));
    expect(releasedVillagers).toHaveLength(20);
    expect(new Set(releasedVillagers.map((unit) => `${unit.x},${unit.y}`)).size)
      .toBeGreaterThan(1);

    const presentedVillagers = bridge
      .getRenderState()
      .entities.filter((entity) => villagerIds.includes(entity.id));
    expect(presentedVillagers).toHaveLength(20);
    expect(
      presentedVillagers
        .map(({ id, generation }) => ({ id, generation }))
        .sort((left, right) => left.id - right.id),
    ).toEqual(originalPresentedIdentities);
    expect(new Set(presentedVillagers.map((entity) => `${entity.x},${entity.y}`)).size)
      .toBe(20);
    expect(
      restored
        .getEconomyState()
        .units.filter((unit) => villagerIds.includes(unit.id))
        .map(({ id, x, y }) => ({ id, x, y })),
    ).toEqual(releasedVillagers.map(({ id, x, y }) => ({ id, x, y })));
    expect(
      restored
        .getRenderState()
        .entities.filter((entity) => villagerIds.includes(entity.id))
        .map(({ id, generation, x, y }) => ({ id, generation, x, y }))
        .sort((left, right) => left.id - right.id),
    ).toEqual(
      presentedVillagers
        .map(({ id, generation, x, y }) => ({ id, generation, x, y }))
        .sort((left, right) => left.id - right.id),
    );

    for (const villagerId of villagerIds) {
      expect(
        bridge.world.getComponent<{ occupancySlotOverflow?: true }>(
          villagerId,
          'unitTransform',
        )?.occupancySlotOverflow,
      ).toBeUndefined();
      expect(restored.world.getComponent(villagerId, 'unitTransform'))
        .toEqual(bridge.world.getComponent(villagerId, 'unitTransform'));
    }
  });

  it('Castle auto-fires on a visible enemy unit within range 8 over a few ticks', () => {
    // castle-defensive-fire-fixture plants a completed player-1 Castle at
    // (14, 6) with an enemy Spearman at (21, 8) — within the Castle's
    // attack range of 8 (south-east footprint corner at (17, 9) is 5 away
    // from (21, 8)). Castle vision radius 11 keeps the target visible.
    // Castle attack 11 pierce > Spearman 45 HP / reload 20 ticks means
    // ~4 shots kill it inside ~80 ticks. We step enough to observe at
    // least one hit.
    const bridge = createSimulationBridge('castle-defensive-fire-fixture');

    const spearmanBefore = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearmanBefore).toBeDefined();

    // Step until either the Spearman is dead OR at least one hit has
    // landed (HP below max). Bail at a generous step budget.
    const spearmanHpDecreased = stepBridgeUntil(
      bridge,
      () => {
        const current = findFirstOwnedUnit(bridge, 2, 'spearman');
        if (!current) {
          return true; // Spearman killed
        }
        const hp = getHealthOfUnitAtCell(bridge, current.x, current.y);
        return hp !== null && hp < 45;
      },
      { maxSteps: 200 },
    );
    expect(spearmanHpDecreased).toBe(true);
  }, 20_000);

  it('AI militia prefers a low-priority House over a closer high-priority Castle', () => {
    // Slice 6 review fix: findPreferredVisibleEnemyBuilding used to sort
    // strictly by Manhattan distance, so an AI militia equidistant
    // between a Castle and any softer building would happily punch the
    // Castle. The fix adds buildingTargetPriority — Castles drop to the
    // bottom of the list. The militia in this fixture stands closer to
    // the Castle than the House (distance 4 vs 6), so a Manhattan-only
    // sort definitely picks the Castle. Post-fix it must pick the
    // House.
    const bridge = createSimulationBridge('castle-ai-target-priority-fixture');

    const castle = findOwnedBuilding(bridge, 1, 'castle');
    const house = findOwnedBuilding(bridge, 1, 'house');
    expect(castle).toBeDefined();
    expect(house).toBeDefined();
    const castleId = castle!.id;
    const houseId = house!.id;

    // Sample initial HP via selection so we can detect a damage delta.
    expect(bridge.selectEntityAtCell(castle!.x, castle!.y)).toBe(true);
    const castleStartHp = bridge.getSelectionState().health?.current ?? null;
    expect(castleStartHp).not.toBeNull();
    expect(bridge.selectEntityAtCell(house!.x, house!.y)).toBe(true);
    const houseStartHp = bridge.getSelectionState().health?.current ?? null;
    expect(houseStartHp).not.toBeNull();

    // Run enough ticks for the AI militia to walk into range of the
    // House and land at least one hit. The militia at (15, 9) needs to
    // reach an adjacent cell of the House anchor at (15, 15) — about 5
    // sub-grid steps. Plenty of headroom on 600 ticks.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          if (!bridge.selectEntityAtCell(house!.x, house!.y)) {
            return false;
          }
          const hp = bridge.getSelectionState().health?.current ?? null;
          return hp !== null && hp < (houseStartHp as number);
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Assert the Castle is untouched: priority must keep the militia
    // away from it even though it's the closer target.
    expect(findBuildingById(bridge, castleId)).toBeDefined();
    expect(bridge.selectEntityAtCell(castle!.x, castle!.y)).toBe(true);
    const castleHpAfter = bridge.getSelectionState().health?.current ?? null;
    expect(castleHpAfter).toBe(castleStartHp);

    // House survives long enough to fail-safely (Castle anchor is still
    // there to inspect even if we ran the full step budget).
    expect(findBuildingById(bridge, houseId)).toBeDefined();
  }, 30_000);
});

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}
