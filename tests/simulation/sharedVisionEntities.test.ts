import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID, TPS } from '../../src/game/simulation/prototypeScenario';
import type {
  BuildingComponent,
  RenderableComponent,
  ResourceComponent,
  UnitComponent,
} from '../../src/game/simulation/types';
import type { SimulationBridge } from '../../src/game/simulation/simulationBridgeTypes';

// GATE (register 2026-09-24, "an ally's base is lit but empty"): what the human
// is SHOWN is decided by the human's sight — its own vision plus every owner it
// shares vision with (Definitive Edition: allies from the first frame; Spies:
// everyone) — never by the human's own vision alone.
//
// The defect this retires: in a 3-player match with teams 1,1,2 the ally's
// ground was lit (the frame's visible cells already took the union) but not one
// of the ally's units, buildings, trees or mines was drawn, because the filter
// that decides which live entities reach the renderer asked the human's own
// vision only. The gate that stood beside it counted lit cells and so stayed
// green over an empty base.
//
// The check is two-way over EVERY entity in the world, not over one building:
// every non-tile entity some sight owner can see must be drawn live, and every
// entity drawn live that the human does not own must be seeable by some sight
// owner. Visibility is read here from the raw per-owner primitive
// (`isCellVisibleForOwner`). The sight set comes from `getSharedVisionOwners`,
// which delegates to the same `humanSight.ts` the bridge uses, so what keeps
// the check from agreeing with itself is the pin `sight === [1, 2]`.
//
// Bound: one seed (`aoe2-prototype`), three players, one team layout (1,1,2),
// at a handful of early ticks — the ally's base is in its own sight, the enemy's
// is not in anyone's, so no enemy stands where only the ally sees it; the Monk
// case below stages one on a small fixture (drawn, clickable, converted). The animation filters are held by
// `tests/simulation/sharedSightAnimations.test.ts`, the replay bridge by
// `tests/replay/makeReplayBridge.sharedSight.test.ts`, and the call-site shape by
// `tests/architecture/humanSightQueries.test.ts`. The playtest agent's snapshot
// is not exercised.

const ALLIED = new Map([[1, 1], [2, 1], [3, 2]]);

