// The behind-building cue must read as a UNIT BEHIND A BUILDING — not as a
// figure painted on the wall, and not as the wrong player's.
//
// The defect this gate exists for, found by playing the boot map (2026-09-06):
// the first thing a player saw at tick 0 was a solid, featureless, bright blue
// humanoid pasted onto the Town Centre's wall, and behind a house an enemy
// spearman rendered as a vivid MAGENTA figure that read as nobody's colour. The
// machinery was working — `getOccludedUnitStates()` confirmed both were the
// intended x-ray cue — so no existing test could see it: the cue was drawn on
// the OPAQUE `ui` lane at full coverage, and its two colours had been chosen by
// maximising RGB distance from the building palette, which maximises distance
// from the player colours too.
//
// So this gate holds two relationships rather than any hex or lane name:
//
//   1. COVERAGE. The lane the cue is drawn on is translucent, and the film's
//      effective coverage is strictly between 0.5 and 1 — above 0.5 so the cue's
//      own colour beats whatever is behind it, below 1 so the building shows
//      through and the shape reads as BEHIND. Both bounds are read out of the
//      snapshot the engine actually consumes (the batch's material opacity, and
//      how many coincident passes the batch holds), never from a constant this
//      module also imports.
//   2. IDENTITY. Each player slot's cue carries that slot's AoE2 player hue,
//      and the composite of cue over background still reads as the cue rather
//      than as the background.
//
// BOUNDS, and they are real. This is a SNAPSHOT gate: it proves what the
// renderer emits for one villager behind one Town Centre, and it says nothing
// about how the frame looks — the pixels were proved once, by capture, with
// `scripts/captureMapScreenshot.mjs` at 800x600 and 1280x800, at zoom 0.7 / 1.2
// (default) / 2.4, on `aoe2-prototype` at ticks 1 and 3000 and on
// `occlusion-showcase-fixture`, each diffed against the same framing at
// 4d398996 (0.02%-0.49% of frame, confined to the silhouettes). A later change
// that keeps these relationships and still looks wrong will pass here.
// The single background this gate composites against is ONE MEASURED PIXEL —
// the sunlit Town Centre roof at (251,96,15), sampled from that capture set —
// because the worst case for a translucent cue is its complement, and this
// world pairs a blue player with orange roofs. It is not the whole palette and
// not every lighting angle.

import { describe, expect, it } from 'vitest';

import type { InstanceBatchV1, MaterialResourceV1, RenderSnapshotV1 } from 'voxel/core';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { occlusionSilhouetteTint } from '../../src/rendering/voxel/aoeVoxelOcclusionSilhouettes';
import { VOXEL_COLORS } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

const OCCLUSION_KEY = /^ui:occlusion(?:-pass\d+)?:/u;

/** A sunlit Town Centre roof, measured off the capture set for this change.
 *  The complement of the friendly blue, and therefore the cue's worst case. */
const SUNLIT_ROOF: readonly [number, number, number] = [251, 96, 15];

/** AoE2's player order, and the angle each slot's cue must sit near. Slot 7 is
 *  the grey player, which has no hue — it is checked for neutrality instead. */
const PLAYER_HUES: Readonly<Record<number, number | 'grey'>> = {
  1: 220, 2: 0, 3: 120, 4: 55, 5: 185, 6: 275, 7: 'grey', 8: 25,
};

const rgb = (hex: number): [number, number, number] => [
  (hex >> 16) & 255, (hex >> 8) & 255, hex & 255,
];
const distance = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function hueOf([r, g, b]: readonly [number, number, number]): number | null {
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  if (span === 0) return null;
  const sixth = max === r
    ? ((g - b) / span) % 6
    : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return (sixth * 60 + 360) % 360;
}

function hueGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

function saturationOf([r, g, b]: readonly [number, number, number]): number {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

function view(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x: 0,
    y: 0,
    elevation: 0,
    tint: 0x587f4e,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
    ...overrides,
  };
}

/** The boot map's own case: a villager standing behind the Town Centre. */
function snapshotWithHiddenVillager(): RenderSnapshotV1 {
  return new AoeVoxelAdapter().createSnapshot([
    view(),
    view({
      id: 7,
      generation: 3,
      kind: 'unit',
      layer: 'unit',
      entityType: 'villager',
      owner: 1,
      x: 7,
      y: 7,
      tint: 0x3f6fd0,
      size: 0.8,
      currentHp: 25,
      maxHp: 25,
    }),
    view({
      id: 20,
      generation: 1,
      kind: 'building',
      layer: 'building',
      entityType: 'town-center',
      owner: 2,
      x: 8,
      y: 8,
      tint: 0xcc3333,
      footprintWidth: 4,
      footprintHeight: 4,
      currentHp: 2400,
      maxHp: 2400,
    }),
  ], 1_000);
}

