// Pointer + wheel input handling and drag-selection/marquee bookkeeping
// factored out of GameScene. Same dep-bag factory shape as the other
// gameScene/ extractions. The controller owns the transient `dragSelection`
// and `middleDragPan` state that used to be mutable scene fields, registers
// the scene's wheel/pointer handlers on construction (preserving their prior
// registration order), and exposes the drag-selection queries the render
// path and camera consume. Move-only: each handler branch mirrors the prior
// inline handlers and private methods on GameScene.

import Phaser from 'phaser';

import type { SimulationBridge } from '../../../game/simulation/createSimulationBridge';
import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../../../game/simulation/prototypeScenario';
import type { ProjectedEntityView } from '../../../game/simulation/types';
import type { CameraController } from './cameraController';
import { isoToWorld } from './isoProjection';
import {
  isDragSelectableEntity,
  isoDragPixelBounds,
  marqueePreviewEntities,
} from './isoViewHelpers';
import {
  CELL_SIZE,
  DRAG_SELECTION_THRESHOLD_PX,
  type DragSelectionState,
  type MiddleDragPanState,
  type SelectionBoxState,
} from './sceneViewTypes';

export interface PointerInputControllerDeps {
  // The Phaser scene handle. Used for `input` (handler registration) and
  // `cameras.main` (world-point projection). No simulation state lives here.
  scene: Phaser.Scene;
  getBridge: () => SimulationBridge;
  getCameraController: () => CameraController | undefined;
  // Snapshot of the scene's `displayedEntities`, read fresh per marquee query.
  getDisplayedEntities: () => ProjectedEntityView[];
  // Selection collaborators owned by the SelectionController; the scene wires
  // these through so the pointer handlers stay decoupled from selection state.
  selectEntityAtWorldPosition: (worldX: number, worldY: number) => boolean;
  issueContextCommandAtWorldPosition: (worldX: number, worldY: number) => boolean;
  clearRecentSelectionClicks: () => void;
}

export interface PointerInputController {
  isDragSelecting(): boolean;
  isMiddleDragging(): boolean;
  getSelectionBoxState(): SelectionBoxState | null;
  getSelectionBoxKey(): string;
  reset(): void;
}

