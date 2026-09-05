import type { ProjectedEntityView, UnitType } from '../../game/simulation/types';
import { TPS } from '../../game/simulation/prototypeScenario';
import { unitBaseTilesPerSecond, unitStepCadenceTicks } from '../unitStepCadence';
import { unitRole, type UnitRole } from '../roles/unitRole';
import type { VoxelPart } from './aoeVoxelRecipeTypes';
import type { AoeUnitAnimationState } from './aoeVoxelUnitAnimationState';
import { posePart } from './aoeVoxelUnitLocomotionPose';
import { clamp01 } from './voxelMath';

export type { AoeUnitAnimationState } from './aoeVoxelUnitAnimationState';
import { unitAmbientAnimation } from './aoeVoxelUnitAmbientAnimation';
import { poseUnitAttackParts } from './aoeVoxelUnitAttackAnimation';
import { unitAttackRig } from './aoeVoxelUnitAttackRigs';
import { sampleUnitAttack } from './aoeVoxelUnitAttackSampling';
import {
  builderWorkPhase,
  builderWorkWeight,
  poseBuilderWorkParts,
} from './aoeVoxelBuilderWorkPose';


export interface AoeUnitMotionHistory extends AoeUnitAnimationState {
  readonly x: number;
  readonly y: number;
  readonly sampleTimeMs: number;
  // Trailing displacement anchors (v0.3.160). At spec §12.4.2 speeds the sim
  // grants a fine step only every 2-5 ticks (the carry banks the fraction
  // between), so frame-to-frame displacement is ZERO on most sampled frames
  // even mid-walk, and deriving `moving`/speed from the single-frame delta
  // made every walk hitch. TWO anchors, promoted every half-window, keep the
  // effective displacement window between half and one full window at all
  // times — a single anchor that snaps forward collapses the window to one
  // frame at each rollover (measured: 18% idle frames, 250 ms idle holds on
  // a continuously walking villager).
  readonly anchorX: number;
  readonly anchorY: number;
  readonly anchorTimeMs: number;
  readonly youngAnchorX: number;
  readonly youngAnchorY: number;
  readonly youngAnchorTimeMs: number;
}

export interface ResolvedUnitAnimationState {
  readonly state: AoeUnitAnimationState;
  readonly history: AoeUnitMotionHistory;
}

const TAU = Math.PI * 2;
const MOVEMENT_EPSILON = 0.000_001;
const MAX_SPEED_WORLD_UNITS_PER_SECOND = 20;
const MAX_SMOOTHING_DELTA_MS = 250;
// Per-unit displacement window: two base step cadences plus a tick, in
// DISPLAY-time ms (display time is sim-clock time — ticks x 100 ms — so the
// cadence is invariant across game speeds). Movement techs only SHORTEN the
// cadence, so the untech'd base is the upper bound. The slowest §12.4.2
// mover (Battering Ram, 62% = 20 hundredths/tick) steps every 5 ticks; its
// window is 1,100 ms, a villager's 900, a scout's 700. The cadence itself is
// shared with the displayed-position smoother (unitStepCadence).
const MS_PER_TICK = 1_000 / TPS;
function motionWindowMsFor(entity: ProjectedEntityView): number {
  return (2 * unitStepCadenceTicks(entity.entityType) + 1) * MS_PER_TICK;
}
// Full gait at three quarters of the unit's OWN base rate (unitStepCadence),
// never at one fixed speed. This was a flat 2.5 tiles/s — the uniform clock
// before §12.4.2 — and v0.3.160 gave every unit its own rate (villager 0.8,
// militia 0.9, knight 1.35), so no unit reached 2.5 again: every walker's
// weight sat at 0.2-0.6 and its legs swung at that fraction of the authored
// gait, about one pixel of boot travel at the default zoom — the owner's
// 2026-09-05 "soldiers are not moving their legs" (gate:
// tests/rendering/aoeVoxelUnitWalkLegs.test.ts). Three quarters rather than
// the whole rate: the drawn root's speed over the window ripples with the
// carry's 3-tick/4-tick alternation (0.62-0.83 tiles/s for a villager at
// 0.8), and a weight that reads 1 at the trough does not flutter with it.
// Below that the unit is being slowed — traffic, a door ball — and the gait
// fades with it, which is the fade this weight exists for.
const FULL_GAIT_FRACTION_OF_BASE_RATE = 0.75;
function fullLocomotionSpeedFor(entity: ProjectedEntityView): number {
  return FULL_GAIT_FRACTION_OF_BASE_RATE * unitBaseTilesPerSecond(entity.entityType);
}
const START_RESPONSE_MS = 90;
const STOP_RESPONSE_MS = 180;
const TURN_RESPONSE_MS = 110;

