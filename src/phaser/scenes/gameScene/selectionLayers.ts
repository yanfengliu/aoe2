// Selection / placement-preview / marquee renderers factored out of
// `GameScene.ts`. Same dep-bag factory shape as the other `gameScene/`
// extractions. Move-only — every paint call and branch mirrors the prior
// private methods on GameScene, and the returned `renderPlacementPreview`
// hands back the visual-state record the scene stashes for browser tests.
//
// The marquee renderer needs `getDisplayedEntities` as a collaborator
// callback because the preview outlines are drawn for entities the scene
// currently displays. The factory stays pure — it reads entity data through
// the callback and paints via the injected layers.

import type {
  PlacementPreviewState,
  ProjectedEntityView,
  SelectionState,
} from '../../../game/simulation/types';
import type {
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from '../GameScene';

export interface SelectionLayersDeps {
  selectionLayer: Phaser.GameObjects.Graphics;
  placementLayer: Phaser.GameObjects.Graphics;
  selectionBoxLayer: Phaser.GameObjects.Graphics;
  cellSize: number;
  // Screen → world coordinate mapping. The marquee is painted in world
  // space, but the drag state it reads is stored in screen coordinates;
  // this callback unifies the two so the factory does not need a handle on
  // the whole camera object.
  screenToWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
  // Snapshot of the scene's `displayedEntities`. Read fresh each paint to
  // avoid capturing a stale array reference across frames.
  getDisplayedEntities: () => ProjectedEntityView[];
}

export interface SelectionLayersRenderer {
  // Paint selection rings / rounded borders for every selected entity.
  renderSelection(entities: ProjectedEntityView[], selectionState: SelectionState): void;
  // Paint the drag-selection marquee plus the live preview outlines for the
  // entities that would be selected on mouse-up.
  renderSelectionBox(selectionBoxState: SelectionBoxState | null): void;
  // Paint the building-placement preview. Returns the visual-state record
  // so the scene can stash it for browser-test introspection, or null if
  // nothing was painted this frame.
  renderPlacementPreview(
    previewState: PlacementPreviewViewState | null,
  ): PlacementPreviewVisualState | null;
}

export function createSelectionLayersRenderer(
  deps: SelectionLayersDeps,
): SelectionLayersRenderer {
  const {
    selectionLayer,
    placementLayer,
    selectionBoxLayer,
    cellSize,
    screenToWorldPoint,
    getDisplayedEntities,
  } = deps;

  function renderSelection(
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
  ): void {
    if (selectionState.selectedEntityIds.length === 0) {
      return;
    }

    selectionLayer.lineStyle(2, 0xf7e5a5, 0.9);
    const selectedIds = new Set(selectionState.selectedEntityIds);

    for (const entity of entities) {
      if (!selectedIds.has(entity.id) || entity.isMemory) {
        continue;
      }

      const px = entity.x * cellSize;
      const py = entity.y * cellSize;

      if (entity.kind === 'building') {
        const widthPx = entity.footprintWidth * cellSize;
        const heightPx = entity.footprintHeight * cellSize;
        selectionLayer.strokeRoundedRect(
          px,
          py,
          widthPx,
          heightPx,
          6,
        );
        continue;
      }

      selectionLayer.strokeCircle(
        px + cellSize * 0.5,
        py + cellSize * 0.5,
        cellSize * Math.max(entity.size, 0.55),
      );
    }
  }

  function renderSelectionBox(selectionBoxState: SelectionBoxState | null): void {
    if (!selectionBoxState?.active) {
      return;
    }

    const minX = Math.min(selectionBoxState.startX, selectionBoxState.currentX);
    const minY = Math.min(selectionBoxState.startY, selectionBoxState.currentY);
    const maxX = Math.max(selectionBoxState.startX, selectionBoxState.currentX);
    const maxY = Math.max(selectionBoxState.startY, selectionBoxState.currentY);
    const worldStart = screenToWorldPoint(minX, minY);
    const worldEnd = screenToWorldPoint(maxX, maxY);
    const width = Math.max(1, worldEnd.x - worldStart.x);
    const height = Math.max(1, worldEnd.y - worldStart.y);

    selectionBoxLayer.lineStyle(2, 0xf7e5a5, 0.98);
    selectionBoxLayer.fillStyle(0xf7e5a5, 0.18);
    selectionBoxLayer.fillRect(worldStart.x, worldStart.y, width, height);
    selectionBoxLayer.strokeRect(worldStart.x, worldStart.y, width, height);

    const previewIds = new Set(selectionBoxState.previewEntityIds);
    if (previewIds.size === 0) {
      return;
    }

    selectionBoxLayer.lineStyle(2, 0xfff4c8, 0.95);
    selectionBoxLayer.fillStyle(0xfff4c8, 0.12);
    for (const entity of getDisplayedEntities()) {
      if (!previewIds.has(entity.id) || entity.isMemory) {
        continue;
      }

      const px = entity.x * cellSize;
      const py = entity.y * cellSize;

      if (entity.kind === 'unit') {
        const radius = cellSize * entity.size * 0.5;
        selectionBoxLayer.fillCircle(px + cellSize * 0.5, py + cellSize * 0.5, radius);
        selectionBoxLayer.strokeCircle(px + cellSize * 0.5, py + cellSize * 0.5, radius);
        continue;
      }

      if (entity.kind === 'resource' && entity.entityType === 'sheep') {
        const radius = cellSize * entity.size * 0.55;
        selectionBoxLayer.fillCircle(px + cellSize * 0.5, py + cellSize * 0.5, radius);
        selectionBoxLayer.strokeCircle(px + cellSize * 0.5, py + cellSize * 0.5, radius);
      }
    }
  }

  function renderPlacementPreview(
    previewState: PlacementPreviewViewState | null,
  ): PlacementPreviewVisualState | null {
    if (!previewState?.active) {
      return null;
    }

    const tint = previewState.isValid ? 0x8fe388 : 0xe36f6f;
    const fillAlpha = previewState.isValid ? 0.32 : 0.36;
    const strokeWidth = 3;
    let cellOutlineCount = 0;
    let blockedMarkerCount = 0;
    placementLayer.lineStyle(strokeWidth, tint, 0.98);
    placementLayer.fillStyle(tint, fillAlpha);
    placementLayer.fillRect(
      previewState.cellX * cellSize,
      previewState.cellY * cellSize,
      previewState.width * cellSize,
      previewState.height * cellSize,
    );
    placementLayer.strokeRect(
      previewState.cellX * cellSize,
      previewState.cellY * cellSize,
      previewState.width * cellSize,
      previewState.height * cellSize,
    );

    placementLayer.lineStyle(1, previewState.isValid ? 0xf6ffe9 : 0xfff0f0, 0.95);
    for (let offsetY = 0; offsetY < previewState.height; offsetY += 1) {
      for (let offsetX = 0; offsetX < previewState.width; offsetX += 1) {
        const x = (previewState.cellX + offsetX) * cellSize;
        const y = (previewState.cellY + offsetY) * cellSize;
        placementLayer.strokeRect(x, y, cellSize, cellSize);
        cellOutlineCount += 1;

        if (!previewState.isValid) {
          placementLayer.lineStyle(2, 0xfff6f6, 0.98);
          placementLayer.lineBetween(x + 3, y + 3, x + cellSize - 3, y + cellSize - 3);
          placementLayer.lineBetween(x + cellSize - 3, y + 3, x + 3, y + cellSize - 3);
          blockedMarkerCount += 1;
          placementLayer.lineStyle(1, 0xfff0f0, 0.95);
        }
      }
    }

    return {
      ...previewState,
      strokeWidth,
      cellOutlineCount,
      blockedMarkerCount,
    };
  }

  return { renderSelection, renderSelectionBox, renderPlacementPreview };
}

// Re-export the PlacementPreviewState type through this module so callers
// that only depend on placement preview can stay off the types barrel.
export type { PlacementPreviewState };
