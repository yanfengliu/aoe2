// Local traffic arbitration for narrow passages. Global A* deliberately sees
// only durable topology (terrain, resources, and buildings); this layer keeps
// active friendly movers from using subcell slots to pass each other in
// a one-cell choke. Every input an election reads — positions, headings and
// each member's starvation clock — comes from a tick-start snapshot, so all
// members of one jam elect the same winner whatever order the systems consult
// the arbiter in. Iteration order is STABLE across live play, save/load and
// replay (dense id-indexed stores, sorted query caches, systems by phase then
// registration); the snapshot is what makes the decision independent of it.

import type { Position } from 'civ-engine';

import type { GathererComponent, UnitComponent, UnitTransformComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { monkTasksCodec, unitCommandsCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';
import { electTrafficWinnerDetailed, trafficProgressClock } from './movementTrafficElection';

export type MovementLaneAxis = 'horizontal' | 'vertical';

export type MovementTrafficDecision =
  | { readonly kind: 'wait' }
  | { readonly kind: 'proceed'; readonly laneAxis?: MovementLaneAxis };

interface TrafficUnitSnapshot {
  readonly id: number;
  readonly owner: number;
  readonly position: Position;
  readonly fineX: number;
  readonly fineY: number;
  readonly activeIntent: boolean;
  readonly direction: Position | null;
  readonly recentAttempt: boolean;
  /** The starvation clock the election reads for this unit — see
   *  `trafficProgressClock`. Snapshotted with everything else. */
  readonly progressTick: number | undefined;
}

/** One admission through the starvation rule rather than lowest-id. */
export interface TrafficReliefEvent {
  readonly unitId: number;
  readonly tick: number;
  readonly waited: number;
}

interface TrafficIntent {
  readonly key: string;
  readonly target: Position | null;
}

interface MovementTrafficOpsDeps {
  readonly world: GameWorld;
  readonly accessor: BridgeStateAccessor;
  readonly isCellPassableForUnit: (
    unitId: number,
    x: number,
    y: number,
    activeWorld: GameWorld,
  ) => boolean;
  /** Fired for every admission the starvation rule grants. Production wires
   *  nothing here; the boot-map relief gate injects a counter through it. */
  readonly onStarvationRelief?: (event: TrafficReliefEvent) => void;
}

function cardinalDirection(from: Position, to: Position): Position | null {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  return { x: dx, y: dy };
}

function dominantDirection(from: Position, to: Position): Position | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx), y: 0 }
    : { x: 0, y: Math.sign(dy) };
}

function samePosition(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y;
}

function projection(unit: TrafficUnitSnapshot, direction: Position): number {
  return unit.fineX * direction.x + unit.fineY * direction.y;
}

