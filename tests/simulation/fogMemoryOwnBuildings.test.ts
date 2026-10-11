// The player's fog memory holds no entry for a building the player owns,
// finished or a foundation, unless an enemy Monk is converting it (spec
// §12.1, vNEXT; defect register 2026-10-11). The render state draws every
// entity the player owns whatever the fog, so such an entry was never read
// while its building stood. It was read once the building was gone: a House
// the player deleted, or lost where nothing else of theirs saw it, stayed on
// the map as a ghost, because its own sight went with it and an entry is
// forgotten only when its ground is seen empty. The entries also cost every
// tick: the engine fingerprints the whole `aoe2.lastSeenStatic` slot twice a
// tick (docs/engine-feedback/current.md).
//
// BOUND: buildings leave the world here by the Delete key's command and by
// enemy Militia, each through the command pipeline; a projectile's kill and a
// foundation's deletion are not driven, and the rule does not ask how a
// building went. The played opening is the boot map, one seat, 3,000 ticks
// with the player's seat on the AI. The older save is EMULATED: a save from
// this build with entries written the way the writer before vNEXT wrote them,
// because no save from an older build is committed. The enemy conversion is
// staged by editing a save — the Monk and Redemption handed to owner 2, the
// House to the player — because no fixture has an enemy Monk with Redemption
// beside a building of the player's and the AI never converts; the conversion
// itself is ordered through the command pipeline. The recycled id is staged by
// direct world edits (a blinded scout, the House destroyed, a bare House of the
// player's on its id), as fogMemory.test.ts stages its M5 case. An ally's
// building is not the player's and is remembered as before
// (sharedVisionEntities.test.ts); that its loss leaves the same ghost is OPEN
// in the register entry.

import { describe, expect, it } from 'vitest';

import { lastSeenStaticCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { buildingTint } from '../../src/game/simulation/prototypeBuildingRules';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { RAID_WARNING_HOUSE, RAID_WARNING_MILITIA } from '../../src/game/simulation/fixtures/raidWarning';
import type { BuildingComponent, ProjectedEntityView } from '../../src/game/simulation/types';
import { asSchema2Blob, legacySchema1FromBridge, worldStateOf } from './saveBlobTestUtils';
import { selectOwnedUnitDirect } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type SerializedMemory = Array<[number, Array<[number, Record<string, unknown>]>]>;
type Building = ReturnType<Bridge['getEconomyState']>['buildings'][number];

/** The player's fog memory as the save and the replay carry it. */
function memoryOf(bridge: Bridge): Map<number, Record<string, unknown>> {
  const serialized = (bridge.world.getState(lastSeenStaticCodec.slot) ?? []) as SerializedMemory;
  return new Map(serialized.find(([playerId]) => playerId === HUMAN_PLAYER_ID)?.[1] ?? []);
}

function step(bridge: Bridge, ticks: number): void {
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
function unseenNow(bridge: Bridge, buildings: readonly Building[]): Building[] {
  const frame = bridge.getRenderState().frame!;
  const visible = new Set(frame.visibleCells);
  const explored = new Set(frame.exploredCells);
  return buildings.filter((building) => {
    const cells = footprintCells(building, frame.mapWidth);
    return cells.some((cell) => explored.has(cell)) && !cells.some((cell) => visible.has(cell));
  });
}

function drawnWithIds(bridge: Bridge, ids: ReadonlySet<number>): ProjectedEntityView[] {
  return bridge.getRenderState().entities.filter((entity) => ids.has(entity.id));
}

function ownBuildings(bridge: Bridge): Building[] {
  return bridge.getEconomyState().buildings.filter((building) => building.owner === HUMAN_PLAYER_ID);
}

describe('the player\'s own buildings are not remembered under fog', () => {
  it('leaves no ghost of any building the player deletes, whatever its type', () => {
    // One finished building of every type and no unit: the player's sight is
    // its buildings' sight, so deleting all but the Town Center leaves most
    // of their ground explored and unseen.
    const bridge = createSimulationBridge('building-vision-fixture');
    step(bridge, 2);
    const own = ownBuildings(bridge);
    const townCenter = own.find((building) => building.buildingType === 'town-center')!;
    const doomed = own.filter((building) => building.id !== townCenter.id);
    expect(doomed.length, 'the fixture holds one building of every type').toBeGreaterThanOrEqual(20);
    for (const building of doomed) {
      expect(bridge.selectEntityById(building.id), `select ${building.buildingType}`).toBe(true);
      expect(bridge.deleteSelectedEntity(), `delete ${building.buildingType}`).toBe(true);
    }
    step(bridge, 3);

    const standing = new Set(bridge.getEconomyState().buildings.map((building) => building.id));
    expect(doomed.filter((building) => standing.has(building.id)), 'every delete went through').toEqual([]);
    // Premise: most of them stood where the player now sees nothing, so a
    // remembered entry would be drawn. Without this the case could pass by
    // every footprint being in the Town Center's sight.
    const unseen = unseenNow(bridge, doomed);
    expect(unseen.length, 'buildings whose ground is explored and unseen').toBeGreaterThanOrEqual(15);

    const doomedIds = new Set(doomed.map((building) => building.id));
    expect(
      drawnWithIds(bridge, doomedIds).map((entity) => `${entity.entityType}@${entity.x},${entity.y}`),
      'drawn after the player deleted them',
    ).toEqual([]);
    expect([...memoryOf(bridge).keys()].filter((id) => doomedIds.has(id))).toEqual([]);
  });

  it('leaves no ghost of a House lost to enemy Militia where nothing else of the player\'s sees it', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    step(bridge, 2);
    const house = ownBuildings(bridge).find((building) => building.buildingType === 'house')!;
    expect(house).toMatchObject({ x: RAID_WARNING_HOUSE.x, y: RAID_WARNING_HOUSE.y });
    const militia = bridge.getEconomyState().units.filter((unit) => unit.owner === 2 && unit.unitType === 'militia');
    expect(militia).toHaveLength(RAID_WARNING_MILITIA.length);
    for (const unit of militia) {
      bridge.pendingCommands.push({
        type: 'unit.attack',
        data: { unitId: unit.id, targetEntityId: house.id, targetEntityKind: 'building' },
      });
    }
    let ticks = 0;
    while (bridge.getEconomyState().buildings.some((building) => building.id === house.id)) {
      bridge.step(100);
      ticks += 1;
      expect(ticks, 'the Militia bring the House down').toBeLessThan(6000);
    }
    step(bridge, 2);

    expect(unseenNow(bridge, [house]), 'premise: its ground is explored and unseen').toHaveLength(1);
    expect(drawnWithIds(bridge, new Set([house.id])), 'drawn after it fell').toEqual([]);
    expect(memoryOf(bridge).has(house.id)).toBe(false);
  });

  it('holds no entry for a building of the player\'s, finished or a foundation, through a played opening', () => {
    // The player's seat on the AI, so it builds: Houses, camps and farms go
    // up as foundations that its villagers see, then finish.
    const bridge = createSimulationBridge('aoe2-prototype', {
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
      renderProjection: 'on-read',
    });
    let foundationsSeen = 0;
    let finishedSeen = 0;
    let largestMemory = 0;
    for (let checkpoint = 0; checkpoint < 30; checkpoint += 1) {
      step(bridge, 100);
      const memory = memoryOf(bridge);
      largestMemory = Math.max(largestMemory, memory.size);
      const remembered: string[] = [];
      for (const building of ownBuildings(bridge)) {
        if (building.isComplete) finishedSeen += 1;
        else foundationsSeen += 1;
        const entry = memory.get(building.id);
        if (entry !== undefined && entry.generation === bridge.world.getEntityGeneration(building.id)) {
          remembered.push(`${building.buildingType}${building.isComplete ? '' : ' (foundation)'}`);
        }
      }
      expect(remembered, `remembered at tick ${bridge.world.tick}`).toEqual([]);
    }
    // Premise: the opening built something, and memory still holds what the
    // player saw of the world.
    expect(foundationsSeen, 'foundations standing across the checkpoints').toBeGreaterThan(0);
    expect(finishedSeen, 'finished buildings standing across the checkpoints').toBeGreaterThan(30);
    expect(largestMemory, 'entries for what the player saw that it does not own').toBeGreaterThan(0);
  }, 120_000);

  it('loads a save that remembers the player\'s own buildings, and drops only those entries', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');
    const enemyHouse = bridge.getEconomyState().buildings.find((building) => building.owner === 2 && building.buildingType === 'house')!;
    const townCenter = ownBuildings(bridge).find((building) => building.buildingType === 'town-center')!;
    for (let ticks = 0; !memoryOf(bridge).has(enemyHouse.id); ticks += 1) {
      expect(ticks, 'premise: the scout sees the enemy House').toBeLessThan(20);
      bridge.step(100);
    }
    const before = memoryOf(bridge);

    // The save an older build made: the same world, with the Town Center
    // remembered the way that build's writer remembered every building seen.
    const blob = asSchema2Blob(bridge.saveGame());
    const view = bridge.getRenderState().entities.find((entity) => entity.id === townCenter.id)!;
    const olderEntry = {
      kind: 'building',
      entityType: view.entityType,
      architecture: view.architecture,
      generation: view.generation,
      position: { x: view.x, y: view.y },
      footprintWidth: view.footprintWidth,
      footprintHeight: view.footprintHeight,
      tint: view.tint,
      owner: view.owner,
      size: view.size,
      visualVariant: view.visualVariant,
    };
    const slot = worldStateOf(blob)[lastSeenStaticCodec.slot] as SerializedMemory;
    slot.find(([playerId]) => playerId === HUMAN_PLAYER_ID)![1].push([townCenter.id, olderEntry]);

    const loaded = createSimulationBridge('fog-memory-fixture', { savedGame: blob });
    expect(memoryOf(loaded).has(townCenter.id), 'premise: the load restored the older entry').toBe(true);
    // The same save in the older schema, taken before a tick has run.
    const legacy = createSimulationBridge('fog-memory-fixture', { savedGame: legacySchema1FromBridge(loaded) });
    expect(memoryOf(legacy).has(townCenter.id), 'premise: schema 1 carries the older entry').toBe(true);

    for (const reloaded of [loaded, legacy]) {
      reloaded.step(100);
      const after = memoryOf(reloaded);
      expect(after.has(townCenter.id), 'the older entry is dropped on the first tick').toBe(false);
      expect(after.get(enemyHouse.id), 'what the player saw of the enemy is kept').toEqual(before.get(enemyHouse.id));
      expect(reloaded.getMatchState().outcome).toBe('running');
    }
  });

  it('keeps a destroyed building\'s ghost when its id comes back as a building of the player\'s', () => {
    // The engine recycles ids: an entry under a recycled id with another
    // generation is a different building's last-known state (fogMemory.test.ts,
    // full-review M5), and a building of the player's taking the id must not
    // erase it.
    const bridge = createSimulationBridge('fog-memory-fixture');
    const houseId = bridge.getEconomyState().buildings.find((building) => building.owner === 2 && building.buildingType === 'house')!.id;
    for (let ticks = 0; !memoryOf(bridge).has(houseId); ticks += 1) {
      expect(ticks, 'premise: the scout sees the enemy House').toBeLessThan(20);
      bridge.step(100);
    }
    const scoutId = bridge.getEconomyState().units.find((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'scout')!.id;
    const ghostGeneration = memoryOf(bridge).get(houseId)!.generation;
    const recycled = bridge.world.runMaintenance(() => {
      // The scout goes blind, so the House's ground falls under fog; the House
      // dies there, and its id comes back as a House of the player's far away.
      bridge.world.removeComponent(scoutId, 'visionSource');
      bridge.world.destroyEntity(houseId);
      const id = bridge.world.createEntity();
      bridge.world.addComponent(id, 'position', { x: 30, y: 30 });
      bridge.world.addComponent(id, 'building', { owner: HUMAN_PLAYER_ID, buildingType: 'house' });
      bridge.world.addComponent(id, 'renderable', {
        kind: 'building', layer: 'building', tint: buildingTint('house', HUMAN_PLAYER_ID, true), size: 1.1,
        footprintWidth: 2, footprintHeight: 2, visualVariant: 'complete',
      });
      return id;
    });
    expect(recycled, 'premise: the id came back').toBe(houseId);
    step(bridge, 3);
    expect(bridge.world.getEntityGeneration(houseId)).not.toBe(ghostGeneration);
    expect(memoryOf(bridge).get(houseId)?.generation, 'the destroyed House is still remembered').toBe(ghostGeneration);
  });

  it('drops the entry of an enemy building the player converts', () => {
    const bridge = createSimulationBridge('redemption-buildings-fixture');
    const house = bridge.getEconomyState().buildings.find((building) => building.buildingType === 'house')!;
    expect(house.owner).toBe(2);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house.id)).toBe(true);
    let heldWhileEnemy = false;
    for (let ticks = 0; ownerOf(bridge, house.id) !== HUMAN_PLAYER_ID; ticks += 1) {
      expect(ticks, 'the Monk converts the House').toBeLessThan(900);
      bridge.step(100);
      if (ownerOf(bridge, house.id) === 2 && memoryOf(bridge).has(house.id)) heldWhileEnemy = true;
    }
    expect(heldWhileEnemy, 'premise: the player remembered the House while it was the enemy\'s').toBe(true);
    bridge.step(100);
    expect(memoryOf(bridge).has(house.id), 'remembered after it became the player\'s').toBe(false);
  });

  it('keeps a building an enemy Monk converts on the map, as last seen', () => {
    const bridge = createSimulationBridge('redemption-buildings-fixture');
    bridge.step(100);
    const economy = bridge.getEconomyState();
    const house = economy.buildings.find((building) => building.buildingType === 'house')!;
    const monk = economy.units.find((unit) => unit.unitType === 'monk')!;

    // Stage the reverse of the fixture: owner 2 holds the Monk and Redemption,
    // the player holds the House, alone, out of the Town Center's sight.
    const blob = asSchema2Blob(bridge.saveGame());
    const snapshot = blob.worldSnapshot as unknown as {
      components: Record<string, Array<[number, Record<string, unknown>]>>;
    };
    const component = (name: string, id: number) => snapshot.components[name]!.find(([entity]) => entity === id)![1];
    component('unit', monk.id).owner = 2;
    component('visionSource', monk.id).playerId = 2;
    component('building', house.id).owner = HUMAN_PLAYER_ID;
    component('visionSource', house.id).playerId = HUMAN_PLAYER_ID;
    component('renderable', house.id).tint = buildingTint('house', HUMAN_PLAYER_ID, true);
    const state = worldStateOf(blob);
    const researched = new Map((state['aoe2.researchedTechnologies'] ?? []) as Array<[number, string[]]>);
    researched.set(HUMAN_PLAYER_ID, (researched.get(HUMAN_PLAYER_ID) ?? []).filter((tech) => tech !== 'redemption'));
    researched.set(2, [...(researched.get(2) ?? []), 'redemption']);
    state['aoe2.researchedTechnologies'] = [...researched];
    const staged = createSimulationBridge('redemption-buildings-fixture', { savedGame: blob });
    staged.step(100);
    expect(ownerOf(staged, house.id), 'premise: the House is the player\'s').toBe(HUMAN_PLAYER_ID);
    expect(memoryOf(staged).has(house.id), 'not remembered before anyone converts it').toBe(false);

    staged.pendingCommands.push({
      type: 'monk.contextAtEntity',
      data: { unitId: monk.id, targetEntityId: house.id, expectedOwner: 2, intendedTaskKind: 'convert' },
    });
    let rememberedWhileOwn = false;
    for (let ticks = 0; ownerOf(staged, house.id) !== 2; ticks += 1) {
      expect(ticks, 'the enemy Monk converts the House').toBeLessThan(900);
      staged.step(100);
      if (ownerOf(staged, house.id) === HUMAN_PLAYER_ID && memoryOf(staged).has(house.id)) rememberedWhileOwn = true;
    }
    staged.step(100);

    expect(unseenNow(staged, [{ ...house, owner: 2 }]), 'premise: the player no longer sees its ground').toHaveLength(1);
    const drawn = drawnWithIds(staged, new Set([house.id]));
    expect(drawn.map((entity) => ({ isMemory: entity.isMemory, x: entity.x, y: entity.y })), 'drawn after the flip')
      .toEqual([{ isMemory: true, x: house.x, y: house.y }]);
    expect(rememberedWhileOwn, 'remembered while an enemy Monk converted it').toBe(true);
  });
});

function ownerOf(bridge: Bridge, id: number): number | undefined {
  return bridge.world.getComponent<BuildingComponent>(id, 'building')?.owner;
}
