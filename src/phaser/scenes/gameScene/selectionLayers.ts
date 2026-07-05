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
import type { SelectionPulse } from './feedbackEffects';
import { worldToIso } from './isoProjection';

// Static ring style used when no pulse is supplied — the exact pre-v0.1.45
// look (constant gold stroke at width 2 / alpha 0.9, base radius). The pulse
// only ever modulates these toward a brighter/slightly-larger breathe; the
// ring's CENTER and base radius are never changed by the pulse.
const STATIC_SELECTION_PULSE: SelectionPulse = {
  alpha: 0.9,
  radiusOffsetPx: 0,
  lineWidth: 2,
};

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
  // Paint selection rings / rounded borders for every selected entity. The
  // optional `pulse` (M7 selection polish) animates the ring's stroke alpha,
  // width, and a small outward radius offset over time — omit it (or pass the
  // static default) for the unchanged constant ring. Base geometry (ring
  // center, base radius, footprint origin) is never altered by the pulse.
  renderSelection(
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
    pulse?: SelectionPulse,
  ): void;
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

  // The four iso-pixel corners of a w×h footprint anchored at (cellX, cellY),
  // in [top, right, bottom, left] order — a closed diamond in screen space.
  function footprintDiamond(
    cellX: number,
    cellY: number,
    w: number,
    h: number,
  ): Array<{ x: number; y: number }> {
    return [
      worldToIso(cellX, cellY),
      worldToIso(cellX + w, cellY),
      worldToIso(cellX + w, cellY + h),
      worldToIso(cellX, cellY + h),
    ];
  }

  function renderSelection(
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
    pulse: SelectionPulse = STATIC_SELECTION_PULSE,
  ): void {
    if (selectionState.selectedEntityIds.length === 0) {
      return;
    }

    selectionLayer.lineStyle(pulse.lineWidth, 0xf7e5a5, pulse.alpha);
    const offset = pulse.radiusOffsetPx;
    const selectedIds = new Set(selectionState.selectedEntityIds);

    for (const entity of entities) {
      if (!selectedIds.has(entity.id) || entity.isMemory) {
        continue;
      }

      if (entity.kind === 'building') {
        // Iso footprint outline: the 4 projected corners of the footprint form a
        // diamond. Inflate it outward from its centre by the pulse offset so the
        // stroke breathes while the footprint centre is unchanged.
        const corners = footprintDiamond(
          entity.x,
          entity.y,
          entity.footprintWidth,
          entity.footprintHeight,
        );
        const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
        const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
        const inflated = corners.map((corner) => {
          const dx = corner.x - cx;
          const dy = corner.y - cy;
          const length = Math.hypot(dx, dy) || 1;
          return { x: corner.x + (dx / length) * offset, y: corner.y + (dy / length) * offset };
        });
        selectionLayer.strokePoints(inflated, true, true);
        continue;
      }

      const centre = worldToIso(entity.x + 0.5, entity.y + 0.5);
      selectionLayer.strokeCircle(
        centre.x,
        centre.y,
        cellSize * Math.max(entity.size, 0.55) + offset,
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

      const centre = worldToIso(entity.x + 0.5, entity.y + 0.5);

      if (entity.kind === 'unit') {
        const radius = cellSize * entity.size * 0.5;
        selectionBoxLayer.fillCircle(centre.x, centre.y, radius);
        selectionBoxLayer.strokeCircle(centre.x, centre.y, radius);
        continue;
      }

      if (entity.kind === 'resource' && entity.entityType === 'sheep') {
        const radius = cellSize * entity.size * 0.55;
        selectionBoxLayer.fillCircle(centre.x, centre.y, radius);
        selectionBoxLayer.strokeCircle(centre.x, centre.y, radius);
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
    // Iso footprint: the whole w×h footprint as one filled diamond, outlined.
    const footprint = footprintDiamond(
      previewState.cellX,
      previewState.cellY,
      previewState.width,
      previewState.height,
    );
    placementLayer.fillPoints(footprint, true);
    placementLayer.strokePoints(footprint, true, true);

    placementLayer.lineStyle(1, previewState.isValid ? 0xf6ffe9 : 0xfff0f0, 0.95);
    for (let offsetY = 0; offsetY < previewState.height; offsetY += 1) {
      for (let offsetX = 0; offsetX < previewState.width; offsetX += 1) {
        const cellX = previewState.cellX + offsetX;
        const cellY = previewState.cellY + offsetY;
        placementLayer.strokePoints(footprintDiamond(cellX, cellY, 1, 1), true, true);
        cellOutlineCount += 1;

        if (!previewState.isValid) {
          // A small screen-space X centred on the cell's iso diamond.
          const centre = worldToIso(cellX + 0.5, cellY + 0.5);
          placementLayer.lineStyle(2, 0xfff6f6, 0.98);
          placementLayer.lineBetween(centre.x - 6, centre.y - 3, centre.x + 6, centre.y + 3);
          placementLayer.lineBetween(centre.x + 6, centre.y - 3, centre.x - 6, centre.y + 3);
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
