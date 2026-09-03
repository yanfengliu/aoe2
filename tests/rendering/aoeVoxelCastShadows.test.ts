// Sun-cast ground shadows (v0.3.193): the contract of what a caster throws
// on the ground, where, and how overlapping shadows are kept to one layer.
import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';
import {
  castShadowParts,
  compareShadowDrawOrder,
  resolveShadowLevels,
  SHADOW_LEVEL_STEP,
  SHADOW_LEVELS,
  SHADOW_SLAB_THICKNESS,
  shadowCasterBox,
  shadowLevel,
} from '../../src/rendering/voxel/aoeVoxelCastShadows';
import {
  AOE_DAYLIGHT,
  SHADOW_PROJECTION,
  shadowProjectionFor,
} from '../../src/rendering/voxel/aoeVoxelDaylight';
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

function house(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return entity({
    kind: 'building',
    layer: 'building',
    entityType: 'house',
    visualVariant: 'complete',
    ...overrides,
  });
}

function tree(x: number, y: number, overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return entity({ kind: 'resource', layer: 'resource', entityType: 'tree', x, y, ...overrides });
}

/** The caster a slab belongs to — the same rule production groups by. */
function ownerOf(part: VoxelPart): string {
  return part.key.slice(0, part.key.lastIndexOf(':'));
}

function groundFootprint(part: VoxelPart) {
  const corners = voxelPartWorldCorners(part);
  return {
    x0: Math.min(...corners.map((c) => c.x)), x1: Math.max(...corners.map((c) => c.x)),
    z0: Math.min(...corners.map((c) => c.z)), z1: Math.max(...corners.map((c) => c.z)),
  };
}

function shadows(parts: readonly VoxelPart[]): VoxelPart[] {
  return parts.filter((part) => part.surface === 'shadow');
}

function solids(parts: readonly VoxelPart[]): VoxelPart[] {
  return parts.filter((part) => part.surface !== 'shadow');
}

/** Whether the slab's ground footprint contains the point (its horizontal
 *  axes may be sheared, so solve for the local coordinates). */
function coversGround(part: VoxelPart, px: number, pz: number): boolean {
  const m = matrixForPart(part);
  const ax = m[0]!; const az = m[2]!;
  const bx = m[8]!; const bz = m[10]!;
  const det = ax * bz - bx * az;
  const dx = px - m[12]!; const dz = pz - m[14]!;
  const a = (dx * bz - bx * dz) / det;
  const c = (ax * dz - az * dx) / det;
  return Math.abs(a) <= 0.5 && Math.abs(c) <= 0.5;
}

function coverage(parts: readonly VoxelPart[], px: number, pz: number): number {
  return shadows(parts).filter((part) => coversGround(part, px, pz)).length;
}

/** The exact swept-box shadow predicate, with the box grown (`margin` > 0)
 *  or shrunk (`margin` < 0) so edge samples are not disputed. */
function inSweptShadow(
  box: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number },
  px: number,
  pz: number,
  margin: number,
): boolean {
  const v = SHADOW_PROJECTION;
  const steps = 400;
  const lo = box.y0 - margin;
  const hi = box.y1 + margin;
  for (let i = 0; i <= steps; i += 1) {
    const t = lo + (hi - lo) * (i / steps);
    const x = px - v.x * t;
    const z = pz - v.z * t;
    if (
      x >= box.x0 - margin && x <= box.x1 + margin
      && z >= box.z0 - margin && z <= box.z1 + margin
    ) return true;
  }
  return false;
}

describe('cast shadow projection', () => {
  it('falls away from the sun the renderer hands to the voxel daylight rig', () => {
    expect(AOE_DAYLIGHT.sunOffset).toEqual({ x: -22, y: 36, z: -18 });
    expect(SHADOW_PROJECTION.x).toBeCloseTo(22 / 36, 10);
    expect(SHADOW_PROJECTION.z).toBeCloseTo(18 / 36, 10);
    expect(shadowProjectionFor({ x: 10, y: 20, z: -5 })).toEqual({ x: -0.5, z: 0.25 });
  });

  it('refuses a sun at or below the ground, naming the offending height', () => {
    expect(() => shadowProjectionFor({ x: 1, y: 0, z: 1 })).toThrow(/sunOffset\.y.*got 0/);
    expect(() => shadowProjectionFor({ x: 1, y: -3, z: 1 })).toThrow(/sunOffset\.y.*got -3/);
  });
});

