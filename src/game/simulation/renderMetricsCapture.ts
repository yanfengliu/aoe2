import type { RenderDebugCapture, WorldDebugSnapshot } from 'civ-engine';

export type RenderMetricsSnapshot = Pick<WorldDebugSnapshot, 'entityCount' | 'metrics'>;

export interface RenderMetricsWorld {
  getAliveEntities(): Iterable<number>;
  getMetrics(): WorldDebugSnapshot['metrics'];
}

/**
 * Captures only the fields consumed by the always-on HUD.
 *
 * WorldDebugger.capture() serializes and structured-clones the complete ECS
 * world. That diagnostic snapshot is valuable to offline tooling, but doing it
 * from RenderAdapter after every simulation tick stalls foreground frames.
 */
export function createRenderMetricsCapture(
  world: RenderMetricsWorld,
): RenderDebugCapture<RenderMetricsSnapshot> {
  return {
    capture() {
      let entityCount = 0;
      for (const entityId of world.getAliveEntities()) {
        void entityId;
        entityCount += 1;
      }
      return {
        entityCount,
        metrics: world.getMetrics(),
      };
    },
  };
}
