// Camera + edge-pan controller factored out of `GameScene.ts`. Same
// dep-bag factory pattern as the other `gameScene/` extractions. The
// controller owns:
//   - the per-frame `update` cycle that applies WASD / arrow-key scroll,
//     edge-pan from pointer proximity, then clamps to world bounds;
//   - middle-mouse drag pan (pointer_move handler in GameScene routes
//     here);
//   - world-bounded zoom (wheel handler does the same);
//   - the public camera queries the HUD + browser test API consume
//     (`getCameraState`, `centerOn`, `getScreenPointForCell`), kept
//     public with their original shapes so consumers stay unchanged.
//
// Fullscreen detection and edge-pan hover-delay tracking live in this
// module so the scene no longer carries the state for it.

import Phaser from 'phaser';

const EDGE_PAN_THRESHOLD_PX = 20;
const EDGE_PAN_SPEED_PX_PER_SECOND = 480;
const EDGE_PAN_HOVER_DELAY_MS = 500;
const MIDDLE_DRAG_PAN_MIN_DELTA_PX = 0.5;
const MIN_CAMERA_ZOOM = 0.7;
const MAX_CAMERA_ZOOM = 2.4;
const INITIAL_CAMERA_ZOOM = 1.4;
const FULLSCREEN_WINDOW_TOLERANCE_PX = 2;
const KEYBOARD_SCROLL_SPEED_PX_PER_SECOND = 420;

interface EdgePanState {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  sinceMs: number;
}

export interface CameraStateSnapshot {
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

export interface CameraControllerDeps {
  // The Phaser scene handle. The controller uses it only for `sys.isActive`,
  // `scale`, `input.activePointer`, and `game.canvas`. It does NOT hold
  // simulation or selection state.
  scene: Phaser.Scene;
  camera: Phaser.Cameras.Scene2D.Camera;
  cellSize: number;
  mapWidth: number;
  mapHeight: number;
  // Scene-owned predicates so the controller can skip edge-pan while the
  // player is actively drag-selecting or middle-dragging.
  isDragSelecting: () => boolean;
  isMiddleDragging: () => boolean;
}

export interface CameraController {
  initialZoom: number;
  readonly maxZoom: number;
  readonly minimumBaseZoom: number;

  // Wired into Phaser's update loop. Consumes keyboard state via the
  // `cursors` / `wasd` key objects resolved during scene `create`.
  update(
    time: number,
    delta: number,
    keys: {
      cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
      wasd: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key> | undefined;
    },
  ): void;

  // Called from GameScene's `pointermove` handler for middle-button drag.
  panByMiddleDrag(deltaScreenX: number, deltaScreenY: number): void;

  // Called from the wheel handler. Absolute zoom value.
  setZoom(zoom: number): void;

  // Camera world-bounds clamp. Runs after every camera-moving operation
  // so the viewport never exposes out-of-world area.
  clampToWorld(): void;

