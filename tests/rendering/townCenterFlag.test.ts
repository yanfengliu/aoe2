// The Town Centre's team flag is how a player tells whose base they are
// looking at, and nothing covered it.
//
// Established by removal-diff on 2026-09-01: deleting the two flag parts and
// re-capturing `aoe2-prototype` at the default zoom changes 389 pixels in a
// box at x 396-414, y 144-173. So it does render — but it renders at
// rgb(53,68,81), a dark blue-grey, because shading drops the 0x3f6fd8 team
// tint far below anything a "bright blue" pixel scan would find. Three
// separate colour scans of mine missed it for exactly that reason.
//
// This asserts the CONTRACT rather than the pixels: the flag exists, it
// carries the owner's colour, and it sits above the rest of the building so it
// cannot be swallowed by the roof. A pixel assertion here would re-break every
// time the lighting is touched.

import { describe, expect, it } from 'vitest';

import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';

const TEAM = 0x3f6fd8;

function townCentreParts(): ReturnType<typeof createBuildingParts> {
  return createBuildingParts(
    {
      id: 1,
      kind: 'building',
      entityType: 'town-center',
      owner: 1,
      tint: TEAM,
      x: 10,
      y: 10,
      footprintWidth: 4,
      footprintHeight: 4,
      visualVariant: 'complete',
    } as Parameters<typeof createBuildingParts>[0],
    'tc',
    0,
  );
}

describe('Town Centre ownership flag', () => {
  it('flies a flag in the owner colour', () => {
    const flag = townCentreParts().find((part) => part.key.endsWith('town-center-flag'));
    expect(flag, 'no flag part — the building no longer shows whose it is').toBeDefined();
    expect(flag!.tint).toBe(TEAM);
  });

  it('puts the flag above everything else on the building', () => {
    // A flag inside the roof identifies nothing. The removal-diff found it at
    // the apex; this keeps it there.
    const parts = townCentreParts();
    const flag = parts.find((part) => part.key.endsWith('town-center-flag'))!;
    const flagTop = flag.centerY + flag.height / 2;
    const tallestOther = parts
      .filter((part) => !part.key.includes('flag'))
      .reduce((highest, part) => Math.max(highest, part.centerY + part.height / 2), 0);
    expect(flagTop).toBeGreaterThan(tallestOther);
  });

  it('carries the flag on a pole, not floating', () => {
    const parts = townCentreParts();
    const pole = parts.find((part) => part.key.endsWith('town-center-flag-pole'));
    const flag = parts.find((part) => part.key.endsWith('town-center-flag'))!;
    expect(pole, 'the flag has no pole').toBeDefined();
    // The pole must reach the flag: its span has to overlap the flag's.
    const poleTop = pole!.centerY + pole!.height / 2;
    const flagBottom = flag.centerY - flag.height / 2;
    expect(poleTop).toBeGreaterThanOrEqual(flagBottom);
  });

  it('tints the flag per owner rather than baking one colour in', () => {
    const parts = createBuildingParts(
      {
        id: 2, kind: 'building', entityType: 'town-center', owner: 2, tint: 0xd83f3f,
        x: 10, y: 10, footprintWidth: 4, footprintHeight: 4, visualVariant: 'complete',
      } as Parameters<typeof createBuildingParts>[0],
      'tc2',
      0,
    );
    const flag = parts.find((part) => part.key.endsWith('town-center-flag'))!;
    expect(flag.tint).toBe(0xd83f3f);
  });
});
