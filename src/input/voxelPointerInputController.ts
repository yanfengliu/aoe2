import type { SimulationBridge } from '../game/simulation/createSimulationBridge';
import {
  HUMAN_PLAYER_ID,
} from '../game/simulation/prototypeScenario';
import type { ProjectedEntityView } from '../game/simulation/types';
import { isoToWorld } from '../rendering/isometricProjection';
import {
  isDragSelectableEntity,
  isoDragPixelBounds,
  marqueePreviewEntities,
} from '../rendering/isoViewHelpers';
import {
  CELL_SIZE,
  DRAG_SELECTION_THRESHOLD_PX,
  type DragSelectionState,
  type MiddleDragPanState,
  type SelectionBoxState,
} from '../rendering/viewTypes';
import type {
  VoxelCameraController,
  VoxelPointerState,
} from './voxelCameraController';

export interface VoxelPointerInputControllerDeps {
  readonly canvas: HTMLCanvasElement;
  readonly getBridge: () => SimulationBridge;
  readonly getCameraController: () => VoxelCameraController;
  readonly getDisplayedEntities: () => ProjectedEntityView[];
  readonly selectEntityAtWorldPosition: (
    worldX: number,
    worldY: number,
    isoX: number,
    isoY: number,
  ) => boolean;
  // M6 control: attack-move arming state, owned by the app so the HUD and the
  // hotkey can both drive it. Optional so existing callers/tests are unaffected.
  readonly armedGroundOrder?: () => 'attack-move' | 'patrol' | 'attack-ground' | null;
  readonly disarmGroundOrder?: () => void;
  readonly issueAttackMoveCommand?: (cellX: number, cellY: number) => boolean;
  readonly issuePatrolCommand?: (cellX: number, cellY: number) => boolean;
  readonly issueAttackGroundCommand?: (cellX: number, cellY: number) => boolean;
  readonly issueContextCommandAtWorldPosition: (
    worldX: number,
    worldY: number,
    isoX: number,
    isoY: number,
    /** Alt held: the player explicitly asked to garrison (spec §9.3). */
    garrison?: boolean,
    /** Ctrl held: explicit attack — the only way to target an ally. */
    forceAttack?: boolean,
    /** Shift held: queue the ground click as a movement waypoint (v0.3.125). */
    queueMove?: boolean,
  ) => boolean;
  readonly clearRecentSelectionClicks: () => void;
}

