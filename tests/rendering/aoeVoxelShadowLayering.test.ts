// The DEPTH half of sun-cast ground shadows: how a lane of overlapping
// shadows is kept to exactly one translucent layer per pixel. The SHAPE half
// is `aoeVoxelCastShadows.test.ts`.
import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';
import {
  compareShadowDrawOrder,
  resolveShadowLevels,
  SHADOW_LEVEL_STEP,
  SHADOW_LEVELS,
  SHADOW_SLAB_THICKNESS,
  shadowLevel,
} from '../../src/rendering/voxel/aoeVoxelCastShadows';
import { voxelPartWorldCorners } from '../../src/rendering/voxel/aoeVoxelGeometry';
import { matrixForPart, type VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createResourceParts } from '../../src/rendering/voxel/aoeVoxelResourceRecipes';
import { makePartBatches } from '../../src/rendering/voxel/aoeVoxelResources';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

function entity(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 4,
    y: 6,
    elevation: 0,
    tint: 0x3568c0,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}


function tree(x: number, y: number, overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return entity({ kind: 'resource', layer: 'resource', entityType: 'tree', x, y, ...overrides });
}

/** The caster a slab belongs to — the same rule production groups by. */
function ownerOf(part: VoxelPart): string {
  return part.key.slice(0, part.key.lastIndexOf(':'));
}

/** The THREE ground corners of a shadow wedge. Its enclosing parallelogram
 *  has a fourth the triangle does not, so a hull taken from the instance's
 *  own unit cube overstates the shape by half its area again. */
function triangleCorners(part: VoxelPart): { x: number; z: number }[] {
  const m = matrixForPart(part);
  return [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]].map(([lx, lz]) => ({
    x: m[0]! * lx! + m[8]! * lz! + m[12]!,
    z: m[2]! * lx! + m[10]! * lz! + m[14]!,
  }));
}

/** Whether two drawn shadow wedges overlap on the ground, by the separating
 *  axis theorem on their actual triangles.
 *
 *  Not their bounding boxes: a wedge's box is half again its area, and box
 *  overlap reports pairs that never share a pixel — which is a gate that
 *  fails on shadows that are fine. Two triangles are disjoint exactly when
 *  some edge normal of one separates them. */
function trianglesOverlap(a: VoxelPart, b: VoxelPart): boolean {
  const separates = (
    from: readonly { x: number; z: number }[],
    other: readonly { x: number; z: number }[],
  ): boolean => from.some((corner, index) => {
    const next = from[(index + 1) % from.length]!;
    const nx = next.z - corner.z;
    const nz = corner.x - next.x;
    const project = (points: readonly { x: number; z: number }[]) => points
      .map((point) => nx * point.x + nz * point.z);
    const own = project(from);
    const theirs = project(other);
    return Math.min(...theirs) >= Math.max(...own) - 1e-9
      || Math.max(...theirs) <= Math.min(...own) + 1e-9;
  });
  const ta = triangleCorners(a);
  const tb = triangleCorners(b);
  return !separates(ta, tb) && !separates(tb, ta);
}

function shadows(parts: readonly VoxelPart[]): VoxelPart[] {
  return parts.filter((part) => part.surface === 'shadow');
}








