// The player's fog memory holds no entry for a building the player owns,
// finished or a foundation, and forgets one recorded as the player's the
// moment its building goes (spec §12.1, vNEXT; defect register 2026-10-11).
// The render state draws every entity the player owns whatever the fog, so
// such an entry was never read while its building stood. It was read once
// the building was gone: a House the player deleted, or lost where nothing
// else of theirs saw it, stayed on the map as a ghost, because its own sight
// went with it and an entry was forgotten only when its ground was seen
// empty. The entries also cost every tick: the engine fingerprints the whole
// `aoe2.lastSeenStatic` slot twice a tick (docs/engine-feedback/current.md).
// The one exception, a building an enemy Monk is sent to convert, has its
// own file: fogMemoryOwnBuildingConversion.test.ts.
//
// BOUND: buildings leave the world here by the Delete key's command and by
// enemy Militia, each through the command pipeline; a projectile's kill and a
// foundation's deletion are not driven, and the rule does not ask how a
// building went. The played opening is the boot map, one seat, 3,000 ticks
// with the player's seat on the AI, checked every 100 ticks. The older save
// is EMULATED: a save from this build with entries written the way builds
// before vNEXT wrote them, because no save from an older build is committed.
// The recycled id is staged by direct world edits (a blinded scout, the
// House destroyed, a bare House of the player's on its id), as
// fogMemory.test.ts stages its M5 case. An ally's building is not the
// player's and is remembered as before (sharedVisionEntities.test.ts); that
// its loss leaves the same ghost is OPEN in the register entry.

import { describe, expect, it } from 'vitest';

import { lastSeenStaticCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { buildingTint } from '../../src/game/simulation/prototypeBuildingRules';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { RAID_WARNING_HOUSE, RAID_WARNING_MILITIA } from '../../src/game/simulation/fixtures/raidWarning';
import { asSchema2Blob, legacySchema1FromBridge, worldStateOf } from './saveBlobTestUtils';
import {
  drawnWithIds, memoryOf, ownBuildings, step, unseenNow, type SerializedMemory,
} from './fogMemoryOwnBuildings.helpers';

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
    // remembered the way that build's writer remembered every building seen;
    // a House of the player's destroyed before the save, far from anything
    // the player sees, left as a ghost; and, as saves of 2026-05 to 2026-07
    // hold them, the Town Center's entry once more without a generation.
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
    const lostHouseId = 999_999;
    const lostHouse = {
      ...olderEntry,
      entityType: 'house',
      generation: 3,
      position: { x: 40, y: 30 },
      footprintWidth: 2,
      footprintHeight: 2,
      tint: buildingTint('house', HUMAN_PLAYER_ID, true),
      visualVariant: 'complete',
    };
    const slot = worldStateOf(blob)[lastSeenStaticCodec.slot] as SerializedMemory;
    const playerEntries = slot.find(([playerId]) => playerId === HUMAN_PLAYER_ID)![1];
    playerEntries.push([townCenter.id, olderEntry], [lostHouseId, lostHouse]);

    const loaded = createSimulationBridge('fog-memory-fixture', { savedGame: blob });
    expect(memoryOf(loaded).has(townCenter.id), 'premise: the load restored the older entry').toBe(true);
    expect(memoryOf(loaded).has(lostHouseId), 'premise: the load restored the ghost').toBe(true);
    // The same save in the older schema, taken before a tick has run.
    const legacy = createSimulationBridge('fog-memory-fixture', { savedGame: legacySchema1FromBridge(loaded) });
    expect(memoryOf(legacy).has(townCenter.id), 'premise: schema 1 carries the older entry').toBe(true);
    // And one without the generation field.
    const generationless = asSchema2Blob(blob);
    const generationlessSlot = worldStateOf(generationless)[lastSeenStaticCodec.slot] as SerializedMemory;
    const townCenterEntry = generationlessSlot.find(([playerId]) => playerId === HUMAN_PLAYER_ID)![1]
      .find(([id]) => id === townCenter.id)![1];
    delete townCenterEntry.generation;
    const undated = createSimulationBridge('fog-memory-fixture', { savedGame: generationless });

    for (const reloaded of [loaded, legacy, undated]) {
      reloaded.step(100);
      const after = memoryOf(reloaded);
      expect(after.has(townCenter.id), 'the older entry is dropped on the first tick').toBe(false);
      expect(after.has(lostHouseId), 'the ghost of a lost building of the player\'s is dropped').toBe(false);
      expect(after.get(enemyHouse.id), 'what the player saw of the enemy is kept').toEqual(before.get(enemyHouse.id));
      expect(reloaded.getMatchState().outcome).toBe('running');
      // Premise: nothing sees the lost House's ground, so forgetting it on
      // sight of its empty ground (the older rule) could not have dropped it.
      const frame = reloaded.getRenderState().frame!;
      const lostCells = [0, 1].flatMap((dy) => [0, 1].map((dx) => (30 + dy) * frame.mapWidth + 40 + dx));
      expect(lostCells.filter((cell) => frame.visibleCells.includes(cell))).toEqual([]);
    }
  });

  it('keeps a destroyed building\'s entry when its id comes back as a building of the player\'s', () => {
    // The engine recycles ids: an entry under a recycled id with another
    // generation is a different building's last-known state (fogMemory.test.ts,
    // full-review M5), and a building of the player's taking the id must not
    // erase it. In play the ghost is hidden while the player's building holds
    // the id, because the render state matches memory to live entities by id
    // alone (fogMemoryOps); this staging cannot show that, since the render
    // store never hears of a House made inside runMaintenance.
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

    // And once the player's House on that id is gone too, the forgetting of
    // entries recorded as the player's spares this one, which records the
    // enemy: it is still drawn where the player last saw the enemy House.
    bridge.world.runMaintenance(() => bridge.world.destroyEntity(houseId));
    step(bridge, 2);
    expect(drawnWithIds(bridge, new Set([houseId])).map((entity) => ({ isMemory: entity.isMemory, owner: entity.owner, x: entity.x })),
      'the destroyed enemy House, drawn from memory').toEqual([{ isMemory: true, owner: 2, x: 14 }]);
  });
});
