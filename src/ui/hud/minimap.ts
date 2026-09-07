import type { RenderState } from '../../game/simulation/types';
import {
  attackWarningSignature,
  getAttackWarning,
  type AttackWarningMark,
} from './attackWarning';

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
  // The visible iso-pixel rectangle's 4 corners in CELL space, polygon order.
  viewCorners: readonly { cellX: number; cellY: number }[];
}

// M9: the minimap only repaints when its CONTENT or the camera viewport
// changes. Content = tick + fog OWNER: a replay can swap the bridge to a
// different player's fog perspective at the SAME paused tick (frame.playerId
// changes, tick does not), so keying the repaint on tick alone would keep the
// minimap showing the prior owner's visibility until a tick/camera change.
// v0.3.215: the attack-warning mark pulses on its own clock, so its quantised
// phase joins the key — otherwise a paused or still frame would freeze the
// mark mid-pulse. The term is EMPTY while no warning is up, so a quiet frame's
// key is exactly what it was before the mark existed.
export function minimapContentSignature(
  renderState: RenderState,
  warning = attackWarningSignature(),
): string {
  return `${renderState.tick}:${renderState.frame?.playerId ?? -1}:${warning}`;
}

export function minimapCameraSignature(cameraState: MinimapCameraState | null): string {
  return cameraState
    ? `${cameraState.scrollX.toFixed(2)},${cameraState.scrollY.toFixed(2)},${cameraState.zoom.toFixed(3)}`
    : 'none';
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
  // Full-review M8: project the 4 real view corners directly. Projecting the
  // cell-space AABB corners instead drew an oversized circumscribing diamond.
  return {
    points: cameraState.viewCorners.map((c) => cellToMinimap(c.cellX, c.cellY, layout)),
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

// The attack-warning mark (v0.3.215): a pulsing red ring around a filled dot
// at the cell that was hit, drawn ON the minimap rather than floating over it
// — nothing may cover the minimap, and AoE2's own affordance is the minimap
// itself flashing. Sized well above a building marker (which is `cellPx*1.4`)
// so it is findable at a glance on a 160px canvas, and dark-backed like every
// other marker so it reads over grass, sand and shore alike.
// The core is WHITE-HOT, not red. Two reasons and both matter: owner 2's tint
// is itself a red, so a red mark beside a red raider is a mark you have to
// look for — and nothing else this minimap draws comes near white (terrain,
// every player tint, the fog wash and the pale viewport outline all have a
// minimum channel under 182, measured 2026-09-06), so "is the warning on
// screen?" has an unambiguous answer in the pixels.
const ALERT_CORE_STYLE = 'rgb(255, 250, 245)';
const ALERT_RING_STYLE = '255, 96, 78';

function drawAttackWarning(
  context: CanvasRenderingContext2D,
  layout: MinimapLayout,
  mark: AttackWarningMark,
): void {
  const centre = cellToMinimap(mark.x + 0.5, mark.y + 0.5, layout);
  const core = Math.max(layout.hw * 1.3, 3);
  const ring = Math.max(layout.hw * 3.4, 7) * (0.72 + 0.28 * mark.intensity);
  context.beginPath();
  context.arc(centre.x, centre.y, ring + 1.5, 0, Math.PI * 2);
  context.fillStyle = MARKER_BACKING_STYLE;
  context.fill();
  context.beginPath();
  context.arc(centre.x, centre.y, ring, 0, Math.PI * 2);
  context.strokeStyle = `rgba(${ALERT_RING_STYLE}, ${(0.35 + 0.65 * mark.intensity).toFixed(3)})`;
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.arc(centre.x, centre.y, core, 0, Math.PI * 2);
  context.fillStyle = ALERT_CORE_STYLE;
  context.fill();
}

// Draws the terrain / entity / fog layers as an iso diamond, then overlays the
// camera viewport quad and any attack-warning mark. The `viewport*` and
// `attackWarning*` datasets are mirrored for browser tests.
export function drawMinimap(
  canvas: HTMLCanvasElement,
  renderState: RenderState,
  cameraState: MinimapCameraState | null,
  warning: AttackWarningMark | null = getAttackWarning(),
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

  if (warning) {
    drawAttackWarning(context, layout, warning);
    canvas.dataset.attackWarningCell = `${warning.x},${warning.y}`;
  } else {
    delete canvas.dataset.attackWarningCell;
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