const STRIDE_LENGTH_WORLD_UNITS: Readonly<Record<UnitRole, number>> = Object.freeze({
  villager: 2.2,
  infantry: 2.35,
  archer: 2.4,
  cavalry: 3.2,
  'cavalry-archer': 3.4,
  siege: 0.95,
  monk: 2.5,
  // A hull glides; it has no stride, so the gait cycle is long and shallow.
  ship: 3.6,
});

const AUTHORED_FORWARD_RADIANS: Readonly<Record<UnitRole, number>> = Object.freeze({
  villager: Math.PI / 2,
  infantry: Math.PI / 2,
  archer: Math.PI / 2,
  cavalry: Math.atan2(-0.36, 0.5),
  'cavalry-archer': Math.atan2(-0.36, 0.5),
  siege: Math.atan2(-0.43, 0.88),
  monk: Math.PI / 2,
  // The hull is authored bow-forward along +z, like the humanoids.
  ship: Math.PI / 2,
});

const FALLBACK_STRIDE_LENGTH_WORLD_UNITS = STRIDE_LENGTH_WORLD_UNITS.infantry;

function animationRole(entity: ProjectedEntityView): UnitRole | undefined {
  return unitRole(entity.entityType as UnitType) as UnitRole | undefined;
}

function wrapRadians(value: number): number {
  return ((value % TAU) + TAU) % TAU;
}

export function phaseForUnitIdentity(identity: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000 * TAU;
}

function initialUnitMotion(
  entity: ProjectedEntityView,
  identity: string,
  sampleTimeMs: number,
): ResolvedUnitAnimationState {
  const attackAnimation = entity.attackAnimation;
  if (attackAnimation?.cancelTick !== undefined) {
    const cancelTimeMs = attackAnimation.cancelTick * 1_000 / TPS;
    const cancelEndTimeMs = cancelTimeMs + 1_000 / TPS;
    const distanceFromSource = Math.hypot(
      entity.x - attackAnimation.sourceX,
      entity.y - attackAnimation.sourceY,
    );
    if (
      sampleTimeMs > cancelTimeMs
      && sampleTimeMs < cancelEndTimeMs
      && distanceFromSource > MOVEMENT_EPSILON
    ) {
      const atSource = {
        ...entity,
        x: attackAnimation.sourceX,
        y: attackAnimation.sourceY,
      };
      const start = initialUnitMotion(atSource, identity, cancelTimeMs);
      return resolveUnitAnimationState(entity, identity, start.history, sampleTimeMs);
    }
  }
  const phaseRadians = phaseForUnitIdentity(identity);
  const role = animationRole(entity);
  const authoredForward = role === undefined ? 0 : AUTHORED_FORWARD_RADIANS[role];
  const attackSample = sampleUnitAttack(
    entity,
    sampleTimeMs,
    Math.cos(authoredForward),
    Math.sin(authoredForward),
  );
  const attack = attackSample?.poseWeight ? attackSample : null;
  const state: AoeUnitAnimationState = {
    mode: attack ? 'attacking' : 'idle',
    phaseRadians,
    gaitPhaseRadians: phaseRadians,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: attackSample?.directionX ?? Math.cos(authoredForward),
    directionZ: attackSample?.directionZ ?? Math.sin(authoredForward),
    attackPhase: attackSample?.phase ?? 0,
    attackWeight: attack?.poseWeight ?? 0,
    ambientSuppressionWeight: attackSample?.ambientSuppressionWeight ?? 0,
    workPhase: builderWorkPhase(sampleTimeMs, phaseRadians),
    workWeight: builderWorkWeight(entity, false, attack?.poseWeight ?? 0),
    targetDistance: attackSample?.targetDistance ?? 0,
  };
  return {
    state,
    history: {
      ...state, x: entity.x, y: entity.y, sampleTimeMs,
      anchorX: entity.x, anchorY: entity.y, anchorTimeMs: sampleTimeMs,
      youngAnchorX: entity.x, youngAnchorY: entity.y, youngAnchorTimeMs: sampleTimeMs,
    },
  };
}

