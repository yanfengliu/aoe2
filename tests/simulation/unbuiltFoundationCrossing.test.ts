// Every unit crosses a foundation nobody has started building (work 126; spec
// §8.1 and §12.3). Definitive Edition update 185872 (Pathfinding): "Fixed a bug
// preventing Villagers from walking over unbuilt Foundations." Forgotten
// Empires' own video for that line has the same title, so the villagers' case
// was the bug and walking over an unbuilt foundation is the rule: forum 227893
// (2023) has enemy units pass through a player's unstarted foundation, and
// forum 286896 (build 178524, 2026) files a unit stopped by unbuilt enemy walls
// as a bug. Animals cross it too, since in DE a sheep is a unit (the
// coordinator's decision of review round 0); the claim's own contract,
// `unbuiltFoundationClaims.test.ts`, holds that half.
//
// The defect: a foundation was a wall from the tick it was placed, so another
// player's units walked around a foundation they could not see, and a unit
// under one could not leave (the register entry of 2026-10-12, work 122).
//
// The cases put owner 2's Barracks down through a real `building.placeConfirm`
// and walk the human's villager along the row through its middle, twenty cells
// due east. On a 4-connected grid that row is the only shortest walk when the
// foundation is open ground, so the crossing is measured as the walk's length
// against the same walk on bare grass, and as a cell of the footprint stood on.
// The control is the same walk once owner 2 has started the Barracks.
//
// BOUND — what a green run here does NOT prove:
//  * One 3x3 Barracks on flat grass, land units only. A Fish Trap's
//    foundation and ships share the code (`isCellBlockedByBuilding` reads the
//    'building' claim only) and are not walked here.
//  * The human's villager and owner 2's own villager. Every unit reads the same
//    passability predicate, so other unit types are not walked one by one.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { UnitTransformComponent } from '../../src/game/simulation/types';
import {
  CROSSER_START,
  CROSSER_TARGET,
  ENEMY_AWAY,
  ENEMY_SITE,
  UNBUILT_FOUNDATIONS_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';
import {
  economyBuilding,
  idsOf,
  placeFoundationAs,
  startFoundationAs,
  type Bridge,
} from './hiddenUnstartedFoundation.helpers';

type Cell = { readonly x: number; readonly y: number };

const BARRACKS = 3;

function onSite(cell: Cell): boolean {
  return cell.x >= ENEMY_SITE.x && cell.x < ENEMY_SITE.x + BARRACKS
    && cell.y >= ENEMY_SITE.y && cell.y < ENEMY_SITE.y + BARRACKS;
}

function unitAt(bridge: Bridge, owner: number, cell: Cell): number {
  const unit = bridge.getEconomyState().units
    .find((candidate) => candidate.owner === owner && candidate.x === cell.x && candidate.y === cell.y);
  expect(unit, `the fixture moved: owner ${owner} has no unit at (${cell.x},${cell.y})`).toBeDefined();
  return unit!.id;
}

function cellOf(bridge: Bridge, id: number): Cell | undefined {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === id);
  if (unit) return { x: unit.x, y: unit.y };
  const resource = bridge.getEconomyState().resources.find((candidate) => candidate.id === id);
  return resource ? { x: resource.x, y: resource.y } : undefined;
}

/** Walks `id` to `target` and reports how many ticks it took, whether it
 *  stood on a cell of the site on the way, and whether it ever stood there in
 *  overflow rather than in a real sub-cell slot (the engine refuses a slot on
 *  a cell another entity's ENGINE claim holds, so a walkable claim kept there
 *  would stack units as overflow: passableStructures.ts). */
function walk(bridge: Bridge, id: number, target: Cell, order: () => boolean, maxTicks = 700) {
  expect(order(), 'the walk order was refused').toBe(true);
  let crossed = false;
  let overflowOnSite = false;
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    bridge.step(100);
    const cell = cellOf(bridge, id);
    expect(cell, 'the walker vanished').toBeDefined();
    if (onSite(cell!)) {
      crossed = true;
      const transform = bridge.world.getComponent<UnitTransformComponent>(id, 'unitTransform');
      if (transform?.occupancySlotOverflow === true) overflowOnSite = true;
    }
    if (cell!.x === target.x && cell!.y === target.y) return { ticks: tick, crossed, overflowOnSite };
  }
  return { ticks: Number.POSITIVE_INFINITY, crossed, overflowOnSite };
}

