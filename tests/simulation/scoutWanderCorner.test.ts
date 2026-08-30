// A scout that reaches the far edge of its own wander box must keep roaming.
//
// It did not. The box is expressed in GRID cells and enforced in FINE units,
// and the far edge converted as `maxX * UNIT_SUBGRID_RESOLUTION` — which is
// the FIRST fine slot of the last legal cell, not the last. Cell 32 spans fine
// 128..131, so clamping to 128 squeezed the scout on that edge: every outward
// step was flipped by the reflection and snapped back by the clamp. The near
// edge is unaffected, because `minX * RESOLUTION` genuinely is that cell's
// first fine slot — which is why this survived: half of every bound was right.
//
// Found while adding wolves to generated maps. A wolf chase left an AI scout
// at its box corner and it never scouted again. The wolf was incidental — this
// reproduces with no wildlife anywhere on the map.
//
// WHICH CORNER PROVES WHAT, measured on `aoe2-canary`, distinct cells visited
// in 1,200 ticks, before this fix vs after:
//
//   (maxX, maxY)   19 → 57   <- the only case that DETECTS the defect
//   (minX, maxY)   29 → 29   unchanged
//   (minX, minY)   13 → 13   unchanged
//   (maxX, minY)    2 →  2   a SEPARATE, still-open defect
//
// The first version of this file asserted a flat `>= 8` across three corners
// and its defect-register entry claimed it red-checked. Review measured that
// and it was false: all three cleared 8 against the unfixed code, because the
// bar sat below even the broken value. Only the far corner moves, so only the
// far corner gets a discriminating bar; the other two are regression floors
// and are labelled as such rather than dressed up as detection.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

/** Distinct cells the canary map's AI scout visits in 1,200 ticks when it
 *  starts at `corner`. Two full minutes of game time. */
function cellsRoamedFrom(pick: (bounds: Bounds) => { x: number; y: number }): number {
  const bridge = createSimulationBridge('aoe2-canary');
  const world = bridge.world as { getComponent<T>(id: number, name: string): T | null };
  const scout = bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === 2 && unit.unitType === 'scout');
  expect(scout, 'canary map must seat an AI scout').toBeDefined();

  const bounds = world.getComponent<Bounds>(scout!.id, 'wanderBounds')!;
  const corner = pick(bounds);
  const position = world.getComponent<{ x: number; y: number }>(scout!.id, 'position')!;
  const transform = world.getComponent<{ fineX: number; fineY: number }>(
    scout!.id,
    'unitTransform',
  )!;
  position.x = corner.x;
  position.y = corner.y;
  transform.fineX = corner.x * 4;
  transform.fineY = corner.y * 4;

  const visited = new Set<string>();
  for (let tick = 0; tick < 1200; tick += 1) {
    bridge.step(100);
    const now = world.getComponent<{ x: number; y: number }>(scout!.id, 'position');
    if (!now) break;
    visited.add(`${now.x},${now.y}`);
  }
  return visited.size;
}

describe('a scout at the edge of its wander box', () => {
  it('keeps roaming from the far corner, which is where the bound was wrong', () => {
    // 40 sits above the broken 19 and below the fixed 57, so this fails on the
    // old conversion and passes on the new one. It red-checks: reverting the
    // two ceiling expressions in `scoutMovementSystem` drops it to 19.
    const cells = cellsRoamedFrom((bounds) => ({ x: bounds.maxX, y: bounds.maxY }));
    expect(cells, `scout covered only ${cells} cells from the far corner`)
      .toBeGreaterThanOrEqual(40);
  }, 120_000);

  // Floors, NOT detection. These two corners are unmoved by the fix; they are
  // here so a later change to the wander bounds cannot quietly degrade them,
  // and the numbers are the measured ones minus a margin.
  it('does not regress at the two corners this fix does not move', () => {
    expect(cellsRoamedFrom((b) => ({ x: b.minX, y: b.maxY }))).toBeGreaterThanOrEqual(20);
    expect(cellsRoamedFrom((b) => ({ x: b.minX, y: b.minY }))).toBeGreaterThanOrEqual(10);
  }, 240_000);

  // (maxX, minY) is deliberately absent: 2 cells before this change and 2
  // after, so it is a second and independent defect in the same system. It is
  // recorded OPEN in `docs/learning/defect-register.md` with its repro rather
  // than gated here, because the only way to include it would be to drop the
  // bar below every value it could produce — which is what made the first
  // version of this file useless.
});