function smoothDirection(
  previous: AoeUnitMotionHistory,
  targetX: number,
  targetZ: number,
  smoothingDeltaMs: number,
): readonly [number, number] {
  const blend = smoothingDeltaMs > 0
    ? 1 - Math.exp(-smoothingDeltaMs / TURN_RESPONSE_MS)
    : 0;
  const previousAngle = Math.atan2(previous.directionZ, previous.directionX);
  const targetAngle = Math.atan2(targetZ, targetX);
  const turn = Math.atan2(
    Math.sin(targetAngle - previousAngle),
    Math.cos(targetAngle - previousAngle),
  );
  const angle = previousAngle + turn * blend;
  return [Math.cos(angle), Math.sin(angle)];
}

export function resolveUnitAnimationState(
  entity: ProjectedEntityView,
  identity: string,
  previous: AoeUnitMotionHistory | undefined,
  sampleTimeMs: number,
): ResolvedUnitAnimationState {
  if (!Number.isFinite(sampleTimeMs) || sampleTimeMs < 0) {
    throw new RangeError('Unit animation sample time must be a non-negative finite number.');
  }
  if (!previous || sampleTimeMs < previous.sampleTimeMs) {
    return initialUnitMotion(entity, identity, sampleTimeMs);
  }

  const deltaX = entity.x - previous.x;
  const deltaZ = entity.y - previous.y;
  const distance = Math.hypot(deltaX, deltaZ);
  // Two-anchor promotion: when the YOUNG anchor is half a window old, the
  // old anchor retires to it and the young anchor restarts at the previous
  // sample. Displacement always measures against an anchor between half and
  // one full window old — never a freshly-planted one.
  const windowMs = motionWindowMsFor(entity);
  const promote = sampleTimeMs - previous.youngAnchorTimeMs >= windowMs / 2;
  const anchorX = promote ? previous.youngAnchorX : previous.anchorX;
  const anchorY = promote ? previous.youngAnchorY : previous.anchorY;
  const anchorTimeMs = promote ? previous.youngAnchorTimeMs : previous.anchorTimeMs;
  const youngAnchorX = promote ? previous.x : previous.youngAnchorX;
  const youngAnchorY = promote ? previous.y : previous.youngAnchorY;
  const youngAnchorTimeMs = promote ? previous.sampleTimeMs : previous.youngAnchorTimeMs;
  const windowDeltaX = entity.x - anchorX;
  const windowDeltaZ = entity.y - anchorY;
  const windowDistance = Math.hypot(windowDeltaX, windowDeltaZ);
  const windowElapsedMs = Math.max(0, sampleTimeMs - anchorTimeMs);
  // Frame-based facts keep their original jobs (same-time redraw semantics,
  // teleport reset, the stationary-strike arbitration); the WINDOW only
  // decides locomotion mode and speed, bridging the carry's zero-step ticks.
  const frameMoving = distance > MOVEMENT_EPSILON;
  const moving = windowDistance > MOVEMENT_EPSILON;
  const elapsedMs = Math.max(0, sampleTimeMs - previous.sampleTimeMs);
  if (elapsedMs === 0) {
    if (!frameMoving) {
      return {
        state: {
          mode: previous.mode,
          phaseRadians: previous.phaseRadians,
          gaitPhaseRadians: previous.gaitPhaseRadians,
          locomotionWeight: previous.locomotionWeight,
          speedWorldUnitsPerSecond: previous.speedWorldUnitsPerSecond,
          directionX: previous.directionX,
          directionZ: previous.directionZ,
          attackPhase: previous.attackPhase,
          attackWeight: previous.attackWeight,
          ambientSuppressionWeight: previous.ambientSuppressionWeight,
          // Equal display time freezes the work loop with everything else.
          workPhase: previous.workPhase,
          workWeight: previous.workWeight,
          targetDistance: previous.targetDistance,
        },
        history: { ...previous, x: entity.x, y: entity.y },
      };
      // (anchor fields ride along via ...previous)
    }
    return initialUnitMotion(entity, identity, sampleTimeMs);
  }
  const smoothingDeltaMs = Math.min(
    MAX_SMOOTHING_DELTA_MS,
    elapsedMs,
  );
  const speed = windowElapsedMs > 0
    ? Math.min(MAX_SPEED_WORLD_UNITS_PER_SECOND, windowDistance * 1_000 / windowElapsedMs)
    : 0;
  const attackSample = sampleUnitAttack(
    entity,
    sampleTimeMs,
    previous.directionX,
    previous.directionZ,
  );
  const attack = !attackSample?.poseWeight ? null : attackSample;
  // A frame-halted unit with a LIVE attack event reads attacking immediately
  // (the sim stops units to fight, so the event is authoritative intent); a
  // mere residual attack pose on a unit the window still shows walking must
  // NOT flip a mid-walk zero-step frame to attacking.
  const stationaryAttack = frameMoving
    ? null
    : attack && (entity.attackAnimation != null || !moving)
      ? attack
      : null;
  const targetWeight = clamp01(speed / fullLocomotionSpeedFor(entity));
  const responseMs = targetWeight > previous.locomotionWeight
    ? START_RESPONSE_MS
    : STOP_RESPONSE_MS;
  const blend = smoothingDeltaMs > 0
    ? 1 - Math.exp(-smoothingDeltaMs / responseMs)
    : 0;
  const blendedWeight = previous.locomotionWeight
    + (targetWeight - previous.locomotionWeight) * blend;
  const locomotionWeight = stationaryAttack
    ? previous.locomotionWeight
    : targetWeight === 0 && blendedWeight < 0.001
      ? 0
      : clamp01(blendedWeight);
  const attackWeight = attack?.poseWeight ?? 0;
  const role = animationRole(entity);
  const strideLength = role === undefined
    ? FALLBACK_STRIDE_LENGTH_WORLD_UNITS
    : STRIDE_LENGTH_WORLD_UNITS[role];
  const gaitPhaseRadians = wrapRadians(
    previous.gaitPhaseRadians + distance / strideLength * TAU,
  );
  // Arm order matters: a frame-halted striker takes its ATTACK direction
  // before the moving-hold window gets a vote, or a unit that stops to fight
  // mid-walk keeps turning toward its stale travel heading.
  const [directionX, directionZ] = frameMoving
    ? smoothDirection(
      previous,
      deltaX / distance,
      deltaZ / distance,
      smoothingDeltaMs,
    )
    : attackSample
      ? [attackSample.directionX, attackSample.directionZ]
      : moving
        ? smoothDirection(
          previous,
          windowDeltaX / windowDistance,
          windowDeltaZ / windowDistance,
          smoothingDeltaMs,
        )
        : [previous.directionX, previous.directionZ];
  const state: AoeUnitAnimationState = {
    mode: stationaryAttack ? 'attacking' : moving ? 'moving' : 'idle',
    phaseRadians: previous.phaseRadians,
    gaitPhaseRadians,
    locomotionWeight,
    speedWorldUnitsPerSecond: speed,
    directionX,
    directionZ,
    attackPhase: attackSample?.phase ?? 0,
    attackWeight,
    ambientSuppressionWeight: attackSample?.ambientSuppressionWeight ?? 0,
    workPhase: builderWorkPhase(sampleTimeMs, previous.phaseRadians),
    // The WINDOW gates the work pose: a builder commuting to its site is
    // walking (zero-step frames included) and must not strobe its hammer.
    workWeight: builderWorkWeight(entity, moving, attackWeight),
    targetDistance: attackSample?.targetDistance ?? 0,
  };
  return {
    state,
    history: {
      ...state, x: entity.x, y: entity.y, sampleTimeMs,
      anchorX, anchorY, anchorTimeMs,
      youngAnchorX, youngAnchorY, youngAnchorTimeMs,
    },
  };
}

