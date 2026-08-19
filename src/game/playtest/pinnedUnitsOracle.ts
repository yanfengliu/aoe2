// no-pinned-or-oscillating-units oracle. Position-only pinning produced 14
// false positives out of 16 findings in the 2026-07-09 canary-drill baseline
// (docs/debugging/2026-07-09-pinned-units-oracle.md), so the oracle
// evaluates:
//   - per unit-lifetime interval — entity ids are reused (a depleted berry
//     bush's id becomes a trained villager's), so a whole-bundle timeline
//     conflates a resource's stationary phase with the unit's. A unit.set
//     that changes owner or unitType on an OPEN interval is also a lifetime
//     boundary: the engine nets a same-tick kill + reuse into a pure set
//     with no removal (ComponentStore.set clears the removed mark);
//   - per position-presence segment — a garrison round-trip removes and
//     later re-sets the position component, and the gap must not count as
//     time spent standing in the world;
//   - only units of DRIVEN owners — an owner with an AI state in any
//     snapshot, a market.action it issued, or a recorded command whose
//     explicit ACTOR key resolves to one of its entities. An inert player's
//     idle units are correct behavior, not pinning;
//   - TWO confinement boxes over the same scan: a unit is PINNED when it
//     stays inside a tight box (pinnedNetProgressCells) for
//     >= pinnedStuckTicks, frozen or churning in place alike; a unit is
//     OSCILLATING when it keeps moving in legs big enough to re-anchor the
//     tight box but stays inside the wider pinnedOscillationBoxCells box for
//     >= pinnedStuckTicks (escape-heading ping-pong, re-target flapping).
//     Working gatherers are exempt while snapshot task samples keep the
//     stuck-suffix fresh: the span is excused only if its LATEST interior
//     'gathering' sample is younger than pinnedStuckTicks (a stale sample
//     must not excuse a later freeze); bounding snapshots are consulted only
//     when the span contains no interior sample at all. A unit frozen in
//     'to-resource'/'idle' still fires — the movement-freeze canary class.

import type { Position, SessionBundle } from 'civ-engine';
import type { GameCommands } from '../simulation/commands';
import type { GatherTaskState } from '../simulation/types';
import type { OracleEnvelope, OracleThresholds, OracleViolation } from './types';
import { reconstructPositions } from './positionReplay';

interface UnitInterval {
  owner: number;
  unitType: string;
  from: number;
  // Tick at which the unit component was removed (or replaced by a new
  // lifetime); null while the interval is still open at bundle end.
  to: number | null;
}

interface SnapshotEntry {
  tick: number;
  components: Record<string, unknown> | undefined;
  state: Record<string, unknown> | undefined;
}

interface ComponentDiff {
  set?: Array<[number, unknown]>;
  removed?: number[];
}

function componentDiff(tickEntry: SessionBundle['ticks'][number], name: string): ComponentDiff | undefined {
  return (tickEntry.diff.components as Record<string, unknown> | undefined)?.[name] as
    | ComponentDiff
    | undefined;
}

// Unit-component lifetime intervals per entity id. A unit.set with the SAME
// owner and unitType onto an open interval is a value replace (hp change,
// stance) and keeps the interval continuous; a set that changes owner or
// unitType is a lifetime boundary (same-tick kill + id reuse nets into a
// pure set — 2026-07-10 review probe — and a conversion/upgrade should reset
// the confinement clock anyway); a set after a removal opens a new interval.
export function collectUnitIntervals(bundle: SessionBundle): Map<number, UnitInterval[]> {
  const intervals = new Map<number, UnitInterval[]>();
  const startTick = bundle.metadata.startTick;
  const open = (id: number, owner: number, unitType: string, from: number): void => {
    const list = intervals.get(id) ?? [];
    const last = list[list.length - 1];
    if (last && last.to === null) {
      if (last.owner === owner && last.unitType === unitType) return;
      last.to = from;
    }
    list.push({ owner, unitType, from, to: null });
    intervals.set(id, list);
  };

  const initialUnits = (bundle.initialSnapshot as { components?: Record<string, unknown> })
    .components?.unit;
  if (Array.isArray(initialUnits)) {
    for (const [id, value] of initialUnits as Array<[number, { owner?: number; unitType?: string }]>) {
      open(id, value?.owner ?? -1, value?.unitType ?? '', startTick);
    }
  }
  for (const tickEntry of bundle.ticks) {
    const diff = componentDiff(tickEntry, 'unit');
    if (!diff) continue;
    for (const [id, value] of diff.set ?? []) {
      const unit = value as { owner?: number; unitType?: string };
      open(id, unit?.owner ?? -1, unit?.unitType ?? '', tickEntry.tick);
    }
    for (const id of diff.removed ?? []) {
      const list = intervals.get(id);
      const last = list?.[list.length - 1];
      if (last && last.to === null) last.to = tickEntry.tick;
    }
  }
  return intervals;
}

