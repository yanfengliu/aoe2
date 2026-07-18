// Contract for the fixture spawn helpers that replaced ~900 hand-written
// spawn object literals (2026-07-17). The invariants they encode were
// verified across the whole fixture tier before the helpers existed:
// every owned spawn had baseOwner === owner (845/845) and every vision
// object had playerId === owner (697/697); every gaia spawn had
// owner: null, with baseOwner either null (28) or a player attribution
// for resources seeded inside a base area (49).
//
// toStrictEqual throughout: the helpers must not add keys the literals
// did not have (an absent optional key and an undefined-valued key are
// different objects to toStrictEqual, and the scenario snapshot diff
// that proved the conversion behavior-preserving relied on exact shapes).

import { describe, expect, it } from 'vitest';

import { gaiaSpawn, ownedSpawn } from '../../src/game/simulation/fixtures/common';

describe('ownedSpawn', () => {
  it('derives baseOwner and vision.playerId from the owner', () => {
    expect(ownedSpawn('town-center', 1, 4, 4, { vision: 7 })).toStrictEqual({
      kind: 'town-center',
      x: 4,
      y: 4,
      owner: 1,
      baseOwner: 1,
      vision: { playerId: 1, radius: 7 },
    });
  });

  it('omits the vision key entirely when no radius is given', () => {
    const spawn = ownedSpawn('barracks', 2, 4, 10);
    expect(spawn).toStrictEqual({ kind: 'barracks', x: 4, y: 10, owner: 2, baseOwner: 2 });
    expect('vision' in spawn).toBe(false);
  });

  it('passes extra spawn fields through unchanged', () => {
    expect(ownedSpawn('house', 1, 2, 3, { startHp: 30 })).toStrictEqual({
      kind: 'house',
      x: 2,
      y: 3,
      owner: 1,
      baseOwner: 1,
      startHp: 30,
    });
  });

  it('combines vision with other extras', () => {
    expect(ownedSpawn('monastery', 2, 8, 9, { vision: 6, startingRelicsInMonastery: 2 })).toStrictEqual({
      kind: 'monastery',
      x: 8,
      y: 9,
      owner: 2,
      baseOwner: 2,
      vision: { playerId: 2, radius: 6 },
      startingRelicsInMonastery: 2,
    });
  });
});

describe('gaiaSpawn', () => {
  it('spawns unowned with a null base attribution by default', () => {
    expect(gaiaSpawn('tree', 5, 6)).toStrictEqual({
      kind: 'tree',
      x: 5,
      y: 6,
      owner: null,
      baseOwner: null,
    });
  });

  it('keeps owner null while allowing a base attribution and amount', () => {
    expect(gaiaSpawn('sheep', 24, 8, { baseOwner: 2, amount: 500 })).toStrictEqual({
      kind: 'sheep',
      x: 24,
      y: 8,
      owner: null,
      baseOwner: 2,
      amount: 500,
    });
  });
});
