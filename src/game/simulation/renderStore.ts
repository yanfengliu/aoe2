import type {
  RenderEntity,
  RenderServerMessage,
  WorldDebugSnapshot,
} from 'civ-engine';

import type {
  ProjectedEntityView,
  ProjectedFrameView,
} from './types';

type RenderMessage = RenderServerMessage<
  ProjectedEntityView,
  ProjectedFrameView,
  WorldDebugSnapshot
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
  private debug: WorldDebugSnapshot | null = null;

  apply(message: RenderMessage): void {
    if (message.type === 'renderSnapshot') {
      this.entities.clear();
      for (const entity of message.data.render.entities) {
        this.entities.set(renderKey(entity), entity);
      }
      this.tick = message.data.render.tick;
      this.debug = message.data.debug;
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
    this.debug = message.data.debug;
  }

  getEntities(): ProjectedEntityView[] {
    return [...this.entities.values()]
      .map((entity) => entity.view)
      .sort((left, right) => {
        const layerOrder = ['terrain', 'building', 'unit'];
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

  getDebug(): WorldDebugSnapshot | null {
    return this.debug;
  }
}