export function createPointerInputController(
  deps: PointerInputControllerDeps,
): PointerInputController {
  const {
    scene,
    getBridge,
    getCameraController,
    getDisplayedEntities,
    selectEntityAtWorldPosition,
    issueContextCommandAtWorldPosition,
    clearRecentSelectionClicks,
  } = deps;

  let dragSelection: DragSelectionState | null = null;
  let middleDragPan: MiddleDragPanState | null = null;

  function isDragSelectionActive(candidate: DragSelectionState): boolean {
    return (
      Math.abs(candidate.currentScreenX - candidate.startScreenX) >= DRAG_SELECTION_THRESHOLD_PX
      || Math.abs(candidate.currentScreenY - candidate.startScreenY) >= DRAG_SELECTION_THRESHOLD_PX
    );
  }

  function getSelectionPreviewEntities(candidate: DragSelectionState): ProjectedEntityView[] {
    if (!isDragSelectionActive(candidate)) {
      return [];
    }
    // Iso-pixel drag bounds; the marquee hit-test projects each unit's body to
    // its iso centre in this SAME space (see isoDragPixelBounds).
    const bounds = isoDragPixelBounds(
      candidate.startScreenX,
      candidate.startScreenY,
      candidate.currentScreenX,
      candidate.currentScreenY,
      (screenX, screenY) => scene.cameras.main.getWorldPoint(screenX, screenY),
    );
    return marqueePreviewEntities(
      getDisplayedEntities(),
      bounds,
      (entity) => isDragSelectableEntity(entity, HUMAN_PLAYER_ID),
      CELL_SIZE,
    );
  }

  function getSelectionPreviewEntityIds(candidate: DragSelectionState): number[] {
    return getBridge().filterSelectableUnitIds(
      getSelectionPreviewEntities(candidate).map((entity) => entity.id),
    );
  }

  function buildSelectionBoxState(candidate: DragSelectionState): SelectionBoxState | null {
    if (!isDragSelectionActive(candidate)) {
      return null;
    }

    const width = Math.abs(candidate.currentScreenX - candidate.startScreenX);
    const height = Math.abs(candidate.currentScreenY - candidate.startScreenY);

    return {
      active: true,
      startX: candidate.startScreenX,
      startY: candidate.startScreenY,
      currentX: candidate.currentScreenX,
      currentY: candidate.currentScreenY,
      width,
      height,
      previewEntityIds: getSelectionPreviewEntityIds(candidate),
    };
  }

  function getSelectionBoxState(): SelectionBoxState | null {
    if (!dragSelection) {
      return null;
    }

    return buildSelectionBoxState(dragSelection);
  }

  function getSelectionBoxKey(): string {
    if (!dragSelection || !isDragSelectionActive(dragSelection)) {
      return 'none';
    }

    return [
      dragSelection.startScreenX,
      dragSelection.startScreenY,
      dragSelection.currentScreenX,
      dragSelection.currentScreenY,
    ].join(',');
  }

  function isDragSelecting(): boolean {
    return dragSelection !== null;
  }

  function isMiddleDragging(): boolean {
    return middleDragPan !== null;
  }

  function reset(): void {
    dragSelection = null;
    middleDragPan = null;
  }

  scene.input.on(
    'wheel',
    (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      getCameraController()?.setZoom(scene.cameras.main.zoom - dy * 0.001);
    },
  );

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.rightButtonDown()) {
      clearRecentSelectionClicks();
      const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cell = isoToWorld(worldPoint.x, worldPoint.y);
      issueContextCommandAtWorldPosition(cell.cellX, cell.cellY);
      return;
    }

    if (pointer.middleButtonDown()) {
      middleDragPan = {
        pointerId: pointer.id,
        lastScreenX: pointer.x,
        lastScreenY: pointer.y,
      };
      dragSelection = null;
      clearRecentSelectionClicks();
      return;
    }

    if (!pointer.leftButtonDown()) {
      return;
    }

    if (getBridge().getSelectionState().placementMode) {
      return;
    }

    dragSelection = {
      pointerId: pointer.id,
      startScreenX: pointer.x,
      startScreenY: pointer.y,
      currentScreenX: pointer.x,
      currentScreenY: pointer.y,
    };
  });

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (middleDragPan && pointer.id === middleDragPan.pointerId && pointer.middleButtonDown()) {
      const deltaX = pointer.x - middleDragPan.lastScreenX;
      const deltaY = pointer.y - middleDragPan.lastScreenY;
      middleDragPan.lastScreenX = pointer.x;
      middleDragPan.lastScreenY = pointer.y;
      getCameraController()?.panByMiddleDrag(deltaX, deltaY);
    }

    if (!dragSelection || pointer.id !== dragSelection.pointerId || !pointer.leftButtonDown()) {
      return;
    }

    dragSelection.currentScreenX = pointer.x;
    dragSelection.currentScreenY = pointer.y;
  });

  scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (pointer.button === 1 && middleDragPan && pointer.id === middleDragPan.pointerId) {
      middleDragPan = null;
    }

    if (pointer.button !== 0) {
      return;
    }

    if (dragSelection && pointer.id === dragSelection.pointerId) {
      dragSelection.currentScreenX = pointer.x;
      dragSelection.currentScreenY = pointer.y;
    }

    const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = isoToWorld(worldPoint.x, worldPoint.y);
    const cellX = Phaser.Math.Clamp(Math.floor(cell.cellX), 0, MAP_WIDTH - 1);
    const cellY = Phaser.Math.Clamp(Math.floor(cell.cellY), 0, MAP_HEIGHT - 1);

    if (getBridge().getSelectionState().placementMode) {
      clearRecentSelectionClicks();
      getBridge().confirmBuildingPlacement(cellX, cellY);
      return;
    }

    if (!dragSelection || pointer.id !== dragSelection.pointerId) {
      return;
    }

    const activeDragSelection = dragSelection;
    dragSelection = null;

    if (isDragSelectionActive(activeDragSelection)) {
      const didSelect = getBridge().selectUnitsByIds(
        getSelectionPreviewEntities(activeDragSelection).map((entity) => entity.id),
      );
      clearRecentSelectionClicks();
      if (!didSelect) {
        getBridge().clearSelection();
      }
      return;
    }

    selectEntityAtWorldPosition(cell.cellX, cell.cellY);
  });

  return {
    isDragSelecting,
    isMiddleDragging,
    getSelectionBoxState,
    getSelectionBoxKey,
    reset,
  };
}
