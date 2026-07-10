import type { RenderState } from '../../game/simulation/types';

// Isometric (diamond) minimap. The map is projected through the SAME 2:1
// diamond transform the world view uses (dx = cellX - cellY, dy = cellX +
// cellY), scaled to fit the minimap canvas, so the minimap reads as a rotated
// diamond that matches the on-screen camera angle rather than a top-down
// rectangle. The projection is an affine transform, so terrain/fog fill via a
// canvas transform (each cell fillRect becomes a diamond) while fixed-size
// markers and the viewport outline draw in identity space through the pure
// `cellToMinimap` helper.

// Iso layout: half-diamond-tile width/height in minimap pixels (2:1 → hh =
// hw/2) plus the pixel origin that centres the map diamond in the canvas.
export interface MinimapLayout {
  hw: number;
  hh: number;
  originX: number;
  originY: number;
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
  // Visible region in CELL space (AABB of the on-screen iso diamond).
  viewCellMinX: number;
  viewCellMinY: number;
  viewCellMaxX: number;
  viewCellMaxY: number;
}

const MARKER_BACKING_STYLE = 'rgba(4, 8, 9, 0.72)';

function tintToCss(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}

// Fit the map diamond (dx spans mapWidth+mapHeight, dy spans mapWidth+mapHeight)
// into the canvas at 2:1, centred. Null when there is no frame yet.
export function getMinimapLayout(
  canvas: HTMLCanvasElement,
  frame: RenderState['frame'],
): MinimapLayout | null {
  if (!frame) {
    return null;
  }
  const span = frame.mapWidth + frame.mapHeight;
  // hw ≤ W/span (diamond width = span·hw) and hw ≤ 2H/span (height = span·hh,
  // hh = hw/2). A small margin keeps the diamond points off the canvas edge.
  const margin = 0.96;
  const hw = Math.min(canvas.width / span, (2 * canvas.height) / span) * margin;
  const hh = hw / 2;
  const originX = canvas.width / 2 - ((frame.mapWidth - frame.mapHeight) / 2) * hw;
  const originY = canvas.height / 2 - ((frame.mapWidth + frame.mapHeight) / 2) * hh;
  return { hw, hh, originX, originY };
}

// Pure cell → minimap-pixel projection (the diamond transform). Fractional
// cells are fine (unit sub-cell positions, cell corners for the viewport).
export function cellToMinimap(
  cellX: number,
  cellY: number,
  layout: MinimapLayout,
): { x: number; y: number } {
  return {
    x: layout.originX + (cellX - cellY) * layout.hw,
    y: layout.originY + (cellX + cellY) * layout.hh,
  };
}

// Inverse of cellToMinimap — minimap pixel → fractional cell, for click-to-pan.
export function minimapToCell(
  pixelX: number,
  pixelY: number,
  layout: MinimapLayout,
): { cellX: number; cellY: number } {
  const dx = (pixelX - layout.originX) / layout.hw; // cellX - cellY
  const dy = (pixelY - layout.originY) / layout.hh; // cellX + cellY
  return {
    cellX: (dx + dy) / 2,
    cellY: (dy - dx) / 2,
  };
}

interface MinimapViewportState {
  // The visible cell AABB's four corners projected to minimap pixels (a
  // rotated quad on the diamond, not an axis-aligned rect).
  points: Array<{ x: number; y: number }>;
}

function getMinimapViewportState(
  layout: MinimapLayout,
  cameraState: MinimapCameraState | null,
): MinimapViewportState | null {
  if (!cameraState) {
    return null;
  }
  const { viewCellMinX, viewCellMinY, viewCellMaxX, viewCellMaxY } = cameraState;
  return {
    points: [
      cellToMinimap(viewCellMinX, viewCellMinY, layout),
      cellToMinimap(viewCellMaxX, viewCellMinY, layout),
      cellToMinimap(viewCellMaxX, viewCellMaxY, layout),
      cellToMinimap(viewCellMinX, viewCellMaxY, layout),
    ],
  };
}

