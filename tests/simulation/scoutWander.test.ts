import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  applyWanderKick,
  headingEscapes,
  pickEscapeHeading,
} from '../../src/game/simulation/bridge/systems/scoutMovementSystem';
import { UNIT_SUBGRID_STEP_PER_TICK } from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitTransformComponent } from '../../src/game/simulation/types';

// Scout wander behavior (2026-07-09 canary-drill fix,
// docs/debugging/2026-07-09-pinned-units-oracle.md). Both AI scouts sat
// pinned for a full 3000-tick match: the base scout wedged against its own
// TC footprint (obstacle never deflected velocity) and the forward scout
// spawned without wander components. AI-driven scouts must roam; scouts of
// owners without an AI state (a real or inert human) must not self-move.

const TICK_MS = 100;

interface ScoutTrack {
  id: number;
  spawn: { x: number; y: number };
  maxDisplacement: number;
}

function trackScouts(
  bridge: ReturnType<typeof createSimulationBridge>,
  owner: number,
  ticks: number,
): ScoutTrack[] {
  const scouts = bridge.getEconomyState().units
    .filter((unit) => unit.owner === owner && unit.unitType === 'scout')
    .map((unit) => ({
      id: unit.id,
      spawn: { x: unit.x, y: unit.y },
      maxDisplacement: 0,
    }));
  for (let i = 0; i < ticks; i++) {
    bridge.step(TICK_MS);
    if (i % 25 !== 0) continue;
    const units = bridge.getEconomyState().units;
    for (const track of scouts) {
      const now = units.find((unit) => unit.id === track.id);
      if (!now) continue;
      const displacement = Math.abs(now.x - track.spawn.x) + Math.abs(now.y - track.spawn.y);
      track.maxDisplacement = Math.max(track.maxDisplacement, displacement);
    }
  }
  return scouts;
}