function snapshotEntries(bundle: SessionBundle): SnapshotEntry[] {
  const raw = (bundle as unknown as { snapshots?: Array<{ tick: number; snapshot?: Record<string, unknown> }> })
    .snapshots ?? [];
  return raw
    .map((entry) => ({
      tick: entry.tick,
      components: entry.snapshot?.components as Record<string, unknown> | undefined,
      state: entry.snapshot?.state as Record<string, unknown> | undefined,
    }))
    .sort((a, b) => a.tick - b.tick);
}

function aiOwnersFromState(state: Record<string, unknown> | undefined, into: Set<number>): void {
  const entries = state?.['aoe2.aiStates'];
  if (!Array.isArray(entries)) return;
  for (const entry of entries as Array<[number, unknown]>) {
    if (Array.isArray(entry) && typeof entry[0] === 'number') into.add(entry[0]);
  }
}

// Explicit ACTOR-entity keys per command type. Typed over the full 16-type
// command surface so adding a command type fails typecheck here until it is
// classified. A suffix heuristic (endsWith 'Id') mis-resolved
// unit.gather.resourceId — a TARGET resource; farms are building+resource
// hybrids whose building owner would leak drivenness onto the farm's
// builder — and market.action.playerId, which is an OWNER number, not an
// entity id (2026-07-10 review probe). unit.attack is intentionally empty:
// the auto-aggression system issues it on behalf of ANY owner's attacked
// units, and retaliation is not being driven. unit.move/unitIds covers the
// batched multi-unit shape recorded by driver harnesses.
const COMMAND_ACTOR_KEYS: { [K in keyof GameCommands]: readonly string[] } = {
  'unit.move': ['unitId', 'unitIds'],
  'unit.attack': [],
  'unit.gather': ['unitId', 'unitIds'],
  // A stance order is a real player instruction addressed at named units, so
  // it counts as driving them.
  'unit.stance': ['unitIds'],
  // An attack-move is a direct order at a named unit.
  'unit.attackMove': ['unitId'],
  // unit.autoGather is SYSTEM-issued at Mining Camp completion (spec §6.2) on
  // behalf of any owner — like unit.attack's auto-aggression, it is not
  // evidence that the owner is driving units, so it carries no actor keys.
  'unit.autoGather': [],
  'unit.context': ['unitId', 'unitIds'],
  'unit.contextAtEntity': ['unitId', 'unitIds'],
  'sheep.move': ['sheepId'],
  'monk.contextAtEntity': ['unitId'],
  'trebuchet.pack': ['unitId'],
  'trebuchet.unpack': ['unitId'],
  'queue.train': ['buildingId'],
  'queue.research': ['buildingId'],
  'market.action': [],
  'building.placeConfirm': ['builderId', 'additionalBuilderIds'],
  'building.setRallyPoint': ['buildingId'],
  'building.action': ['buildingId'],
};

