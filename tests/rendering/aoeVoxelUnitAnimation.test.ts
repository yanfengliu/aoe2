// Locomotion SAMPLING: what `resolveUnitAnimationState` reads off a displayed
// entity over time — gait phase, body direction, speed, locomotion weight, and
// the identity phase that seeds them.
//
// On 2026-09-05 this file sat at exactly the 500-line hard cap enforced by
// `tests/architecture/fileSizeBudget.test.ts`, so it was split by role. The
// cases that assert what layers ON TOP of baked locomotion — the ambient
// mechanisms and the attack/strike blend — moved verbatim to
// `aoeVoxelUnitAnimationChannels.test.ts`; the shared builders moved to
// `./helpers/voxelUnitAnimationFixtures`. Pure structural split, no assertion
// changed.

import { describe, expect, it } from 'vitest';

import {
  animateUnitParts,
  phaseForUnitIdentity,
  resolveUnitAnimationState,
  type AoeUnitMotionHistory,
} from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';
import {
  forwardRadians,
  movingState,
  ORIGIN_HISTORY_FIELDS,
  signedAngleDelta,
  unit,
} from './helpers/voxelUnitAnimationFixtures';

describe('AoE voxel unit locomotion sampling', () => {
  it('starts a fresh idle identity on its authored forward axis', () => {
    const initial = resolveUnitAnimationState(
      unit({ entityType: 'militia' }),
      '7:3',
      undefined,
      0,
    );

    expect(initial.state.directionX).toBeCloseTo(0);
    expect(initial.state.directionZ).toBeCloseTo(1);
  });

  it('keeps malformed unit projections renderable with the neutral forward axis', () => {
    const initial = resolveUnitAnimationState(
      unit({ entityType: 'grass' }),
      'malformed-unit',
      undefined,
      0,
    );

    expect(initial.state.directionX).toBeCloseTo(1);
    expect(initial.state.directionZ).toBeCloseTo(0);
    expect(Math.hypot(initial.state.directionX, initial.state.directionZ)).toBeCloseTo(1);

    const malformedMoving = resolveUnitAnimationState(
      unit({ entityType: 'grass', x: 0.1 }),
      'malformed-unit',
      initial.history,
      16.67,
    );
    const recovered = resolveUnitAnimationState(
      unit({ entityType: 'villager', x: 0.2 }),
      'malformed-unit',
      malformedMoving.history,
      33.34,
    );

    for (const resolved of [malformedMoving, recovered]) {
      expect(Object.values(resolved.state).every((value) => (
        typeof value !== 'number' || Number.isFinite(value)
      ))).toBe(true);
    }
    expect(() => createUnitParts(
      unit({ entityType: 'villager', x: 0.2 }),
      'malformed-unit',
      0,
      recovered.state,
    )).not.toThrow();
  });

  it('advances gait phase by displayed distance so faster movement has faster cadence', () => {
    const identity = '7:3';
    const initial = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const slow = resolveUnitAnimationState(
      unit({ x: 0.1 }), identity, initial.history, 100,
    );
    const fast = resolveUnitAnimationState(
      unit({ x: 0.2 }), identity, initial.history, 100,
    );

    const slowAdvance = forwardRadians(
      initial.state.gaitPhaseRadians,
      slow.state.gaitPhaseRadians,
    );
    const fastAdvance = forwardRadians(
      initial.state.gaitPhaseRadians,
      fast.state.gaitPhaseRadians,
    );
    expect(fastAdvance).toBeCloseTo(slowAdvance * 2);
    expect(fast.state.speedWorldUnitsPerSecond).toBeCloseTo(2);
    expect(slow.state.speedWorldUnitsPerSecond).toBeCloseTo(1);
  });

  it('is split-distance invariant and does not advance phase while stopped', () => {
    const identity = '7:3';
    const initial = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const single = resolveUnitAnimationState(
      unit({ x: 0.42 }), identity, initial.history, 200,
    );
    const half = resolveUnitAnimationState(
      unit({ x: 0.21 }), identity, initial.history, 100,
    );
    const split = resolveUnitAnimationState(
      unit({ x: 0.42 }), identity, half.history, 200,
    );
    // The WINDOW, not the frame, says when a unit stopped: at 300 ms it still
    // reads the 2.1 tiles/s burst as a full walk; it empties (and the weight
    // decays) at the second anchor promotion, 450 ms apart for a villager.
    let resting = split;
    for (const at of [300, 500, 950, 1_000]) {
      resting = resolveUnitAnimationState(unit({ x: 0.42 }), identity, resting.history, at);
    }

    expect(split.state.gaitPhaseRadians).toBeCloseTo(single.state.gaitPhaseRadians);
    expect(resting.state.gaitPhaseRadians).toBeCloseTo(split.state.gaitPhaseRadians);
    expect(resting.state.locomotionWeight).toBeLessThan(split.state.locomotionWeight);
    expect(resting.state.locomotionWeight).toBeGreaterThan(0);
  });

  it('tracks normalized displayed direction and resets cleanly on a rewound clock', () => {
    const identity = '7:3';
    const initial = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const moving = resolveUnitAnimationState(
      unit({ x: 0.3, y: 0.4 }), identity, initial.history, 100,
    );
    const rewound = resolveUnitAnimationState(
      unit({ x: 9, y: 9 }), identity, moving.history, 50,
    );

    expect(moving.state.directionX).toBeGreaterThan(0);
    expect(moving.state.directionX).toBeLessThan(0.6);
    expect(moving.state.directionZ).toBeGreaterThan(0.8);
    expect(moving.state.directionZ).toBeLessThan(1);
    expect(Math.hypot(moving.state.directionX, moving.state.directionZ)).toBeCloseTo(1);
    expect(rewound.state.gaitPhaseRadians).toBeCloseTo(phaseForUnitIdentity(identity));
    expect(rewound.state.locomotionWeight).toBe(0);
    expect(rewound.state.speedWorldUnitsPerSecond).toBe(0);
    expect(rewound.state.directionX).toBeCloseTo(0);
    expect(rewound.state.directionZ).toBeCloseTo(1);
  });

  it('eases a moving unit through path corners instead of snapping its gait plane', () => {
    const identity = '7:3';
    const initial = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const east = resolveUnitAnimationState(
      unit({ x: 0.2 }), identity, initial.history, 100,
    );
    const corner = resolveUnitAnimationState(
      unit({ x: 0.2, y: 0.2 }), identity, east.history, 200,
    );

    expect(east.state.directionX).toBeGreaterThan(0);
    expect(east.state.directionZ).toBeGreaterThan(0);
    expect(corner.state.directionX).toBeGreaterThan(0);
    expect(corner.state.directionX).toBeLessThan(east.state.directionX);
    expect(corner.state.directionZ).toBeGreaterThan(east.state.directionZ);
    expect(corner.state.directionZ).toBeLessThan(1);
    expect(Math.hypot(corner.state.directionX, corner.state.directionZ)).toBeCloseTo(1);
  });

  it.each([
    ['north', 0, 1, Math.PI / 2],
    ['west', -1, 0, Math.PI],
  ] as const)('bounds an idle-to-%s body turn at a 60 Hz sample', (
    _label,
    targetX,
    targetZ,
    targetAngle,
  ) => {
    const previous: AoeUnitMotionHistory = {
      ...movingState({
        mode: 'idle',
        locomotionWeight: 0,
        speedWorldUnitsPerSecond: 0,
        directionX: 1,
        directionZ: 0,
      }),
      ...ORIGIN_HISTORY_FIELDS,
    };
    const next = resolveUnitAnimationState(
      unit({ x: targetX * 0.1, y: targetZ * 0.1 }),
      '7:3',
      previous,
      1_000 / 60,
    );
    const nextAngle = Math.atan2(next.state.directionZ, next.state.directionX);
    const turn = Math.abs(signedAngleDelta(0, nextAngle));

    expect(turn).toBeGreaterThan(0);
    expect(turn).toBeLessThan(0.5);
    expect(Math.abs(signedAngleDelta(nextAngle, targetAngle))).toBeLessThan(targetAngle);
  });

  it('takes a bounded shortest-arc turn across the -pi/pi seam at a 60 Hz sample', () => {
    const previousAngle = Math.PI - 0.02;
    const targetAngle = -Math.PI + 0.02;
    const previous: AoeUnitMotionHistory = {
      ...movingState({
        directionX: Math.cos(previousAngle),
        directionZ: Math.sin(previousAngle),
      }),
      ...ORIGIN_HISTORY_FIELDS,
    };
    const next = resolveUnitAnimationState(
      unit({ x: Math.cos(targetAngle) * 0.1, y: Math.sin(targetAngle) * 0.1 }),
      '7:3',
      previous,
      1_000 / 60,
    );
    const nextAngle = Math.atan2(next.state.directionZ, next.state.directionX);
    const turn = signedAngleDelta(previousAngle, nextAngle);

    expect(turn).toBeGreaterThan(0);
    expect(turn).toBeLessThan(0.01);
    expect(Math.abs(signedAngleDelta(nextAngle, targetAngle))).toBeLessThan(0.04);
  });

  it('is invariant to selection-forced redraws while simulation display time is paused', () => {
    const identity = '7:3';
    const initial = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const moving = resolveUnitAnimationState(
      unit({ x: 0.2 }), identity, initial.history, 100,
    );
    let forced = moving;
    for (let redraw = 0; redraw < 8; redraw += 1) {
      forced = resolveUnitAnimationState(unit({ x: 0.2 }), identity, forced.history, 100);
    }
    const resumedWithoutRedraw = resolveUnitAnimationState(
      unit({ x: 0.3 }), identity, moving.history, 120,
    );
    const resumedAfterForcedRedraw = resolveUnitAnimationState(
      unit({ x: 0.3 }), identity, forced.history, 120,
    );

    expect(forced.state).toEqual(moving.state);
    expect(resumedAfterForcedRedraw).toEqual(resumedWithoutRedraw);
    // v0.3.160: speed reads over the ~450ms trailing window (0.3 world units
    // in 120ms => 2.5/s), not the single-frame delta — the §12.4.2 carry
    // grants fine steps only every few ticks, so per-frame speed flickered.
    expect(resumedAfterForcedRedraw.state.speedWorldUnitsPerSecond).toBeCloseTo(2.5);
  });

  it('uses the full injected interval for speed while bounding only transition smoothing', () => {
    const initial = resolveUnitAnimationState(unit(), '7:3', undefined, 0);
    const delayed = resolveUnitAnimationState(
      unit({ x: 2.5 }), '7:3', initial.history, 1_000,
    );

    expect(delayed.state.speedWorldUnitsPerSecond).toBeCloseTo(2.5);
    expect(delayed.state.locomotionWeight).toBeGreaterThan(0);
    expect(delayed.state.locomotionWeight).toBeLessThanOrEqual(1);
  });

  it('is deterministic for identical displayed entity and injected-time sequences', () => {
    const run = () => {
      let history = resolveUnitAnimationState(unit(), '7:3', undefined, 0);
      const states = [history.state];
      for (const [x, y, nowMs] of [[0.04, 0, 16], [0.12, 0.03, 33], [0.12, 0.03, 133]] as const) {
        history = resolveUnitAnimationState(unit({ x, y }), '7:3', history.history, nowMs);
        states.push(history.state);
      }
      return states;
    };

    expect(run()).toEqual(run());
  });

  it('keeps identity phases distinct and fog memories static', () => {
    expect(phaseForUnitIdentity('7:3')).toBe(phaseForUnitIdentity('7:3'));
    expect(phaseForUnitIdentity('8:3')).not.toBe(phaseForUnitIdentity('7:3'));
    const memory = unit({ isMemory: true });
    const animated = animateUnitParts(
      createUnitParts(memory, '7:memory', 0),
      memory,
      movingState(),
    );
    expect(animated.every((candidate) => candidate.animation === undefined)).toBe(true);
  });
});
