import type { ProjectedFrameView, RenderState } from '../../game/simulation/types';

// World-cell pixel size — must match GameScene's CELL_SIZE so minimap
// coordinates translate back to world coordinates exactly.
export const MINIMAP_CELL_SIZE = 24;

interface MinimapLayout {
  scale: number;
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface MinimapCameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
}

interface MinimapViewportState {
  x: number;
  y: number;
  width: number;
  height: number;
}

function tintToCss(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}

export function getMinimapLayout(
  canvas: HTMLCanvasElement,
  frame: RenderState['frame'],
): MinimapLayout | null {
  if (!frame) {
    return null;
  }

  const scale = Math.min(
    canvas.width / frame.mapWidth,
    canvas.height / frame.mapHeight,
  );
  const drawWidth = frame.mapWidth * scale;
  const drawHeight = frame.mapHeight * scale;
  const offsetX = (canvas.width - drawWidth) * 0.5;
  const offsetY = (canvas.height - drawHeight) * 0.5;

  return {
    scale,
    drawWidth,
    drawHeight,
    offsetX,
    offsetY,
  };
}

function getMinimapViewportState(
  layout: MinimapLayout,
  frame: ProjectedFrameView,
  cameraState: MinimapCameraState | null,
): MinimapViewportState | null {
  if (!cameraState) {
    return null;
  }

  const worldWidth = frame.mapWidth * MINIMAP_CELL_SIZE;
  const worldHeight = frame.mapHeight * MINIMAP_CELL_SIZE;
  const minimapScaleX = layout.drawWidth / worldWidth;
  const minimapScaleY = layout.drawHeight / worldHeight;

  return {
    x: layout.offsetX + cameraState.viewX * minimapScaleX,
    y: layout.offsetY + cameraState.viewY * minimapScaleY,
    width: cameraState.viewWidth * minimapScaleX,
    height: cameraState.viewHeight * minimapScaleY,
  };
}

function setMinimapViewportDataset(
  canvas: HTMLCanvasElement,
  viewportState: MinimapViewportState | null,
): void {
  canvas.dataset.viewportActive = viewportState ? 'true' : 'false';
  canvas.dataset.viewportX = viewportState ? viewportState.x.toFixed(2) : '';
  canvas.dataset.viewportY = viewportState ? viewportState.y.toFixed(2) : '';
  canvas.dataset.viewportWidth = viewportState ? viewportState.width.toFixed(2) : '';
  canvas.dataset.viewportHeight = viewportState ? viewportState.height.toFixed(2) : '';
}

// Draws the terrain / entity / fog layers onto the minimap canvas, then
// overlays the camera viewport rectangle when a camera state is provided.
// The `viewport*` datasets are mirrored onto the canvas for browser tests.
export function drawMinimap(
  canvas: HTMLCanvasElement,
  renderState: RenderState,
  cameraState: MinimapCameraState | null,
): void {
  const frame = renderState.frame;
  if (!frame) {
    setMinimapViewportDataset(canvas, null);
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const layout = getMinimapLayout(canvas, frame);
  if (!layout) {
    setMinimapViewportDataset(canvas, null);
    return;
  }

  const { scale, offsetX, offsetY } = layout;
  const visible = new Set(frame.visibleCells);
  const explored = new Set(frame.exploredCells);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#081012';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const entity of renderState.entities) {
    const x = offsetX + entity.x * scale;
    const y = offsetY + entity.y * scale;

    context.fillStyle = tintToCss(entity.tint);

    if (entity.layer === 'terrain') {
      context.fillRect(x, y, Math.ceil(scale), Math.ceil(scale));
      continue;
    }

    const markerSize =
      entity.kind === 'building'
        ? Math.max(scale * 1.4, 2)
        : Math.max(scale * 0.8, 1.5);

    context.fillRect(
      x + (scale - markerSize) * 0.5,
      y + (scale - markerSize) * 0.5,
      markerSize,
      markerSize,
    );
  }

  for (let y = 0; y < frame.mapHeight; y += 1) {
    for (let x = 0; x < frame.mapWidth; x += 1) {
      const index = y * frame.mapWidth + x;
      const drawX = offsetX + x * scale;
      const drawY = offsetY + y * scale;

      if (!explored.has(index)) {
        context.fillStyle = 'rgba(8, 16, 18, 0.94)';
        context.fillRect(drawX, drawY, Math.ceil(scale), Math.ceil(scale));
        continue;
      }

      if (!visible.has(index)) {
        context.fillStyle = 'rgba(10, 16, 18, 0.58)';
        context.fillRect(drawX, drawY, Math.ceil(scale), Math.ceil(scale));
      }
    }
  }

  const viewportState = getMinimapViewportState(layout, frame, cameraState);
  setMinimapViewportDataset(canvas, viewportState);
  if (viewportState) {
    context.fillStyle = 'rgba(247, 229, 165, 0.08)';
    context.fillRect(
      viewportState.x,
      viewportState.y,
      viewportState.width,
      viewportState.height,
    );
    context.strokeStyle = 'rgba(247, 229, 165, 0.95)';
    context.lineWidth = 1.5;
    context.strokeRect(
      viewportState.x,
      viewportState.y,
      viewportState.width,
      viewportState.height,
    );
  }
}