function silhouetteBatch(snapshot: RenderSnapshotV1): InstanceBatchV1 {
  const carrying = snapshot.batches.filter(
    (batch) => batch.instanceKeys.some((key) => OCCLUSION_KEY.test(key)),
  );
  expect(carrying, 'a hidden villager must produce silhouette instances').toHaveLength(1);
  return carrying[0]!;
}

function materialFor(snapshot: RenderSnapshotV1, batch: InstanceBatchV1): MaterialResourceV1 {
  const material = snapshot.resources.find(
    (resource): resource is MaterialResourceV1 => resource.kind === 'material'
      && resource.key === batch.materialKey,
  );
  expect(material, `batch ${batch.key} names material ${batch.materialKey}`).toBeDefined();
  return material!;
}

/** How much of the cue's own colour survives on a pixel: one minus what every
 *  coincident pass lets through. Read from the snapshot, both halves. */
function measuredCoverage(snapshot: RenderSnapshotV1): number {
  const batch = silhouetteBatch(snapshot);
  const material = materialFor(snapshot, batch);
  const opacity = material.opacity * (material.color.a / 255);
  const passesBySource = new Map<string, number>();
  for (const key of batch.instanceKeys) {
    if (!OCCLUSION_KEY.test(key)) continue;
    const source = key.replace(OCCLUSION_KEY, '');
    passesBySource.set(source, (passesBySource.get(source) ?? 0) + 1);
  }
  const counts = new Set(passesBySource.values());
  expect(counts.size, 'every mirrored part is laid down the same number of times').toBe(1);
  const passes = [...counts][0]!;
  return 1 - (1 - opacity) ** passes;
}

describe('a hidden unit is drawn as a see-through cue, not a solid figure', () => {
  it('draws the cue on a translucent lane', () => {
    const snapshot = snapshotWithHiddenVillager();
    const material = materialFor(snapshot, silhouetteBatch(snapshot));
    expect(
      material.transparent || material.opacity < 1,
      `the cue is drawn on '${material.key}', which is opaque — an opaque mirror of a `
      + 'unit is a decal painted on the wall, which is the defect this replaced',
    ).toBe(true);
  });

  it('leaves the building visible through the cue, and the cue readable over it', () => {
    const coverage = measuredCoverage(snapshotWithHiddenVillager());
    expect(
      coverage,
      `coverage ${coverage.toFixed(2)} hides the building completely: nothing shows through, `
      + 'so the cue reads as a unit standing in front of the wall',
    ).toBeLessThan(1);
    expect(
      coverage,
      `coverage ${coverage.toFixed(2)} lets the background win: at or below half, a pixel is `
      + "at least as much wall as cue and the owner's colour is lost",
    ).toBeGreaterThan(0.5);
  });

  it('costs no extra instance batch', () => {
    // Nine is what the snapshot declares and what the browser occlusion proof
    // holds; buying opacity with a tenth lane would break both.
    const snapshot = snapshotWithHiddenVillager();
    expect(snapshot.batches.length).toBeLessThanOrEqual(9);
    expect(snapshot.descriptor.limits.maxBatches).toBe(9);
  });

  it('lays every pass of a part in exactly the same place and colour', () => {
    const snapshot = snapshotWithHiddenVillager();
    const batch = silhouetteBatch(snapshot);
    const bySource = new Map<string, number[]>();
    batch.instanceKeys.forEach((key, index) => {
      if (!OCCLUSION_KEY.test(key)) return;
      const source = key.replace(OCCLUSION_KEY, '');
      bySource.set(source, [...(bySource.get(source) ?? []), index]);
    });
    expect(bySource.size).toBeGreaterThan(0);
    for (const [source, indices] of bySource) {
      const [first, ...rest] = indices;
      for (const other of rest) {
        for (let lane = 0; lane < 16; lane += 1) {
          expect(
            batch.matrices[other * 16 + lane],
            `${source} pass ${String(other)} sits off its first pass — coincident passes `
            + 'that drift would smear the cue instead of deepening it',
          ).toBe(batch.matrices[first! * 16 + lane]);
        }
        for (let channel = 0; channel < 4; channel += 1) {
          expect(batch.colors![other * 4 + channel])
            .toBe(batch.colors![first! * 4 + channel]);
        }
      }
    }
  });
});

