// Two foundations on the same ground: whoever starts building first wins (work
// 126; spec §8.1, §12.1).
//
// An enemy may put a foundation over another player's unstarted one (update
// 185872, unbuiltFoundationPlacement.test.ts), so two can share cells. The
// first to get build progress becomes a building site, a wall. The other is
// cancelled when its own builders arrive and find that site: hotfix 45185,
// "Building foundations can no longer begin construction if overlapping other
// structures or foundations that aren't within a player's line of sight", and
// update 46295, "Building foundations are now automatically cancelled when
// Villagers attempt to begin construction if placed over an obstacle". The
// cancelled one is refunded in full at its owner's price, and the human is told
// what its builders found. When it is cancelled is this game's decision, where
// the notes leave the choice (the coordinator, 2026-10-14): on its builders'
// arrival, not when the other one starts.
//
// BOUND — what a green run here does NOT prove: one House over one corner of
// one Barracks on flat grass, between the human and an enemy with no AI; the
// AI's own foundation losing such a race is foundationStartRaceAi.test.ts.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
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

const HUMAN = 1;
const ENEMY = 2;
const BARRACKS_WOOD = 175;
const HOUSE_WOOD = 25;
/** Where the human's builder waits while the other side starts first. */
const HUMAN_ASIDE = { x: 22, y: 24 };

function humanBuilder(bridge: Bridge): number {
  const unit = bridge.getEconomyState().units
    .find((candidate) => candidate.owner === HUMAN && candidate.x === HUMAN_BUILDER.x && candidate.y === HUMAN_BUILDER.y);
  expect(unit, 'the fixture moved: the human has no builder').toBeDefined();
  return unit!.id;
}

function wood(bridge: Bridge, owner: number): number {
  return bridge.getEconomyState().playerResources[owner]?.wood ?? Number.NaN;
}

function drain(bridge: Bridge): string[] {
  const messages: string[] = [];
  for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
    messages.push(message);
  }
  return messages;
}

/** The human puts a House over owner 2's unstarted Barracks; returns both ids. */
function overlap(bridge: Bridge): { barracks: number; house: number; builder: number; enemyBuilder: number } {
  const enemyBuilder = idsOf(bridge, ENEMY, 'villager')[0]!;
  const barracks = placeFoundationAs(bridge, enemyBuilder, 'barracks', ENEMY_SITE, ENEMY_AWAY);
  const builder = humanBuilder(bridge);
  expect(bridge.selectUnitsByIds([builder])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  expect(bridge.confirmBuildingPlacement(HOUSE_OVER_ENEMY_SITE.x, HOUSE_OVER_ENEMY_SITE.y),
    'the House over the enemy\'s unstarted Barracks was refused').toBe(true);
  bridge.step(100);
  const house = bridge.getEconomyState().buildings.find((building) => (
    building.owner === HUMAN && building.x === HOUSE_OVER_ENEMY_SITE.x && building.y === HOUSE_OVER_ENEMY_SITE.y
  ));
  expect(house, 'the House was not founded').toBeDefined();
  return { barracks, house: house!.id, builder, enemyBuilder };
}

function stepUntil(bridge: Bridge, done: () => boolean, maxTicks = 600): boolean {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (done()) return true;
    bridge.step(100);
  }
  return done();
}

describe('the first foundation started wins the ground (work 126)', () => {
  it('the human starts first: the enemy\'s Barracks is cancelled when its builder comes, and refunded', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const { barracks, house, enemyBuilder } = overlap(bridge);
    expect(wood(bridge, ENEMY), 'the premise: the enemy paid for its Barracks').toBe(1000 - BARRACKS_WOOD);
    expect(stepUntil(bridge, () => (economyBuilding(bridge, house)?.buildProgressTicks ?? 0) > 0),
      'the human\'s builder never started the House over the enemy\'s unstarted Barracks').toBe(true);
    expect(economyBuilding(bridge, barracks), 'the enemy\'s Barracks went before its builder came').toBeDefined();

    expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: enemyBuilder, targetEntityId: barracks })
      .accepted).toBe(true);
    expect(stepUntil(bridge, () => economyBuilding(bridge, barracks) === undefined),
      'the enemy\'s Barracks was never cancelled').toBe(true);
    expect(wood(bridge, ENEMY), 'the enemy\'s Barracks was not refunded').toBe(1000);
    expect(economyBuilding(bridge, house)?.buildProgressTicks ?? 0, 'the human\'s House lost its ground').toBeGreaterThan(0);
    const enemy = bridge.getEconomyState().units.find((unit) => unit.id === enemyBuilder);
    expect(enemy?.task, 'the enemy\'s builder is still building the cancelled site').not.toBe('building');
    expect(drain(bridge).join(' | '), 'the human was told of the enemy\'s cancel').not.toContain('cancelled');
  });

  it('the enemy starts first: the human\'s House is cancelled when its builder comes, refunded, and the human is told', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const { barracks, house, builder, enemyBuilder } = overlap(bridge);
    // The human's builder steps aside before it strikes a blow.
    expect(bridge.world.submitWithResult('unit.move', { unitId: builder, target: { ...HUMAN_ASIDE } }).accepted).toBe(true);
    bridge.step(100);
    expect(economyBuilding(bridge, house)?.buildProgressTicks).toBe(0);
    expect(wood(bridge, HUMAN), 'the premise: the human paid for its House').toBe(1000 - HOUSE_WOOD);
    startFoundationAs(bridge, enemyBuilder, barracks, ENEMY_AWAY);
    drain(bridge);

    expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: builder, targetEntityId: house })
      .accepted).toBe(true);
    let messages: string[] = [];
    expect(stepUntil(bridge, () => {
      messages = messages.concat(drain(bridge));
      return economyBuilding(bridge, house) === undefined;
    }), 'the human\'s House was never cancelled').toBe(true);
    messages = messages.concat(drain(bridge));
    expect(wood(bridge, HUMAN), 'the House was not refunded').toBe(1000);
    expect(economyBuilding(bridge, barracks)?.buildProgressTicks ?? 0).toBeGreaterThan(0);
    const message = messages.join(' | ');
    expect(message).toContain(`Your house at (${HOUSE_OVER_ENEMY_SITE.x},${HOUSE_OVER_ENEMY_SITE.y}) was cancelled`);
    expect(message).toContain(`a barracks (building) at (${ENEMY_SITE.x},${ENEMY_SITE.y})`);
    expect(message).toContain('refunded');
  });
});
