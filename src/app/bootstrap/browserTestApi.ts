import type Phaser from 'phaser';

import type {
  EconomyState,
  HudState,
  PlacementPreviewState,
  RenderState,
  SelectionState,
} from '../../game/simulation/types';
import type {
  CameraState,
  GameScene,
  PlacementPreviewViewState,
  SelectionBoxState,
} from '../../phaser/scenes/GameScene';

interface BrowserTestBridge {
  step(deltaMs: number): void;
  getHudState(): HudState;
  getRenderState(): RenderState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  selectEntityAtCell(x: number, y: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number): boolean;
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
  worldToScreen(cellX: number, cellY: number): { x: number; y: number };
  selectEntityAtCell(cellX: number, cellY: number): boolean;
  clearSelection(): void;
  issueContextCommand(cellX: number, cellY: number): boolean;
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
  return {
    hudState: bridge.getHudState(),
    renderState: bridge.getRenderState(),
    economyState: bridge.getEconomyState(),
    selectionState: bridge.getSelectionState(),
    cameraState: scene.getCameraState(),
  };
}

export function installBrowserTestApi(
  target: Window,
  game: Phaser.Game,
  bridge: BrowserTestBridge,
  scene: GameScene,
): void {
  target.__AOE2_TEST__ = {
    isBooted: () => game.isBooted && scene.scene.isActive(),
    getHudState: () => bridge.getHudState(),
    getRenderState: () => bridge.getRenderState(),
    getEconomyState: () => bridge.getEconomyState(),
    getSelectionState: () => bridge.getSelectionState(),
    getCameraState: () => scene.getCameraState(),
    getSelectionBoxState: () => scene.getSelectionBoxState(),
    getPlacementPreviewState: () => scene.getPlacementPreviewState(),
    worldToScreen: (cellX: number, cellY: number) => {
      const point = scene.getScreenPointForCell(cellX, cellY);
      if (!point) {
        throw new Error('Game scene is not ready to project screen coordinates.');
      }
      return point;
    },
    selectEntityAtCell: (cellX: number, cellY: number) => bridge.selectEntityAtCell(cellX, cellY),
    clearSelection: () => bridge.clearSelection(),
    issueContextCommand: (cellX: number, cellY: number) => bridge.issueContextCommand(cellX, cellY),
    getSnapshot: () => getSnapshot(bridge, scene),
    advanceTicks: (count: number, deltaMs = 100) => {
      const safeCount = Math.max(0, Math.floor(count));
      const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 100;

      for (let index = 0; index < safeCount; index += 1) {
        bridge.step(safeDeltaMs);
      }

      return getSnapshot(bridge, scene);
    },
  };
}
