### 5.1 Bridge state migration — per-slot JsonValue serializers + `BridgeStateAccessor`

`Map`/`Set` instances are NOT directly storable in `world.state` (rejected by `assertJsonCompatible`). Each Tier-1 slot has a **per-slot serializer pair** (`serialize: native → JsonValue`, `deserialize: JsonValue → native`) registered in a dispatch table. The serializers mirror the existing `SerializedSideMaps` shape (so schema-1 SaveBlobs and schema-2 `world.state.aoe2.*` use the same JSON format).

```ts
// src/game/simulation/bridge/bridgeStateSerialize.ts
export interface SlotCodec<TNative, TJson> {
  readonly slot: string;             // 'aoe2.combatStates' etc.
  serialize(native: TNative): TJson; // native → JsonValue-compatible
  deserialize(json: TJson | undefined): TNative; // JsonValue → native; undefined → fresh empty
}

// Examples (full table covers all 35 Tier-1 slots):

// Flat entity-keyed Map: combatStates, buildingHealthStates, etc.
export const combatStatesCodec: SlotCodec<Map<number, CombatState>, Array<[number, CombatState]>> = {
  slot: 'aoe2.combatStates',
  serialize: (m) => Array.from(m),                 // Map → Array<[K, V]>
  deserialize: (j) => new Map(j ?? []),
};

// Map<K, Set<V>>: researchedTechnologies — Set must become array
export const researchedTechnologiesCodec: SlotCodec<
  Map<number, Set<ResearchableTechnologyType>>,
  Array<[number, ResearchableTechnologyType[]]>
> = {
  slot: 'aoe2.researchedTechnologies',
  serialize: (m) => Array.from(m).map(([k, set]) => [k, Array.from(set)]),
  deserialize: (j) => new Map((j ?? []).map(([k, arr]) => [k, new Set(arr)])),
};

// Map<K, Map<K2, V>>: lastSeenStatic (per-player fog memory)
export const lastSeenStaticCodec: SlotCodec<
  Map<number, Map<number, MemoryEntry>>,
  Array<[number, Array<[number, MemoryEntry]>]>
> = {
  slot: 'aoe2.lastSeenStatic',
  serialize: (m) => Array.from(m).map(([k, inner]) => [k, Array.from(inner)]),
  deserialize: (j) => new Map((j ?? []).map(([k, arr]) => [k, new Map(arr)])),
};

// Plain object slot: marketExchangeRates is already JsonValue-compatible
export const marketExchangeRatesCodec: SlotCodec<
  { food: number; wood: number; stone: number },
  { food: number; wood: number; stone: number }
> = {
  slot: 'aoe2.marketExchangeRates',
  serialize: (o) => ({ ...o }),
  deserialize: (j) => j ?? { food: 1, wood: 1, stone: 1 },
};

// Registry of all 35 Tier-1 codecs:
export const TIER_1_CODECS: ReadonlyArray<SlotCodec<unknown, unknown>> = [
  combatStatesCodec,
  buildingHealthStatesCodec,
  buildingCombatStatesCodec,
  wildlifeStatesCodec,
  conversionStateCodec,
  // ... 30 more ...
] as const;
```

`BridgeStateAccessor` provides the per-tick cache layer:

