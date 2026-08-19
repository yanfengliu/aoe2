import { describe, expect, it } from 'vitest';

import type { ProjectedFrameView, ProjectedProjectileView } from '../../src/game/simulation/types';
import { createProjectileParts } from '../../src/rendering/voxel/aoeVoxelProjectileParts';

function frame(
  projectiles: ProjectedProjectileView[],
  tick = 10,
): ProjectedFrameView {
  return {
    tick,
    playerId: 1,
    seed: 'projectile-parts',
    mapWidth: 32,
    mapHeight: 32,
    visibleCells: [],
    exploredCells: [],
    recentUnitDeaths: [],
    projectiles,
  };
}

function shot(overrides: Partial<ProjectedProjectileView> = {}): ProjectedProjectileView {
  return {
    id: 1,
    originX: 4,
    originY: 4,
    aimX: 12,
    aimY: 4,
    launchTick: 0,
    impactTick: 10,
    visual: 'arrow',
    ...overrides,
  };
}

describe('projectile rendering', () => {
  it('draws nothing when the sky is empty', () => {
    expect(createProjectileParts(frame([]))).toEqual([]);
    expect(createProjectileParts(null)).toEqual([]);
  });

  it('places the shot along its flight path according to the tick', () => {
    // Half way through a 10-tick flight from x=4 to x=12. Positions are
    // cell-centered, matching where units are drawn.
    const [part] = createProjectileParts(frame([shot()], 5));
    expect(part).toBeDefined();
    expect(part!.centerX).toBeCloseTo(8.5, 6);
    expect(part!.centerZ).toBeCloseTo(4.5, 6);
  });

  it('moves the shot forward as ticks advance, and never past its aim point', () => {
    const at = (tick: number) => createProjectileParts(frame([shot()], tick))[0]!.centerX;
    expect(at(0)).toBeCloseTo(4.5, 6);
    expect(at(2)).toBeGreaterThan(at(0));
    expect(at(7)).toBeGreaterThan(at(2));
    expect(at(10)).toBeCloseTo(12.5, 6);
    // A frame past impact clamps to the aim point rather than overshooting.
    expect(at(40)).toBeCloseTo(12.5, 6);
  });

  it('arcs the shot above the ground and brings it back down', () => {
    const height = (tick: number) => createProjectileParts(frame([shot()], tick))[0]!.centerY;
    // Rises through the first half, falls through the second.
    expect(height(5)).toBeGreaterThan(height(0));
    expect(height(5)).toBeGreaterThan(height(10));
    // Never underground.
    for (let tick = 0; tick <= 10; tick += 1) expect(height(tick)).toBeGreaterThan(0);
  });

  it('points the shot along its direction of travel', () => {
    const east = createProjectileParts(frame([shot()], 5))[0]!;
    const north = createProjectileParts(
      frame([shot({ aimX: 4, aimY: -4 })], 5),
    )[0]!;
    expect(east.yaw ?? 0).not.toBeCloseTo(north.yaw ?? 0, 3);
  });

  it('gives each projectile class its own look', () => {
    const kinds: Array<ProjectedProjectileView['visual']> = [
      'arrow', 'bolt', 'stone', 'boulder', 'cannonball',
    ];
    const parts = kinds.map((visual) => createProjectileParts(
      frame([shot({ visual })], 5),
    )[0]!);
    // Siege ordnance reads heavier than an arrow.
    const byKind = new Map(kinds.map((kind, index) => [kind, parts[index]!]));
    expect(byKind.get('boulder')!.width).toBeGreaterThan(byKind.get('arrow')!.width);
    expect(byKind.get('stone')!.width).toBeGreaterThan(byKind.get('arrow')!.width);
    expect(byKind.get('cannonball')!.tint).not.toBe(byKind.get('arrow')!.tint);
    // An arrow is a shaft: longer than it is wide.
    expect(byKind.get('arrow')!.depth).toBeGreaterThan(byKind.get('arrow')!.width);
  });

  it('keys every part uniquely and stably so instancing stays coherent', () => {
    const parts = createProjectileParts(frame([
      shot({ id: 1 }),
      shot({ id: 2, originY: 9, aimY: 9 }),
      shot({ id: 3, originY: 14, aimY: 14 }),
    ], 5));
    expect(parts).toHaveLength(3);
    expect(new Set(parts.map((part) => part.key)).size).toBe(3);
    // Same shot, same frame -> identical key.
    const again = createProjectileParts(frame([shot({ id: 1 })], 5));
    expect(again[0]!.key).toBe(parts[0]!.key);
  });

  it('draws a zero-length flight without producing a degenerate box', () => {
    const parts = createProjectileParts(frame([
      shot({ originX: 5, originY: 5, aimX: 5, aimY: 5, launchTick: 3, impactTick: 3 }),
    ], 3));
    expect(parts).toHaveLength(1);
    expect(parts[0]!.width).toBeGreaterThan(0);
    expect(parts[0]!.height).toBeGreaterThan(0);
    expect(parts[0]!.depth).toBeGreaterThan(0);
    expect(Number.isFinite(parts[0]!.yaw ?? 0)).toBe(true);
  });
});
