// Barrel module that re-exports every gameTestHelpers helper and type
// from the per-theme sub-files. The consumers (all Playwright spec files
// under `tests/browser/`) pull these names through this file so adding a
// new helper means dropping it into the right sub-module and re-exporting
// it here.

export type {
  DisplayedEntityState,
  HudChipRect,
  MinimapStats,
  MinimapViewportState,
  RenderedEntityStateWithSize,
  RenderedUnitState,
  ScreenPoint,
  SelectionBoxPreviewState,
} from './gameTestHelpers/types';

export {
  getSnapshot,
  waitForBoot,
  waitForBootWithSeed,
  waitForPausedBootWithSeed,
} from './gameTestHelpers/snapshot';

export {
  emulateMonitorSize,
  enterGameFullscreen,
  exitFullscreen,
  getGameCanvasBounds,
  getGameCanvasMetrics,
  getMinimapPoint,
  getScreenPointForCell,
  getScreenPointForWorldPosition,
} from './gameTestHelpers/camera';

export {
  clickCanvasAtPoint,
  clickCell,
  clickMinimapAt,
  clickWorldPosition,
  dragMinimapTo,
  moveMouseToCell,
} from './gameTestHelpers/command';

export {
  doubleClickWorldPosition,
  dragSelectCells,
  dragSelectWorldRect,
  getOwnedResourceCells,
  getOwnedUnitCells,
  selectOwnedBuildingAtDirect,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
} from './gameTestHelpers/selection';

export {
  expectSelectionDetail,
  expectSelectionDetailAbsent,
  getBuildingVisualState,
  getDisplayedEntityState,
  getEntityHealthBarState,
  getHudChipKeys,
  getHudChipRects,
  getMinimapStats,
  getMinimapViewportState,
  getRenderedOwnedEntitiesByType,
  getRenderedOwnedUnits,
} from './gameTestHelpers/hud';

export {
  findValidPlacementNearTownCenter,
} from './gameTestHelpers/placement';
