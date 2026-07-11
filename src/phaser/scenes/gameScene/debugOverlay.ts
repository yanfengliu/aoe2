// Debug-overlay renderers factored out of `GameScene.ts` so the scene file
// stays focused on lifecycle + render orchestration. The five overlay modes
// (selection-bounds, pathing, fog-state, coarse-vs-fine) are move-only
// extractions that previously lived as private methods on `GameScene`. They
// read the debug snapshot off the provided bridge and paint onto the scene's
// dedicated `debugLayer`. No behavior change from pre-extraction.

import type { SimulationBridge } from '../../../game/simulation/createSimulationBridge';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
  SelectionState,
} from '../../../game/simulation/types';
import type { DebugOverlayMode } from '../GameScene';
import { worldToIso } from './isoProjection';

export interface DebugOverlayDeps {
  // The graphics layer the renderer paints onto. Scene owns the lifetime.
  debugLayer: Phaser.GameObjects.Graphics;
  // Bridge read-only access for debug snapshots (unit paths, coarse-vs-fine
  // probes). No mutations happen here.
  bridge: SimulationBridge;
}

export interface DebugOverlayRenderer {
  // Dispatches to the right sub-renderer based on the current HUD debug mode.
  // Off / ai-state / perf modes are no-ops (ai-state + perf are HUD-only).
  render(
    mode: DebugOverlayMode,
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
    frame: ProjectedFrameView | null,
  ): void;
}

export function createDebugOverlayRenderer(deps: DebugOverlayDeps): DebugOverlayRenderer {
  const { debugLayer, bridge } = deps;

  function renderDebugSelectionBounds(
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
  ): void {
    if (selectionState.selectedEntityIds.length === 0) {
      return;
    }

    const selectedIds = new Set(selectionState.selectedEntityIds);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let anyFound = false;

    for (const entity of entities) {
      if (!selectedIds.has(entity.id) || entity.isMemory) {
        continue;
      }
      const left = entity.x;
      const top = entity.y;
      const width = entity.kind === 'building' ? entity.footprintWidth : 1;
      const height = entity.kind === 'building' ? entity.footprintHeight : 1;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + width);
      maxY = Math.max(maxY, top + height);
      anyFound = true;
    }

    if (!anyFound) {
      return;
    }

    // Iso: the selected-footprint AABB (minX,minY)-(maxX,maxY) projects to a
    // DIAMOND (its four world corners run through worldToIso), not an axis-
    // aligned rect. The debug layer shares the camera's iso transform, so a
    // top-down strokeRect at `min*cellSize` lands where the world isn't.
    const corners = [
      worldToIso(minX, minY),
      worldToIso(maxX, minY),
      worldToIso(maxX, maxY),
      worldToIso(minX, maxY),
    ];
    debugLayer.lineStyle(2, 0x6ed4ff, 0.95);
    debugLayer.strokePoints(corners, true, true);
  }

  function renderDebugPathing(entities: ProjectedEntityView[]): void {
    const displayedPositionById = new Map<number, { x: number; y: number }>();
    for (const entity of entities) {
      if (entity.kind === 'unit') {
        displayedPositionById.set(entity.id, { x: entity.x, y: entity.y });
      }
    }

    const snapshot = bridge.getDebugSnapshot();
    for (const path of snapshot.unitPaths) {
      const source = displayedPositionById.get(path.id) ?? { x: path.fromX, y: path.fromY };
      // Iso: project the cell centres (worldToIso already returns screen pixels;
      // no cellSize scaling) so the path line tracks the unit in the diamond view.
      const from = worldToIso(source.x + 0.5, source.y + 0.5);
      const to = worldToIso(path.toX + 0.5, path.toY + 0.5);
      const color =
        path.commandType === 'attack'
          ? 0xff5a5a
          : path.commandType === 'build'
            ? 0xffd97d
            : 0x6ed4ff;
      debugLayer.lineStyle(1.5, color, 0.9);
      debugLayer.lineBetween(from.x, from.y, to.x, to.y);
      debugLayer.fillStyle(color, 0.9);
      debugLayer.fillCircle(to.x, to.y, 3);
    }
  }

  function renderDebugFogState(frame: ProjectedFrameView): void {
    const visible = new Set(frame.visibleCells);
    const explored = new Set(frame.exploredCells);
    for (let y = 0; y < frame.mapHeight; y += 1) {
      for (let x = 0; x < frame.mapWidth; x += 1) {
        const index = y * frame.mapWidth + x;
        if (visible.has(index)) {
          debugLayer.fillStyle(0x39d27c, 0.16);
        } else if (explored.has(index)) {
          debugLayer.fillStyle(0xe0b25a, 0.18);
        } else {
          debugLayer.fillStyle(0x8a3f5b, 0.22);
        }
        // Iso: paint the cell's four projected corners as a diamond (same shape
        // the terrain/fog layers draw), not a top-down `x*cellSize` square.
        debugLayer.fillPoints(
          [
            worldToIso(x, y),
            worldToIso(x + 1, y),
            worldToIso(x + 1, y + 1),
            worldToIso(x, y + 1),
          ],
          true,
        );
      }
    }
  }

  // Slice 12 Task D: draw one line per unit from the coarse simulation
  // cell center to the fine interpolated render position. A big delta
  // is the visible signal of "unit is between coarse cells A and B
  // right now" — if simulation pushes coarse back to A or forward to B
  // while rendering stays put (or vice versa), that mismatch shows up
  // as a long line instead of the expected short step.
  function renderDebugCoarseVsFine(): void {
    const snapshot = bridge.getDebugSnapshot();
    for (const probe of snapshot.coarseVsFine) {
      // Iso: project both cell centres so coarse/fine endpoints land in the
      // diamond view (worldToIso returns screen pixels; no cellSize scaling).
      const coarse = worldToIso(probe.coarseX + 0.5, probe.coarseY + 0.5);
      const fine = worldToIso(probe.fineX + 0.5, probe.fineY + 0.5);
      // Line from coarse (blue) to fine (magenta) with a dot on the
      // coarse endpoint so the player can see which side is the
      // simulation cell.
      debugLayer.lineStyle(1.5, 0xff5ed1, 0.9);
      debugLayer.lineBetween(coarse.x, coarse.y, fine.x, fine.y);
      debugLayer.fillStyle(0x6ed4ff, 0.9);
      debugLayer.fillCircle(coarse.x, coarse.y, 3);
      debugLayer.fillStyle(0xff5ed1, 0.9);
      debugLayer.fillCircle(fine.x, fine.y, 3);
    }
  }

  function render(
    mode: DebugOverlayMode,
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
    frame: ProjectedFrameView | null,
  ): void {
    if (mode === 'off' || mode === 'ai-state' || mode === 'perf') {
      return;
    }

    if (mode === 'selection-bounds') {
      renderDebugSelectionBounds(entities, selectionState);
      return;
    }

    if (mode === 'pathing') {
      renderDebugPathing(entities);
      return;
    }

    if (mode === 'fog-state' && frame) {
      renderDebugFogState(frame);
      return;
    }

    if (mode === 'coarse-vs-fine') {
      renderDebugCoarseVsFine();
    }
  }

  return { render };
}
