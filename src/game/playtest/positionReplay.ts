import type { Position, SessionBundle } from 'civ-engine';

type EntityId = number;

export interface PositionTimeline {
  // Map from entityId -> array of (tick, position) events ordered by tick.
  byEntity: Map<EntityId, Array<{ tick: number; pos: Position }>>;
  // Tick at which each entity's position component was removed (garrisoned,
  // destroyed, etc.). Absent = still active through bundle endTick.
  activeUntil: Map<EntityId, number>;
  // Closed position gaps per entity: [removed tick, next re-set tick). A
  // garrison round-trip leaves one gap; oracles must not treat the gap as
  // time the unit spent standing in the world (2026-07-10 review probe: a
  // 1400-tick garrison stay read as a 1650-tick pin). The final, still-open
  // gap (if any) is in activeUntil, not here.
  gaps: Map<EntityId, Array<{ from: number; to: number }>>;
}

export function reconstructPositions(bundle: SessionBundle): PositionTimeline {
  const byEntity = new Map<EntityId, Array<{ tick: number; pos: Position }>>();
  const activeUntil = new Map<EntityId, number>();
  const gaps = new Map<EntityId, Array<{ from: number; to: number }>>();

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
      // A re-set after removal reactivates the entity for oracle evaluation
      // and closes the open gap.
      const openGapStart = activeUntil.get(id);
      if (openGapStart !== undefined) {
        const list = gaps.get(id) ?? [];
        list.push({ from: openGapStart, to: tickEntry.tick });
        gaps.set(id, list);
        activeUntil.delete(id);
      }
    }
    for (const id of (positionDiff.removed ?? [])) {
      activeUntil.set(id, tickEntry.tick);
    }
  }

  return { byEntity, activeUntil, gaps };
}