export interface VoxelPointerInputController {
  isDragSelecting(): boolean;
  isMiddleDragging(): boolean;
  getSelectionBoxState(): SelectionBoxState | null;
  getSelectionBoxKey(): string;
  getPointerState(): VoxelPointerState;
  reset(): void;
  dispose(): void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createVoxelPointerInputController(
  deps: VoxelPointerInputControllerDeps,
): VoxelPointerInputController {
  const canvas = deps.canvas;
  let dragSelection: DragSelectionState | null = null;
  let middleDragPan: MiddleDragPanState | null = null;
  let pointerState: VoxelPointerState = { x: 0, y: 0, hasMoved: false, isDown: false };

  function localPoint(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function isDragSelectionActive(candidate: DragSelectionState): boolean {
    return Math.abs(candidate.currentScreenX - candidate.startScreenX)
      >= DRAG_SELECTION_THRESHOLD_PX
      || Math.abs(candidate.currentScreenY - candidate.startScreenY)
      >= DRAG_SELECTION_THRESHOLD_PX;
  }

  function previewEntities(candidate: DragSelectionState): ProjectedEntityView[] {
    if (!isDragSelectionActive(candidate)) return [];
    const bounds = isoDragPixelBounds(
      candidate.startScreenX,
      candidate.startScreenY,
      candidate.currentScreenX,
      candidate.currentScreenY,
      (x, y) => deps.getCameraController().screenToIso(x, y),
    );
    return marqueePreviewEntities(
      deps.getDisplayedEntities(),
      bounds,
      (entity) => isDragSelectableEntity(entity, HUMAN_PLAYER_ID),
      CELL_SIZE,
    );
  }

  function selectionBoxState(): SelectionBoxState | null {
    if (!dragSelection || !isDragSelectionActive(dragSelection)) return null;
    return {
      active: true,
      startX: dragSelection.startScreenX,
      startY: dragSelection.startScreenY,
      currentX: dragSelection.currentScreenX,
      currentY: dragSelection.currentScreenY,
      width: Math.abs(dragSelection.currentScreenX - dragSelection.startScreenX),
      height: Math.abs(dragSelection.currentScreenY - dragSelection.startScreenY),
      previewEntityIds: deps.getBridge().filterSelectableUnitIds(
        previewEntities(dragSelection).map((entity) => entity.id),
      ),
    };
  }

  function worldCellAt(x: number, y: number): {
    x: number;
    y: number;
    isoX: number;
    isoY: number;
  } {
    const iso = deps.getCameraController().screenToIso(x, y);
    const cell = isoToWorld(iso.x, iso.y);
    return { x: cell.cellX, y: cell.cellY, isoX: iso.x, isoY: iso.y };
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const camera = deps.getCameraController();
    camera.setZoom(camera.getState().zoom - event.deltaY * 0.001);
  }

  function handlePointerDown(event: PointerEvent): void {
    const point = localPoint(event);
    pointerState = { x: point.x, y: point.y, hasMoved: true, isDown: true };
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can fail when the browser has already canceled it.
    }
    const armedOrder = event.button === 0 ? deps.armedGroundOrder?.() : null;
    if (armedOrder) {
      // M6 control: the player armed a ground order (A for attack-move, P for
      // patrol) and this left click is its destination, exactly like AoE2.
      // Disarm FIRST so a rejected order cannot leave the cursor stuck.
      event.preventDefault();
      const cell = worldCellAt(point.x, point.y);
      deps.disarmGroundOrder?.();
      if (armedOrder === 'patrol') deps.issuePatrolCommand?.(cell.x, cell.y);
      else if (armedOrder === 'attack-ground') deps.issueAttackGroundCommand?.(cell.x, cell.y);
      else deps.issueAttackMoveCommand?.(cell.x, cell.y);
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      // A right-click cancels an armed ground order rather than issuing one.
      deps.disarmGroundOrder?.();
      deps.clearRecentSelectionClicks();
      const cell = worldCellAt(point.x, point.y);
      // Alt+right-click = garrison; Ctrl+right-click = explicit attack (the
      // deliberate order that can hit an ALLY); plain right-click moves (§9.3).
      deps.issueContextCommandAtWorldPosition(
        cell.x,
        cell.y,
        cell.isoX,
        cell.isoY,
        event.altKey,
        event.ctrlKey,
        event.shiftKey,
      );
      return;
    }
    if (event.button === 1) {
      event.preventDefault();
      middleDragPan = {
        pointerId: event.pointerId,
        lastScreenX: point.x,
        lastScreenY: point.y,
      };
      dragSelection = null;
      deps.clearRecentSelectionClicks();
      return;
    }
    if (event.button !== 0 || deps.getBridge().getSelectionState().placementMode) return;
    dragSelection = {
      pointerId: event.pointerId,
      startScreenX: point.x,
      startScreenY: point.y,
      currentScreenX: point.x,
      currentScreenY: point.y,
    };
  }

  function handlePointerMove(event: PointerEvent): void {
    const point = localPoint(event);
    pointerState = { x: point.x, y: point.y, hasMoved: true, isDown: event.buttons !== 0 };
    if (middleDragPan && event.pointerId === middleDragPan.pointerId && (event.buttons & 4) !== 0) {
      deps.getCameraController().panByMiddleDrag(
        point.x - middleDragPan.lastScreenX,
        point.y - middleDragPan.lastScreenY,
      );
      middleDragPan.lastScreenX = point.x;
      middleDragPan.lastScreenY = point.y;
    }
    if (dragSelection && event.pointerId === dragSelection.pointerId && (event.buttons & 1) !== 0) {
      dragSelection.currentScreenX = point.x;
      dragSelection.currentScreenY = point.y;
    }
  }

  function handlePointerUp(event: PointerEvent): void {
    const point = localPoint(event);
    pointerState = { x: point.x, y: point.y, hasMoved: true, isDown: false };
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // Releasing an already-canceled pointer is harmless.
    }
    if (event.button === 1 && middleDragPan?.pointerId === event.pointerId) {
      middleDragPan = null;
      return;
    }
    if (event.button !== 0) return;
    const cell = worldCellAt(point.x, point.y);
    const map = deps.getBridge().getMapSize();
    const cellX = clamp(Math.floor(cell.x), 0, map.width - 1);
    const cellY = clamp(Math.floor(cell.y), 0, map.height - 1);
    if (deps.getBridge().getSelectionState().placementMode) {
      deps.clearRecentSelectionClicks();
      deps.getBridge().confirmBuildingPlacement(cellX, cellY);
      return;
    }
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) return;
    dragSelection.currentScreenX = point.x;
    dragSelection.currentScreenY = point.y;
    const completed = dragSelection;
    dragSelection = null;
    if (isDragSelectionActive(completed)) {
      const didSelect = deps.getBridge().selectUnitsByIds(
        previewEntities(completed).map((entity) => entity.id),
      );
      deps.clearRecentSelectionClicks();
      if (!didSelect) deps.getBridge().clearSelection();
      return;
    }
    deps.selectEntityAtWorldPosition(cell.x, cell.y, cell.isoX, cell.isoY);
  }

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (dragSelection?.pointerId === event.pointerId) dragSelection = null;
    if (middleDragPan?.pointerId === event.pointerId) middleDragPan = null;
    pointerState = { ...pointerState, isDown: false };
  }

  function reset(): void {
    dragSelection = null;
    middleDragPan = null;
    pointerState = { x: 0, y: 0, hasMoved: false, isDown: false };
  }

  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);
  canvas.addEventListener('contextmenu', handleContextMenu);

  return {
    isDragSelecting: () => dragSelection !== null,
    isMiddleDragging: () => middleDragPan !== null,
    getSelectionBoxState: selectionBoxState,
    getSelectionBoxKey: () => {
      if (!dragSelection || !isDragSelectionActive(dragSelection)) return 'none';
      return [
        dragSelection.startScreenX,
        dragSelection.startScreenY,
        dragSelection.currentScreenX,
        dragSelection.currentScreenY,
      ].join(',');
    },
    getPointerState: () => pointerState,
    reset,
    dispose() {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      reset();
    },
  };
}