```ts
// src/game/simulation/bridge/bridgeStateAccessor.ts
import type { World } from 'civ-engine';

export class BridgeStateAccessor {
  // Lazy world getter — sidesteps the construction-order chicken-and-egg
  // (createWorldSkeleton needs the accessor to register bridgeSnapshotSystem;
  // the accessor needs the world reference). The getter is supplied by the
  // bridge construction code AFTER world creation. Premature calls produce
  // an explicit domain error (NOT an implicit `undefined.getState` TypeError),
  // so accidental misuse during registration fails loudly.
  private readonly _getWorld: () => World<...> | undefined;
  private readonly _cache = new Map<string, unknown>();
  private readonly _dirty = new Set<string>();

  constructor(getWorld: () => World<...> | undefined) {
    this._getWorld = getWorld;
  }

  private requireWorld(): World<...> {
    const w = this._getWorld();
    if (w === undefined) throw new Error('BridgeStateAccessor used before world bound');
    return w;
  }

  /** Lazy-materialize from world.state via the slot's codec. Subsequent reads
   *  in the same tick return the same cached value (reference stability is
   *  the cache-coherence invariant). */
  get<TNative, TJson>(codec: SlotCodec<TNative, TJson>): TNative {
    if (!this._cache.has(codec.slot)) {
      const json = this.requireWorld().getState(codec.slot) as TJson | undefined;
      this._cache.set(codec.slot, codec.deserialize(json));
    }
    return this._cache.get(codec.slot) as TNative;
  }

  /** Mark a slot dirty after mutation. Cheap. */
  markDirty(slot: string): void {
    this._dirty.add(slot);
  }

  /** Tick-end (or pre-saveGame): serialize dirty caches back to world.state via codecs.
   *  Called by `bridgeSnapshotSystem` and by `saveGameOps.saveGame()` (per ADR 5). */
  flush(): void {
    if (this._dirty.size === 0) return;
    const w = this.requireWorld();
    for (const slot of this._dirty) {
      const codec = SLOT_CODECS_BY_KEY.get(slot);
      if (codec === undefined) continue;
      const native = this._cache.get(slot);
      if (native === undefined) continue;
      w.setState(codec.slot, codec.serialize(native));
    }
    this._dirty.clear();
  }

  /** After applySnapshot / enterReplay / exitReplay: drop caches.
   *  Next read re-materializes from world.state via codec.deserialize. */
  reset(): void {
    this._cache.clear();
    this._dirty.clear();
  }
}
```

Ops modules read/mutate via the accessor + codec:

```ts
// Before:
const states = bridge.combatStates;
states.set(unitId, newCombatState);

// After:
import { combatStatesCodec } from './bridgeStateSerialize';
const states = accessor.get(combatStatesCodec);
states.set(unitId, newCombatState);
accessor.markDirty(combatStatesCodec.slot);
```

A `mutate` helper wraps the markDirty pattern:
```ts
function mutate<T>(
  accessor: BridgeStateAccessor,
  codec: SlotCodec<T, unknown>,
  fn: (native: T) => void,
): void {
  fn(accessor.get(codec));
  accessor.markDirty(codec.slot);
}

// Use:
mutate(accessor, combatStatesCodec, (m) => m.set(unitId, newState));
```

**Cache-coherence invariant** (per Claude M2 in iter-1):
- Single accessor instance per bridge.
- All ops modules within a tick read through the same accessor → same Map reference → mutations are visible.
- `accessor.reset()` is called on: `applySnapshot()`, `enterReplay()`, `exitReplay()`. NOT at tick start (the cache is intentionally tick-spanning; only mutated slots flush to world.state, unchanged slots stay cached).
- After `bridgeSnapshotSystem.flush()` runs, the cache is NOT cleared — `_dirty` is cleared, but cached values remain valid for the next tick.