// Owners that actually drive units this run: an AI state in any snapshot, a
// market.action they issued (playerId IS the owner), or a recorded command
// whose actor key resolves to one of the owner's entities. Actor references
// resolve to the entity's owner AT THE COMMAND'S TICK — entity ids are
// reused, so a lifetime-union would leak drivenness onto a dead unit's
// previous owner (observed on the canary bundle). Everything the gate needs
// is inside the bundle, so verification stays mechanical and replayable.
export function collectDrivenOwners(
  bundle: SessionBundle,
  intervals: Map<number, UnitInterval[]>,
  snapshots: SnapshotEntry[],
): Set<number> {
  const driven = new Set<number>();
  aiOwnersFromState(
    (bundle.initialSnapshot as { state?: Record<string, unknown> }).state,
    driven,
  );
  for (const snap of snapshots) aiOwnersFromState(snap.state, driven);

  // Entity -> ordered (tick, owner) events for time-aware command
  // resolution: units (interval starts) plus buildings (initial + diffs) —
  // commands mostly reference buildings (train/research) and unit ids
  // (move/gather).
  const ownerEvents = new Map<number, Array<{ tick: number; owner: number }>>();
  const addOwnerEvent = (id: number, tick: number, owner: number | undefined): void => {
    if (typeof owner !== 'number') return;
    const list = ownerEvents.get(id) ?? [];
    list.push({ tick, owner });
    ownerEvents.set(id, list);
  };
  for (const [id, list] of intervals) {
    for (const interval of list) addOwnerEvent(id, interval.from, interval.owner);
  }
  const startTick = bundle.metadata.startTick;
  const initialBuildings = (bundle.initialSnapshot as { components?: Record<string, unknown> })
    .components?.building;
  if (Array.isArray(initialBuildings)) {
    for (const [id, value] of initialBuildings as Array<[number, { owner?: number }]>) {
      addOwnerEvent(id, startTick, value?.owner);
    }
  }
  for (const tickEntry of bundle.ticks) {
    const diff = componentDiff(tickEntry, 'building');
    if (!diff) continue;
    for (const [id, value] of diff.set ?? []) {
      addOwnerEvent(id, tickEntry.tick, (value as { owner?: number })?.owner);
    }
  }
  for (const list of ownerEvents.values()) list.sort((a, b) => a.tick - b.tick);

  const commands = (bundle as unknown as {
    commands?: Array<{ type?: string; submissionTick?: number; data?: unknown }>;
  }).commands ?? [];
  for (const command of commands) {
    const data = command.data;
    if (data === null || typeof data !== 'object') continue;
    if (command.type === 'market.action') {
      const playerId = (data as { playerId?: unknown }).playerId;
      if (typeof playerId === 'number') driven.add(playerId);
      continue;
    }
    const actorKeys = COMMAND_ACTOR_KEYS[command.type as keyof GameCommands];
    if (!actorKeys || actorKeys.length === 0) continue;
    const commandTick = command.submissionTick ?? startTick;
    const resolve = (id: unknown): void => {
      if (typeof id !== 'number') return;
      const events = ownerEvents.get(id);
      if (!events) return;
      let owner: number | null = null;
      for (const event of events) {
        if (event.tick > commandTick) break;
        owner = event.owner;
      }
      if (owner !== null) driven.add(owner);
    };
    for (const key of actorKeys) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) value.forEach(resolve);
      else resolve(value);
    }
  }
  return driven;
}

function gathererTaskAt(snapshot: SnapshotEntry, entity: number): GatherTaskState | null {
  const gatherers = snapshot.components?.gatherer;
  if (!Array.isArray(gatherers)) return null;
  for (const entry of gatherers as Array<[number, { task?: GatherTaskState }]>) {
    if (Array.isArray(entry) && entry[0] === entity) return entry[1]?.task ?? null;
  }
  return null;
}

// Is the confined span [fromTick, toTick] explained by active gathering?
// The LATEST interior 'gathering' sample re-anchors the stuck clock: the
// span is exempt only while toTick - latestGatheringTick < stuckTicks, so a
// stale sample cannot excuse a later freeze (2026-07-10 review probe P1) and
// a healthy loop's duty-cycle sampling (walk legs at some snapshots) stays
// quiet as long as gathering evidence keeps refreshing. Bounding snapshots
// (nearest at-or-before / after) are fuzzy evidence consulted ONLY when the
// span contains no interior sample at all (probe P2) — under default
// thresholds a qualifying span always spans a snapshot cadence, so the
// fallback matters only for custom thresholds. No snapshots -> not exempt.
export function isActivelyGatheringSpan(
  snapshots: SnapshotEntry[],
  entity: number,
  fromTick: number,
  toTick: number,
  stuckTicks: number,
): boolean {
  const interior = snapshots.filter((s) => s.tick > fromTick && s.tick <= toTick);
  if (interior.length === 0) {
    const before = [...snapshots].reverse().find((s) => s.tick <= fromTick);
    const after = snapshots.find((s) => s.tick > toTick);
    return [before, after].some(
      (s) => s !== undefined && gathererTaskAt(s, entity) === 'gathering',
    );
  }
  let latestGathering: number | null = null;
  for (const snap of interior) {
    if (gathererTaskAt(snap, entity) === 'gathering') latestGathering = snap.tick;
  }
  if (latestGathering === null) return false;
  return toTick - latestGathering < stuckTicks;
}

const manhattan = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

interface PositionEvent {
  tick: number;
  pos: Position;
}

interface EventSegment {
  events: PositionEvent[];
  end: number;
}