function orientUnitParts(
  parts: readonly VoxelPart[],
  entity: ProjectedEntityView,
  role: UnitRole,
  state: AoeUnitAnimationState,
): readonly VoxelPart[] {
  const targetHeading = Math.atan2(state.directionZ, state.directionX);
  const authoredForward = AUTHORED_FORWARD_RADIANS[role] ?? 0;
  const heading = Math.atan2(
    Math.sin(targetHeading - authoredForward),
    Math.cos(targetHeading - authoredForward),
  );
  if (Math.abs(heading) <= MOVEMENT_EPSILON) return parts;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const rootX = entity.x + 0.5;
  const rootZ = entity.y + 0.5;
  return parts.map((part) => {
    // The cast shadow falls away from the sun, not along the heading.
    if (part.surface === 'shadow') return part;
    const offsetX = part.centerX - rootX;
    const offsetZ = part.centerZ - rootZ;
    return {
      ...part,
      centerX: rootX + offsetX * cosine - offsetZ * sine,
      centerZ: rootZ + offsetX * sine + offsetZ * cosine,
      yaw: (part.yaw ?? 0) - heading,
    };
  });
}

function normalizeAnimationDirection(state: AoeUnitAnimationState): AoeUnitAnimationState {
  const length = Math.hypot(state.directionX, state.directionZ);
  if (!Number.isFinite(length) || length <= MOVEMENT_EPSILON) {
    throw new RangeError('Unit animation direction must be finite and non-zero.');
  }
  if (Math.abs(length - 1) <= MOVEMENT_EPSILON) return state;
  return {
    ...state,
    directionX: state.directionX / length,
    directionZ: state.directionZ / length,
  };
}

