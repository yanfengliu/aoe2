import type { Position, SessionBundle } from 'civ-engine';

type EntityId = number;

export interface PositionTimeline {
  // Map from entityId -> array of (tick, position) events ordered by tick.
  byEntity: Map<EntityId, Array<{ tick: number; pos: Position }>>;
  // Tick at which each entity's position component was removed (garrisoned,
  // destroyed, etc.). Absent = still active through bundle endTick.
  activeUntil: Map<EntityId, number>;
}

export function reconstructPositions(bundle: SessionBundle): PositionTimeline {
  const byEntity = new Map<EntityId, Array<{ tick: number; pos: Position }>>();
  const activeUntil = new Map<EntityId, number>();

  // Seed from initial snapshot. WorldSnapshot.components is shaped as
  // Record<string, Array<[EntityId, T]>> (per civ-engine serializer.d.ts:66),
  // distinct from TickDiff.components which uses { set, removed }.
  const initialPositions = (bundle.initialSnapshot as { components?: Record<string, unknown> })
    .components?.position;
  if (Array.isArray(initialPositions)) {
    for (const entry of initialPositions as Array<[EntityId, Position]>) {
      byEntity.set(entry[0], [{ tick: bundle.metadata.startTick, pos: entry[1] }]);
    }
  }

  // Apply tick diffs. position.removed marks the END of an entity's visible-
  // position window (e.g., garrison removes the position component; entity
  // destruction removes everything). We preserve the timeline of past events
  // so oracles can still evaluate windows that closed before the removal,
  // but record the removal tick in activeUntil so post-removal stretches are
  // not treated as "the unit was pinned in the world."
  for (const tickEntry of bundle.ticks) {
    const positionDiff = (tickEntry.diff.components as Record<string, unknown>)?.position as
      | { set?: Array<[EntityId, Position]>; removed?: EntityId[] }
      | undefined;
    if (!positionDiff) continue;
    for (const [id, pos] of (positionDiff.set ?? [])) {
      const arr = byEntity.get(id) ?? [];
      arr.push({ tick: tickEntry.tick, pos });
      byEntity.set(id, arr);
      // A re-set after removal reactivates the entity for oracle evaluation.
      activeUntil.delete(id);
    }
    for (const id of (positionDiff.removed ?? [])) {
      activeUntil.set(id, tickEntry.tick);
    }
  }

  return { byEntity, activeUntil };
}

export function netManhattanProgress(
  events: Array<{ tick: number; pos: Position }>,
  windowStart: number,
  windowEnd: number,
): number {
  const inWindow = events.filter((e) => e.tick >= windowStart && e.tick <= windowEnd);
  if (inWindow.length < 2) return 0;
  const first = inWindow[0]!.pos;
  const last = inWindow[inWindow.length - 1]!.pos;
  return Math.abs(last.x - first.x) + Math.abs(last.y - first.y);
}