describe('cast shadow shape', () => {
  it('tiles the swept footprint of a house with three non-overlapping slabs', () => {
    const parts = createBuildingParts(house(), '60:1', 0);
    const slabs = shadows(parts);
    expect(slabs.map((part) => part.key.split(':').at(-1))).toEqual([
      'building-shadow', 'building-shadow-sweep-x', 'building-shadow-sweep-z',
    ]);
    for (const slab of slabs) {
      expect(slab.height).toBeCloseTo(SHADOW_SLAB_THICKNESS, 10);
      // As EMITTED, before the lane is resolved: the recipe's own cell level,
      // which is always one of the nine. `resolveShadowLevels` may lift it
      // past the band later, and does in a dense crowd.
      expect(slab.centerY).toBeGreaterThanOrEqual(SHADOW_SLAB_THICKNESS / 2);
      expect(slab.centerY).toBeLessThan(SHADOW_SLAB_THICKNESS / 2 + SHADOW_LEVELS * SHADOW_LEVEL_STEP);
    }
    const box = shadowCasterBox(solids(parts))!;
    expect(box.y0).toBeCloseTo(0, 6);
    expect(box.y1).toBeGreaterThan(0.8);
    let inside = 0;
    for (let px = 3; px <= 7; px += 0.04) {
      for (let pz = 5; pz <= 9; pz += 0.04) {
        const count = coverage(parts, px, pz);
        expect(count, `double shadow at ${String(px)},${String(pz)}`).toBeLessThanOrEqual(1);
        if (inSweptShadow(box, px, pz, -0.03)) {
          expect(count, `hole at ${String(px)},${String(pz)}`).toBe(1);
          inside += 1;
        } else if (!inSweptShadow(box, px, pz, 0.03)) {
          expect(count, `stray shadow at ${String(px)},${String(pz)}`).toBe(0);
        }
      }
    }
    expect(inside).toBeGreaterThan(200);
    // The sweep reaches beyond the footprint toward +x,+z only.
    expect(coverage(parts, box.x1 + 0.3, box.z1 + 0.25)).toBe(1);
    expect(coverage(parts, box.x0 - 0.1, box.z0 - 0.1)).toBe(0);
  });

  it('casts from the mass of a Town Center, not its tower or flag pole', () => {
    const parts = createBuildingParts(entity({
      kind: 'building',
      layer: 'building',
      entityType: 'town-center',
      visualVariant: 'complete',
      footprintWidth: 4,
      footprintHeight: 4,
    }), '61:1', 0);
    const box = shadowCasterBox(solids(parts))!;
    const flagTop = Math.max(...solids(parts).map((part) => part.centerY + part.height / 2));
    expect(flagTop).toBeGreaterThan(3);
    expect(box.y1).toBeGreaterThan(1.5);
    expect(box.y1).toBeLessThan(2.2);
    expect(box.x1 - box.x0).toBeGreaterThan(3);
  });

  it('casts a tree from its crown, wider than the trunk and above it', () => {
    const parts = createResourceParts(tree(4, 6), '8:2', 0);
    const box = shadowCasterBox(solids(parts))!;
    expect(box.x1 - box.x0).toBeGreaterThan(0.6);
    expect(box.z1 - box.z0).toBeGreaterThan(0.6);
    expect(box.y1).toBeGreaterThan(1.4);
    // The leaning trunk's rotated corner dips a hair under the ground.
    expect(Math.abs(box.y0)).toBeLessThan(0.05);
    expect(shadows(parts)).toHaveLength(3);
  });

  it('gives units a shadow from the rest pose, and a flat slab when no recipe exists', () => {
    const villager = createUnitParts(entity({ entityType: 'villager' }), '7:4', 0);
    expect(shadows(villager)).toHaveLength(3);
    const box = shadowCasterBox(solids(villager))!;
    expect(box.y1).toBeGreaterThan(0.5);
    const unknown = createUnitParts(entity({ entityType: 'mystery' as UnitType }), '7:5', 0);
    expect(unknown).toHaveLength(1);
    expect(unknown[0]!.surface).toBe('shadow');
    expect(unknown[0]!.key).toBe('7:5:unit-shadow');
  });

  it('sweeps only the mass ABOVE the ground, so a carcass does not overshoot', () => {
    // `fellWildlifeParts` rotates the body about its root, so a felled
    // animal's caster box dips below the ground plane — a boar's by 0.317.
    // Sweeping that depth added a quarter tile of shadow to every dead
    // animal on the map.
    // Live entities whose lowest part dips under the ground are the same rule:
    // a gold or stone mine's lowest facet sits below zero, and before the
    // clamp its shadow ran 0.037 world units long — 5.8 px at the closest
    // camera zoom, more than a carcass's error.
    const cases = [
      { kind: 'boar', alive: false }, { kind: 'deer', alive: false },
      { kind: 'sheep', alive: false }, { kind: 'wolf', alive: false },
      { kind: 'gold-mine', alive: true }, { kind: 'stone-mine', alive: true },
      { kind: 'fish', alive: true },
    ] as const;
    for (const { kind, alive } of cases) {
      const carcass = entity({
        kind: 'resource', layer: 'resource', entityType: kind,
        x: 5, y: 5, ...(alive ? {} : { wildlifeAlive: false }),
      });
      const parts = createResourceParts(carcass, `${kind}:0`, 0);
      const box = shadowCasterBox(solids(parts))!;
      expect(box.y0, `${kind} should have mass below the ground plane`).toBeLessThan(0);
      const reach = Math.max(...shadows(parts).flatMap(
        (part) => voxelPartWorldCorners(part).map((corner) => corner.x),
      )) - box.x1;
      // Only the above-ground height is swept.
      expect(reach).toBeCloseTo(Math.max(0, box.y1) * SHADOW_PROJECTION.x, 6);
    }
  });

  it('casts nothing for memory entities', () => {
    expect(shadows(createBuildingParts(house({ isMemory: true }), '60:m', 0))).toEqual([]);
    expect(shadows(createResourceParts(tree(4, 6, { isMemory: true }), '8:m', 0))).toEqual([]);
    expect(shadows(createUnitParts(entity({ isMemory: true }), '7:m', 0))).toEqual([]);
    expect(castShadowParts(house({ isMemory: true }), 'x', 'shadow', 0, [])).toEqual([]);
  });
});

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
        const fa = groundFootprint(a); const fb = groundFootprint(b);
        if (!(fa.x0 < fb.x1 && fb.x0 < fa.x1 && fa.z0 < fb.z1 && fb.z0 < fa.z1)) continue;
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
    const lane = resolveShadowLevels(scene);
    expect(lane).toHaveLength(scene.length);
    let overlapping = 0;
    for (let i = 0; i < lane.length; i += 1) {
      for (let j = i + 1; j < lane.length; j += 1) {
        const a = lane[i]!; const b = lane[j]!;
        if (ownerOf(a) === ownerOf(b)) continue;
        const fa = groundFootprint(a); const fb = groundFootprint(b);
        if (!(fa.x0 < fb.x1 && fb.x0 < fa.x1 && fa.z0 < fb.z1 && fb.z0 < fa.z1)) continue;
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
    const highest = Math.max(...lane.map((part) => part.centerY));
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
    expect(slabs).toHaveLength(36 * 3);
    const footprint = (part: VoxelPart) => {
      const corners = voxelPartWorldCorners(part);
      return {
        x0: Math.min(...corners.map((c) => c.x)), x1: Math.max(...corners.map((c) => c.x)),
        z0: Math.min(...corners.map((c) => c.z)), z1: Math.max(...corners.map((c) => c.z)),
      };
    };
    let overlappingPairs = 0;
    for (const a of slabs) {
      const fa = footprint(a);
      for (const b of slabs) {
        if (ownerOf(a) === ownerOf(b) || a.key >= b.key) continue;
        const fb = footprint(b);
        const overlaps = fa.x0 < fb.x1 && fb.x0 < fa.x1 && fa.z0 < fb.z1 && fb.z0 < fa.z1;
        if (!overlaps) continue;
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