export function animateUnitParts(
  parts: readonly VoxelPart[],
  entity: ProjectedEntityView,
  state: AoeUnitAnimationState,
): VoxelPart[] {
  if (entity.isMemory) return parts.map((part) => ({ ...part, animation: undefined }));
  const unitType = entity.entityType as UnitType;
  const role = unitRole(unitType);
  const attackRig = unitAttackRig(unitType);
  const scale = Math.max(0.48, entity.size);
  const normalizedState = normalizeAnimationDirection(state);
  const locomotionParts = orientUnitParts(parts, entity, role, normalizedState).map((part) => {
    if (part.surface === 'shadow') return part;
    const suffix = part.key.slice(part.key.lastIndexOf(':') + 1);
    return posePart(part, suffix, role, normalizedState, scale);
  });
  // The work loop runs before the attack pose so the attack — which owns the
  // same tool/arm parts and is weight-gated against it — always wins.
  const workedParts = role === 'villager'
    ? poseBuilderWorkParts(locomotionParts, normalizedState, scale, entity.activeVerb)
    : locomotionParts;
  return poseUnitAttackParts(
    workedParts,
    role,
    attackRig,
    normalizedState,
    scale,
    entity.x + 0.5,
    entity.y + 0.5,
  ).map((posed) => {
    if (posed.surface === 'shadow') return posed;
    const suffix = posed.key.slice(posed.key.lastIndexOf(':') + 1);
    return {
      ...posed,
      animation: unitAmbientAnimation(suffix, role, normalizedState, scale, attackRig),
    };
  });
}
