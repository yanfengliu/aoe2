// AI-owned scout wander. Bounces a scout's velocity off its WanderBounds,
// rotates it away from impassable cells, and steps the unit one subgrid
// step per tick — without going through the command queue. A scout on a
// player-controlled slot (the human owner without a forced AI state) skips
// this loop so manual move orders keep full control; a forced-AI human
// slot (all-AI playtests) wanders like any other AI owner.

import type { Position } from 'civ-engine';
import type {
  UnitComponent,
  UnitTransformComponent,
  VelocityComponent,
  WanderBoundsComponent,
} from '../../types';
import {
  clamp,
  gridPositionFromUnitTransform,
  mapSizeOf,
  stepUnitTransformToward,
  type GameWorld,
} from '../pureHelpers';
import { UNIT_SUBGRID_RESOLUTION, UNIT_SUBGRID_STEP_PER_TICK } from '../pureHelpers';
import { unitBaseSpeedPercent } from '../../prototypeUnitRules/unitBaseSpeed';
import { aiStatesCodec, unitCommandsCodec } from '../bridgeStateSerialize';
import type { UnitAttackFeedRuntime } from '../bridgeState';
import { markUnitAttackMovementStartedForEntity } from '../unitAttackAnimationFeed';

type CivWorld = GameWorld;

/**
 * Turn the wanderer away from whatever just refused it.
 *
 * Shared by both refusal paths. A blind 90-degree rotation is not enough: at a
 * wander-box edge the bounds reflection flips the rotated heading straight back
 * into the wall it just hit — a two-state livelock that froze the canary-seed
 * scout at (38,18) for 2502 ticks beside its own forward house
 * (docs/debugging/2026-07-09-pinned-units-oracle.md). When even the escape
 * probe finds nothing, keep rotating so the scout re-probes as soon as the box
 * opens (a unit steps away, a building falls).
 */
function repickHeading(
  id: number,
  velocity: VelocityComponent,
  slottedPosition: { fineX: number; fineY: number },
  position: Position,
  bounds: WanderBoundsComponent,
  activeWorld: CivWorld,
  isCellPassableForUnit: (
    entityId: number,
    x: number,
    y: number,
    world: CivWorld,
  ) => boolean,
): void {
  const escape = pickEscapeHeading(
    {
      fineX: slottedPosition.fineX,
      fineY: slottedPosition.fineY,
      position,
      bounds,
    },
    velocity,
    (x, y) => isCellPassableForUnit(id, x, y, activeWorld),
  );
  if (escape) {
    velocity.dx = escape.dx;
    velocity.dy = escape.dy;
    return;
  }
  const rotatedDx = -velocity.dy;
  velocity.dy = velocity.dx;
  velocity.dx = rotatedDx;
}

export interface ScoutMovementSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor;
  unitAttackFeed: UnitAttackFeedRuntime;
  isCellPassableForUnit: (
    entityId: number,
    x: number,
    y: number,
    activeWorld: CivWorld,
  ) => boolean;
  setPositionAndSyncOccupancy: (
    entityId: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  getUnitTargetTransformForPosition: (
    entityId: number,
    position: Position,
  ) => UnitTransformComponent;
}