interface Seen {
  id: number;
  owner: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

function worldEntities(bridge: SimulationBridge): Seen[] {
  const { world } = bridge;
  const seen: Seen[] = [];
  for (const id of world.query('position', 'renderable')) {
    const renderable = world.getComponent<RenderableComponent>(id, 'renderable')!;
    if (renderable.kind === 'tile') continue;
    const position = world.getComponent<{ x: number; y: number }>(id, 'position')!;
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    seen.push({
      id,
      owner: unit?.owner ?? building?.owner ?? resource?.owner ?? null,
      x: position.x,
      y: position.y,
      width: renderable.footprintWidth,
      height: renderable.footprintHeight,
    });
  }
  return seen;
}

function sightOf(bridge: SimulationBridge): number[] {
  return [HUMAN_PLAYER_ID, ...bridge.getSharedVisionOwners(HUMAN_PLAYER_ID)];
}

function seeable(bridge: SimulationBridge, sight: readonly number[], entity: Seen): boolean {
  const map = bridge.getMapSize();
  for (let dy = 0; dy < entity.height; dy += 1) {
    for (let dx = 0; dx < entity.width; dx += 1) {
      const x = Math.floor(entity.x) + dx;
      const y = Math.floor(entity.y) + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (sight.some((owner) => bridge.isCellVisibleForOwner(owner, x, y))) return true;
    }
  }
  return false;
}

function liveDrawnIds(bridge: SimulationBridge): Set<number> {
  return new Set(
    bridge.getRenderState().entities
      .filter((entity) => entity.kind !== 'tile' && !entity.isMemory)
      .map((entity) => entity.id),
  );
}

function stepTicks(bridge: SimulationBridge, ticks: number): void {
  let ran = 0;
  for (let call = 0; ran < ticks && call < ticks * 2; call += 1) {
    const report = bridge.step(1000 / TPS);
    expect(report.refusedBecause, 'the bridge refused to advance').toBeNull();
    ran += report.ticks;
  }
  expect(ran).toBe(ticks);
}

describe('the human is shown what its sight sees — its own vision plus its allies’', () => {
  it('draws every entity an ally can see, and nothing no sight owner can see', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      playerCount: 3,
      teamsByOwner: ALLIED,
    });
    const sight = sightOf(bridge);
    expect(sight).toEqual([1, 2]);

    for (const ticks of [1, 40, 200]) {
      stepTicks(bridge, ticks);
      const entities = worldEntities(bridge);
      const drawn = liveDrawnIds(bridge);

      const allyBase = entities.filter((e) => e.owner === 2 && seeable(bridge, sight, e));
      // Non-vacuous: the ally's Town Centre and villagers stand in its own sight,
      // and at least that much of it is out of reach of the human's own eyes, so
      // only the shared sight can put it on screen.
      expect(allyBase.length).toBeGreaterThan(3);
      const onlyThroughTheAlly = allyBase.filter((e) => !seeable(bridge, [HUMAN_PLAYER_ID], e));
      expect(onlyThroughTheAlly.length).toBeGreaterThan(3);

      const missing = entities
        .filter((e) => seeable(bridge, sight, e) && !drawn.has(e.id))
        .map((e) => `#${e.id} owner ${e.owner} at (${e.x},${e.y})`);
      expect(missing, `seen by the human's sight but not drawn after ${ticks} more ticks`).toEqual([]);

      const leaked = entities
        .filter((e) => drawn.has(e.id) && e.owner !== HUMAN_PLAYER_ID && !seeable(bridge, sight, e))
        .map((e) => `#${e.id} owner ${e.owner} at (${e.x},${e.y})`);
      expect(leaked, `drawn although no sight owner sees it after ${ticks} more ticks`).toEqual([]);

      // The enemy's base is in nobody's sight this early: none of it is drawn.
      const enemyDrawn = entities.filter((e) => e.owner === 3 && drawn.has(e.id));
      expect(enemyDrawn).toEqual([]);
    }
  }, 120_000);

  it('draws none of the same player’s base when it is not an ally (control)', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { playerCount: 3 });
    expect(bridge.getSharedVisionOwners(HUMAN_PLAYER_ID)).toEqual([]);
    stepTicks(bridge, 40);
    const drawn = liveDrawnIds(bridge);
    const otherDrawn = worldEntities(bridge)
      .filter((e) => e.owner !== null && e.owner !== HUMAN_PLAYER_ID && drawn.has(e.id));
    expect(otherDrawn).toEqual([]);
  }, 120_000);

  it('remembers an ally’s buildings seen through shared sight, as DE does', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      playerCount: 3,
      teamsByOwner: ALLIED,
    });
    stepTicks(bridge, 5);
    const allyTownCentre = worldEntities(bridge).find((e) => {
      const building = bridge.world.getComponent<BuildingComponent>(e.id, 'building');
      return building?.owner === 2 && building.buildingType === 'town-center';
    });
    expect(allyTownCentre).toBeDefined();
    const memory = new Map(
      (bridge.world.getState('aoe2.lastSeenStatic') ?? []) as Array<[number, Array<[number, unknown]>]>,
    );
    const remembered = new Set((memory.get(HUMAN_PLAYER_ID) ?? []).map(([id]) => id));
    expect(remembered.has(allyTownCentre!.id)).toBe(true);
  }, 120_000);

  it('lets the human click an ally’s building and unit, and a right-click on an ally is never an attack', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      playerCount: 3,
      teamsByOwner: ALLIED,
    });
    stepTicks(bridge, 5);
    const entities = worldEntities(bridge);
    const allyTownCentre = entities.find((e) => {
      const building = bridge.world.getComponent<BuildingComponent>(e.id, 'building');
      return building?.owner === 2 && building.buildingType === 'town-center';
    })!;
    expect(bridge.selectEntityAtCell(allyTownCentre.x, allyTownCentre.y)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityId).toBe(allyTownCentre.id);
    // It is labelled an ally, not an enemy.
    expect(bridge.getSelectionState().faction).toBe('Ally');

    // The human's scout, right-clicked onto the cell an ally villager stands
    // on through the ground route (the fallback when the pointer hits no drawn
    // entity): a walk, never friendly fire.
    const scout = entities.find((e) => {
      const unit = bridge.world.getComponent<UnitComponent>(e.id, 'unit');
      return unit?.owner === HUMAN_PLAYER_ID && unit.unitType === 'scout';
    })!;
    const allyVillager = entities.find((e) => {
      const unit = bridge.world.getComponent<UnitComponent>(e.id, 'unit');
      return unit?.owner === 2 && unit.unitType === 'villager';
    })!;
    // A unit is picked through the per-cell rule, a building through the
    // footprint rule: both must see through the ally's eyes.
    expect(bridge.selectEntityAtCell(allyVillager.x, allyVillager.y)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityId).toBe(allyVillager.id);
    expect(bridge.selectEntityAtCell(scout.x, scout.y)).toBe(true);
    bridge.issueContextCommand(Math.floor(allyVillager.x), Math.floor(allyVillager.y));
    stepTicks(bridge, 2);
    const unitCommand = (bridge.world.getState('aoe2.unitCommands') ?? []) as Array<[number, { type: string }]>;
    const command = new Map(unitCommand).get(scout.id);
    expect(command?.type).toBe('move');
  }, 120_000);
  it('lets a Monk convert an enemy only its ally sees, and never convert an ally on either route', () => {
    const bridge = createSimulationBridge('monk-allied-sight-fixture', {
      teamsByOwner: ALLIED,
      disableAiForOwners: new Set([2, 3]),
    });
    stepTicks(bridge, 1);
    const unitOf = (owner: number, unitType: string): Seen => worldEntities(bridge).find((e) => {
      const unit = bridge.world.getComponent<UnitComponent>(e.id, 'unit');
      return unit?.owner === owner && unit.unitType === unitType;
    })!;
    const monk = unitOf(HUMAN_PLAYER_ID, 'monk');
    const enemy = unitOf(3, 'villager');
    const allyEye = unitOf(2, 'monk');
    const allyVillager = unitOf(2, 'villager');
    // The staging the case rests on: the enemy is seen by the ally alone, from
    // the same cell, and the ally's villager stands in the human's own sight.
    expect([allyEye.x, allyEye.y]).toEqual([enemy.x, enemy.y]);
    expect(allyEye.id).toBeLessThan(enemy.id);
    expect(bridge.isCellVisibleForOwner(HUMAN_PLAYER_ID, enemy.x, enemy.y)).toBe(false);
    expect(bridge.isCellVisibleForOwner(2, enemy.x, enemy.y)).toBe(true);
    expect(bridge.isCellVisibleForOwner(HUMAN_PLAYER_ID, allyVillager.x, allyVillager.y)).toBe(true);
    // An enemy only the ally sees is drawn, like everything else in its sight.
    expect(liveDrawnIds(bridge).has(enemy.id)).toBe(true);

    const monkTask = (): { kind: string; targetEntityRef: { id: number } } | undefined =>
      new Map((bridge.world.getState('aoe2.monkTasks') ?? []) as Array<
        [number, { kind: string; targetEntityRef: { id: number } }]
      >).get(monk.id);
    const monkCommand = (): { type: string; target?: { x: number; y: number } } | undefined =>
      new Map((bridge.world.getState('aoe2.unitCommands') ?? []) as Array<
        [number, { type: string; target?: { x: number; y: number } }]
      >).get(monk.id);
    const allyCell = { x: allyVillager.x, y: allyVillager.y };

    expect(bridge.selectEntityAtCell(monk.x, monk.y)).toBe(true);
    // By-entity route (the pointer hits the drawn ally villager): a walk to it.
    expect(bridge.issueContextCommandAtEntity(allyVillager.id)).toBe(true);
    stepTicks(bridge, 2);
    expect(monkTask(), 'a by-entity right-click on an ally made it a conversion target').toBeUndefined();
    expect(monkCommand()).toMatchObject({ type: 'move', target: allyCell });

    // Ground route (the pointer hits no drawn entity): a walk too. The Monk is
    // first sent elsewhere, so the walk seen afterwards is this click's.
    expect(bridge.issueMoveCommand(monk.x, monk.y + 4)).toBe(true);
    stepTicks(bridge, 2);
    expect(monkCommand()?.target).toEqual({ x: monk.x, y: monk.y + 4 });
    bridge.issueContextCommand(allyVillager.x, allyVillager.y);
    stepTicks(bridge, 2);
    expect(monkTask(), 'a ground right-click on an ally made it a conversion target').toBeUndefined();
    expect(monkCommand()).toMatchObject({ type: 'move', target: allyCell });

    // Ground route on the enemy's cell, where the ally's Monk stands too: the
    // conversion is armed on the ENEMY, and it completes although the Monk's
    // own eyes never see the target — the ally's do.
    bridge.issueContextCommand(enemy.x, enemy.y);
    stepTicks(bridge, 2);
    expect(monkTask()).toMatchObject({ kind: 'convert', targetEntityRef: { id: enemy.id } });
    let converted = false;
    for (let step = 0; step < 60 && !converted; step += 1) {
      stepTicks(bridge, 10);
      converted = bridge.world.getComponent<UnitComponent>(enemy.id, 'unit')?.owner === HUMAN_PLAYER_ID;
    }
    expect(converted, 'the conversion was armed but never completed').toBe(true);
  }, 120_000);
});