describe("the cue carries the owner's colour", () => {
  it('gives every AoE2 player slot its own hue', () => {
    for (const [slot, expected] of Object.entries(PLAYER_HUES)) {
      const channels = rgb(occlusionSilhouetteTint(Number(slot)));
      const hue = hueOf(channels);
      if (expected === 'grey') {
        expect(
          saturationOf(channels),
          `slot ${slot} is AoE2's grey player and must read neutral`,
        ).toBeLessThan(0.12);
        continue;
      }
      expect(hue, `slot ${slot} must have a hue at all`).not.toBeNull();
      expect(
        hueGap(hue!, expected),
        `slot ${slot} sits at ${String(Math.round(hue!))}°, not the ${String(expected)}° `
        + 'AoE2 paints that player — a cue naming the wrong player is worse than no cue',
      ).toBeLessThanOrEqual(25);
    }
  });

  it('never renders an enemy as magenta again', () => {
    // The reported defect, in one assertion. AoE2's player 2 is RED: red is the
    // dominant channel and the other two stay close to each other. The magenta
    // that shipped (0xff4de0) had blue 147 above green.
    const [red, green, blue] = rgb(occlusionSilhouetteTint(2));
    expect(red).toBeGreaterThan(green);
    expect(red).toBeGreaterThan(blue);
    expect(
      Math.abs(green - blue),
      `the not-yours cue is ${String(Math.abs(green - blue))} off neutral between green and `
      + 'blue — that is a pink or an amber, not the red AoE2 paints player 2',
    ).toBeLessThanOrEqual(Math.round(red * 0.15));
  });

  it('keeps every slot bright, distinct and never white', () => {
    const seen: [number, number, number][] = [];
    for (const slot of Object.keys(PLAYER_HUES).map(Number)) {
      const tint = occlusionSilhouetteTint(slot);
      const channels = rgb(tint);
      expect(Math.max(...channels), `slot ${String(slot)} is too dark to read`)
        .toBeGreaterThan(200);
      expect(Math.min(...channels), `slot ${String(slot)} is washing out toward white`)
        .toBeLessThan(240);
      expect(tint).not.toBe(0xffffff);
      for (const other of seen) {
        expect(
          distance(channels, other),
          `two player slots are only ${String(Math.round(distance(channels, other)))} apart`,
        ).toBeGreaterThan(60);
      }
      seen.push(channels);
    }
  });

  it("survives the background that cancels it: blue cue on an orange roof", () => {
    // The measurement this gate was written from. At half coverage the friendly
    // blue over a sunlit roof rendered (171,126,135) — a grey-mauve nearer the
    // roof than the cue, so one silhouette carried two different colours and
    // neither was reliably the player's.
    const coverage = measuredCoverage(snapshotWithHiddenVillager());
    for (const slot of Object.keys(PLAYER_HUES).map(Number)) {
      const cue = rgb(occlusionSilhouetteTint(slot));
      const composite = cue.map(
        (channel, index) => coverage * channel + (1 - coverage) * SUNLIT_ROOF[index]!,
      ) as [number, number, number];
      expect(
        distance(composite, cue) < distance(composite, SUNLIT_ROOF),
        `slot ${String(slot)} composites to ${String(composite.map(Math.round))} over a sunlit `
        + 'roof, which is nearer the roof than the cue: the player colour is gone',
      ).toBe(true);
    }
  });

  it('names the two slots that cannot clear the building palette', () => {
    // Honesty about the bound rather than a floor nobody can meet. Grey cannot
    // clear stone and plaster because those materials ARE greys; orange cannot
    // clear a lit roof because a lit roof IS orange. Every other slot must stay
    // above the floor `occlusionSilhouetteContrast.test.ts` sets.
    const materials = [
      'plaster', 'plasterLight', 'stone', 'stoneLight', 'stoneDark',
      'timber', 'timberDark', 'roofTile', 'roofTileDark', 'thatch',
      'steel', 'steelDark', 'gold', 'window', 'cloth', 'leather',
    ] as const;
    const nearest = (tint: number): number => Math.min(...materials.map(
      (key) => distance(rgb(tint), rgb(VOXEL_COLORS[key])),
    ));
    for (const slot of [1, 2, 3, 4, 5, 6, 8]) {
      expect(nearest(occlusionSilhouetteTint(slot)), `slot ${String(slot)}`)
        .toBeGreaterThan(90);
    }
    // Slot 7 is allowed to be close to the palette's greys, but only just: this
    // pins the known weakness so it cannot quietly get worse.
    expect(nearest(occlusionSilhouetteTint(7))).toBeGreaterThan(55);
  });
});
