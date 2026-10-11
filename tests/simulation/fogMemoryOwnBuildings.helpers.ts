// Shared by the two gate files for "the player's own buildings are not
// remembered under fog" (spec §12.1, work 116): fogMemoryOwnBuildings.test.ts
// and fogMemoryOwnBuildingConversion.test.ts.

import { lastSeenStaticCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { buildingTint } from '../../src/game/simulation/prototypeBuildingRules';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import type { BuildingComponent, ProjectedEntityView } from '../../src/game/simulation/types';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

export type Bridge = ReturnType<typeof createSimulationBridge>;
export type SerializedMemory = Array<[number, Array<[number, Record<string, unknown>]>]>;
export type Building = ReturnType<Bridge['getEconomyState']>['buildings'][number];

/** The player's fog memory as the save and the replay carry it. */
export function memoryOf(bridge: Bridge): Map<number, Record<string, unknown>> {
  const serialized = (bridge.world.getState(lastSeenStaticCodec.slot) ?? []) as SerializedMemory;
  return new Map(serialized.find(([playerId]) => playerId === HUMAN_PLAYER_ID)?.[1] ?? []);
}

export function step(bridge: Bridge, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
}

function footprintCells(building: Building, mapWidth: number): number[] {
  const cells: number[] = [];
  for (let dy = 0; dy < building.footprintHeight; dy += 1) {
    for (let dx = 0; dx < building.footprintWidth; dx += 1) {
      cells.push((building.y + dy) * mapWidth + building.x + dx);
    }
  }
  return cells;
}

/** Buildings whose ground the player has explored but sees none of now:
 *  where a ghost of them would be drawn, if one were remembered. */
export function unseenNow(bridge: Bridge, buildings: readonly Building[]): Building[] {
  const frame = bridge.getRenderState().frame!;
  const visible = new Set(frame.visibleCells);
  const explored = new Set(frame.exploredCells);
  return buildings.filter((building) => {
    const cells = footprintCells(building, frame.mapWidth);
    return cells.some((cell) => explored.has(cell)) && !cells.some((cell) => visible.has(cell));
  });
}

export function drawnWithIds(bridge: Bridge, ids: ReadonlySet<number>): ProjectedEntityView[] {
  return bridge.getRenderState().entities.filter((entity) => ids.has(entity.id));
}

export function ownBuildings(bridge: Bridge): Building[] {
  return bridge.getEconomyState().buildings.filter((building) => building.owner === HUMAN_PLAYER_ID);
}

export function ownerOf(bridge: Bridge, id: number): number | undefined {
  return bridge.world.getComponent<BuildingComponent>(id, 'building')?.owner;
}

/**
 * The reverse of `redemption-buildings-fixture`, staged by editing a save:
 * owner 2 holds the Monk and Redemption, the player holds the House at
 * (22, 16), alone, out of its Town Center's sight. No fixture has an enemy
 * Monk with Redemption beside a building of the player's, and the AI never
 * converts, so this is the only way to reach the case; the conversion itself
 * is ordered through the command pipeline (`orderEnemyConversion`). With
 * `foundation`, the House is an unstarted foundation, which gives no sight.
 */
export function stageEnemyConversion(options: { foundation?: boolean } = {}): {
  staged: Bridge;
  house: Building;
  monkId: number;
} {
  const bridge = createSimulationBridge('redemption-buildings-fixture');
  bridge.step(100);
  const economy = bridge.getEconomyState();
  const house = economy.buildings.find((building) => building.buildingType === 'house')!;
  const monk = economy.units.find((unit) => unit.unitType === 'monk')!;

  const blob = asSchema2Blob(bridge.saveGame());
  const snapshot = blob.worldSnapshot as unknown as {
    components: Record<string, Array<[number, Record<string, unknown>]>>;
  };
  const component = (name: string, id: number) => snapshot.components[name]!.find(([entity]) => entity === id)![1];
  component('unit', monk.id).owner = 2;
  component('visionSource', monk.id).playerId = 2;
  component('building', house.id).owner = HUMAN_PLAYER_ID;
  component('visionSource', house.id).playerId = HUMAN_PLAYER_ID;
  component('renderable', house.id).tint = buildingTint('house', HUMAN_PLAYER_ID, !options.foundation);
  const state = worldStateOf(blob);
  const researched = new Map((state['aoe2.researchedTechnologies'] ?? []) as Array<[number, string[]]>);
  researched.set(HUMAN_PLAYER_ID, (researched.get(HUMAN_PLAYER_ID) ?? []).filter((tech) => tech !== 'redemption'));
  researched.set(2, [...(researched.get(2) ?? []), 'redemption']);
  state['aoe2.researchedTechnologies'] = [...researched];
  if (options.foundation) {
    // An unstarted foundation: no sight, the construction look, no progress.
    snapshot.components.visionSource = snapshot.components.visionSource!.filter(([entity]) => entity !== house.id);
    component('renderable', house.id).visualVariant = 'construction';
    const constructions = new Map((state['aoe2.constructionStates'] ?? []) as Array<[number, Record<string, unknown>]>);
    constructions.set(house.id, {
      ...(constructions.get(house.id) ?? { totalBuildTicks: 250, populationProvided: 5, width: 2, height: 2 }),
      isComplete: false,
      buildProgressTicks: 0,
    });
    state['aoe2.constructionStates'] = [...constructions];
  }
  const staged = createSimulationBridge('redemption-buildings-fixture', { savedGame: blob });
  staged.step(100);
  return { staged, house, monkId: monk.id };
}

/** Owner 2's Monk is sent at the House, as an agent's command would send it. */
export function orderEnemyConversion(staged: Bridge, monkId: number, houseId: number): void {
  staged.pendingCommands.push({
    type: 'monk.contextAtEntity',
    data: { unitId: monkId, targetEntityId: houseId, expectedOwner: 2, intendedTaskKind: 'convert' },
  });
}