  // Public query helpers — bridged to the HUD and the browser test API.
  getState(): CameraStateSnapshot | null;
  centerOnWorldPosition(worldX: number, worldY: number): void;
  getScreenPointForCell(cellX: number, cellY: number): { x: number; y: number } | null;
  resetEdgePanState(): void;
}

export function createCameraController(deps: CameraControllerDeps): CameraController {
  const {
    scene,
    camera,
    cellSize,
    mapWidth,
    mapHeight,
    isDragSelecting,
    isMiddleDragging,
  } = deps;

  let edgePanState: EdgePanState | null = null;

  function worldWidthPx(): number {
    return mapWidth * cellSize;
  }

  function worldHeightPx(): number {
    return mapHeight * cellSize;
  }

  function getMinimumCameraZoom(): number {
    return Math.max(
      MIN_CAMERA_ZOOM,
      camera.width / worldWidthPx(),
      camera.height / worldHeightPx(),
    );
  }

  function getCameraScrollBounds(): {
    minScrollX: number;
    maxScrollX: number;
    minScrollY: number;
    maxScrollY: number;
  } {
    const viewWidth = camera.width / camera.zoom;
    const viewHeight = camera.height / camera.zoom;
    const minScrollX = (viewWidth - camera.width) * 0.5;
    const maxScrollX = worldWidthPx() - (camera.width + viewWidth) * 0.5;
    const minScrollY = (viewHeight - camera.height) * 0.5;
    const maxScrollY = worldHeightPx() - (camera.height + viewHeight) * 0.5;

    return {
      minScrollX,
      maxScrollX: Math.max(minScrollX, maxScrollX),
      minScrollY,
      maxScrollY: Math.max(minScrollY, maxScrollY),
    };
  }

  function clampToWorld(): void {
    if (!scene.sys.isActive()) {
      return;
    }

    const minimumZoom = getMinimumCameraZoom();
    const clampedZoom = Phaser.Math.Clamp(camera.zoom, minimumZoom, MAX_CAMERA_ZOOM);
    if (camera.zoom !== clampedZoom) {
      camera.setZoom(clampedZoom);
    }

    const { minScrollX, maxScrollX, minScrollY, maxScrollY } = getCameraScrollBounds();
    camera.scrollX = Phaser.Math.Clamp(camera.scrollX, minScrollX, maxScrollX);
    camera.scrollY = Phaser.Math.Clamp(camera.scrollY, minScrollY, maxScrollY);
  }

  function setZoom(nextZoom: number): void {
    const minimumZoom = getMinimumCameraZoom();
    const clampedZoom = Phaser.Math.Clamp(nextZoom, minimumZoom, MAX_CAMERA_ZOOM);
    camera.setZoom(clampedZoom);
    clampToWorld();
  }

  function isEdgePanEnabled(): boolean {
    const ownerDocument = scene.game.canvas?.ownerDocument;
    const fullscreenElement = ownerDocument?.fullscreenElement;
    const canvas = scene.game.canvas;
    if (fullscreenElement != null && canvas != null && fullscreenElement.contains(canvas)) {
      return true;
    }

    const view = ownerDocument?.defaultView;
    const screenWidth = view?.screen.width ?? 0;
    const screenHeight = view?.screen.height ?? 0;
    if (!view || screenWidth <= 0 || screenHeight <= 0) {
      return false;
    }

    return (
      Math.abs(view.outerWidth - screenWidth) <= FULLSCREEN_WINDOW_TOLERANCE_PX
      && Math.abs(view.outerHeight - screenHeight) <= FULLSCREEN_WINDOW_TOLERANCE_PX
    );
  }

  function getEdgePanDelta(time: number): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } {
    if (!isEdgePanEnabled()) {
      edgePanState = null;
      return { dx: 0, dy: 0 };
    }

    const pointer = scene.input.activePointer;
    const width = scene.scale.width;
    const height = scene.scale.height;
    // Once the game is fullscreen, activePointer still defaults to (0, 0),
    // which is inside the NW edge zone. Wait for a real mousemove on the
    // canvas before trusting it.
    if (
      pointer.moveTime === 0
      || pointer.isDown
      || pointer.x < 0
      || pointer.y < 0
      || pointer.x > width
      || pointer.y > height
    ) {
      edgePanState = null;
      return { dx: 0, dy: 0 };
    }

    const dx =
      pointer.x <= EDGE_PAN_THRESHOLD_PX ? -1
      : pointer.x >= width - EDGE_PAN_THRESHOLD_PX ? 1
      : 0;
    const dy =
      pointer.y <= EDGE_PAN_THRESHOLD_PX ? -1
      : pointer.y >= height - EDGE_PAN_THRESHOLD_PX ? 1
      : 0;

    if (dx === 0 && dy === 0) {
      edgePanState = null;
      return { dx: 0, dy: 0 };
    }

    if (
      edgePanState === null
      || edgePanState.dx !== dx
      || edgePanState.dy !== dy
    ) {
      edgePanState = {
        dx,
        dy,
        sinceMs: time,
      };
      return { dx: 0, dy: 0 };
    }

    if (time - edgePanState.sinceMs < EDGE_PAN_HOVER_DELAY_MS) {
      return { dx: 0, dy: 0 };
    }

    return { dx, dy };
  }

