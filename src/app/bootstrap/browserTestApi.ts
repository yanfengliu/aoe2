import type Phaser from 'phaser';

import type {
  UnitType,
  EconomyState,
  HudState,
  PlacementPreviewState,
  RenderState,
  SelectionState,
} from '../../game/simulation/types';
import type {
  BuildingVisualState,
  DisplayedEntityState,
  EntityHealthBarState,
  CameraState,
  GameScene,
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from '../../phaser/scenes/GameScene';

interface BrowserTestBridge {
  step(deltaMs: number): void;
  getHudState(): HudState;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  confirmBuildingPlacement(x: number, y: number): boolean;
  selectEntityAtCell(x: number, y: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number): boolean;
  issueMoveCommand(x: number, y: number): boolean;
}

export interface BrowserTestSnapshot {
  hudState: HudState;
  renderState: RenderState;
  economyState: EconomyState;
  selectionState: SelectionState;
  cameraState: CameraState | null;
}

export interface BrowserTestApi {
  isBooted(): boolean;
  getHudState(): HudState;
  getRenderState(): RenderState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getCameraState(): CameraState | null;
  getSelectionBoxState(): SelectionBoxState | null;
  getPlacementPreviewState(): PlacementPreviewViewState | null;
  getPlacementPreviewVisualState(): PlacementPreviewVisualState | null;
  getPlacementPreviewAt(cellX: number, cellY: number): PlacementPreviewState | null;
  getBuildingVisualStates(): BuildingVisualState[];
  getEntityHealthBarStates(): EntityHealthBarState[];
  getDisplayedEntities(): DisplayedEntityState[];
  worldToScreen(cellX: number, cellY: number): { x: number; y: number };
  confirmBuildingPlacement(cellX: number, cellY: number): boolean;
  selectEntityAtWorldPosition(worldX: number, worldY: number): boolean;
  selectEntityAtCell(cellX: number, cellY: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(cellX: number, cellY: number): boolean;
  issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean;
  issueMoveCommand(cellX: number, cellY: number): boolean;
  getSnapshot(): BrowserTestSnapshot;
  advanceTicks(count: number, deltaMs?: number): BrowserTestSnapshot;
}

declare global {
  interface Window {
    __AOE2_TEST__?: BrowserTestApi;
  }
}

function getSnapshot(
  bridge: BrowserTestBridge,
  scene: GameScene,
): BrowserTestSnapshot {
  scene.syncFromBridge(true);
  return {
    hudState: bridge.getHudState(),
    renderState: bridge.getRenderState(),
    economyState: bridge.getEconomyState(),
    selectionState: bridge.getSelectionState(),
    cameraState: scene.getCameraState(),
  };
}

// Iter-3 V3-25: install once, resolve bridge dynamically. Pre-fix,
// `installBrowserTestApi` captured the bridge at install time and was
// re-called on each load — leaving any test that captured a reference
// to the prior `window.__AOE2_TEST__` object pointing at a stale
// bridge. The Playwright suite always re-resolves
// `window.__AOE2_TEST__` per call, so it didn't bite — but a future
// test holding a long-lived ref would silently observe pre-load state.
//
// New shape: pass a `getBridge: () => BrowserTestBridge` thunk.
// createApp owns the live bridge cell; the API closures resolve via
// the thunk every call. Subsequent loads only need to update the cell;
// no re-install is required. Object.freeze hardens against accidental
// mutation by tests.
export function installBrowserTestApi(
  target: Window,
  game: Phaser.Game,
  getBridge: () => BrowserTestBridge,
  scene: GameScene,
): void {
  // If an API object is already installed, reuse it: tests that
  // captured a reference now see the live bridge through the same
  // closure thunks. The earlier `target.__AOE2_TEST__ = { ... }`
  // assignment-style replacement is gone.
  if (target.__AOE2_TEST__) {
    return;
  }

  const api: BrowserTestApi = {
    isBooted: () => game.isBooted && scene.scene.isActive(),
    getHudState: () => getBridge().getHudState(),
    getRenderState: () => getBridge().getRenderState(),
    getEconomyState: () => getBridge().getEconomyState(),
    getSelectionState: () => getBridge().getSelectionState(),
    getCameraState: () => {
      scene.syncFromBridge(true);
      return scene.getCameraState();
    },
    getSelectionBoxState: () => scene.getSelectionBoxState(),
    getPlacementPreviewState: () => {
      scene.syncFromBridge(true);
      return scene.getPlacementPreviewState();
    },
    getPlacementPreviewVisualState: () => {
      scene.syncFromBridge(true);
      return scene.getPlacementPreviewVisualState();
    },
    getPlacementPreviewAt: (cellX: number, cellY: number) => {
      // Iter-3 V3-17: parity with the other getters in this API; tests
      // calling this immediately after a command (without manually
      // advancing ticks) would otherwise observe a stale preview
      // through the scene-cached path. The bridge call itself is the
      // authoritative source so the value isn't wrong without the
      // sync, but the asymmetry is a correctness footgun.
      scene.syncFromBridge(true);
      return getBridge().getPlacementPreview(cellX, cellY);
    },
    getBuildingVisualStates: () => {
      scene.syncFromBridge(true);
      return scene.getBuildingVisualStates();
    },
    getEntityHealthBarStates: () => {
      scene.syncFromBridge(true);
      return scene.getEntityHealthBarStates();
    },
    getDisplayedEntities: () => {
      scene.syncFromBridge(true);
      return scene.getDisplayedEntities();
    },
    worldToScreen: (cellX: number, cellY: number) => {
      scene.syncFromBridge(true);
      const point = scene.getScreenPointForCell(cellX, cellY);
      if (!point) {
        throw new Error('Game scene is not ready to project screen coordinates.');
      }
      return point;
    },
    selectEntityAtCell: (cellX: number, cellY: number) => {
      const didSelect = getBridge().selectEntityAtCell(cellX, cellY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    selectEntityAtWorldPosition: (worldX: number, worldY: number) => {
      const didSelect = scene.selectEntityAtWorldPosition(worldX, worldY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    selectOwnedUnitsByTypeInRect: (unitType, minX, minY, maxX, maxY) => {
      const didSelect = getBridge().selectOwnedUnitsByTypeInRect(unitType, minX, minY, maxX, maxY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    selectUnitsInBox: (minX, minY, maxX, maxY) => {
      const didSelect = getBridge().selectUnitsInBox(minX, minY, maxX, maxY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    confirmBuildingPlacement: (cellX: number, cellY: number) => {
      const didPlace = getBridge().confirmBuildingPlacement(cellX, cellY);
      scene.syncFromBridge(true);
      return didPlace;
    },
    clearSelection: () => {
      getBridge().clearSelection();
      scene.syncFromBridge(true);
    },
    issueContextCommand: (cellX: number, cellY: number) => {
      const didIssue = getBridge().issueContextCommand(cellX, cellY);
      scene.syncFromBridge(true);
      return didIssue;
    },
    issueContextCommandAtWorldPosition: (worldX: number, worldY: number) => {
      const didIssue = scene.issueContextCommandAtWorldPosition(worldX, worldY);
      scene.syncFromBridge(true);
      return didIssue;
    },
    issueMoveCommand: (cellX: number, cellY: number) => {
      const didIssue = getBridge().issueMoveCommand(cellX, cellY);
      scene.syncFromBridge(true);
      return didIssue;
    },
    getSnapshot: () => getSnapshot(getBridge(), scene),
    advanceTicks: (count: number, deltaMs = 100) => {
      const safeCount = Math.max(0, Math.floor(count));
      const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 100;
      const liveBridge = getBridge();
      for (let index = 0; index < safeCount; index += 1) {
        liveBridge.step(safeDeltaMs);
      }

      scene.syncFromBridge(true);
      return getSnapshot(liveBridge, scene);
    },
  };
  target.__AOE2_TEST__ = Object.freeze(api);
}
