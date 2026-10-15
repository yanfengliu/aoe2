// Another player may build on a foundation nobody has started building, but
// only an enemy (work 126; spec §12.1-12.2).
//
// Definitive Edition update 185872 (Gameplay): "Fixed a bug causing unbuilt
// building Foundations to prevent players from building upon them". Forum
// reports 208633 (2022) and 287158 (2026, "This is already tracked") file an
// enemy's unbuilt foundation refusing a placement as a bug. Which players may
// build on one is this game's decision where the notes leave the choice (the
// coordinator, 2026-10-14): what the player is shown blocks it. An enemy's
// unstarted foundation is hidden from the player (work 121), so it refuses
// nothing; the player's own and an ally's are drawn, and they refuse a
// placement over them as before. A started foundation is a building site and
// refuses everyone.
//
// The defect: an enemy's unstarted foundation refused the player's placement
// over it, which told the player that something it could not see stood there,
// and the refusal named it (the register entry of 2026-10-12, work 121).
//
// A refusal that has to happen over an enemy's hidden foundation must read
// word for word as it would without it: the reporter and the anchor search
// read the placer's view as the footprint rule does (review round 0).
//
// BOUND — what a green run here does NOT prove: one House footprint over one
// Barracks site and one House site, on lit, explored grass; the human seat and
// the same seat driven by the AI; the word-for-word refusal for the human seat
// only (an AI seat's anchor search is unbuiltFoundationAnchors.test.ts's).
// Placement over unexplored ground is placementHiddenFoundation.test.ts.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  ALLY_AWAY,
  ALLY_SITE,
  CROSSER_START,
  ENEMY_AWAY,
  ENEMY_SITE,
  HOUSE_OVER_ENEMY_SITE,
  HUMAN_BUILDER,
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

const HUMAN = 1;
/** A House here overlaps the ally's House site at (20,13) and (21,13) only. */
const HOUSE_OVER_ALLY_SITE: Cell = { x: 20, y: 12 };

function humanBuilder(bridge: Bridge): number {
  const unit = bridge.getEconomyState().units
    .find((candidate) => candidate.owner === HUMAN && candidate.x === HUMAN_BUILDER.x && candidate.y === HUMAN_BUILDER.y);
  expect(unit, 'the fixture moved: the human has no builder').toBeDefined();
  return unit!.id;
}

function previewHouse(bridge: Bridge, anchor: Cell, builder = humanBuilder(bridge)): boolean {
  expect(bridge.selectUnitsByIds([builder])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  return bridge.getPlacementPreview(anchor.x, anchor.y)?.isValid === true;
}

function drain(bridge: Bridge): string {
  const messages: string[] = [];
  for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
    messages.push(message);
  }
  return messages.join(' | ');
}

function lit(bridge: Bridge, cell: Cell): boolean {
  const frame = bridge.getRenderState().frame;
  const { width } = bridge.getMapSize();
  return (frame?.visibleCells ?? []).includes(cell.y * width + cell.x);
}

function humanHouseAt(bridge: Bridge, anchor: Cell) {
  return bridge.getEconomyState().buildings.find((building) => (
    building.owner === HUMAN && building.buildingType === 'house' && building.x === anchor.x && building.y === anchor.y
  ));
}