  function update(
    time: number,
    delta: number,
    keys: {
      cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
      wasd: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key> | undefined;
    },
  ): void {
    const { cursors, wasd } = keys;
    const speed = (delta / 1000) * KEYBOARD_SCROLL_SPEED_PX_PER_SECOND;
    const edgePanSpeed = (delta / 1000) * EDGE_PAN_SPEED_PX_PER_SECOND;

    if (cursors?.left.isDown || wasd?.A.isDown) {
      camera.scrollX -= speed;
    }
    if (cursors?.right.isDown || wasd?.D.isDown) {
      camera.scrollX += speed;
    }
    if (cursors?.up.isDown || wasd?.W.isDown) {
      camera.scrollY -= speed;
    }
    if (cursors?.down.isDown || wasd?.S.isDown) {
      camera.scrollY += speed;
    }

    if (!isMiddleDragging() && !isDragSelecting()) {
      const edgePan = getEdgePanDelta(time);
      if (edgePan.dx !== 0) {
        camera.scrollX += edgePan.dx * edgePanSpeed;
      }
      if (edgePan.dy !== 0) {
        camera.scrollY += edgePan.dy * edgePanSpeed;
      }
    }

    clampToWorld();
  }

  function panByMiddleDrag(deltaScreenX: number, deltaScreenY: number): void {
    if (
      Math.abs(deltaScreenX) < MIDDLE_DRAG_PAN_MIN_DELTA_PX
      && Math.abs(deltaScreenY) < MIDDLE_DRAG_PAN_MIN_DELTA_PX
    ) {
      return;
    }

    camera.scrollX -= deltaScreenX / camera.zoom;
    camera.scrollY -= deltaScreenY / camera.zoom;
    clampToWorld();
  }

  function getState(): CameraStateSnapshot | null {
    if (!scene.sys.isActive()) {
      return null;
    }

    clampToWorld();

    const viewWidth = camera.width / camera.zoom;
    const viewHeight = camera.height / camera.zoom;
    const viewX = camera.scrollX + (camera.width - viewWidth) * 0.5;
    const viewY = camera.scrollY + (camera.height - viewHeight) * 0.5;

    return {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
      width: camera.width,
      height: camera.height,
      viewX,
      viewY,
      viewWidth,
      viewHeight,
    };
  }

  function centerOnWorldPosition(worldX: number, worldY: number): void {
    if (!scene.sys.isActive()) {
      return;
    }

    camera.centerOn(worldX, worldY);
    clampToWorld();
  }

  function getScreenPointForCell(
    cellX: number,
    cellY: number,
  ): { x: number; y: number } | null {
    if (!scene.sys.isActive() || !scene.game.canvas) {
      return null;
    }

    const worldX = cellX * cellSize + cellSize * 0.5;
    const worldY = cellY * cellSize + cellSize * 0.5;
    const bounds = scene.game.canvas.getBoundingClientRect();
    const worldView = camera.worldView;
    const scaleX = bounds.width / worldView.width;
    const scaleY = bounds.height / worldView.height;

    return {
      x: bounds.left + (worldX - worldView.x) * scaleX,
      y: bounds.top + (worldY - worldView.y) * scaleY,
    };
  }

  function resetEdgePanState(): void {
    edgePanState = null;
  }

  return {
    initialZoom: INITIAL_CAMERA_ZOOM,
    maxZoom: MAX_CAMERA_ZOOM,
    minimumBaseZoom: MIN_CAMERA_ZOOM,
    update,
    panByMiddleDrag,
    setZoom,
    clampToWorld,
    getState,
    centerOnWorldPosition,
    getScreenPointForCell,
    resetEdgePanState,
  };
}
