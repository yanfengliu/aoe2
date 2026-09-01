// Local traffic arbitration for narrow passages. Global A* deliberately sees
// only durable topology (terrain, resources, and buildings); this layer keeps
// active friendly movers from using subcell slots to pass each other in
// a one-cell choke. Decisions are derived from a tick-start snapshot so ECS
// iteration order cannot decide who gets to enter first.

import type { Position } from 'civ-engine';

import type { GathererComponent, UnitComponent, UnitTransformComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { monkTasksCodec, unitCommandsCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

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

/**
 * Elects the single unit admitted from a closed jam.
 *
 * Two properties are load-bearing and a replacement must keep both. It is a
 * pure function of the jam's ids and the tick, so ECS iteration order cannot
 * decide who enters first (the reason the original rule was a stable
 * lowest-id). And every member of one closure must elect the SAME winner, or
 * two units drive into one cell.
 */
/**
 * Ticks a unit may sit in a contested passage before the election prefers it
 * over the standing lowest-id winner.
 *
 * Chosen against measurement, not taste. Across six seeds the healthy maps
 * never hold a walking villager still for more than 500 ticks, while the
 * pathological ones reached 1,250-5,250. A threshold of 750 is above every
 * healthy figure and below every pathological one, so maps that do not
 * starve keep their exact previous behaviour.
 */
const TRAFFIC_STARVATION_TICKS = 750;

/**
 * Elects the single unit admitted from a closed jam.
 *
 * Two properties are load-bearing. It is a pure function of the jam, the tick
 * and each member's last admission, so ECS iteration order cannot decide who
 * enters first (the reason the original rule was a stable lowest-id). And
 * every member of one closure must elect the SAME winner, or two units drive
 * into one cell.
 *
 * The shipped rule was `Math.min(...cycle)` alone, which is stable but unfair:
 * it admits only the lowest id, so in a continuously-replenished jam the high
 * ids are never admitted at all. Measured on `seed-2` — eleven villagers
 * head-on in a one-tile choke — admission was monotonic in id from 88% down to
 * 0.6%, and five villagers stood still for up to 2,750 ticks.
 *
 * Lowest-id is KEPT as the ordinary rule, because replacing it outright
 * regressed the boot map from zero stuck villagers to five. It yields only to
 * a member that has actually starved past TRAFFIC_STARVATION_TICKS, which is a
 * state healthy maps never reach.
 */
export function electTrafficWinner(
  cycle: Iterable<number>,
  tick: number,
  lastProgressTick: (id: number) => number | undefined,
): number {
  const ids = [...cycle].sort((left, right) => left - right);
  if (ids.length === 0) return -1;
  if (ids.length === 1) return ids[0]!;
  let starved = -1;
  let longestWait = TRAFFIC_STARVATION_TICKS;
  for (const id of ids) {
    const since = lastProgressTick(id);
    // A unit with no record has never been arbitrated; it is not starving.
    if (since === undefined) continue;
    const waited = tick - since;
    // Strictly greater keeps the winner stable when two units tie: the sorted
    // scan reaches the lower id first and later ties do not displace it.
    if (waited > longestWait) {
      longestWait = waited;
      starved = id;
    }
  }
  return starved === -1 ? ids[0]! : starved;
}

export function createMovementTrafficOps(deps: MovementTrafficOpsDeps): {
  resolveMovementTraffic(
    unitId: number,
    nextStep: Position,
    activeWorld?: GameWorld,
  ): MovementTrafficDecision;
} {
  const { world, accessor, isCellPassableForUnit } = deps;
  let snapshotTick: number | null = null;
  let snapshot: TrafficUnitSnapshot[] = [];
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
      });
    }
    snapshot.sort((left, right) => left.id - right.id);
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
   * Records PROGRESS — the last tick this unit changed cell — so the election
   * can find a unit that is not moving.
   *
   * Recording admissions instead detected nothing, and the reason is worth
   * keeping: the arbiter is consulted ~44 times per unit per tick, so a
   * villager frozen for 2,750 ticks still collected sporadic admissions (12 in
   * 40 ticks) that reset an admission clock. Crossing a cell needs ~3.2
   * CONSECUTIVE admissions, so occasional permission buys no movement. Only
   * cell change proves the unit is actually getting somewhere.
   */
  function resolveMovementTraffic(
    unitId: number,
    nextStep: Position,
    activeWorld: GameWorld = world,
  ): MovementTrafficDecision {
    const transform = activeWorld.getComponent<UnitTransformComponent>(unitId, 'unitTransform');
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    if (transform && position) {
      const moved = transform.trafficProgressCellX !== position.x
        || transform.trafficProgressCellY !== position.y;
      // Stamp on a real cell change, and seed a baseline the first time a unit
      // is arbitrated so its clock starts running from a known tick rather
      // than reading as infinitely old.
      if (moved || transform.trafficProgressTick === undefined) {
        activeWorld.setComponent(unitId, 'unitTransform', {
          ...transform,
          trafficProgressTick: activeWorld.tick,
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
    const mover = units.find((unit) => unit.id === unitId);
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
      const lastProgressTick = (id: number): number | undefined => (
        activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform')?.trafficProgressTick
      );
      if (!cycle || mover.id !== electTrafficWinner(cycle, activeWorld.tick, lastProgressTick)) {
        return { kind: 'wait' };
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