function setMinimapViewportDataset(
  canvas: HTMLCanvasElement,
  viewportState: MinimapViewportState | null,
): void {
  canvas.dataset.viewportActive = viewportState ? 'true' : 'false';
  // Mirror the projected quad's bounding box for browser tests (they only need
  // presence + rough placement, not the exact quad).
  if (viewportState) {
    const xs = viewportState.points.map((p) => p.x);
    const ys = viewportState.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    canvas.dataset.viewportX = minX.toFixed(2);
    canvas.dataset.viewportY = minY.toFixed(2);
    canvas.dataset.viewportWidth = (Math.max(...xs) - minX).toFixed(2);
    canvas.dataset.viewportHeight = (Math.max(...ys) - minY).toFixed(2);
  } else {
    canvas.dataset.viewportX = '';
    canvas.dataset.viewportY = '';
    canvas.dataset.viewportWidth = '';
    canvas.dataset.viewportHeight = '';
  }
}

// The iso affine matrix that turns a cell-space fillRect into a diamond:
// x' = hw·cx − hw·cy + originX, y' = hh·cx + hh·cy + originY.
function applyIsoTransform(
  context: CanvasRenderingContext2D,
  layout: MinimapLayout,
): void {
  context.setTransform(layout.hw, layout.hh, -layout.hw, layout.hh, layout.originX, layout.originY);
}

function resetTransform(context: CanvasRenderingContext2D): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
}

// Draws the terrain / entity / fog layers as an iso diamond, then overlays the
// camera viewport quad. The `viewport*` datasets are mirrored for browser tests.
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

  const visible = new Set(frame.visibleCells);
  const explored = new Set(frame.exploredCells);

  resetTransform(context);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#081012';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Terrain + fog fill in CELL space under the iso transform (each unit cell
  // renders as a diamond). The OPAQUE terrain fills overdraw by a hair to
  // close AA seams; the TRANSLUCENT fog fills draw at exact cell bounds — an
  // overdraw there would double-composite in the overlap band and paint a
  // darker diamond lattice over the shroud (any hairline seam instead shows
  // the already-gapless terrain beneath, which is invisible under the wash).
  applyIsoTransform(context, layout);
  const overdraw = 0.03;
  for (const entity of renderState.entities) {
    if (entity.layer !== 'terrain') {
      continue;
    }
    context.fillStyle = tintToCss(entity.tint);
    context.fillRect(entity.x - overdraw, entity.y - overdraw, 1 + overdraw * 2, 1 + overdraw * 2);
  }
  for (let y = 0; y < frame.mapHeight; y += 1) {
    for (let x = 0; x < frame.mapWidth; x += 1) {
      const index = y * frame.mapWidth + x;
      if (!explored.has(index)) {
        context.fillStyle = 'rgba(8, 16, 18, 0.94)';
        context.fillRect(x, y, 1, 1);
      } else if (!visible.has(index)) {
        context.fillStyle = 'rgba(10, 16, 18, 0.58)';
        context.fillRect(x, y, 1, 1);
      }
    }
  }
  resetTransform(context);

  // Entity markers: fixed-size dark-backed dots at the projected cell centre.
  // A cell on the diamond is ~hw wide, so hw is the marker scale reference.
  const cellPx = layout.hw;
  for (const entity of renderState.entities) {
    if (entity.layer === 'terrain') {
      continue;
    }
    const centre = cellToMinimap(entity.x + 0.5, entity.y + 0.5, layout);
    const markerSize =
      entity.kind === 'building' ? Math.max(cellPx * 1.4, 2) : Math.max(cellPx * 0.8, 1.5);
    const markerX = centre.x - markerSize * 0.5;
    const markerY = centre.y - markerSize * 0.5;
    const backingPad = Math.max(1, Math.min(2, cellPx * 0.2));

    context.fillStyle = MARKER_BACKING_STYLE;
    context.fillRect(
      markerX - backingPad,
      markerY - backingPad,
      markerSize + backingPad * 2,
      markerSize + backingPad * 2,
    );
    context.fillStyle = tintToCss(entity.tint);
    context.fillRect(markerX, markerY, markerSize, markerSize);
  }

  const viewportState = getMinimapViewportState(layout, cameraState);
  setMinimapViewportDataset(canvas, viewportState);
  if (viewportState) {
    const [a, b, c, d] = viewportState.points;
    context.beginPath();
    context.moveTo(a!.x, a!.y);
    context.lineTo(b!.x, b!.y);
    context.lineTo(c!.x, c!.y);
    context.lineTo(d!.x, d!.y);
    context.closePath();
    context.fillStyle = 'rgba(247, 229, 165, 0.08)';
    context.fill();
    context.strokeStyle = 'rgba(247, 229, 165, 0.95)';
    context.lineWidth = 1.5;
    context.stroke();
  }
}