// Split an interval's events into position-presence segments at garrison
// gaps: a span must never straddle a stretch where the unit had no world
// position. Each segment before a gap ends at the gap's removal tick; the
// re-set event opens the next segment.
function splitAtGaps(
  events: PositionEvent[],
  gaps: Array<{ from: number; to: number }>,
  intervalFrom: number,
  intervalEnd: number,
): EventSegment[] {
  const relevant = gaps
    .filter((gap) => gap.from >= intervalFrom && gap.to <= intervalEnd)
    .sort((a, b) => a.from - b.from);
  const segments: EventSegment[] = [];
  let remaining = events;
  for (const gap of relevant) {
    const inSegment = remaining.filter((e) => e.tick < gap.to);
    remaining = remaining.filter((e) => e.tick >= gap.to);
    if (inSegment.length > 0) segments.push({ events: inSegment, end: gap.from });
  }
  if (remaining.length > 0) segments.push({ events: remaining, end: intervalEnd });
  return segments;
}

export function noPinnedOrOscillatingUnits(
  bundle: SessionBundle,
  _envelope: OracleEnvelope,
  thresholds: Required<OracleThresholds>,
): OracleViolation[] {
  const violations: OracleViolation[] = [];
  const timeline = reconstructPositions(bundle);
  const intervals = collectUnitIntervals(bundle);
  const snapshots = snapshotEntries(bundle);
  const driven = collectDrivenOwners(bundle, intervals, snapshots);
  const endTick = bundle.metadata.endTick ?? bundle.metadata.startTick;
  const stuckTicks = thresholds.pinnedStuckTicks;
  // Tight box first (the stronger verdict), wide box only if tight stayed
  // quiet for the interval — a frozen unit is pinned, not oscillating.
  const boxes = [
    { radius: thresholds.pinnedNetProgressCells, kind: 'pinned' as const },
    { radius: thresholds.pinnedOscillationBoxCells, kind: 'oscillating' as const },
  ];

  for (const [entity, unitIntervals] of intervals) {
    const events = timeline.byEntity.get(entity) ?? [];
    const gaps = timeline.gaps.get(entity) ?? [];
    // Position-removal tick applies to the currently-open interval only;
    // closed intervals are already bounded by their unit-removed tick.
    const positionUntil = timeline.activeUntil.get(entity) ?? endTick;

    for (const interval of unitIntervals) {
      if (!driven.has(interval.owner)) continue;
      const intervalEnd = Math.min(interval.to ?? endTick, positionUntil, endTick);
      const intervalEvents = events.filter(
        (e) => e.tick >= interval.from && e.tick <= intervalEnd,
      );
      if (intervalEvents.length === 0) continue;
      const segments = splitAtGaps(intervalEvents, gaps, interval.from, intervalEnd);

      // Confinement scan: anchor at an event; the span extends while every
      // later event stays strictly inside the box; an event at or past the
      // radius closes the span (checked, then re-anchors there). The final
      // span extends to the segment end (frozen units have a single anchor
      // and no breaks).
      const scan = (segment: EventSegment, radius: number, kind: 'pinned' | 'oscillating'): boolean => {
        let anchor = segment.events[0]!;
        let movesInSpan = 0;
        const fireIfConfined = (spanEnd: number): boolean => {
          const span = spanEnd - anchor.tick;
          if (span < stuckTicks) return false;
          if (isActivelyGatheringSpan(snapshots, entity, anchor.tick, spanEnd, stuckTicks)) {
            return false;
          }
          const where = `(${anchor.pos.x}, ${anchor.pos.y})`;
          violations.push({
            oracle: 'no-pinned-or-oscillating-units',
            severity: 'medium',
            tick: anchor.tick,
            message: kind === 'oscillating'
              ? `unit ${entity} oscillated within ${radius - 1} cells of ${where}`
                + ` for ${span} ticks after tick ${anchor.tick} (${movesInSpan} moves inside the box)`
              : movesInSpan === 0
                ? `unit ${entity} stayed at ${where} for ${span} ticks after tick ${anchor.tick}`
                : `unit ${entity} stayed within ${radius - 1} cells of ${where}`
                  + ` for ${span} ticks after tick ${anchor.tick} (${movesInSpan} moves inside the box)`,
            details: {
              entity,
              sinceTick: anchor.tick,
              durationTicks: span,
              position: anchor.pos,
              movesInSpan,
            },
          });
          return true;
        };

        for (let i = 1; i < segment.events.length; i++) {
          const event = segment.events[i]!;
          if (manhattan(anchor.pos, event.pos) >= radius) {
            if (fireIfConfined(event.tick)) return true;
            anchor = event;
            movesInSpan = 0;
          } else {
            movesInSpan += 1;
          }
        }
        return fireIfConfined(segment.end);
      };

      let fired = false;
      for (const box of boxes) {
        for (const segment of segments) {
          if (scan(segment, box.radius, box.kind)) {
            fired = true;
            break;
          }
        }
        if (fired) break;
      }
    }
  }
  return violations;
}