export function createMovementTrafficOps(deps: MovementTrafficOpsDeps): {
  resolveMovementTraffic(
    unitId: number,
    nextStep: Position,
    activeWorld?: GameWorld,
  ): MovementTrafficDecision;
} {
  const { world, accessor, isCellPassableForUnit, onStarvationRelief } = deps;
  let snapshotTick: number | null = null;
  let snapshot: TrafficUnitSnapshot[] = [];
  const snapshotById = new Map<number, TrafficUnitSnapshot>();
  const attemptedDirections = new Map<number, Position>();
  const originReservations = new Map<string, number>();

  function trafficIntentFor(
    id: number,
    activeWorld: GameWorld,
  ): TrafficIntent | null {
    const command = accessor.get(unitCommandsCodec).get(id);
    if (command) {
      const targetRef = command.targetEntityRef ?? command.buildingRef;
      return {
        key: [
          'command',
          command.type,
          command.target.x,
          command.target.y,
          targetRef?.id ?? '-',
          targetRef?.generation ?? '-',
        ].join(':'),
        target: command.target,
      };
    }
    const monkTask = accessor.get(monkTasksCodec).get(id);
    if (monkTask) {
      return {
        key: [
          'monk',
          monkTask.kind,
          monkTask.targetEntityRef.id,
          monkTask.targetEntityRef.generation,
        ].join(':'),
        target: activeWorld.getComponent<Position>(monkTask.targetEntityRef.id, 'position') ?? null,
      };
    }
    const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
    if (!gatherer) return null;
    if (gatherer.task === 'to-resource' && gatherer.targetResourceId !== null) {
      return {
        key: `gather:resource:${gatherer.targetResourceId}`,
        target: activeWorld.getComponent<Position>(gatherer.targetResourceId, 'position') ?? null,
      };
    }
    if (gatherer.task === 'to-dropoff' && gatherer.dropOffBuildingId !== null) {
      return {
        key: `gather:dropoff:${gatherer.dropOffBuildingId}`,
        target: activeWorld.getComponent<Position>(gatherer.dropOffBuildingId, 'position') ?? null,
      };
    }
    if (gatherer.task === 'idle' && gatherer.hasExplicitGatherOrder) {
      return { key: `gather:pending:${gatherer.desiredResource}`, target: null };
    }
    return null;
  }

  function snapshotForTick(activeWorld: GameWorld): readonly TrafficUnitSnapshot[] {
    if (snapshotTick === activeWorld.tick) return snapshot;
    snapshot = [];
    snapshotById.clear();
    attemptedDirections.clear();
    originReservations.clear();
    for (const id of activeWorld.query('position', 'unit', 'unitTransform')) {
      const position = activeWorld.getComponent<Position>(id, 'position');
      const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
      const transform = activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform');
      if (!position || !unit || !transform) continue;
      const intent = trafficIntentFor(id, activeWorld);
      const attemptAge = transform.trafficAttemptTick === undefined
        ? Number.POSITIVE_INFINITY
        : activeWorld.tick - transform.trafficAttemptTick;
      const rememberedIsCurrent = intent !== null
        && transform.trafficIntentKey === intent.key
        && attemptAge >= 0
        && attemptAge <= 1;
      const rememberedDirection = cardinalDirection(
        { x: 0, y: 0 },
        {
          x: transform.trafficDirectionX ?? 0,
          y: transform.trafficDirectionY ?? 0,
        },
      );
      snapshot.push({
        id,
        owner: unit.owner,
        position: { ...position },
        fineX: transform.fineX,
        fineY: transform.fineY,
        activeIntent: intent !== null,
        direction: rememberedIsCurrent
          ? rememberedDirection
          : intent?.target
            ? dominantDirection(position, intent.target)
            : null,
        recentAttempt: rememberedIsCurrent && rememberedDirection !== null,
        progressTick: trafficProgressClock(transform, position, activeWorld.tick),
      });
    }
    snapshot.sort((left, right) => left.id - right.id);
    for (const unit of snapshot) snapshotById.set(unit.id, unit);
    snapshotTick = activeWorld.tick;
    return snapshot;
  }

  function narrowLaneAxis(
    unitId: number,
    current: Position,
    nextStep: Position,
    activeWorld: GameWorld,
  ): MovementLaneAxis | null {
    const direction = cardinalDirection(current, nextStep);
    if (!direction) return null;
    const hasBlockedFlanks = (cell: Position): boolean => {
      const flanks = direction.x !== 0
        ? [{ x: cell.x, y: cell.y - 1 }, { x: cell.x, y: cell.y + 1 }]
        : [{ x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y }];
      return flanks.every((flank) => (
        !isCellPassableForUnit(unitId, flank.x, flank.y, activeWorld)
      ));
    };
    // Checking both cells preserves a one-wide lane through a bend: the corner
    // itself has an open flank (the outgoing leg), while the incoming or
    // outgoing neighbour remains statically one cell wide.
    const isNarrow = hasBlockedFlanks(current) || hasBlockedFlanks(nextStep);
    if (!isNarrow) return null;
    return direction.x !== 0 ? 'horizontal' : 'vertical';
  }

  /**
   * Keeps the unit's starvation clock — the record `trafficProgressClock`
   * reads — so the election can find a unit that is waiting and not moving.
   *
   * The clock restarts on a cell change (progress) and when the unit resumes
   * asking after a gap (it was standing still by choice), and is seeded the
   * first time a unit is arbitrated so it starts from a known tick rather
   * than reading as infinitely old. Recording ADMISSIONS instead detected
   * nothing, and the reason is worth keeping straight: the arbiter is
   * consulted about once per unit per tick (~44 consults per tick across the
   * ~44 units then moving — an earlier note mislabelled that total as
   * per-unit), an admitted tick credits 0.32 fine units and a cell is 4, so a
   * villager frozen for 2,750 ticks that still collected sporadic admissions
   * (12 in 40 ticks — under one cell of movement) reset an admission clock
   * every time. Crossing a cell needs ~12.5 CONSECUTIVE admissions; only a
   * cell change proves the unit is getting somewhere.
   */
  function resolveMovementTraffic(
    unitId: number,
    nextStep: Position,
    activeWorld: GameWorld = world,
  ): MovementTrafficDecision {
    const transform = activeWorld.getComponent<UnitTransformComponent>(unitId, 'unitTransform');
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    if (transform && position) {
      const clock = trafficProgressClock(transform, position, activeWorld.tick) ?? activeWorld.tick;
      if (
        clock !== transform.trafficProgressTick
        || transform.trafficProgressCellX !== position.x
        || transform.trafficProgressCellY !== position.y
      ) {
        activeWorld.setComponent(unitId, 'unitTransform', {
          ...transform,
          trafficProgressTick: clock,
          trafficProgressCellX: position.x,
          trafficProgressCellY: position.y,
        });
      }
    }
    return resolveMovementTrafficInner(unitId, nextStep, activeWorld);
  }

  function resolveMovementTrafficInner(
    unitId: number,
    nextStep: Position,
    activeWorld: GameWorld = world,
  ): MovementTrafficDecision {
    const units = snapshotForTick(activeWorld);
    const mover = snapshotById.get(unitId);
    if (!mover) return { kind: 'proceed' };
    const direction = cardinalDirection(mover.position, nextStep);
    if (!direction) return { kind: 'proceed' };
    // Record the actual caller-selected leg even when its task became active
    // after this tick's snapshot. Later callers then see a stable reservation
    // instead of slipping through because their prior task state was idle.
    attemptedDirections.set(unitId, direction);
    const liveIntent = trafficIntentFor(unitId, activeWorld);
    const liveTransform = activeWorld.getComponent<UnitTransformComponent>(unitId, 'unitTransform');
    if (
      liveTransform
      && liveIntent
      && (
        liveTransform.trafficDirectionX !== direction.x
        || liveTransform.trafficDirectionY !== direction.y
        || liveTransform.trafficIntentKey !== liveIntent.key
        || liveTransform.trafficAttemptTick !== activeWorld.tick
      )
    ) {
      activeWorld.setComponent(unitId, 'unitTransform', {
        ...liveTransform,
        trafficDirectionX: direction.x,
        trafficDirectionY: direction.y,
        trafficIntentKey: liveIntent.key,
        trafficAttemptTick: activeWorld.tick,
      });
    }
    const laneAxis = narrowLaneAxis(unitId, mover.position, nextStep, activeWorld);
    if (!laneAxis) return { kind: 'proceed' };

    const trafficPeers = units.filter((unit) => (
      unit.id !== mover.id
      && unit.owner === mover.owner
      && (unit.activeIntent || attemptedDirections.has(unit.id))
    ));
    const directionFor = (unit: TrafficUnitSnapshot): Position | null => (
      attemptedDirections.get(unit.id) ?? unit.direction
    );
    const originKey = `${mover.owner}:${mover.position.x},${mover.position.y}`;
    const existingReservation = originReservations.get(originKey);
    if (existingReservation !== undefined && existingReservation !== mover.id) {
      return { kind: 'wait' };
    }
    const nextCellPeers = trafficPeers.filter((unit) => samePosition(unit.position, nextStep));
    if (nextCellPeers.length > 0) {
      const trafficUnits = [mover, ...trafficPeers];
      const nextFor = (unit: TrafficUnitSnapshot): Position | null => {
        if (
          unit.id !== mover.id
          && !attemptedDirections.has(unit.id)
          && !unit.recentAttempt
        ) {
          return null;
        }
        const unitDirection = unit.id === mover.id ? direction : directionFor(unit);
        return unitDirection
          ? { x: unit.position.x + unitDirection.x, y: unit.position.y + unitDirection.y }
          : null;
      };
      // Iterative closure (v0.3.160). The recursive version copied its
      // visited-Set per branch — combinatorial in ball size, profiled at
      // multi-second ticks with sixteen carriers sharing a door's cells. One
      // BFS over the wait-for graph closes the same set: every member of the
      // mover's reachable jam must itself be trying to move (a member with no
      // learned direction, or facing an empty cell, is not a closed jam — it
      // will move on its own, so the caller waits for it instead of pushing).
      const closeDependencies = (): ReadonlySet<number> | null => {
        const byCell = new Map<string, TrafficUnitSnapshot[]>();
        for (const unit of trafficUnits) {
          const key = `${unit.position.x},${unit.position.y}`;
          const cell = byCell.get(key);
          if (cell) cell.push(unit);
          else byCell.set(key, [unit]);
        }
        const closedIds = new Set<number>([mover.id]);
        const queue: TrafficUnitSnapshot[] = [mover];
        while (queue.length > 0) {
          const current = queue.pop()!;
          const currentNext = nextFor(current);
          if (!currentNext) return null;
          const occupants = byCell.get(`${currentNext.x},${currentNext.y}`);
          if (!occupants || occupants.length === 0) return null;
          for (const occupant of occupants) {
            if (closedIds.has(occupant.id)) continue;
            closedIds.add(occupant.id);
            queue.push(occupant);
          }
        }
        return closedIds;
      };
      const cycle = closeDependencies();
      // A normal occupied lane has no directed cycle, so its follower waits.
      // A fully learned head-on pair or longer occupied loop admits only the
      // stable lowest-id caller when every blocking branch closes back to it.
      // Clocks come from the snapshot like every other input. A member's own
      // consult re-stamps its record mid-tick, and reading that live made the
      // members that asked before it elect a different winner (review E2).
      const lastProgressTick = (id: number): number | undefined => snapshotById.get(id)?.progressTick;
      const election = cycle
        ? electTrafficWinnerDetailed(cycle, activeWorld.tick, lastProgressTick)
        : null;
      if (!election || mover.id !== election.winner) return { kind: 'wait' };
      if (election.starved) {
        onStarvationRelief?.({ unitId: mover.id, tick: activeWorld.tick, waited: election.waited });
      }
      // The election is final. It is the only rule here that weighs the whole
      // jam, and it names exactly one winner; the co-located rules below judge
      // a single cell and would veto that winner for standing behind a
      // better-placed neighbour — which is a deadlock, because the neighbour is
      // waiting on the election the winner just won. Two wood carriers and two
      // villagers sat one step from their lumber camp for ten thousand ticks
      // that way, with the AI's wood income stuck at seven.
      return { kind: 'proceed', laneAxis };
    }

    const coLocated = trafficPeers.filter((unit) => samePosition(unit.position, mover.position));
    const crossFlow = coLocated.filter((unit) => {
      const peerDirection = directionFor(unit);
      return peerDirection !== null
        && (peerDirection.x !== direction.x || peerDirection.y !== direction.y);
    });
    // Yielding is only meaningful to a peer that can actually take the turn it
    // is being given. Deferring to a co-located peer that is itself blocked
    // stalls both of them forever, which is how a villager with an empty cell
    // ahead of it stood still for the last ten thousand ticks of a match.
    const canTakeATurn = (unit: TrafficUnitSnapshot): boolean => {
      const unitDirection = directionFor(unit);
      if (!unitDirection) return false;
      const ahead = {
        x: unit.position.x + unitDirection.x,
        y: unit.position.y + unitDirection.y,
      };
      if (!isCellPassableForUnit(unit.id, ahead.x, ahead.y, activeWorld)) return false;
      return ![mover, ...trafficPeers].some((other) => (
        other.id !== unit.id && samePosition(other.position, ahead)
      ));
    };
    if (crossFlow.some((unit) => unit.id < mover.id && canTakeATurn(unit))) {
      return { kind: 'wait' };
    }
    const sameFlow = coLocated.filter((unit) => !crossFlow.includes(unit));
    const moverProjection = projection(mover, direction);
    const anotherHasPriority = sameFlow.some((unit) => {
      const otherProjection = projection(unit, direction);
      return otherProjection > moverProjection
        || (otherProjection === moverProjection && unit.id < mover.id);
    });
    if (anotherHasPriority) return { kind: 'wait' };
    originReservations.set(originKey, mover.id);
    return { kind: 'proceed', laneAxis };
  }

  return { resolveMovementTraffic };
}
