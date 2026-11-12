import type {
  RenderEntity,
  RenderServerMessage,
} from 'civ-engine';

import type {
  ProjectedEntityView,
  ProjectedFrameView,
} from './types';
import type { RenderMetricsSnapshot } from './renderMetricsCapture';

type RenderMessage = RenderServerMessage<
  ProjectedEntityView,
  ProjectedFrameView,
  RenderMetricsSnapshot
>;

type UnitAttackAnimation = NonNullable<ProjectedEntityView['attackAnimation']>;
const ALWAYS_VISIBLE = (): boolean => true;

function renderKey(entity: RenderEntity<ProjectedEntityView>): string {
  return `${entity.ref.id}:${entity.ref.generation}`;
}

function destroyedKey(id: number, generation: number): string {
  return `${id}:${generation}`;
}

const LAYER_RANK: Record<ProjectedEntityView['layer'], number> = { terrain: 0, resource: 1, building: 2, unit: 3 };

/** The list's order: layer, then row, then column, then id, which matches a full engine snapshot even after a
 *  lower entity id is reused. */
function compareStoredViews(left: ProjectedEntityView, right: ProjectedEntityView): number {
  const layerDelta = LAYER_RANK[left.layer] - LAYER_RANK[right.layer];
  if (layerDelta !== 0) return layerDelta;
  if (left.y !== right.y) return left.y - right.y;
  if (left.x !== right.x) return left.x - right.x;
  return left.id - right.id;
}

export class RenderStore {
  private readonly entities = new Map<string, RenderEntity<ProjectedEntityView>>();
  // The entries that are not terrain, and the terrain views in list order. A map has one terrain entity per cell
  // (14,400 on a 120x120 map) and they almost never change, so their sorted block is kept until one of them is
  // created, replaced or destroyed, and a tick sorts only the rest (work 150 M2b; plan 150, "M2b measurement").
  private readonly others = new Map<string, RenderEntity<ProjectedEntityView>>();
  private terrainSorted: ProjectedEntityView[] | null = null;
  private terrainIsTilesOnly = true;
  private readonly attackAnimationKeys = new Set<string>();
  private readonly suppressedAttackAnimationTicks = new Map<string, number>();
  private tick = 0;
  private frame: ProjectedFrameView | null = null;
  private debug: RenderMetricsSnapshot | null = null;
  private initialized = false;

  apply(message: RenderMessage): void {
    const nextTick = message.data.render.tick;
    if (this.initialized && nextTick < this.tick) {
      // A rewind (replay scrub, rollback): the suppression ledger belongs to
      // the timeline being left. The prior-tick position frame that display
      // interpolation once read was captured here too; since v0.3.192 the
      // presentation keeps its own per-unit history (displayedPositionSmoother)
      // under its own version of that rule — visible in the previously
      // PRESENTED frame rather than the previous tick, which a frame that
      // coalesces ticks makes strictly weaker — so the store no longer does.
      this.suppressedAttackAnimationTicks.clear();
    }

    if (message.type === 'renderSnapshot') {
      this.entities.clear();
      this.others.clear();
      this.terrainSorted = null;
      this.attackAnimationKeys.clear();
      for (const entity of message.data.render.entities) {
        const key = renderKey(entity);
        this.store(key, entity);
        if (entity.view.attackAnimation) this.attackAnimationKeys.add(key);
      }
      this.tick = message.data.render.tick;
      this.frame = message.data.render.frame;
      this.debug = message.data.debug;
      this.initialized = true;
      return;
    }

    for (const entity of message.data.render.created) {
      const key = renderKey(entity);
      this.store(key, entity);
      if (entity.view.attackAnimation) this.attackAnimationKeys.add(key);
      else this.attackAnimationKeys.delete(key);
    }
    for (const entity of message.data.render.updated) {
      const key = renderKey(entity);
      this.store(key, entity);
      if (entity.view.attackAnimation) this.attackAnimationKeys.add(key);
      else this.attackAnimationKeys.delete(key);
    }
    for (const ref of message.data.render.destroyed) {
      const key = destroyedKey(ref.id, ref.generation);
      this.discard(key);
      this.attackAnimationKeys.delete(key);
    }
    this.tick = message.data.render.tick;
    this.frame = message.data.render.frame;
    this.debug = message.data.debug;
    this.initialized = true;
  }