export function registerScoutMovementSystem(deps: ScoutMovementSystemDeps): void {
  const {
    world,
    humanPlayerId,
    accessor,
    unitAttackFeed,
    isCellPassableForUnit,
    setPositionAndSyncOccupancy,
    getUnitTargetTransformForPosition,
  } = deps;

  world.registerSystem({
    name: 'prototypeScoutMovement',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      const unitCommands = accessor.get(unitCommandsCodec);
      const aiStates = accessor.get(aiStatesCodec);
      for (const id of activeWorld.query('position', 'velocity', 'wanderBounds')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const position = activeWorld.getComponent<Position>(id, 'position');
        const velocity = activeWorld.getComponent<VelocityComponent>(id, 'velocity');
        const bounds = activeWorld.getComponent<WanderBoundsComponent>(id, 'wanderBounds');
        const transform = activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform');
        if (!position || !velocity || !bounds) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        // A human-controlled slot keeps manual-only movement; a forced-AI
        // human slot (all-AI playtests) has an AI state and wanders.
        if (
          !unit
          || unit.unitType !== 'scout'
          || (unit.owner === humanPlayerId && !aiStates.has(unit.owner))
        ) {
          continue;
        }

        // Periodic deterministic patrol kick: pure diagonal bounce plus a
        // fixed escape order is a deterministic billiard, and inside a
        // blocker pocket it can settle into a closed orbit — the forward
        // scout circled 5 cells of (46,17) for 2963 ticks with the south
        // exit open (prove-rerun 3, wide-box oracle verdict). A staggered
        // heading rotation every WANDER_HEADING_REFRESH_TICKS (angle cycling
        // 90/180/270) breaks any such cycle while keeping runs replayable.
        applyWanderKick(velocity, activeWorld.tick, id);

        // Wander moves the fine transform DIRECTLY rather than through the
        // step executor, so the per-unit base speed has to be applied here too
        // — otherwise an AI scout patrols at a villager's pace while the same
        // scout under a move order travels at 150%. A whole-fine-unit step
        // rather than the fractional carry: the bounce reflection recomputes
        // this step three times in one tick and a carry banked across a
        // reflection has no meaning. Rounding is exact for the scout (2 x 150%
        // = 3) and at worst a few percent off for any future wanderer.
        const wanderStepUnits = Math.max(1, Math.round(
          (UNIT_SUBGRID_STEP_PER_TICK * unitBaseSpeedPercent(unit.unitType)) / 100,
        ));
        const slottedPosition = getUnitTargetTransformForPosition(id, position);
        const currentFineX = transform?.fineX ?? slottedPosition.fineX;
        const currentFineY = transform?.fineY ?? slottedPosition.fineY;

        // An auto-aggression chase can strand the scout OUTSIDE its box.
        // Widening the effective box to include the current cell makes the
        // edge reflection below ratchet the scout back home step by step:
        // outward steps reflect off the moving edge, inward steps shrink it,
        // so the scout walks back at normal speed — clamping to the real box
        // instead teleported it to the box edge in one tick (multi-cell
        // jump, 2026-07-10 review finding). A scout walled off behind
        // impassable terrain patrols in place until the wall opens; the
        // pinned-units oracle reports that state honestly (bounded wander is
        // patrol, not navigation — fog-directed exploration is future work).
        const insideBox =
          position.x >= bounds.minX && position.x <= bounds.maxX
          && position.y >= bounds.minY && position.y <= bounds.maxY;
        const effectiveBounds: WanderBoundsComponent = insideBox ? bounds : {
          minX: Math.min(bounds.minX, position.x),
          maxX: Math.max(bounds.maxX, position.x),
          minY: Math.min(bounds.minY, position.y),
          maxY: Math.max(bounds.maxY, position.y),
        };

        const nextX = currentFineX + velocity.dx * wanderStepUnits;
        const nextY = currentFineY + velocity.dy * wanderStepUnits;

        if (
          nextX < effectiveBounds.minX * UNIT_SUBGRID_RESOLUTION
          || nextX > effectiveBounds.maxX * UNIT_SUBGRID_RESOLUTION
        ) {
          velocity.dx *= -1;
        }
        if (
          nextY < effectiveBounds.minY * UNIT_SUBGRID_RESOLUTION
          || nextY > effectiveBounds.maxY * UNIT_SUBGRID_RESOLUTION
        ) {
          velocity.dy *= -1;
        }

        if (transform) {
          // Try the full step first, then shorter ones. A wanderer hemmed in by
          // impassable neighbours makes progress by moving WITHIN its own cell
          // until the heading kick turns it, and a step that jumps straight
          // over the cell boundary never gets that chance — a Scout at 3 fine
          // units froze solid against a wall that a 2-unit step walked away
          // from, purely because 2 happened to leave it inside the cell.
          const candidateFor = (stepUnits: number) => ({
            ...transform,
            fineX: clamp(
              currentFineX + velocity.dx * stepUnits,
              effectiveBounds.minX * UNIT_SUBGRID_RESOLUTION,
              effectiveBounds.maxX * UNIT_SUBGRID_RESOLUTION,
            ),
            fineY: clamp(
              currentFineY + velocity.dy * stepUnits,
              effectiveBounds.minY * UNIT_SUBGRID_RESOLUTION,
              effectiveBounds.maxY * UNIT_SUBGRID_RESOLUTION,
            ),
          });
          const staysInCell = (grid: { x: number; y: number }) => (
            grid.x === position.x && grid.y === position.y
          );
          let candidateTransform = candidateFor(wanderStepUnits);
          let nextGridPosition = gridPositionFromUnitTransform(
            candidateTransform,
            mapSizeOf(activeWorld),
          );
          // Whether the FULL step was refused. A shortened step can still make
          // progress, but the heading must be re-picked either way: publishing
          // a sub-cell wiggle and calling it movement is what lets a hemmed-in
          // scout orbit inside one cell forever (canary scout 2257, block 3).
          const blockedAtFullStep = !staysInCell(nextGridPosition)
            && !isCellPassableForUnit(id, nextGridPosition.x, nextGridPosition.y, activeWorld);
          if (blockedAtFullStep) {
            for (let stepUnits = wanderStepUnits - 1; stepUnits >= 1; stepUnits -= 1) {
              const shorter = candidateFor(stepUnits);
              const grid = gridPositionFromUnitTransform(shorter, mapSizeOf(activeWorld));
              if (staysInCell(grid) || isCellPassableForUnit(id, grid.x, grid.y, activeWorld)) {
                candidateTransform = shorter;
                nextGridPosition = grid;
                break;
              }
            }
          }
          if (staysInCell(nextGridPosition)) {
            activeWorld.setComponent(id, 'unitTransform', candidateTransform);
            if (
              candidateTransform.fineX !== transform.fineX
              || candidateTransform.fineY !== transform.fineY
            ) markUnitAttackMovementStartedForEntity(unitAttackFeed, id, activeWorld);
            if (blockedAtFullStep) {
              repickHeading(
              id,
              velocity,
              slottedPosition,
              position,
              effectiveBounds,
              activeWorld,
              isCellPassableForUnit,
            );
            }
          } else if (isCellPassableForUnit(
            id,
            nextGridPosition.x,
            nextGridPosition.y,
            activeWorld,
          )) {
            activeWorld.setComponent(id, 'unitTransform', candidateTransform);
            markUnitAttackMovementStartedForEntity(unitAttackFeed, id, activeWorld);
            setPositionAndSyncOccupancy(id, nextGridPosition, activeWorld);
          } else {
            // Impassable next cell (a building footprint, a resource, bad
            // terrain — units crowd-share cells and do not block).
            // The candidate was never published. Recenter toward the
            // occupancy-assigned slot by at most one normal movement step,
            // then use that slot as the escape probe. The bounded recenter
            // preserves the deterministic phase change that avoids closed
            // obstacle orbits; publishing the slot in one jump would visibly
            // teleport whenever the fine transform is farther away.
            const recenteredTransform = stepUnitTransformToward(
              transform,
              slottedPosition,
              wanderStepUnits,
            );
            if (
              recenteredTransform.fineX !== transform.fineX
              || recenteredTransform.fineY !== transform.fineY
            ) {
              activeWorld.setComponent(id, 'unitTransform', {
                ...transform,
                fineX: recenteredTransform.fineX,
                fineY: recenteredTransform.fineY,
              });
              markUnitAttackMovementStartedForEntity(unitAttackFeed, id, activeWorld);
            }
            // A blind 90°
            // rotation is not enough: at a wander-box edge the bounds
            // reflection flips the rotated heading straight back into the
            // wall it just hit — a two-state livelock that froze the
            // canary-seed scout at (38,18) for 2502 ticks beside its own
            // forward house (docs/debugging/2026-07-09-pinned-units-oracle.md).
            repickHeading(
              id,
              velocity,
              slottedPosition,
              position,
              effectiveBounds,
              activeWorld,
              isCellPassableForUnit,
            );
          }
          continue;
        }

        const nextPosition = {
          x: clamp(position.x + velocity.dx, effectiveBounds.minX, effectiveBounds.maxX),
          y: clamp(position.y + velocity.dy, effectiveBounds.minY, effectiveBounds.maxY),
        };
        if (isCellPassableForUnit(id, nextPosition.x, nextPosition.y, activeWorld)) {
          if (nextPosition.x !== position.x || nextPosition.y !== position.y) {
            markUnitAttackMovementStartedForEntity(unitAttackFeed, id, activeWorld);
          }
          setPositionAndSyncOccupancy(id, nextPosition, activeWorld);
        } else {
          // Same livelock guard as the transform path, emulated from the
          // slot-derived fine coordinates the reflection above already used —
          // a grid-only destination check would re-pick headings the fine
          // reflection cancels (review probe: unreachable in production, but
          // this keeps one escape semantics for both paths).
          const escape = pickEscapeHeading(
            {
              fineX: slottedPosition.fineX,
              fineY: slottedPosition.fineY,
              position,
              bounds: effectiveBounds,
            },
            velocity,
            (x, y) => isCellPassableForUnit(id, x, y, activeWorld),
          );
          if (escape) {
            velocity.dx = escape.dx;
            velocity.dy = escape.dy;
          } else {
            const rotatedDx = -velocity.dy;
            velocity.dy = velocity.dx;
            velocity.dx = rotatedDx;
          }
        }
      }
    },
  });
}