**Invalidation events** (when `accessor.reset()` is called):
- After every `world.applySnapshot(...)` (via a dedicated reset hook in `world.ts`'s `setSetupComplete` path is brittle — instead aoe2 manages this from `hydrateFromSavedGame` and `makeReplayBridge`)
- On `enterReplay` / `exitReplay` (because the bridge is rebuilt)
- Optionally at tick-start, but unnecessary if we trust that ops modules don't capture stale Map refs across ticks (verified by tests)

### 5.2 Output-phase tail: `tier3SyncSystem` then `bridgeSnapshotSystem`

The output-phase tail has TWO systems running in fixed order: `tier3SyncSystem` (writes mutable Tier-3 state — `VisibilityMap`, `MatchState`, `bridgeMeta` — to `world.state.aoe2.*`) followed by `bridgeSnapshotSystem` (flushes the Tier-1 codec table). Both must run last so that `world.serialize()` (fired by recorder via `world.ts:1746-1763`'s diff-listener) sees current values.

**Registration site:** these two systems are NOT registered by `createWorldSkeleton` (which registers only ECS components). They are registered at the TAIL of `wireBridgeOps` after `registerBridgeSystems` (which registers all gameplay systems). Reasoning: gameplay system registration sequence is unchanged (`registerBridgeSystems.ts` paths intact); the tail is appended via a new `registerOutputTail(world, accessor, visibilityCell, matchState)` helper called as the last action in `wireBridgeOps` before scenario seeding completes.

```ts
// src/game/simulation/bridge/tier3SyncSystem.ts (NEW in v8 — closes Claude iter-7 MAJOR)
import type { SystemRegistration } from 'civ-engine';

/** Factory captures the visibility cell + matchState references in the
 *  execute closure. Per-tick this system writes the live mutable state
 *  back into world.state.aoe2.* so the recorder's snapshot sees current
 *  values. Visibility writes are gated by the cell's dirty bit (v9) —
 *  visibility-mutating ops modules must call `cell.markDirty()` after
 *  any setSource/removeSource/clearPlayer (mirrors the Tier-1 dirty-mark
 *  pattern from BridgeStateAccessor). matchState writes are unconditional
 *  since the object is small + flat. */
export function makeTier3SyncSystem(
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): SystemRegistration<...> {
  return {
    name: 'tier3Sync',
    phase: 'output',
    execute: (world) => {
      if (visibilityCell.isDirty()) {
        world.setState('aoe2.visibility', visibilityCell.get().getState());
        visibilityCell.clearDirty();
      }
      world.setState('aoe2.matchState', serializeMatchState(matchState));
      // aoe2.bridgeMeta is set once at game start in bootstrapFlush and not
      // mutated per-tick; no need to re-sync (would be a no-op fingerprint
      // miss anyway since the value is identical, but skipping the
      // assertJsonCompatible call avoids wasted work).
    },
  };
}

// src/game/simulation/bridge/bridgeSnapshotSystem.ts
/** Flushes the Tier-1 codec table — only writes slots marked dirty
 *  via accessor.markDirty(). Tier-3 sync runs in tier3SyncSystem above,
 *  registered immediately before this one. */
export function makeBridgeSnapshotSystem(
  accessor: BridgeStateAccessor,
): SystemRegistration<...> {
  return {
    name: 'bridgeSnapshot',
    phase: 'output',
    execute: (_world) => {
      accessor.flush();
    },
  };
}

// src/game/simulation/bridge/registerOutputTail.ts (NEW in v9; v10 — uses correct API)
/** Tail-registration helper called at end of wireBridgeOps and wireReplaySystems.
 *  The order here is the source of truth: tier3Sync first, bridgeSnapshot last. */
export function registerOutputTail(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): void {
  world.registerSystem(makeTier3SyncSystem(visibilityCell, matchState));
  world.registerSystem(makeBridgeSnapshotSystem(accessor));
}
```

`serializeMatchState` strips derived fields to avoid persisting stale values (live API recomputes them per-call; persisting them would surface stale data to anything reading `world.state.aoe2.matchState` directly). v10 introduces an explicit persisted shape so the strip typechecks:
```ts
// src/game/simulation/saveSchema.ts (additions)
export type PersistedMatchState = Omit<
  SerializedMatchState,
  'wonderCountdownTicks' | 'relicCountdownTicks'
>;

function serializeMatchState(m: MatchState): PersistedMatchState {
  const { wonderCountdownTicks: _wc, relicCountdownTicks: _rc, ...rest } = m;
  return rest;
}
```
Load paths use `world.getState('aoe2.matchState') as PersistedMatchState | undefined`. `Object.assign(matchState, msState)` accepts the partial shape — mutation-target's `wonderCountdownTicks`/`relicCountdownTicks` fields keep their pre-existing values (or get recomputed by live API on next read). Schema-1 `migrateLegacySaveBlobToWorldState` strips legacy stored derived fields the same way before writing.

`VisibilityCell` carries a dirty bit (v9 — closes Codex+Claude iter-8 MAJOR on per-tick perf):
```ts
export class VisibilityCell {
  private _current: VisibilityMap;
  private _dirty = true;          // initial = needs first write at bootstrap
  constructor(initial: VisibilityMap) { this._current = initial; }
  get(): VisibilityMap { return this._current; }
  /** Visibility-mutating ops modules call this after setSource/removeSource etc. */
  markDirty(): void { this._dirty = true; }
  /** Used post-applySnapshot to swap in the hydrated map; auto-marks dirty. */
  replace(next: VisibilityMap): void { this._current = next; this._dirty = true; }
  isDirty(): boolean { return this._dirty; }
  clearDirty(): void { this._dirty = false; }
}
```

**v10 — `syncVisibilitySources` fingerprinting** (closes Codex iter-9 MAJOR / Claude iter-9 MINOR): the dirty bit is only effective if the mutator actually skips no-op writes. Today `syncVisibilitySources` (`bridge/visibility.ts:150-170`) iterates every entity with a `visionSource` and unconditionally calls `cell.get().setSource(player, sourceId, x, y, radius)`. v10 adds a per-(player, sourceId) `{ x, y, radius }` fingerprint cache:
```ts
// Pseudocode:
const fingerprints = new Map<string /* `${player}:${sourceId}` */, { x: number; y: number; radius: number }>();
for (const entity of visionEntities) {
  const fp = fingerprints.get(key);
  if (fp && fp.x === x && fp.y === y && fp.radius === radius) continue;  // no-op
  cell.get().setSource(player, sourceId, x, y, radius);
  fingerprints.set(key, { x, y, radius });
  cell.markDirty();
}
```
Trades 3 number comparisons per entity for a meaningful gate. Steady-state ticks (no movement among vision sources) skip the visibility write entirely. The §9 perf fallbacks (every-Nth-tick batching, larger snapshotInterval) remain as safety nets if benchmarks show this isn't enough.

The engine's `SystemRegistration` shape is `{ name, phase, execute: (world) => void, before?, after? }` (`world.ts:74-87` / `:51-56`). No `ctx` parameter — refs reach the system via closure capture from each factory.

**Ordering invariants** (CI-protected):
1. `tier3SyncSystem` is the SECOND-TO-LAST output-phase registration; `bridgeSnapshotSystem` is LAST.
2. Any future output-phase system MUST be registered BEFORE `tier3SyncSystem`.
3. civ-engine's topological scheduler treats empty `before`/`after` as the default (no constraints); constraint-free systems sort by **registration order** as the tiebreaker (per `world.ts:2089-2134, 2415-2480`).
4. **Ordering-test mechanism**: civ-engine's `World.resolvedSystemOrder` is private (`world.ts:248`) so we can't directly introspect. The test fixture instruments each output-phase system's `execute` (during test setup) to push its `name` onto a per-tick trace array. After running one `world.step()`, the test asserts the LAST TWO entries in the trace whose `phase === 'output'` are `['tier3Sync', 'bridgeSnapshot']`. Any future output system registered after either flips the trace ordering and fails the test.

`flushBridgeStateToWorld()` (used by `saveGameOps.saveGame()` per ADR 5) runs the same pair of writes (Tier-3 writes + `accessor.flush()`) so saved snapshots are consistent with recorder snapshots.

Recorder snapshots fire AFTER the output phase completes (per `world.ts:1746-1763`'s diff-listener invocation in `runTick`), so by the time `world.serialize()` runs, both Tier-3 mutable state and Tier-1 dirty slots have been written to `world.state`.