describe('scout wander', () => {
  it('keeps blocked autonomous fine transforms within one normal step', () => {
    const bridge = createSimulationBridge('aoe2-canary');
    const scoutIds = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 2 && unit.unitType === 'scout')
      .map((unit) => unit.id);
    const previous = new Map(scoutIds.map((id) => {
      const transform = bridge.world.getComponent<UnitTransformComponent>(id, 'unitTransform')!;
      return [id, { fineX: transform.fineX, fineY: transform.fineY }] as const;
    }));

    expect(scoutIds.length).toBeGreaterThanOrEqual(2);
    for (let tick = 0; tick < 10; tick += 1) {
      bridge.step(TICK_MS);
      for (const id of scoutIds) {
        const prior = previous.get(id)!;
        const current = bridge.world.getComponent<UnitTransformComponent>(id, 'unitTransform')!;
        expect(Math.abs(current.fineX - prior.fineX), `scout ${id} x jump at tick ${tick}`)
          .toBeLessThanOrEqual(UNIT_SUBGRID_STEP_PER_TICK);
        expect(Math.abs(current.fineY - prior.fineY), `scout ${id} y jump at tick ${tick}`)
          .toBeLessThanOrEqual(UNIT_SUBGRID_STEP_PER_TICK);
        previous.set(id, { fineX: current.fineX, fineY: current.fineY });
      }
    }
  });

  it('both AI scouts roam instead of pinning at spawn (canary seed)', () => {
    const bridge = createSimulationBridge('aoe2-canary');
    const scouts = trackScouts(bridge, 2, 800);
    expect(scouts.length).toBeGreaterThanOrEqual(2);
    for (const scout of scouts) {
      // Escapes the pinned-oracle confinement box (radius 3) by a margin:
      // real roaming, not a one-cell wobble against the TC.
      expect(scout.maxDisplacement, `scout ${scout.id} pinned near spawn`).toBeGreaterThanOrEqual(5);
    }
  }, 120_000);

  it('a human-owned scout does not roam on its own', () => {
    const bridge = createSimulationBridge('aoe2-canary');
    const scouts = trackScouts(bridge, 1, 200);
    expect(scouts.length).toBeGreaterThanOrEqual(1);
    for (const scout of scouts) {
      expect(scout.maxDisplacement).toBe(0);
    }
  });

  it('the human-slot scout roams when the slot is AI-driven (all-ai runs)', () => {
    const bridge = createSimulationBridge('aoe2-canary', { forceAiForOwners: new Set([1]) });
    const scouts = trackScouts(bridge, 1, 800);
    expect(scouts.length).toBeGreaterThanOrEqual(1);
    for (const scout of scouts) {
      expect(scout.maxDisplacement, `scout ${scout.id} pinned near spawn`).toBeGreaterThanOrEqual(5);
    }
  }, 120_000);

  it('no AI scout freezes or two-cell-livelocks mid-match (livelock regression)', () => {
    // Prove-rerun residue: scout 2257 escaped spawn but hit a two-state
    // livelock at its wander-box west edge beside the forward house — the
    // bounds reflection flipped every 90° escape rotation straight back
    // into the blocked heading, freezing it from tick 498 to match end
    // (docs/debugging/2026-07-09-pinned-units-oracle.md). Positions are read
    // EVERY tick (a sampled streak check aliases away period-2 cell
    // alternation — review probe), and each 600-tick block must visit >= 3
    // distinct cells: 1 distinct = frozen, 2 = the A<->B ping-pong livelock
    // pickEscapeHeading could produce by design (it only guarantees reaching
    // one different passable cell), 3+ = real roaming.
    const bridge = createSimulationBridge('aoe2-canary');
    const scoutIds = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 2 && unit.unitType === 'scout')
      .map((unit) => unit.id);
    expect(scoutIds.length).toBeGreaterThanOrEqual(2);
    const BLOCK_TICKS = 600;
    const blocks = new Map<number, Set<string>[]>(scoutIds.map((id) => [id, []]));
    const previous = new Map(scoutIds.map((id) => {
      const transform = bridge.world.getComponent<UnitTransformComponent>(id, 'unitTransform')!;
      return [id, { fineX: transform.fineX, fineY: transform.fineY }] as const;
    }));
    for (let i = 0; i < 2000; i++) {
      bridge.step(TICK_MS);
      const blockIndex = Math.floor(i / BLOCK_TICKS);
      for (const id of scoutIds) {
        const prior = previous.get(id)!;
        const transform = bridge.world.getComponent<UnitTransformComponent>(id, 'unitTransform')!;
        expect(Math.abs(transform.fineX - prior.fineX), `scout ${id} x jump at tick ${i}`)
          .toBeLessThanOrEqual(UNIT_SUBGRID_STEP_PER_TICK);
        expect(Math.abs(transform.fineY - prior.fineY), `scout ${id} y jump at tick ${i}`)
          .toBeLessThanOrEqual(UNIT_SUBGRID_STEP_PER_TICK);
        previous.set(id, { fineX: transform.fineX, fineY: transform.fineY });
        const pos = (bridge.world as { getComponent<T>(id: number, name: string): T | null })
          .getComponent<{ x: number; y: number }>(id, 'position');
        if (!pos) continue;
        const perScout = blocks.get(id)!;
        (perScout[blockIndex] ??= new Set()).add(`${pos.x},${pos.y}`);
      }
    }
    for (const [id, perScout] of blocks) {
      // The trailing partial block (2000 % 600) is held to the same bar: 400
      // ticks is still far beyond any legitimate jam at wander speed.
      for (let b = 0; b < perScout.length; b++) {
        const distinct = perScout[b]?.size ?? 0;
        expect(
          distinct,
          `scout ${id} visited only ${distinct} distinct cell(s) in block ${b}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  }, 240_000);

  it('a scout stranded outside its wander box walks back stepwise, never teleporting', () => {
    // Auto-aggression chases can end far outside the box; the wander resume
    // used to clamp the transform straight back to the box edge — a
    // multi-cell single-tick teleport (review finding). The scout must walk
    // home at normal speed (<= 1 cell per axis per tick) and re-enter its
    // box. Uses the BASE scout (easternmost box) and the y=18 approach row,
    // clear grass on the recorded canary map (the forward scout's western
    // approach crosses terrain walls a bounded-patrol return does not
    // navigate around by contract).
    const bridge = createSimulationBridge('aoe2-canary');
    const world = bridge.world as {
      getComponent<T>(id: number, name: string): T | null;
    };
    const scouts = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 2 && unit.unitType === 'scout')
      .map((unit) => ({
        id: unit.id,
        bounds: world.getComponent<{ minX: number; maxX: number; minY: number; maxY: number }>(
          unit.id,
          'wanderBounds',
        )!,
      }));
    expect(scouts.length).toBeGreaterThanOrEqual(2);
    const base = scouts.reduce((a, b) => (a.bounds.maxX >= b.bounds.maxX ? a : b));
    const bounds = base.bounds;
    const strandX = bounds.minX - 5;
    const strandY = 18;
    const pos = world.getComponent<{ x: number; y: number }>(base.id, 'position')!;
    pos.x = strandX;
    pos.y = strandY;
    const transform = world.getComponent<{ fineX: number; fineY: number }>(base.id, 'unitTransform')!;
    transform.fineX = strandX * 4;
    transform.fineY = strandY * 4;

    let prev = { x: strandX, y: strandY };
    let reentered = false;
    for (let i = 0; i < 400 && !reentered; i++) {
      bridge.step(TICK_MS);
      const now = world.getComponent<{ x: number; y: number }>(base.id, 'position')!;
      const jump = Math.max(Math.abs(now.x - prev.x), Math.abs(now.y - prev.y));
      expect(jump, `tick ${i}: scout teleported ${jump} cells`).toBeLessThanOrEqual(1);
      prev = { x: now.x, y: now.y };
      reentered = now.x >= bounds.minX && now.x <= bounds.maxX
        && now.y >= bounds.minY && now.y <= bounds.maxY;
    }
    expect(reentered, 'scout never walked back into its wander box').toBe(true);
  }, 120_000);
});

describe('wander patrol kick (pure)', () => {
  // Deterministic bounce + a fixed escape order can settle into a closed
  // orbit inside a blocker pocket: prove-rerun 3 caught the forward scout
  // circling within 5 cells of (46,17) for 2963 ticks with 1185 moves — the
  // south exit was open the whole time. The periodic kick breaks limit
  // cycles while staying fully deterministic (replay-safe).
  it('kicks on the unit-staggered cadence and leaves other ticks alone', () => {
    const vel = { dx: 1, dy: 1 };
    expect(applyWanderKick(vel, 400 - 7, 7)).toBe(true);
    expect(applyWanderKick(vel, 400 - 7 + 1, 7)).toBe(false);
    expect(applyWanderKick(vel, 400 - 7 + 399, 7)).toBe(false);
    expect(applyWanderKick(vel, 800 - 7, 7)).toBe(true);
  });

  it('cycles the kick angle 90/180/270 so no orbit survives all three', () => {
    const headings: Array<{ dx: number; dy: number }> = [];
    for (let k = 1; k <= 3; k++) {
      const vel = { dx: 1, dy: 1 };
      applyWanderKick(vel, k * 400 - 7, 7);
      headings.push({ ...vel });
    }
    // From (1,1): 90° CW -> (-1,1); 180° -> (-1,-1); 270° -> (1,-1).
    expect(headings).toEqual([
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
    ]);
  });

  it('is deterministic for identical inputs', () => {
    const a = { dx: -1, dy: 1 };
    const b = { dx: -1, dy: 1 };
    expect(applyWanderKick(a, 1193, 7)).toBe(applyWanderKick(b, 1193, 7));
    expect(a).toEqual(b);
  });
});

describe('escape-heading selection (pure)', () => {
  // The exact recorded trap from the prove rerun: scout 2257 in cell
  // (38,18) at fine (153,72), wander box x 38..58 / y 16..32 (fine west
  // edge 152), own forward house footprint at (39..40, 18..19). Grass
  // everywhere else nearby. The only way out is the phase-dependent
  // "staircase" north — cross y into (38,17) first, then x into (39,17).
  const house = new Set(['39,18', '40,18', '39,19', '40,19']);
  const isPassable = (x: number, y: number) => !house.has(`${x},${y}`);
  const probe = {
    fineX: 153,
    fineY: 72,
    position: { x: 38, y: 18 },
    bounds: { minX: 38, maxX: 58, minY: 16, maxY: 32 },
  };

  it('rejects the heading the bounds reflection would flip back into the wall', () => {
    // (-1,1) reflects off the west edge into (1,1), which lands on the
    // house at (39,19) — assigning it recreates the two-state livelock.
    expect(headingEscapes(probe, { dx: -1, dy: 1 }, isPassable)).toBe(false);
  });

  it('rejects the heading that lands on the house', () => {
    expect(headingEscapes(probe, { dx: 1, dy: 1 }, isPassable)).toBe(false);
  });

  it('accepts the staircase escape past the blocked corner', () => {
    // (1,-1) from fine (153,72) crosses y first: (38,17) grass, then
    // (39,17) grass — it never touches the house cell even though the
    // naive no-corner-cut rule would reject it.
    expect(headingEscapes(probe, { dx: 1, dy: -1 }, isPassable)).toBe(true);
  });

  it('accepts the reflected staircase and picks it deterministically', () => {
    // (-1,-1) reflects off the west edge into (1,-1) — same escape. With
    // current velocity (1,1) the CW-rotation try order is (-1,1) → cancelled,
    // (-1,-1) → viable, so the picked heading is exactly (-1,-1).
    expect(headingEscapes(probe, { dx: -1, dy: -1 }, isPassable)).toBe(true);
    const picked = pickEscapeHeading(probe, { dx: 1, dy: 1 }, isPassable);
    expect(picked).toEqual({ dx: -1, dy: -1 });
  });

  it('returns null when the scout is genuinely boxed in', () => {
    const boxed = (x: number, y: number) => x === 38 && y === 18;
    expect(pickEscapeHeading(probe, { dx: 1, dy: 1 }, boxed)).toBeNull();
  });
});
