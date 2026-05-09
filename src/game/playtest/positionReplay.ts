import type { Position, SessionBundle } from 'civ-engine';

type EntityId = number;

export interface PositionTimeline {
  // Map from entityId -> array of (tick, position) events ordered by tick.
  byEntity: Map<EntityId, Array<{ tick: number; pos: Position }>>;
}

export function reconstructPositions(bundle: SessionBundle): PositionTimeline {
  const byEntity = new Map<EntityId, Array<{ tick: number; pos: Position }>>();

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

  // Apply tick diffs.
  for (const tickEntry of bundle.ticks) {
    const positionDiff = (tickEntry.diff.components as Record<string, unknown>)?.position as
      | { set?: Array<[EntityId, Position]>; removed?: EntityId[] }
      | undefined;
    if (!positionDiff) continue;
    for (const [id, pos] of (positionDiff.set ?? [])) {
      const arr = byEntity.get(id) ?? [];
      arr.push({ tick: tickEntry.tick, pos });
      byEntity.set(id, arr);
    }
    for (const id of (positionDiff.removed ?? [])) {
      byEntity.delete(id);
    }
  }

  return { byEntity };
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
