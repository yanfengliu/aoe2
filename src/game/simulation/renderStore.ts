import type {
  RenderEntity,
  RenderServerMessage,
} from 'civ-engine';

import type {
  ProjectedEntityView,
  ProjectedFrameView,
  RenderPositionFrame,
} from './types';
import type { RenderMetricsSnapshot } from './renderMetricsCapture';

type RenderMessage = RenderServerMessage<
  ProjectedEntityView,
  ProjectedFrameView,
  RenderMetricsSnapshot
>;

function renderKey(entity: RenderEntity<ProjectedEntityView>): string {
  return `${entity.ref.id}:${entity.ref.generation}`;
}

function destroyedKey(id: number, generation: number): string {
  return `${id}:${generation}`;
}

export class RenderStore {
  private readonly entities = new Map<string, RenderEntity<ProjectedEntityView>>();
  private tick = 0;
  private frame: ProjectedFrameView | null = null;
  private debug: RenderMetricsSnapshot | null = null;
  private initialized = false;
  private previousPositionFrame: RenderPositionFrame | null = null;

  apply(message: RenderMessage): void {
    const nextTick = message.data.render.tick;
    if (this.initialized && nextTick > this.tick) {
      const positions = [...this.entities.values()]
        .filter(({ view }) => (
          !view.isMemory && (view.kind === 'unit' || view.kind === 'resource')
        ))
        .map(({ ref, view }) => ({
          id: ref.id,
          generation: ref.generation,
          x: view.x,
          y: view.y,
        }))
        .sort((left, right) => left.id - right.id || left.generation - right.generation);
      this.previousPositionFrame = { tick: this.tick, positions };
    } else if (this.initialized && nextTick < this.tick) {
      this.previousPositionFrame = null;
    }

    if (message.type === 'renderSnapshot') {
      this.entities.clear();
      for (const entity of message.data.render.entities) {
        this.entities.set(renderKey(entity), entity);
      }
      this.tick = message.data.render.tick;
      this.frame = message.data.render.frame;
      this.debug = message.data.debug;
      this.initialized = true;
      return;
    }

    for (const entity of message.data.render.created) {
      this.entities.set(renderKey(entity), entity);
    }
    for (const entity of message.data.render.updated) {
      this.entities.set(renderKey(entity), entity);
    }
    for (const ref of message.data.render.destroyed) {
      this.entities.delete(destroyedKey(ref.id, ref.generation));
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

  getTick(): number {
    return this.tick;
  }

  getFrame(): ProjectedFrameView | null {
    return this.frame;
  }

  getDebug(): RenderMetricsSnapshot | null {
    return this.debug;
  }

  getPreviousPositionFrame(): RenderPositionFrame | null {
    const frame = this.previousPositionFrame;
    return frame
      ? { tick: frame.tick, positions: frame.positions.map((position) => ({ ...position })) }
      : null;
  }
}
