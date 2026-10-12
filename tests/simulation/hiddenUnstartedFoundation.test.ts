// A foundation nobody has started building is hidden from its owner's enemies
// (work 121; spec §12.2, "An unstarted foundation is hidden from the owner's
// enemies"). Definitive Edition's notes: update 61321 "Players can no longer see
// unbuilt foundations of enemy players if treaty is active", update 58259 the
// same through allied vision in fog and unexplored ground, update 46295 the
// minimap showing enemy Gate foundations and allied unstarted foundations in
// fog, and forum report 199626, tracked by the developers, whose expected
// result is that a player cannot find out in any way that an enemy has placed
// a foundation before its construction starts.
//
// The cases drive the real command path: owner 2's villager puts the
// foundation down with `building.placeConfirm` (the tower case spawns its
// foundation with the fixture flag instead), and the human's side is read
// through what the page reads — the render state (which the minimap draws
// from too), the selection API, the two right-click routes — plus the
// bridge's debug snapshot for what each unit was ordered to do, and the fog
// memory slot a save carries.
//
// BOUND — what a green run here does NOT prove:
//   * A 3x3 Barracks, and a Watch Tower beside a House, on flat grass, owner
//     1 against owner 2, Dark Age, no Spies. The AI's own choices are in
//     `hiddenUnstartedFoundationAi.test.ts`.
//   * The minimap is not drawn here: it draws `getRenderState().entities`, the
//     list case 1 reads, and nothing else.
//   * "Started" is read as the economy state reports it: build progress above
//     zero. Nothing here measures how much progress the builders made.

import { describe, expect, it } from 'vitest';

import { lastSeenStaticCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import {
  HIDDEN_FOUNDATION_AWAY,
  HIDDEN_FOUNDATION_SITE,
  HIDDEN_TOWER_FOUNDATION,
  HIDDEN_TOWER_NEIGHBOUR_HOUSE,
} from '../../src/game/simulation/fixtures/hiddenFoundation';
import {
  attackCommandOn,
  economyBuilding,
  footprintCells,
  idsOf,
  placeFoundationAs,
  startFoundationAs,
  stepTicks,
  type Bridge,
} from './hiddenUnstartedFoundation.helpers';

const FIXTURE = 'hidden-foundation-fixture';

function bootWithEnemyFoundation(options: Parameters<typeof createSimulationBridge>[1] = {}): {
  bridge: Bridge;
  foundationId: number;
  soldiers: number[];
  builder: number;
} {
  const bridge = createSimulationBridge(FIXTURE, options);
  const builder = idsOf(bridge, 2, 'villager')[0]!;
  const foundationId = placeFoundationAs(bridge, builder, 'barracks', HIDDEN_FOUNDATION_SITE, HIDDEN_FOUNDATION_AWAY);
  return { bridge, foundationId, soldiers: idsOf(bridge, 1, 'militia'), builder };
}

function isDrawn(bridge: Bridge, id: number): boolean {
  return bridge.getRenderState().entities.some((entity) => entity.id === id);
}

type SerializedMemory = Array<[number, Array<[number, Record<string, unknown>]>]>;

/** The human's fog memory as the save and the replay carry it. */
function memoryOf(bridge: Bridge): Map<number, Record<string, unknown>> {
  const serialized = (bridge.world.getState(lastSeenStaticCodec.slot) ?? []) as SerializedMemory;
  return new Map(serialized.find(([playerId]) => playerId === HUMAN_PLAYER_ID)?.[1] ?? []);
}

describe('an enemy\'s unstarted foundation is hidden from the human', () => {
  it('is not drawn while a soldier stands beside it, and is drawn once building starts', () => {
    const { bridge, foundationId, builder } = bootWithEnemyFoundation();
    // Premise: two of its cells are inside the soldiers' sight, so only the
    // foundation rule can keep it off the screen.
    const seen = footprintCells(HIDDEN_FOUNDATION_SITE, 3)
      .filter((cell) => bridge.getRenderState().frame?.visibleCells
        .includes(cell.y * bridge.world.grid.width + cell.x));
    expect(seen.length).toBeGreaterThan(0);

    for (let tick = 0; tick < 60; tick += 1) {
      bridge.step(100);
      expect(isDrawn(bridge, foundationId), `tick ${tick}`).toBe(false);
    }

    startFoundationAs(bridge, builder, foundationId);
    expect(economyBuilding(bridge, foundationId)!.buildProgressTicks).toBeGreaterThan(0);
    expect(isDrawn(bridge, foundationId)).toBe(true);
  }, 30_000);

  it('cannot be selected by a click on any of its cells or by its id', () => {
    const { bridge, foundationId, builder } = bootWithEnemyFoundation();
    for (const cell of footprintCells(HIDDEN_FOUNDATION_SITE, 3)) {
      bridge.selectEntityAtCell(cell.x, cell.y);
      expect(bridge.getSelectionState().selectedEntityIds, `cell ${cell.x},${cell.y}`)
        .not.toContain(foundationId);
    }
    expect(bridge.selectEntityById(foundationId)).toBe(false);

    startFoundationAs(bridge, builder, foundationId);
    expect(bridge.selectEntityById(foundationId)).toBe(true);
  }, 30_000);

  it('a right-click on its ground walks there, and a right-click on it is refused as unseen', () => {
    const { bridge, foundationId, soldiers } = bootWithEnemyFoundation();
    const [first, second] = soldiers as [number, number];

    expect(bridge.selectUnitsByIds([first])).toBe(true);
    bridge.issueContextCommand(HIDDEN_FOUNDATION_SITE.x + 1, HIDDEN_FOUNDATION_SITE.y + 1);
    bridge.step(100);
    const ground = bridge.getDebugSnapshot().unitPaths.find((path) => path.id === first);
    expect(ground?.commandType).toBe('move');

    expect(bridge.selectUnitsByIds([second])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(foundationId)).toBe(false);
    bridge.step(100);
    expect(attackCommandOn(bridge, second, HIDDEN_FOUNDATION_SITE)).toBe(false);
  }, 30_000);

  it('an attack order naming it is not carried out until building starts', () => {
    const { bridge, foundationId, soldiers, builder } = bootWithEnemyFoundation();
    const soldier = soldiers[0]!;
    const order = (): void => {
      bridge.world.submitWithResult('unit.attack', {
        unitId: soldier,
        targetEntityId: foundationId,
        targetEntityKind: 'building',
      });
      bridge.step(100);
    };

    // A standing order first: a refused attack leaves it as it was. One that
    // was taken and then dropped by the attack step would leave the soldier
    // idle, so this tells the order's refusal from the step's.
    expect(bridge.world.submitWithResult('unit.move', { unitId: soldier, target: { x: 8, y: 17 } }).accepted).toBe(true);
    bridge.step(100);
    order();
    expect(attackCommandOn(bridge, soldier, HIDDEN_FOUNDATION_SITE)).toBe(false);
    expect(bridge.getDebugSnapshot().unitPaths.find((path) => path.id === soldier)?.commandType, 'its move stands')
      .toBe('move');

    startFoundationAs(bridge, builder, foundationId);
    order();
    expect(attackCommandOn(bridge, soldier, HIDDEN_FOUNDATION_SITE)).toBe(true);
  }, 30_000);

  it('Aggressive soldiers beside it leave it alone, and attack it once building starts', () => {
    const { bridge, foundationId, soldiers, builder } = bootWithEnemyFoundation();
    const startHp = bridge.getEntityHealth(foundationId)!.currentHp;

    for (let tick = 0; tick < 300; tick += 1) {
      bridge.step(100);
      for (const soldier of soldiers) {
        expect(attackCommandOn(bridge, soldier, HIDDEN_FOUNDATION_SITE), `soldier ${soldier} tick ${tick}`).toBe(false);
      }
    }
    expect(bridge.getEntityHealth(foundationId)!.currentHp).toBe(startHp);

    startFoundationAs(bridge, builder, foundationId);
    let attacked = false;
    for (let tick = 0; tick < 300 && !attacked; tick += 1) {
      bridge.step(100);
      attacked = soldiers.some((soldier) => attackCommandOn(bridge, soldier, HIDDEN_FOUNDATION_SITE));
    }
    expect(attacked).toBe(true);
  }, 30_000);

  it('Aggressive soldiers go past an unstarted tower foundation to the House beside it', () => {
    // The tower outranks a House as a target, so a soldier that still picked
    // the foundation would be refused and never reach the House.
    const bridge = createSimulationBridge('hidden-foundation-tower-fixture');
    const soldiers = idsOf(bridge, 1, 'militia');
    let onHouse = false;
    for (let tick = 0; tick < 100 && !onHouse; tick += 1) {
      bridge.step(100);
      for (const soldier of soldiers) {
        expect(attackCommandOn(bridge, soldier, HIDDEN_TOWER_FOUNDATION), `soldier ${soldier} tick ${tick}`).toBe(false);
      }
      onHouse = soldiers.some((soldier) => attackCommandOn(bridge, soldier, HIDDEN_TOWER_NEIGHBOUR_HOUSE));
    }
    expect(onHouse).toBe(true);
  }, 30_000);

  it('leaves no ghost on the map once the soldiers walk away from it', () => {
    const { bridge, foundationId, soldiers } = bootWithEnemyFoundation();
    stepTicks(bridge, 20);
    expect(bridge.selectUnitsByIds(soldiers)).toBe(true);
    expect(bridge.issueMoveCommand(8, 17)).toBe(true);
    stepTicks(bridge, 200);
    expect(bridge.getRenderState().entities.find((entity) => entity.id === foundationId)).toBeUndefined();
  }, 30_000);
});

/** Owner 2 on the human's side, owner 3 the enemy that keeps the match live. */
const ALLIED = new Map([[1, 1], [2, 1], [3, 2]]);

/** The entry fog memory would hold for a drawn building: what an older build
 *  recorded for an unstarted foundation it saw. */
function memoryEntryFrom(view: ProjectedEntityView): Record<string, unknown> {
  return {
    kind: 'building',
    entityType: view.entityType,
    ...(view.architecture ? { architecture: view.architecture } : {}),
    generation: view.generation,
    position: { x: view.x, y: view.y },
    footprintWidth: view.footprintWidth,
    footprintHeight: view.footprintHeight,
    tint: view.tint,
    owner: view.owner,
    size: view.size,
    visualVariant: view.visualVariant,
  };
}

describe('an enemy\'s unstarted foundation in an older save\'s fog memory', () => {
  it('is not drawn after the load, and is dropped on the first tick', () => {
    // An older build remembered an enemy's unstarted foundation once seen.
    // Its entry is built from how the same foundation is drawn while it is an
    // ally's, which the human sees in plain sight, and put into an enemy
    // match's save.
    const allied = bootWithEnemyFoundation({ teamsByOwner: ALLIED });
    stepTicks(allied.bridge, 5);
    const view = allied.bridge.getRenderState().entities.find((entity) => entity.id === allied.foundationId);
    expect(view, 'premise: an ally\'s unstarted foundation in sight is drawn').toBeDefined();

    const { bridge, foundationId } = bootWithEnemyFoundation();
    stepTicks(bridge, 5);
    const blob = asSchema2Blob(bridge.saveGame());
    const state = worldStateOf(blob);
    const memory = new Map((state[lastSeenStaticCodec.slot] ?? []) as SerializedMemory);
    const human = new Map(memory.get(HUMAN_PLAYER_ID) ?? []);
    human.set(foundationId, { ...memoryEntryFrom(view!), generation: bridge.world.getEntityGeneration(foundationId) });
    memory.set(HUMAN_PLAYER_ID, [...human]);
    state[lastSeenStaticCodec.slot] = [...memory];

    const loaded = createSimulationBridge(FIXTURE, { savedGame: blob });
    expect(memoryOf(loaded).has(foundationId), 'premise: the save carries the entry').toBe(true);
    expect(isDrawn(loaded, foundationId), 'drawn after the load, before any tick').toBe(false);
    loaded.step(100);
    expect(memoryOf(loaded).has(foundationId), 'remembered after the first tick').toBe(false);
    expect(isDrawn(loaded, foundationId)).toBe(false);
  }, 30_000);
});

describe('an ally\'s unstarted foundation', () => {
  it('is drawn where the human can see it, and not attacked', () => {
    const { bridge, foundationId, soldiers } = bootWithEnemyFoundation({ teamsByOwner: ALLIED });
    stepTicks(bridge, 30);
    expect(bridge.getMatchState().outcome, 'premise: the match is live').toBe('running');
    expect(isDrawn(bridge, foundationId)).toBe(true);
    for (const soldier of soldiers) {
      expect(attackCommandOn(bridge, soldier, HIDDEN_FOUNDATION_SITE)).toBe(false);
    }
  }, 30_000);

  it('is not remembered once nothing sees it (DE update 46295)', () => {
    const { bridge, foundationId, soldiers } = bootWithEnemyFoundation({ teamsByOwner: ALLIED });
    stepTicks(bridge, 20);
    expect(isDrawn(bridge, foundationId), 'premise: seen').toBe(true);
    expect(bridge.selectUnitsByIds(soldiers)).toBe(true);
    expect(bridge.issueMoveCommand(8, 17)).toBe(true);
    stepTicks(bridge, 200);
    expect(bridge.getMatchState().outcome, 'premise: the match is live').toBe('running');
    expect(memoryOf(bridge).has(foundationId), 'remembered').toBe(false);
    expect(isDrawn(bridge, foundationId), 'drawn').toBe(false);
  }, 30_000);
});
