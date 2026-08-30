// The Deer — spec §5.5's third huntable and §5.6's "deer flee".
//
// Deer did not exist at all: no `'deer'` anywhere in `src/`, so the Dark-Age
// food layer was sheep and boar only and the deer hunt, an ordinary part of an
// AoE2 opening, was not a thing a player could do. This covers the entity, its
// yield, and the behaviour that makes it a different thing from a sheep.
//
// WHAT IS NOT HERE, deliberately: assertions that generated maps carry deer.
// Seeding them into map generation is held — adding deer to the procedural map
// breaks the canary map's stranded-scout return for a reason isolated to "deer
// exist on the map" and not to the flee system, to proximity (the deer land 15
// tiles from the affected scout), to terrain painting, or to cluster ordering.
// See the devlog for the full elimination. Asserting map presence here would
// mean either a red suite or a weakened bar, so the gap is recorded instead.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

describe('deer', () => {
  it('carries the food a deer carries', () => {
    const bridge = createSimulationBridge('deer-flee-fixture');
    const deer = bridge
      .getEconomyState()
      .resources.filter((resource) => resource.resourceType === 'deer');

    expect(deer.length).toBeGreaterThan(0);
    // units.csv:42 — Deer "Provides": {"Food": 140}.
    for (const animal of deer) {
      expect(animal.amount).toBe(140);
    }
  });

  it('flees an approaching villager instead of standing to be shot', () => {
    const bridge = createSimulationBridge('deer-flee-fixture');
    const deerBefore = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer');
    expect(deerBefore).toBeDefined();

    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager');
    expect(villager).toBeDefined();

    const startDistance =
      Math.abs(deerBefore!.x - villager!.x) + Math.abs(deerBefore!.y - villager!.y);

    for (let tick = 0; tick < 200; tick += 1) bridge.step(100);

    const deerAfter = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer');
    expect(deerAfter).toBeDefined();

    const moved =
      Math.abs(deerAfter!.x - deerBefore!.x) + Math.abs(deerAfter!.y - deerBefore!.y);
    expect(moved, 'the deer never moved').toBeGreaterThan(0);

    const villagerAfter = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager');
    const endDistance =
      Math.abs(deerAfter!.x - villagerAfter!.x) + Math.abs(deerAfter!.y - villagerAfter!.y);
    expect(endDistance, 'the deer moved, but not away').toBeGreaterThan(startDistance);
  });

  it('left alone, does not flee — the flight is caused by the approach', () => {
    // The control. Without it, "moved away" would be satisfied about half the
    // time by a deer that simply wandered.
    const bridge = createSimulationBridge('deer-undisturbed-fixture');
    const before = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer');
    expect(before).toBeDefined();

    for (let tick = 0; tick < 200; tick += 1) bridge.step(100);

    const after = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer');
    expect(after).toBeDefined();
    expect(after!.x).toBe(before!.x);
    expect(after!.y).toBe(before!.y);
  });

  it('breaks off the pursuer\'s axis rather than running straight ahead of it', () => {
    // A deer that flees along the pursuer's own line of travel stays in front
    // of it forever, and a herd doing that becomes a moving wall — measured
    // corking a scout's wander-box entrance for 900 ticks. The flight must
    // gain separation on BOTH axes, not just the one it is being pushed along.
    const bridge = createSimulationBridge('deer-flee-fixture');
    const before = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer')!;
    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.unitType === 'villager')!;

    for (let tick = 0; tick < 200; tick += 1) bridge.step(100);

    const after = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer')!;
    // The fixture puts villager and deer on the same row, so a straight-line
    // flee leaves y untouched and the break shows as a change in y.
    //
    // Both halves are asserted separately. A first version wrote this as
    // `after.y !== before.y || after.x === before.x`, which review pointed out
    // is satisfied by a deer that does not move AT ALL — both disjuncts favour
    // standing still, so the test passed for the one behaviour it was written
    // to rule out.
    expect(
      Math.abs(after.x - before.x) + Math.abs(after.y - before.y),
      'the deer did not move, so there is no flight direction to judge',
    ).toBeGreaterThan(0);
    expect(
      after.y,
      `deer fled straight along the villager's row from (${before.x},${before.y}) `
      + `to (${after.x},${after.y}) with the villager at (${villager.x},${villager.y})`,
    ).not.toBe(before.y);
  });
});

describe('hunting a deer', () => {
  // The test this file was missing, and the one that matters most: everything
  // above proves the deer exists and runs. None of it proves a player can
  // actually get the food out of one.
  //
  // Review measured what the absence hid — a villager tasked onto a deer drove
  // it 40 tiles to the map border and delivered 10 food in five minutes of
  // game time, about 0.04 food/sec against the 0.41 the rate table promises,
  // and gathered at all only because the world edge finally stopped the deer.
  // The rate table entry was true and the behaviour was not, because gathering
  // happens at adjacency 1 and that is permanently inside the flee radius.
  it('a villager tasked onto a deer catches it and delivers real food', () => {
    const bridge = createSimulationBridge('deer-flee-fixture');
    const deer = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer')!;
    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.unitType === 'villager')!;

    expect(
      bridge.selectUnitsInBox(villager.x - 1, villager.y - 1, villager.x + 1, villager.y + 1),
    ).toBe(true);
    expect(bridge.issueContextCommandAtEntity(deer.id)).toBe(true);

    const startFood = bridge.getEconomyState().playerResources[HUMAN_PLAYER_ID]!.food;
    for (let tick = 0; tick < 3000; tick += 1) bridge.step(100);
    const state = bridge.getEconomyState();
    const gained = state.playerResources[HUMAN_PLAYER_ID]!.food - startFood;
    const remaining =
      state.resources.find((resource) => resource.resourceType === 'deer')?.amount ?? 0;

    // 3,000 ticks is five minutes. A villager at the §6.3 deer rate of 0.41
    // food/sec cannot spend all of it gathering — it has to walk the deer down
    // first, and then carry loads back — so the bar is deliberately far below
    // the theoretical 120. It is still 6x what the un-catchable deer managed.
    expect(
      gained + (140 - remaining),
      `only ${gained} food delivered and ${140 - remaining} taken from the deer`,
    ).toBeGreaterThanOrEqual(60);
    expect(gained, 'nothing reached the stockpile').toBeGreaterThan(0);
  }, 120_000);

  it('still flees a villager that was not sent to hunt it', () => {
    // The control for the rule above: "stop for your hunter" must not decay
    // into "stop for anyone", or the flight is gone entirely.
    const bridge = createSimulationBridge('deer-flee-fixture');
    const before = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer')!;

    for (let tick = 0; tick < 200; tick += 1) bridge.step(100);

    const after = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'deer')!;
    expect(
      Math.abs(after.x - before.x) + Math.abs(after.y - before.y),
      'an unhunted deer stood still next to a villager',
    ).toBeGreaterThan(0);
  });
});
