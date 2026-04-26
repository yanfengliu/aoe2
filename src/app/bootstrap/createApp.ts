import Phaser from 'phaser';

import {
  createSimulationBridge,
  type SimulationBridge,
} from '../../game/simulation/createSimulationBridge';
import type { SaveBlob } from '../../game/simulation/saveSchema';
import { GameScene } from '../../phaser/scenes/GameScene';
import { createHudController } from '../../ui/hud/createHudController';
import { installBrowserTestApi } from './browserTestApi';

export function createApp(): Phaser.Game {
  const gameRoot = document.getElementById('game-root');
  const hudRoot = document.getElementById('hud-root');

  if (!gameRoot || !hudRoot) {
    throw new Error('Expected #game-root and #hud-root to exist.');
  }

  // Iter-3 V3-22: distinguish "param absent" (use DEFAULT_SEED) from
  // "param explicitly empty / whitespace" (warn + still fall through).
  // The previous expression collapsed both to undefined silently, so a
  // user typing `?seed=` to "reset" got the same canonical fixture map
  // as a user with no `?seed=` at all.
  const rawSeed = new URL(window.location.href).searchParams.get('seed');
  const trimmedSeed = rawSeed?.trim() ?? '';
  if (rawSeed !== null && trimmedSeed === '') {
    console.warn('[aoe2] ?seed= URL parameter was empty; falling back to DEFAULT_SEED.');
  }
  const seed = trimmedSeed === '' ? undefined : trimmedSeed;
  // FU5: the bridge reference is mutable so the HUD Load button can swap
  // in a rehydrated simulation. Everything downstream (scene, HUD,
  // browser test API) is rewired to the new bridge when `loadGame` fires.
  let bridge: SimulationBridge = createSimulationBridge(seed);

  // GameScene receives the debug-mode getter up front so its render loop
  // can read the current overlay mode every frame (selection-bounds,
  // pathing, etc.) without further plumbing.
  const scene = new GameScene(bridge, {
    getDebugOverlayMode: () => hudController.getDebugOverlayMode(),
  });

  function handleLoadGame(blob: SaveBlob): void {
    const nextBridge = createSimulationBridge(seed, { savedGame: blob });
    bridge = nextBridge;
    scene.setBridge(nextBridge);
    // Iter-3 V3-25: no re-install required. `installBrowserTestApi`
    // resolves the live bridge dynamically through the getter passed
    // at first install, so updating the local `bridge` cell is enough
    // for the API to reflect the swap. Holders of a long-lived
    // reference to `window.__AOE2_TEST__` continue seeing live state.
  }

  const hudController = createHudController(hudRoot, {
    // The HUD receives a stable facade whose methods always delegate to
    // the currently-live bridge, so swapping the bridge on load does not
    // require re-creating the HUD. Arrow bodies re-read `bridge` on every
    // call.
    getHudState: () => bridge.getHudState(),
    getRenderState: () => bridge.getRenderState(),
    getEconomyState: () => bridge.getEconomyState(),
    getSelectionState: () => bridge.getSelectionState(),
    getCameraState: () => scene.getCameraState(),
    centerCameraOnWorldPosition: (worldX: number, worldY: number) => {
      scene.centerCameraOnWorldPosition(worldX, worldY);
    },
    issueAction: (actionType) => bridge.issueAction(actionType),
    queueTrainUnit: (unitType) => bridge.queueTrainUnit(unitType),
    queueResearch: (technologyType) => bridge.queueResearch(technologyType),
    issueMarketAction: (actionType) => bridge.issueMarketAction(actionType),
    beginBuildingPlacement: (buildingType) => bridge.beginBuildingPlacement(buildingType),
    consumeCommandRejection: () => bridge.consumeCommandRejection(),
    getDebugSnapshot: () => bridge.getDebugSnapshot(),
    saveGame: () => bridge.saveGame(),
    loadGame: handleLoadGame,
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameRoot,
    width: gameRoot.clientWidth,
    height: gameRoot.clientHeight,
    backgroundColor: '#132224',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
    },
    scene: [scene],
  });

  installBrowserTestApi(window, game, () => bridge, scene);

  return game;
}
