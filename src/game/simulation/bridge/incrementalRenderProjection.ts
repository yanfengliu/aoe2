// The live game's render projection, kept current by what changed (work 150 M2a).
//
// civ-engine's `RenderAdapter` re-projects, on each tick, the entities whose
// components the tick wrote, and has no way in for state the projector reads
// outside components (health, selection, the work verb, wildlife, the in-place
// writes to a renderable, an owner or a unit type). The bridge used to answer
// every such change by disconnecting and reconnecting the adapter, which
// projected every entity again and checked each one's JSON shape: 68.5% of a
// late tick on a 120x120 map, most of it trees nothing had touched (plan 150).
//
// This projection keeps the adapter's per-tick rule and replaces the
// reconnect with the entities that CAN change out of band (`canChangeOutOfBand`):
// every unit and building, every resource that is not a tree, bush or mine,
// and every entity that is or was selected. After an out-of-band change those
// are projected again and compared field by field with what the store holds,
// and only the ones that differ are sent: at the end of the tick that made the
// change, or at the next step or read for a change made between ticks (a
// click while paused).
//
// It reads the world only through civ-engine's public surface (`onDiff`,
// `getAliveEntities`, `getEntityRef`), and sends the same `renderSnapshot` and
// `renderTick` messages to the same store. It does not check JSON shape per
// tick: the equivalence test (tests/simulation/incrementalRenderProjection.test.ts)
// compares this store with civ-engine's own full `RenderAdapter` snapshot,
// which checks every entity's shape, at every tick of its matches.
//
// BOUND. Between ticks only the followed entities and the selection are
// projected again: the bridge's commands create, destroy and move entities
// inside the next tick (a placement or a delete is queued), and a component
// write between ticks to anything else would wait for the next tick's diff.

import type {
  EntityId,
  EntityRef,
  RenderDebugCapture,
  RenderEntity,
  RenderProjector,
  RenderServerMessage,
  TickDiff,
} from 'civ-engine';

import { isStaticMemorableResourceType } from '../prototypeUnitRules';
import type { ProjectedEntityView, ProjectedFrameView, ResourceComponent } from '../types';
import type { RenderMetricsSnapshot } from '../renderMetricsCapture';
import type { GameCommands, GameEvents, GameWorld } from './pureHelpers';
import { toEngineWorld } from './pureHelpers';

type View = ProjectedEntityView;
type Message = RenderServerMessage<View, ProjectedFrameView, RenderMetricsSnapshot>;
type Projector = RenderProjector<GameEvents, GameCommands, View, ProjectedFrameView>;

export interface IncrementalRenderProjectionConfig {
  world: GameWorld;
  projector: Projector;
  debug?: RenderDebugCapture<RenderMetricsSnapshot>;
  send(message: Message): void;
  /** True once since the last call after anything changed out of band
   *  (createWorld's `markOutOfBandRenderChange`). */
  consumeOutOfBandChange(): boolean;
  getSelectedEntityIds(): readonly EntityId[];
}

/** Whether the projector reads anything for this entity that a component
 *  write does not announce. Trees, berry bushes, mines and bare terrain have
 *  no health, verb, wildlife state, civilization or in-place write; every
 *  other entity is followed. */
