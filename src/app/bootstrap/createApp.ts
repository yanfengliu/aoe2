import Phaser from 'phaser';

import { createSimulationBridge } from '../../game/simulation/createSimulationBridge';
import { GameScene } from '../../phaser/scenes/GameScene';
import { createHudController } from '../../ui/hud/createHudController';

export function createApp(): Phaser.Game {
  const gameRoot = document.getElementById('game-root');
  const hudRoot = document.getElementById('hud-root');

  if (!gameRoot || !hudRoot) {
    throw new Error('Expected #game-root and #hud-root to exist.');
  }

  const bridge = createSimulationBridge();
  createHudController(hudRoot, bridge);

  return new Phaser.Game({
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
    scene: [new GameScene(bridge)],
  });
}