  /** Every write of an entry goes through here, so the two halves below never fall behind the map. */
  private store(key: string, entity: RenderEntity<ProjectedEntityView>): void {
    const wasTerrain = this.entities.get(key)?.view.layer === 'terrain';
    this.entities.set(key, entity);
    if (entity.view.layer === 'terrain') {
      this.others.delete(key);
      this.terrainSorted = null;
    } else if (wasTerrain) {
      // The key keeps its place in `entities`, and the list's order falls back on that place when two entries
      // tie (one id held in two generations on one cell), so the other half is rebuilt in that order rather than
      // given the key at its end.
      this.terrainSorted = null;
      this.others.clear();
      for (const [heldKey, held] of this.entities) {
        if (held.view.layer !== 'terrain') this.others.set(heldKey, held);
      }
    } else {
      this.others.set(key, entity);
    }
  }

  private discard(key: string): void {
    const entity = this.entities.get(key);
    if (!entity) return;
    this.entities.delete(key);
    if (entity.view.layer === 'terrain') this.terrainSorted = null;
    else this.others.delete(key);
  }

  /** The views in list order, as its two halves: the terrain, then everything else. The terrain array is the
   *  store's own and is handed out again until a terrain entity changes, so a caller must not write to it.
   *  `terrainIsTilesOnly` says every terrain view is a map cell, which is what lets a reader skip the half. */
  getEntityLists(): { terrain: readonly ProjectedEntityView[]; others: ProjectedEntityView[]; terrainIsTilesOnly: boolean } {
    if (this.terrainSorted === null) {
      const terrain: ProjectedEntityView[] = [];
      let tilesOnly = true;
      for (const entity of this.entities.values()) {
        if (entity.view.layer !== 'terrain') continue;
        terrain.push(entity.view);
        if (entity.view.kind !== 'tile') tilesOnly = false;
      }
      this.terrainSorted = terrain.sort(compareStoredViews);
      this.terrainIsTilesOnly = tilesOnly;
    }
    const others: ProjectedEntityView[] = [];
    for (const entity of this.others.values()) others.push(entity.view);
    return { terrain: this.terrainSorted, others: others.sort(compareStoredViews), terrainIsTilesOnly: this.terrainIsTilesOnly };
  }

  getEntities(): ProjectedEntityView[] {
    const { terrain, others } = this.getEntityLists();
    return terrain.concat(others);
  }

  /** Reconciles transient attack overlays in O(active + previously-active).
   * Render diffs may not revisit a stationary attacker when its cue expires,
   * so the store owns the one-time removal instead of every frame scanning
   * every unit forever. The return value is the number of keys examined. */
  reconcileUnitAttackAnimations(
    active: ReadonlyMap<string, UnitAttackAnimation>,
    isCurrentlyVisible: (view: ProjectedEntityView) => boolean = ALWAYS_VISIBLE,
  ): number {
    for (const [key, tick] of this.suppressedAttackAnimationTicks) {
      if (active.get(key)?.tick !== tick) {
        this.suppressedAttackAnimationTicks.delete(key);
      }
    }
    const keys = new Set([...this.attackAnimationKeys, ...active.keys()]);
    for (const key of keys) {
      const entity = this.entities.get(key);
      let next = active.get(key);
      if (next && (!entity || !isCurrentlyVisible(entity.view))) {
        this.suppressedAttackAnimationTicks.set(key, next.tick);
        next = undefined;
      } else if (
        next
        && this.suppressedAttackAnimationTicks.get(key) === next.tick
      ) {
        next = undefined;
      }
      if (!entity) {
        this.attackAnimationKeys.delete(key);
        continue;
      }
      const current = entity.view.attackAnimation;
      if (!next) {
        if (current) {
          const view = { ...entity.view };
          delete view.attackAnimation;
          this.store(key, { ...entity, view });
        }
        this.attackAnimationKeys.delete(key);
        continue;
      }
      if (
        current?.tick !== next.tick
        || current.cancelTick !== next.cancelTick
        || current.sourceX !== next.sourceX
        || current.sourceY !== next.sourceY
        || current.targetX !== next.targetX
        || current.targetY !== next.targetY
      ) {
        this.store(key, {
          ...entity,
          view: { ...entity.view, attackAnimation: next },
        });
      }
      this.attackAnimationKeys.add(key);
    }
    return keys.size;
  }

  getTick(): number {
    return this.tick;
  }

  getFrame(): ProjectedFrameView | null {
    return this.frame;
  }

  getDebug(): RenderMetricsSnapshot | null {
    return this.debug;
  }
}
