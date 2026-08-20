import { isoToWorld, worldToIso } from '../rendering/isometricProjection';
import type { CameraState } from '../rendering/viewTypes';

const EDGE_PAN_THRESHOLD_PX = 20;
const EDGE_PAN_SPEED_PX_PER_SECOND = 480;
const EDGE_PAN_HOVER_DELAY_MS = 500;
const MIN_CAMERA_ZOOM = 0.7;
const MAX_CAMERA_ZOOM = 2.4;
const INITIAL_CAMERA_ZOOM = 2.0;
const KEYBOARD_SCROLL_SPEED_PX_PER_SECOND = 420;

export interface VoxelPointerState {
  readonly x: number;
  readonly y: number;
  readonly hasMoved: boolean;
  readonly isDown: boolean;
}

export interface VoxelCameraControllerDeps {
  readonly canvas: HTMLCanvasElement;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly getPressedKeys: () => ReadonlySet<string>;
  readonly getPointerState: () => VoxelPointerState;
  readonly isDragSelecting: () => boolean;
  readonly isMiddleDragging: () => boolean;
}

export interface VoxelCameraController {
  readonly initialZoom: number;
  readonly maxZoom: number;
  readonly minimumBaseZoom: number;
  update(timeMs: number, deltaMs: number): void;
  resize(width: number, height: number): void;
  panByMiddleDrag(deltaScreenX: number, deltaScreenY: number): void;
  setZoom(zoom: number): void;
  centerOnWorldPosition(cellX: number, cellY: number): void;
  screenToIso(screenX: number, screenY: number): { x: number; y: number };
  getScreenPointForCell(cellX: number, cellY: number): { x: number; y: number };
  getState(): CameraState;
  resetEdgePanState(): void;
}

interface EdgePanState {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  sinceMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createVoxelCameraController(
  deps: VoxelCameraControllerDeps,
): VoxelCameraController {
  let width = Math.max(1, deps.canvas.clientWidth || deps.canvas.width || 1);
  let height = Math.max(1, deps.canvas.clientHeight || deps.canvas.height || 1);
  let zoom = INITIAL_CAMERA_ZOOM;
  let centerX = 0;
  let centerY = 0;
  let edgePanState: EdgePanState | null = null;

  function worldExtent(): { minX: number; minY: number; maxX: number; maxY: number } {
    const corners = [
      worldToIso(0, 0),
      worldToIso(deps.mapWidth, 0),
      worldToIso(0, deps.mapHeight),
      worldToIso(deps.mapWidth, deps.mapHeight),
    ];
    return {
      minX: Math.min(...corners.map((point) => point.x)),
      minY: Math.min(...corners.map((point) => point.y)),
      maxX: Math.max(...corners.map((point) => point.x)),
      maxY: Math.max(...corners.map((point) => point.y)),
    };
  }

  function minimumZoom(): number {
    const extent = worldExtent();
    return Math.max(
      MIN_CAMERA_ZOOM,
      width / Math.max(1, extent.maxX - extent.minX),
      height / Math.max(1, extent.maxY - extent.minY),
    );
  }

  function clampToWorld(): void {
    zoom = clamp(zoom, minimumZoom(), MAX_CAMERA_ZOOM);
    const extent = worldExtent();
    const viewWidth = width / zoom;
    const viewHeight = height / zoom;
    centerX = viewWidth >= extent.maxX - extent.minX
      ? (extent.minX + extent.maxX) / 2
      : clamp(centerX, extent.minX + viewWidth / 2, extent.maxX - viewWidth / 2);
    centerY = viewHeight >= extent.maxY - extent.minY
      ? (extent.minY + extent.maxY) / 2
      : clamp(centerY, extent.minY + viewHeight / 2, extent.maxY - viewHeight / 2);
  }

  function isEdgePanEnabled(): boolean {
    const document = deps.canvas.ownerDocument;
    if (document.fullscreenElement?.contains(deps.canvas)) return true;
    const view = document.defaultView;
    if (!view || view.screen.width <= 0 || view.screen.height <= 0) return false;
    return Math.abs(view.outerWidth - view.screen.width) <= 2
      && Math.abs(view.outerHeight - view.screen.height) <= 2;
  }

  function edgePan(timeMs: number): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } {
    const pointer = deps.getPointerState();
    if (!isEdgePanEnabled() || !pointer.hasMoved || pointer.isDown) {
      edgePanState = null;
      return { dx: 0, dy: 0 };
    }
    const dx = pointer.x <= EDGE_PAN_THRESHOLD_PX
      ? -1
      : pointer.x >= width - EDGE_PAN_THRESHOLD_PX ? 1 : 0;
    const dy = pointer.y <= EDGE_PAN_THRESHOLD_PX
      ? -1
      : pointer.y >= height - EDGE_PAN_THRESHOLD_PX ? 1 : 0;
    if (dx === 0 && dy === 0) {
      edgePanState = null;
      return { dx, dy };
    }
    if (!edgePanState || edgePanState.dx !== dx || edgePanState.dy !== dy) {
      edgePanState = { dx, dy, sinceMs: timeMs };
      return { dx: 0, dy: 0 };
    }
    return timeMs - edgePanState.sinceMs >= EDGE_PAN_HOVER_DELAY_MS
      ? { dx, dy }
      : { dx: 0, dy: 0 };
  }