function moveOrder(bridge: Bridge, unitId: number, target: Cell): () => boolean {
  return () => bridge.world.submitWithResult('unit.move', { unitId, target: { ...target } }).accepted;
}

function enemyBarracks(bridge: Bridge, started: boolean): number {
  const builder = idsOf(bridge, 2, 'villager')[0]!;
  const site = placeFoundationAs(bridge, builder, 'barracks', ENEMY_SITE, ENEMY_AWAY);
  if (started) startFoundationAs(bridge, builder, site, ENEMY_AWAY);
  return site;
}

describe('a foundation nobody has started building is open ground to every unit (work 126)', () => {
  it('the human\'s villager walks straight across an enemy\'s unstarted Barracks, as fast as over bare grass', () => {
    // The same tick of the same match with no foundation: owner 2's villager
    // walks away as `placeFoundationAs` walks it, and nothing else differs.
    const bare = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    expect(moveOrder(bare, idsOf(bare, 2, 'villager')[0]!, ENEMY_AWAY)()).toBe(true);
    bare.step(100);
    const bareWalker = unitAt(bare, 1, CROSSER_START);
    const bareWalk = walk(bare, bareWalker, CROSSER_TARGET, moveOrder(bare, bareWalker, CROSSER_TARGET));
    expect(bareWalk.crossed, 'the premise: the bare walk runs along the site\'s row').toBe(true);

    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const site = enemyBarracks(bridge, false);
    const crosser = unitAt(bridge, 1, CROSSER_START);
    const crossing = walk(bridge, crosser, CROSSER_TARGET, moveOrder(bridge, crosser, CROSSER_TARGET));
    expect(economyBuilding(bridge, site)?.buildProgressTicks, 'the premise: nobody started it').toBe(0);
    expect(crossing.crossed, 'the villager walked around the unstarted foundation').toBe(true);
    expect(crossing.ticks, 'crossing the foundation cost more than crossing grass').toBe(bareWalk.ticks);
    expect(crossing.overflowOnSite, 'the villager stood on the foundation in overflow, not in a slot').toBe(false);
  });

  it('a started foundation is a wall: the same walk goes around it', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const site = enemyBarracks(bridge, true);
    expect(economyBuilding(bridge, site)?.buildProgressTicks ?? 0).toBeGreaterThan(0);
    const crosser = unitAt(bridge, 1, CROSSER_START);
    const around = walk(bridge, crosser, CROSSER_TARGET, moveOrder(bridge, crosser, CROSSER_TARGET));
    expect(around.crossed, 'the villager walked through a started foundation').toBe(false);
    expect(Number.isFinite(around.ticks), 'the villager never arrived').toBe(true);
  });

  it('its owner\'s own villager walks back across it the way it came', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const builder = idsOf(bridge, 2, 'villager')[0]!;
    // Placed and walked due west along the site's middle row, never working it.
    const west = { x: 18, y: ENEMY_SITE.y + 1 };
    expect(cellOf(bridge, builder)?.y, "the fixture moved: owner 2's villager is not on the row it crosses")
      .toBe(west.y);
    const site = placeFoundationAs(bridge, builder, 'barracks', ENEMY_SITE, west);
    let crossed = false;
    for (let tick = 0; tick < 700; tick += 1) {
      const cell = cellOf(bridge, builder)!;
      if (onSite(cell)) crossed = true;
      if (cell.x === west.x && cell.y === west.y) break;
      bridge.step(100);
    }
    expect(economyBuilding(bridge, site)?.buildProgressTicks).toBe(0);
    expect(crossed, 'owner 2\'s villager walked around its own unstarted foundation').toBe(true);
  });
});