type Heading = { dx: number; dy: number };

// Rotate `velocity` in place when (tick + id) hits the refresh cadence;
// returns whether a kick was applied. The angle cycles 90° -> 180° -> 270°
// across successive kicks so a closed patrol orbit would have to be
// invariant under all three interleaved rotations to survive. Pure and
// tick-derived: identical inputs kick identically (replay/save safe).
const WANDER_HEADING_REFRESH_TICKS = 400;
export function applyWanderKick(velocity: Heading, tick: number, unitId: number): boolean {
  const stagger = tick + unitId;
  if (stagger === 0 || stagger % WANDER_HEADING_REFRESH_TICKS !== 0) return false;
  const turns = 1 + ((stagger / WANDER_HEADING_REFRESH_TICKS - 1) % 3);
  for (let i = 0; i < turns; i++) {
    const rotatedDx = -velocity.dy;
    velocity.dy = velocity.dx;
    velocity.dx = rotatedDx;
  }
  return true;
}

export interface EscapeProbe {
  fineX: number;
  fineY: number;
  position: Position;
  bounds: WanderBoundsComponent;
}

// CW rotations of the current heading first (it just hit a wall — try
// turning), the current heading last (a bounds reflection may still rescue
// it). Deterministic order keeps runs replayable.
function candidateHeadings(velocity: Heading): Heading[] {
  return [
    { dx: -velocity.dy, dy: velocity.dx },
    { dx: -velocity.dx, dy: -velocity.dy },
    { dx: velocity.dy, dy: -velocity.dx },
    { dx: velocity.dx, dy: velocity.dy },
  ];
}