describe('cast shadow layering', () => {
  it('gives casters that SHARE a cell different levels', () => {
    // The rule this replaced took the level from the anchor CELL, so units on
    // one tile drew coplanar slabs that z-fight into stripes. Units share
    // cells routinely: an AI-vs-AI run on the boot map had four villagers on
    // one tile at tick 4,500, and 16 same-level overlapping slab pairs.
    const crowd = [7, 8, 9, 10].flatMap((id) => shadows(createUnitParts(
      entity({ id, x: 12.2 + (id - 7) * 0.12, y: 9.3 + (id - 7) * 0.09 }),
      `${String(id)}:0`,
      0,
    )));
    const laneHeights = new Map<string, number>();
    for (const part of resolveShadowLevels(crowd)) {
      laneHeights.set(part.key.slice(0, part.key.lastIndexOf(':')), part.centerY);
    }
    expect(laneHeights.size).toBe(4);
    expect(new Set(laneHeights.values()).size).toBe(4);
    // Four casters need four heights, so this one stays inside the band; the
    // woodline test below is where a crowd is dense enough to leave it.
    for (const height of laneHeights.values()) {
      expect(height).toBeGreaterThanOrEqual(SHADOW_SLAB_THICKNESS / 2 - 1e-12);
      expect(height).toBeLessThan(SHADOW_SLAB_THICKNESS / 2 + SHADOW_LEVELS * SHADOW_LEVEL_STEP);
    }
  });

  it('never lifts a caster nothing overlaps off its cell level', () => {
    // The cell rule stays the colouring; the resolver is only a repair.
    const lonely = shadows(createResourceParts(tree(40, 41), '900:0', 0));
    expect(lonely.length).toBeGreaterThan(0);
    const expected = SHADOW_SLAB_THICKNESS / 2 + shadowLevel(40, 41) * SHADOW_LEVEL_STEP;
    for (const part of resolveShadowLevels(lonely)) {
      expect(part.centerY).toBeCloseTo(expected, 12);
    }
  });

  it('keeps every caster of a dense forest on its own cell level, unlifted', () => {
    // Greedy colouring WITHOUT the cell seed exhausted all nine levels here
    // and dropped casters back onto a neighbour's: a tree's shadow reaches
    // 2.4 tiles, so a 3x3 block of trees is a nine-clique.
    const forest = [];
    for (let x = 0; x < 6; x += 1) {
      for (let z = 0; z < 6; z += 1) {
        forest.push(...shadows(createResourceParts(
          tree(x, z, { id: 300 + x * 6 + z }), `${String(300 + x * 6 + z)}:0`, 0,
        )));
      }
    }
    const before = new Map(forest.map((part) => [part.key, part.centerY]));
    for (const part of resolveShadowLevels(forest)) {
      expect(part.centerY).toBeCloseTo(before.get(part.key)!, 12);
    }
  });

  it('leaves no two casters overlapping at one height in a mixed scene', () => {
    // The class gate. Two slabs of DIFFERENT casters at the same drawn height
    // z-fight: the overlap tears into stripes as the rasteriser picks a winner
    // per pixel, which is what forcing SHADOW_LEVEL_STEP to 0 produces across
    // a whole frame. Measured on a 12,000-tick AI-vs-AI run of the boot map
    // before this pass existed: up to 13 such pairs at once, every one of them
    // villagers sharing a tile. Resolved: 0.
    const scene: VoxelPart[] = [];
    scene.push(...shadows(createBuildingParts(entity({
      kind: 'building', layer: 'building', entityType: 'town-center',
      visualVariant: 'complete', x: 6, y: 6, footprintWidth: 4, footprintHeight: 4,
    }), '500:0', 0)));
    for (let x = 0; x < 5; x += 1) {
      for (let z = 0; z < 5; z += 1) {
        scene.push(...shadows(createResourceParts(
          tree(x, z, { id: 600 + x * 5 + z }), `${String(600 + x * 5 + z)}:0`, 0,
        )));
      }
    }
    // A crowd on ONE tile beside the Town Center, plus its neighbours.
    for (let index = 0; index < 6; index += 1) {
      scene.push(...shadows(createUnitParts(entity({
        id: 700 + index,
        x: 5.2 + (index % 3) * 0.2,
        y: 10.15 + Math.floor(index / 3) * 0.25,
      }), `${String(700 + index)}:0`, 0)));
    }
    const lane = resolveShadowLevels(scene);
    expect(lane).toHaveLength(scene.length);
    let overlapping = 0;
    for (let i = 0; i < lane.length; i += 1) {
      for (let j = i + 1; j < lane.length; j += 1) {
        const a = lane[i]!; const b = lane[j]!;
        if (ownerOf(a) === ownerOf(b)) continue;
        if (!trianglesOverlap(a, b)) continue;
        overlapping += 1;
        expect(
          Math.abs(a.centerY - b.centerY),
          `${a.key} and ${b.key} would z-fight at height ${String(a.centerY)}`,
        ).toBeGreaterThanOrEqual(SHADOW_LEVEL_STEP - 1e-9);
      }
    }
    // The scene has to actually exercise the rule.
    expect(overlapping).toBeGreaterThan(60);
  });

  it('keeps a woodline full of gathering villagers off one height', () => {
    // An independent review broke the first version of the resolver here. It
    // searched only nine levels and then fell back on the EMITTED height —
    // which is taken by construction, since the search only starts when it is
    // — so a dense cluster reproduced the z-fighting the pass exists to
    // prevent: 34 coincident overlapping slab pairs across 7 casters on this
    // scene. The search is unbounded now and steps above the band instead.
    const scene: VoxelPart[] = [];
    for (let x = 0; x < 6; x += 1) {
      for (let z = 0; z < 6; z += 1) {
        scene.push(...shadows(createResourceParts(
          tree(x, z, { id: 800 + x * 6 + z }), `${String(800 + x * 6 + z)}:0`, 0,
        )));
      }
    }
    for (let index = 0; index < 12; index += 1) {
      scene.push(...shadows(createUnitParts(entity({
        id: 900 + index,
        x: 2 + (index % 4) * 0.3,
        y: 2 + Math.floor(index / 4) * 0.3,
      }), `${String(900 + index)}:0`, 0)));
    }
    // A pad-bearing caster in the same scene, because its second layer sits
    // tens of level-steps up and an earlier version of the bar below counted
    // that as lift.
    scene.push(...shadows(createBuildingParts(entity({
      id: 950, kind: 'building', layer: 'building', entityType: 'house',
      visualVariant: 'complete', footprintWidth: 2, footprintHeight: 2, x: 3, y: 3,
    }), '950:0', 0)));
    const lane = resolveShadowLevels(scene);
    expect(lane).toHaveLength(scene.length);
    let overlapping = 0;
    for (let i = 0; i < lane.length; i += 1) {
      for (let j = i + 1; j < lane.length; j += 1) {
        const a = lane[i]!; const b = lane[j]!;
        if (ownerOf(a) === ownerOf(b)) continue;
        if (!trianglesOverlap(a, b)) continue;
        overlapping += 1;
        expect(
          Math.abs(a.centerY - b.centerY),
          `${a.key} and ${b.key} would z-fight at height ${String(a.centerY)}`,
        ).toBeGreaterThanOrEqual(SHADOW_LEVEL_STEP - 1e-9);
      }
    }
    expect(overlapping).toBeGreaterThan(200);
    // A lift ABOVE the nine-level band is allowed here and is the price of not
    // tearing: a clique of K mutually overlapping casters needs K distinct
    // heights, and 12 villagers packed at 0.3 tiles inside a woodline is a
    // clique of about twenty. What is bounded is the SCREEN cost. This scene
    // measures 0.058 — 0.040 of lift, which at the closest camera zoom (2.4,
    // about 94 px per world unit vertically) is under four pixels of offset
    // between the highest shadow and the ground. The bar is set just above the
    // measurement so a scheme that starts stacking levels fails here.
    // LIFT, not absolute height. A caster that stands on a pad draws a second
    // layer at the pad's own top, which is tens of level-steps up and has
    // nothing to do with how far the resolver pushed anything: a review showed
    // that adding one pad-bearing caster to this scene takes the absolute
    // maximum from 0.058 to 0.2913 and fails this bar for the wrong reason.
    // What is bounded here is how far the LOWEST piece of a caster was pushed
    // above the level its own cell seeded.
    const byOwner = new Map<string, number>();
    for (const part of lane) {
      const owner = ownerOf(part);
      byOwner.set(owner, Math.min(byOwner.get(owner) ?? Infinity, part.centerY));
    }
    const highest = Math.max(...byOwner.values());
    expect(highest).toBeLessThan(SHADOW_SLAB_THICKNESS / 2 + 22 * SHADOW_LEVEL_STEP);
  });

  it('draws overlapping shadows of a forest top-down so no pixel blends twice', () => {
    const forest: VoxelPart[] = [];
    for (let x = 0; x < 6; x += 1) {
      for (let z = 0; z < 6; z += 1) {
        forest.push(...createResourceParts(tree(x, z, { id: 100 + x * 6 + z }), `${String(100 + x * 6 + z)}:0`, 0));
      }
    }
    const slabs = resolveShadowLevels(shadows(forest));
    expect(slabs).toHaveLength(shadows(forest).length);
    expect(slabs.length).toBeGreaterThan(36 * 3);
    let overlappingPairs = 0;
    for (const a of slabs) {
      for (const b of slabs) {
        if (ownerOf(a) === ownerOf(b) || a.key >= b.key) continue;
        if (!trianglesOverlap(a, b)) continue;
        overlappingPairs += 1;
        expect(Math.abs(a.centerY - b.centerY)).toBeGreaterThanOrEqual(SHADOW_LEVEL_STEP - 1e-9);
      }
    }
    expect(overlappingPairs).toBeGreaterThan(50);

    // The batcher must present exactly this resolved lane, not the raw parts.
    const byKey = new Map(slabs.map((part) => [part.key, part]));
    const batch = makePartBatches(forest, 1).find((candidate) => candidate.key === 'aoe2:batch:shadow-parts')!;
    expect(batch.instanceKeys).toHaveLength(slabs.length);
    for (let index = 1; index < batch.instanceKeys.length; index += 1) {
      const previous = byKey.get(batch.instanceKeys[index - 1]!)!;
      const current = byKey.get(batch.instanceKeys[index]!)!;
      expect(compareShadowDrawOrder(previous, current)).toBeLessThanOrEqual(0);
      expect(previous.centerY).toBeGreaterThanOrEqual(current.centerY);
    }
    // The matrices are the parts' own, in that order.
    const first = byKey.get(batch.instanceKeys[0]!)!;
    expect([...batch.matrices.slice(0, 16)]).toEqual([...matrixForPart(first)].map((v) => Math.fround(v)));
  });
});
describe('ground parallelogram parts', () => {
  it('place their corners on the sheared edge vectors', () => {
    const part: VoxelPart = {
      key: 'x:slab',
      surface: 'shadow',
      tint: 0x172019,
      centerX: 10,
      centerY: 0.018,
      centerZ: 20,
      width: Math.hypot(1, 0.5),
      height: 0.036,
      depth: 2,
      groundAxes: { x: { x: 1, z: 0.5 }, z: { x: 0, z: 2 } },
    };
    const corners = voxelPartWorldCorners(part).map((c) => [
      Number(c.x.toFixed(6)), Number(c.y.toFixed(6)), Number(c.z.toFixed(6)),
    ].join(','));
    const expected: string[] = [];
    for (const sx of [-0.5, 0.5]) {
      for (const sy of [-0.5, 0.5]) {
        for (const sz of [-0.5, 0.5]) {
          expected.push([
            Number((10 + sx * 1 + sz * 0).toFixed(6)),
            Number((0.018 + sy * 0.036).toFixed(6)),
            Number((20 + sx * 0.5 + sz * 2).toFixed(6)),
          ].join(','));
        }
      }
    }
    expect(new Set(corners)).toEqual(new Set(expected));
  });
});

