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

export class RenderStore {
  private readonly entities = new Map<string, RenderEntity<ProjectedEntityView>>();
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
      // interpolation once read was captured here too; since v0.3.187 the
      // presentation keeps its own per-unit history (displayedPositionSmoother)
      // under the same visible-last-tick rule, so the store no longer does.
      this.suppressedAttackAnimationTicks.clear();
    }

    if (message.type === 'renderSnapshot') {
      this.entities.clear();
      this.attackAnimationKeys.clear();
      for (const entity of message.data.render.entities) {
        const key = renderKey(entity);
        this.entities.set(key, entity);
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
      this.entities.set(key, entity);
      if (entity.view.attackAnimation) this.attackAnimationKeys.add(key);
      else this.attackAnimationKeys.delete(key);
    }
    for (const entity of message.data.render.updated) {
      const key = renderKey(entity);
      this.entities.set(key, entity);
      if (entity.view.attackAnimation) this.attackAnimationKeys.add(key);
      else this.attackAnimationKeys.delete(key);
    }
    for (const ref of message.data.render.destroyed) {
      const key = destroyedKey(ref.id, ref.generation);
      this.entities.delete(key);
      this.attackAnimationKeys.delete(key);
    }
    this.tick = message.data.render.tick;
    this.frame = message.data.render.frame;
    this.debug = message.data.debug;
    this.initialized = true;
  }

  getEntities(): ProjectedEntityView[] {
    return [...this.entities.values()]
      .map((entity) => entity.view)
      .sort((left, right) => {
        const layerOrder = ['terrain', 'resource', 'building', 'unit'];
        const layerDelta =
          layerOrder.indexOf(left.layer) - layerOrder.indexOf(right.layer);
        if (layerDelta !== 0) return layerDelta;
        if (left.y !== right.y) return left.y - right.y;
        return left.x - right.x;
      });
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
          this.entities.set(key, { ...entity, view });
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
        this.entities.set(key, {
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