// Emulate up to UNIT_SUBGRID_RESOLUTION ticks of the wander stepping above
// (bounds reflection + clamp included) for one candidate heading. Viable iff
// the path reaches a DIFFERENT, passable grid cell before ever landing on an
// impassable one. Phase-aware on purpose: which axis crosses its cell
// boundary first depends on the sub-cell fine coordinates, so a diagonal can
// legally "staircase" past a blocked corner that a naive no-corner-cutting
// rule would reject; and a heading the reflection would flip straight back
// into a wall is rejected — assigning it recreates the two-state livelock.
export function headingEscapes(
  probe: EscapeProbe,
  heading: Heading,
  isPassable: (x: number, y: number) => boolean,
): boolean {
  const minFineX = probe.bounds.minX * UNIT_SUBGRID_RESOLUTION;
  const maxFineX = probe.bounds.maxX * UNIT_SUBGRID_RESOLUTION;
  const minFineY = probe.bounds.minY * UNIT_SUBGRID_RESOLUTION;
  const maxFineY = probe.bounds.maxY * UNIT_SUBGRID_RESOLUTION;
  let { fineX, fineY } = probe;
  let { dx, dy } = heading;
  for (let i = 0; i < UNIT_SUBGRID_RESOLUTION; i++) {
    if (
      fineX + dx * UNIT_SUBGRID_STEP_PER_TICK < minFineX
      || fineX + dx * UNIT_SUBGRID_STEP_PER_TICK > maxFineX
    ) {
      dx = -dx;
    }
    if (
      fineY + dy * UNIT_SUBGRID_STEP_PER_TICK < minFineY
      || fineY + dy * UNIT_SUBGRID_STEP_PER_TICK > maxFineY
    ) {
      dy = -dy;
    }
    fineX = clamp(fineX + dx * UNIT_SUBGRID_STEP_PER_TICK, minFineX, maxFineX);
    fineY = clamp(fineY + dy * UNIT_SUBGRID_STEP_PER_TICK, minFineY, maxFineY);
    // No map clamp here: `fineX`/`fineY` were just clamped to the probe's own
    // wander bounds, which are inside the map by construction, so the cell is
    // already on it — and this helper is pure, with no world to ask.
    const cell = {
      x: Math.floor(fineX / UNIT_SUBGRID_RESOLUTION),
      y: Math.floor(fineY / UNIT_SUBGRID_RESOLUTION),
    };
    if (cell.x === probe.position.x && cell.y === probe.position.y) continue;
    return isPassable(cell.x, cell.y);
  }
  return false;
}

export function pickEscapeHeading(
  probe: EscapeProbe,
  velocity: Heading,
  isPassable: (x: number, y: number) => boolean,
): Heading | null {
  for (const heading of candidateHeadings(velocity)) {
    if (headingEscapes(probe, heading, isPassable)) return heading;
  }
  return null;
}

