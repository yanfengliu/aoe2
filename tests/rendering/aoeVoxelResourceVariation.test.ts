// Resource visual variation (spec §14.5, user directive 2026-07-14): gold
// mines, stone mines, and trees must not read as copies of each other.
// Variants are a PURE function of the resource's map position — stable across
// save/load, replay, and every frame — and stay inside the resource's cell.

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createResourceParts } from '../../src/rendering/voxel/aoeVoxelResourceRecipes';
import { voxelPartMaxY } from '../../src/rendering/voxel/aoeVoxelGeometry';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

function resource(
  entityType: ProjectedEntityView['entityType'],
  x: number,
  y: number,
): ProjectedEntityView {
  return {
    id: 100 + x * 64 + y,
    generation: 0,
    kind: 'resource',
    layer: 'resource',
    entityType,
    owner: null,
    x,
    y,
    elevation: 0,
    tint: entityType === 'tree' ? 0x39703e : 0xc89f39,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
  };
}

function parts(entityType: ProjectedEntityView['entityType'], x: number, y: number): VoxelPart[] {
  const entity = resource(entityType, x, y);
  return createResourceParts(entity, `${String(entity.id)}:0`, 0);
}

// A pose signature that ignores the cell offset, so it compares SHAPE rather
// than position: two resources are "copies" if every part has the same local
// geometry and rotation.
function shapeSignature(entityType: ProjectedEntityView['entityType'], x: number, y: number): string {
  return parts(entityType, x, y)
    .filter((part) => part.surface !== 'shadow')
    .map((part) => [
      part.key.slice(part.key.lastIndexOf(':') + 1),
      (part.centerX - (x + 0.5)).toFixed(4),
      part.centerY.toFixed(4),
      (part.centerZ - (y + 0.5)).toFixed(4),
      part.width.toFixed(4),
      part.height.toFixed(4),
      part.depth.toFixed(4),
      (part.yaw ?? 0).toFixed(4),
      (part.roll ?? 0).toFixed(4),
      part.tint,
    ].join('|'))
    .join(';');
}

const CELLS: readonly (readonly [number, number])[] = [
  [3, 4], [4, 4], [5, 4], [3, 5], [4, 5], [5, 5], [6, 7], [9, 2],
];

// Local (cell-relative) geometry of one part, for measuring how far two
// instances' equivalent parts actually diverge.
function localPart(
  entityType: ProjectedEntityView['entityType'],
  x: number,
  y: number,
  suffix: string,
): { x: number; y: number; z: number; w: number; h: number; d: number; yaw: number } {
  const part = parts(entityType, x, y)
    .find((candidate) => candidate.key.endsWith(`:${suffix}`))!;
  return {
    x: part.centerX - (x + 0.5),
    y: part.centerY,
    z: part.centerZ - (y + 0.5),
    w: part.width,
    h: part.height,
    d: part.depth,
    yaw: part.yaw ?? 0,
  };
}

// A part is "visibly different" between two instances when its local pose or
// size moves by more than ~3 screen px at default zoom (~0.08 world units),
// or it rotates by a readable angle.
function visiblyDiffers(
  entityType: ProjectedEntityView['entityType'],
  suffix: string,
  a: readonly [number, number],
  b: readonly [number, number],
): boolean {
  const left = localPart(entityType, a[0], a[1], suffix);
  const right = localPart(entityType, b[0], b[1], suffix);
  const moved = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
  const resized = Math.hypot(left.w - right.w, left.h - right.h, left.d - right.d);
  return moved > 0.08 || resized > 0.08 || Math.abs(left.yaw - right.yaw) > 0.25;
}

describe('resource visual variation (spec §14.5)', () => {
  it('gives adjacent trees visibly different CANOPIES, not just trunk height', () => {
    // The pre-v0.2.10 recipe jittered only the trunk's height: every tree's
    // crown blocks were byte-identical, which is what made a forest read as
    // stamped copies at default zoom.
    const crowns = ['tree-crown-left', 'tree-crown-right', 'tree-crown-center', 'tree-crown-top'];
    for (const suffix of crowns) {
      const varied = CELLS.slice(1).some((cell) => visiblyDiffers('tree', suffix, CELLS[0]!, cell));
      expect(varied, `every tree's ${suffix} is identical — the canopy must vary`).toBe(true);
    }
  });

  for (const kind of ['gold-mine', 'stone-mine'] as const) {
    it(`gives adjacent ${kind}s visibly different rock LAYOUTS, not just yaw`, () => {
      // The pre-v0.2.10 recipe jittered only each rock's yaw; positions and
      // sizes were identical, so a mine cluster read as one shape repeated.
      for (const suffix of [`${kind}-rock-center`, `${kind}-rock-left`, `${kind}-rock-right`]) {
        const varied = CELLS.slice(1).some((cell) => {
          const left = localPart(kind, CELLS[0]![0], CELLS[0]![1], suffix);
          const right = localPart(kind, cell[0], cell[1], suffix);
          const moved = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
          const resized = Math.hypot(left.w - right.w, left.h - right.h, left.d - right.d);
          return moved > 0.08 || resized > 0.08;
        });
        expect(varied, `every ${kind}'s ${suffix} sits at the same place and size`).toBe(true);
      }
    });
  }

  for (const kind of ['tree', 'gold-mine', 'stone-mine'] as const) {
    it(`gives every ${kind} in a cluster a distinct shape`, () => {
      const signatures = CELLS.map(([x, y]) => shapeSignature(kind, x, y));
      expect(new Set(signatures).size, `${kind} instances read as copies`)
        .toBe(CELLS.length);
    });

    it(`keeps ${kind} variants deterministic across rebuilds`, () => {
      for (const [x, y] of CELLS) {
        expect(shapeSignature(kind, x, y)).toBe(shapeSignature(kind, x, y));
      }
    });

    it(`keeps every ${kind} variant inside its cell and above ground`, () => {
      for (const [x, y] of CELLS) {
        for (const part of parts(kind, x, y)) {
          expect(Math.abs(part.centerX - (x + 0.5)), `${kind} at ${String(x)},${String(y)} escapes its cell`)
            .toBeLessThan(0.85);
          expect(Math.abs(part.centerZ - (y + 0.5))).toBeLessThan(0.85);
          expect(part.centerY + part.height / 2).toBeGreaterThan(-0.01);
        }
      }
    });

    it(`keeps the ${kind} part SET identical (hit silhouette source unchanged)`, () => {
      const suffixes = (x: number, y: number) => parts(kind, x, y)
        .map((part) => part.key.slice(part.key.lastIndexOf(':') + 1))
        .sort();
      expect(suffixes(3, 4)).toEqual(suffixes(9, 2));
    });

    it(`bounds ${kind} height variation so silhouettes stay readable`, () => {
      const tops = CELLS.map(([x, y]) => parts(kind, x, y)
        .filter((part) => part.surface !== 'shadow')
        .reduce((top, part) => Math.max(top, voxelPartMaxY(part)), 0));
      const min = Math.min(...tops);
      const max = Math.max(...tops);
      expect(max / min).toBeLessThan(1.6);
      expect(min).toBeGreaterThan(0.3);
    });
  }
});
