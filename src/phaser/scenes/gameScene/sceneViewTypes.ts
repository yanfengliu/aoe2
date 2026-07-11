// Shared view-state types and layout constants consumed by GameScene and its
// gameScene/ render + input modules. These are the introspection shapes the
// browser test API reads; GameScene re-exports the public ones so external
// importers keep resolving them from '../scenes/GameScene'.

import type {
  PlacementPreviewState,
  ProjectedEntityView,
  UnitType,
} from '../../../game/simulation/types';

// Slice 11: debug-overlay modes relevant to world-space drawing. The HUD
// owns the full cycle; the scene only needs to read the current mode to
// decide whether to draw selection rectangles, pathing lines, or fog tints.
// Slice 12 Task D adds `coarse-vs-fine` for the sub-grid probe overlay.
export type DebugOverlayMode =
  | 'off'
  | 'selection-bounds'
  | 'pathing'
  | 'fog-state'
  | 'ai-state'
  | 'perf'
  | 'coarse-vs-fine';

export interface GameSceneOptions {
  getDebugOverlayMode(): DebugOverlayMode;
}

export const CELL_SIZE = 24;

export interface CameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
  // Visible iso-pixel rectangle's 4 corners in CELL space, polygon order (full-review M8).
  viewCorners: readonly { cellX: number; cellY: number }[];
}

export interface SelectionBoxState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  width: number;
  height: number;
  previewEntityIds: number[];
}

export interface PlacementPreviewViewState {
  active: boolean;
  buildingType: PlacementPreviewState['buildingType'];
  cellX: number;
  cellY: number;
  width: number;
  height: number;
  isValid: boolean;
}

export interface PlacementPreviewVisualState extends PlacementPreviewViewState {
  strokeWidth: number;
  cellOutlineCount: number;
  blockedMarkerCount: number;
}

export interface BuildingVisualState {
  id: number;
  buildingType: ProjectedEntityView['entityType'];
  owner: number | null;
  cellX: number;
  cellY: number;
  footprintWidthCells: number;
  footprintHeightCells: number;
  widthPx: number;
  heightPx: number;
  visualVariant: ProjectedEntityView['visualVariant'];
  hasFoundationSlab: boolean;
  hasScaffoldPosts: boolean;
  hasStructureBody: boolean;
  hasRoofAccent: boolean;
  hasConstructionIndicator: boolean;
  hasCompletionAccent: boolean;
}

export interface EntityHealthBarState {
  id: number;
  entityKind: 'unit' | 'building' | 'resource';
  entityType: ProjectedEntityView['entityType'];
  owner: number | null;
  currentHp: number;
  maxHp: number;
  fillRatio: number;
  barX: number;
  barY: number;
  barWidthPx: number;
  barHeightPx: number;
  entityTopPx: number;
}

// v0.1.133: one record per unit drawn as a white "behind a building"
// silhouette this frame — lets browser tests assert the occlusion cue fired
// without reading the canvas.
export interface OccludedUnitState {
  id: number;
  x: number;
  y: number;
  entityType: ProjectedEntityView['entityType'];
}

export interface DisplayedEntityState {
  id: number;
  kind: ProjectedEntityView['kind'];
  entityType: ProjectedEntityView['entityType'];
  owner: number | null;
  x: number;
  y: number;
}

export interface DragSelectionState {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  currentScreenX: number;
  currentScreenY: number;
}

export interface MiddleDragPanState {
  pointerId: number;
  lastScreenX: number;
  lastScreenY: number;
}

export interface RecentFriendlyUnitClick {
  atMs: number;
  cellX: number;
  cellY: number;
  unitType: UnitType | 'sheep';
}

export interface RecentExactSelectionClick {
  cellX: number;
  cellY: number;
}

export const DRAG_SELECTION_THRESHOLD_PX = 8;
export const DOUBLE_CLICK_WINDOW_MS = 300;