describe('who may build on a foundation nobody has started (work 126)', () => {
  it('the human builds over an enemy\'s unstarted Barracks on ground it sees', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const site = placeFoundationAs(bridge, idsOf(bridge, 2, 'villager')[0]!, 'barracks', ENEMY_SITE, ENEMY_AWAY);
    expect(lit(bridge, ENEMY_SITE), 'the premise: the human sees the site').toBe(true);
    expect(bridge.getRenderState().entities.some((entity) => entity.id === site), 'the premise: the frame hides it')
      .toBe(false);
    expect(previewHouse(bridge, HOUSE_OVER_ENEMY_SITE), 'the ghost turned red over a foundation the frame hides').toBe(true);
    expect(bridge.confirmBuildingPlacement(HOUSE_OVER_ENEMY_SITE.x, HOUSE_OVER_ENEMY_SITE.y)).toBe(true);
    bridge.step(100);
    expect(drain(bridge)).toBe('');
    expect(humanHouseAt(bridge, HOUSE_OVER_ENEMY_SITE), 'the House was not founded').toBeDefined();
    expect(economyBuilding(bridge, site), 'the enemy\'s foundation is still there').toBeDefined();
  });

  it('a started enemy Barracks refuses it, and the refusal names it', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const builder = idsOf(bridge, 2, 'villager')[0]!;
    const site = placeFoundationAs(bridge, builder, 'barracks', ENEMY_SITE, ENEMY_AWAY);
    startFoundationAs(bridge, builder, site, ENEMY_AWAY);
    expect(previewHouse(bridge, HOUSE_OVER_ENEMY_SITE)).toBe(false);
    expect(bridge.confirmBuildingPlacement(HOUSE_OVER_ENEMY_SITE.x, HOUSE_OVER_ENEMY_SITE.y)).toBe(false);
    expect(drain(bridge)).toContain(`blocked by a barracks (building) at (${ENEMY_SITE.x},${ENEMY_SITE.y})`);
  });

  it('an ally\'s unstarted House refuses it, and the refusal names it', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const site = placeFoundationAs(bridge, idsOf(bridge, 3, 'villager')[0]!, 'house', ALLY_SITE, ALLY_AWAY);
    expect(bridge.getRenderState().entities.some((entity) => entity.id === site), 'the premise: the frame draws it')
      .toBe(true);
    expect(previewHouse(bridge, HOUSE_OVER_ALLY_SITE)).toBe(false);
    expect(bridge.confirmBuildingPlacement(HOUSE_OVER_ALLY_SITE.x, HOUSE_OVER_ALLY_SITE.y)).toBe(false);
    expect(drain(bridge)).toContain(`blocked by a house (building) at (${ALLY_SITE.x},${ALLY_SITE.y})`);
  });

  it('the human\'s own unstarted House refuses another of its own over it', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const builder = humanBuilder(bridge);
    expect(previewHouse(bridge, ALLY_SITE, builder)).toBe(true);
    expect(bridge.confirmBuildingPlacement(ALLY_SITE.x, ALLY_SITE.y)).toBe(true);
    bridge.step(100);
    expect(bridge.world.submitWithResult('unit.move', { unitId: builder, target: { ...HUMAN_BUILDER } }).accepted)
      .toBe(true);
    expect(previewHouse(bridge, HOUSE_OVER_ALLY_SITE, builder)).toBe(false);
  });

  // The route a builder must walk to a new site does not count on crossing its
  // owner's unstarted foundation, which will be a wall (foundationClaims.ts);
  // a builder standing on one may still walk off it.
  it('a builder standing on its own unstarted House may still found another beside it', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const builder = humanBuilder(bridge);
    expect(previewHouse(bridge, ALLY_SITE, builder)).toBe(true);
    expect(bridge.confirmBuildingPlacement(ALLY_SITE.x, ALLY_SITE.y)).toBe(true);
    bridge.step(100);
    expect(bridge.world.submitWithResult('unit.move', { unitId: builder, target: { ...ALLY_SITE } }).accepted).toBe(true);
    let onIt = false;
    for (let tick = 0; tick < 400 && !onIt; tick += 1) {
      bridge.step(100);
      const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === builder);
      onIt = unit?.x === ALLY_SITE.x && unit?.y === ALLY_SITE.y;
    }
    expect(onIt, 'the builder never stood on its own unstarted House').toBe(true);
    expect(bridge.selectUnitsByIds([builder])).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.getPlacementPreview(ALLY_SITE.x + 3, ALLY_SITE.y)?.isValid,
      'a builder on its own unstarted House was taken to reach nothing').toBe(true);
  });

  it('an AI seat reads the same rule off the true map', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED, { forceAiForOwners: new Set([HUMAN]) });
    placeFoundationAs(bridge, idsOf(bridge, 2, 'villager')[0]!, 'barracks', ENEMY_SITE, ENEMY_AWAY);
    placeFoundationAs(bridge, idsOf(bridge, 3, 'villager')[0]!, 'house', ALLY_SITE, ALLY_AWAY);
    expect(previewHouse(bridge, HOUSE_OVER_ENEMY_SITE), 'over the enemy\'s').toBe(true);
    expect(previewHouse(bridge, HOUSE_OVER_ALLY_SITE), 'over the ally\'s').toBe(false);
  });

  // The reporter and the anchor search read the placer's view too (review round
  // 0, promoted from its refusalText probe). The human's crosser stands inside
  // the Barracks site, so a House there is refused for the human's own unit,
  // and the nearest open ground the refusal offers overlaps the hidden site.
  it('a refusal over an enemy\'s hidden unstarted Barracks reads word for word as without it', () => {
    const refusal = (withBarracks: boolean): string => {
      const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
      const enemy = idsOf(bridge, 2, 'villager')[0]!;
      if (withBarracks) placeFoundationAs(bridge, enemy, 'barracks', ENEMY_SITE, ENEMY_AWAY);
      else expect(bridge.world.submitWithResult('unit.move', { unitId: enemy, target: { ...ENEMY_AWAY } }).accepted).toBe(true);
      const crosser = bridge.getEconomyState().units
        .find((unit) => unit.owner === HUMAN && unit.x === CROSSER_START.x && unit.y === CROSSER_START.y)!.id;
      const stand = { x: ENEMY_SITE.x + 1, y: ENEMY_SITE.y + 1 };
      expect(bridge.world.submitWithResult('unit.move', { unitId: crosser, target: { ...stand } }).accepted).toBe(true);
      for (let tick = 0; tick < 400; tick += 1) {
        bridge.step(100);
        const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === crosser)!;
        if (unit.x === stand.x && unit.y === stand.y && unit.task === 'idle') break;
      }
      drain(bridge);
      expect(previewHouse(bridge, ENEMY_SITE), 'the premise: the House is refused').toBe(false);
      expect(bridge.confirmBuildingPlacement(ENEMY_SITE.x, ENEMY_SITE.y)).toBe(false);
      return drain(bridge);
    };
    const withIt = refusal(true);
    expect(withIt, 'the premise: refused for the human\'s own unit').toContain('blocked by a unit standing there at (27,17)');
    expect(withIt, 'the premise: the offered ground overlaps the hidden site').toContain('Nearest open ground you can see: (25,15)');
    expect(withIt).toBe(refusal(false));
  });
});