export function canChangeOutOfBand(world: GameWorld, id: EntityId): boolean {
  if (world.getComponent(id, 'unit') || world.getComponent(id, 'building')) return true;
  const resource = world.getComponent<ResourceComponent>(id, 'resource');
  if (resource) return !isStaticMemorableResourceType(resource.resourceType);
  return !world.getComponent(id, 'terrain');
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  if (keys.length !== Object.keys(rightRecord).length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(rightRecord, key)) return false;
    if (!sameValue(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

/** Field-by-field equality of two projected views (nested records included). */
export function sameProjectedView(left: View, right: View): boolean {
  return sameValue(left, right);
}

export class IncrementalRenderProjection {
  private readonly world: GameWorld;
  private readonly projector: Projector;
  private readonly debug?: RenderDebugCapture<RenderMetricsSnapshot>;
  private readonly send: (message: Message) => void;
  private readonly consumeOutOfBandChange: () => boolean;
  private readonly getSelectedEntityIds: () => readonly EntityId[];
  /** What the store holds, by id: the same objects it was sent. */
  private readonly rendered = new Map<EntityId, RenderEntity<View>>();
  /** Rendered entities that `canChangeOutOfBand`. */
  private readonly followed = new Set<EntityId>();
  /** The selection at the last pass. */
  private selected = new Set<EntityId>();
  private listener: ((diff: TickDiff) => void) | null = null;

  constructor(config: IncrementalRenderProjectionConfig) {
    this.world = config.world;
    this.projector = config.projector;
    this.debug = config.debug;
    this.send = config.send;
    this.consumeOutOfBandChange = config.consumeOutOfBandChange;
    this.getSelectedEntityIds = config.getSelectedEntityIds;
  }

  connect(): void {
    if (this.listener) return;
    this.rendered.clear();
    this.followed.clear();
    // A change marked before the snapshot is in the snapshot.
    this.consumeOutOfBandChange();
    this.selected = new Set(this.getSelectedEntityIds());
    const entities: Array<RenderEntity<View>> = [];
    for (const id of this.world.getAliveEntities()) {
      const ref = { id, generation: this.world.getEntityGeneration(id) };
      const view = this.projectEntity(ref);
      if (view === null) continue;
      const entity = { ref, view };
      entities.push(entity);
      this.remember(entity);
    }
    this.send({
      type: 'renderSnapshot',
      data: {
        render: { tick: this.world.tick, entities, frame: this.projectFrame(null) },
        debug: this.debug?.capture() ?? null,
      },
    });
    this.listener = (diff) => this.onTick(diff);
    this.world.onDiff(this.listener);
  }

  disconnect(): void {
    if (!this.listener) return;
    this.world.offDiff(this.listener);
    this.listener = null;
  }

  /** Between ticks: projects what changed out of band since the last tick or
   *  flush. Returns whether it sent anything. */
  flush(): boolean {
    if (!this.listener || !this.consumeOutOfBandChange()) return false;
    const candidates = new Set(this.followed);
    this.addSelectionChange(candidates);
    this.sendChanges(this.world.tick, candidates, null);
    return true;
  }

  private onTick(diff: TickDiff): void {
    const candidates = new Set<EntityId>();
    for (const id of diff.entities.created) candidates.add(id);
    for (const id of diff.entities.destroyed) candidates.add(id);
    for (const changes of Object.values(diff.components)) {
      for (const [id] of changes.set) candidates.add(id);
      for (const id of changes.removed) candidates.add(id);
    }
    for (const changes of Object.values(diff.resources)) {
      for (const [id] of changes.set) candidates.add(id);
      for (const id of changes.removed) candidates.add(id);
    }
    if (this.consumeOutOfBandChange()) {
      for (const id of this.followed) candidates.add(id);
    }
    this.addSelectionChange(candidates);
    this.sendChanges(diff.tick, candidates, diff);
  }

  private addSelectionChange(candidates: Set<EntityId>): void {
    const now = new Set(this.getSelectedEntityIds());
    for (const id of now) if (!this.selected.has(id)) candidates.add(id);
    for (const id of this.selected) if (!now.has(id)) candidates.add(id);
    this.selected = now;
  }

  private sendChanges(tick: number, candidates: Set<EntityId>, diff: TickDiff | null): void {
    const created: Array<RenderEntity<View>> = [];
    const updated: Array<RenderEntity<View>> = [];
    const destroyed: EntityRef[] = [];
    for (const id of [...candidates].sort((left, right) => left - right)) {
      const held = this.rendered.get(id) ?? null;
      const ref = this.world.getEntityRef(id);
      const view = ref === null ? null : this.projectEntity(ref);
      if (ref === null || view === null) {
        if (held) {
          destroyed.push(held.ref);
          this.forget(id);
        }
        continue;
      }
      if (held === null || held.ref.generation !== ref.generation) {
        if (held) destroyed.push(held.ref);
        const entity = { ref, view };
        created.push(entity);
        this.remember(entity);
      } else if (!sameProjectedView(held.view, view)) {
        const entity = { ref, view };
        updated.push(entity);
        this.remember(entity);
      }
    }
    this.send({
      type: 'renderTick',
      data: {
        render: { tick, created, updated, destroyed, frame: this.projectFrame(diff) },
        debug: this.debug?.capture() ?? null,
      },
    });
  }

  private projectEntity(ref: EntityRef): View | null {
    return this.projector.projectEntity(ref, toEngineWorld(this.world), null);
  }

  private projectFrame(diff: TickDiff | null): ProjectedFrameView | null {
    return this.projector.projectFrame?.(toEngineWorld(this.world), diff) ?? null;
  }

  private remember(entity: RenderEntity<View>): void {
    this.rendered.set(entity.ref.id, entity);
    if (canChangeOutOfBand(this.world, entity.ref.id)) this.followed.add(entity.ref.id);
    else this.followed.delete(entity.ref.id);
  }

  private forget(id: EntityId): void {
    this.rendered.delete(id);
    this.followed.delete(id);
  }
}