  function update(timeMs: number, deltaMs: number): void {
    const keys = deps.getPressedKeys();
    const keyboardSpeed = deltaMs / 1_000 * KEYBOARD_SCROLL_SPEED_PX_PER_SECOND / zoom;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) centerX -= keyboardSpeed;
    if (keys.has('ArrowRight') || keys.has('KeyD')) centerX += keyboardSpeed;
    if (keys.has('ArrowUp') || keys.has('KeyW')) centerY -= keyboardSpeed;
    if (keys.has('ArrowDown') || keys.has('KeyS')) centerY += keyboardSpeed;
    if (!deps.isMiddleDragging() && !deps.isDragSelecting()) {
      const edge = edgePan(timeMs);
      const speed = deltaMs / 1_000 * EDGE_PAN_SPEED_PX_PER_SECOND / zoom;
      centerX += edge.dx * speed;
      centerY += edge.dy * speed;
    }
    clampToWorld();
  }

  function getState(): CameraState {
    clampToWorld();
    const viewWidth = width / zoom;
    const viewHeight = height / zoom;
    const viewX = centerX - viewWidth / 2;
    const viewY = centerY - viewHeight / 2;
    return {
      scrollX: viewX,
      scrollY: viewY,
      zoom,
      width,
      height,
      viewX,
      viewY,
      viewWidth,
      viewHeight,
      viewCorners: [
        isoToWorld(viewX, viewY),
        isoToWorld(viewX + viewWidth, viewY),
        isoToWorld(viewX + viewWidth, viewY + viewHeight),
        isoToWorld(viewX, viewY + viewHeight),
      ].map((cell) => ({ cellX: cell.cellX, cellY: cell.cellY })),
    };
  }

  function screenToIso(screenX: number, screenY: number): { x: number; y: number } {
    const state = getState();
    return {
      x: state.viewX + screenX / width * state.viewWidth,
      y: state.viewY + screenY / height * state.viewHeight,
    };
  }

  function getScreenPointForCell(cellX: number, cellY: number): { x: number; y: number } {
    const state = getState();
    const point = worldToIso(cellX + 0.5, cellY + 0.5);
    const rect = deps.canvas.getBoundingClientRect();
    return {
      x: rect.left + (point.x - state.viewX) / state.viewWidth * rect.width,
      y: rect.top + (point.y - state.viewY) / state.viewHeight * rect.height,
    };
  }

  return {
    initialZoom: INITIAL_CAMERA_ZOOM,
    maxZoom: MAX_CAMERA_ZOOM,
    minimumBaseZoom: MIN_CAMERA_ZOOM,
    update,
    resize(nextWidth, nextHeight) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      clampToWorld();
    },
    panByMiddleDrag(dx, dy) {
      centerX -= dx / zoom;
      centerY -= dy / zoom;
      clampToWorld();
    },
    setZoom(nextZoom) {
      zoom = nextZoom;
      clampToWorld();
    },
    centerOnWorldPosition(cellX, cellY) {
      const point = worldToIso(cellX, cellY);
      centerX = point.x;
      centerY = point.y;
      clampToWorld();
    },
    screenToIso,
    getScreenPointForCell,
    getState,
    resetEdgePanState() {
      edgePanState = null;
    },
  };
}
