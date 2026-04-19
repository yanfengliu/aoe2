import Phaser from 'phaser';

import { createSimulationBridge } from '../../game/simulation/createSimulationBridge';
import { GameScene } from '../../phaser/scenes/GameScene';
import { createHudController } from '../../ui/hud/createHudController';
import { installBrowserTestApi } from './browserTestApi';

export function createApp(): Phaser.Game {
  const gameRoot = document.getElementById('game-root');
  const hudRoot = document.getElementById('hud-root');

  if (!gameRoot || !hudRoot) {
    throw new Error('Expected #game-root and #hud-root to exist.');
  }

  const seed = new URL(window.location.href).searchParams.get('seed')?.trim() || undefined;
  const bridge = createSimulationBridge(seed);
  // GameScene receives the debug-mode getter up front so its render loop
  // can read the current overlay mode every frame (selection-bounds,
  // pathing, etc.) without further plumbing.
  const scene = new GameScene(bridge, {
    getDebugOverlayMode: () => hudController.getDebugOverlayMode(),
  });
  const hudController = createHudController(hudRoot, {
    ...bridge,
    getCameraState: () => scene.getCameraState(),
    centerCameraOnWorldPosition: (worldX: number, worldY: number) => {
      scene.centerCameraOnWorldPosition(worldX, worldY);
    },
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

  installBrowserTestApi(window, game, bridge, scene);

  return game;
}
