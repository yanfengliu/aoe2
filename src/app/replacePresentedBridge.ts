// A bridge becomes the view's owner only when its synchronous presentation succeeds.
import type { SimulationBridge } from '../game/simulation/createSimulationBridge';
import type { AoeVoxelPresentationCoordinator } from '../rendering/voxel/AoeVoxelPresentationCoordinator';
import type { AoeVoxelWorldRenderer } from '../rendering/voxel/AoeVoxelWorldRenderer';

interface BridgePresentationSwap {
  current(): SimulationBridge;
  assign(bridge: SimulationBridge): void;
  readonly presentation: Pick<AoeVoxelPresentationCoordinator, 'resetForBridgeSwap'>;
  readonly renderer: Pick<AoeVoxelWorldRenderer, 'beginBridgeSwap'>;
  sync(): void;
}

export function replacePresentedBridge(bridge: SimulationBridge, swap: BridgePresentationSwap): void {
  const previous = swap.current();
  const restorePresentation = swap.presentation.resetForBridgeSwap();
  const rendererSwap = swap.renderer.beginBridgeSwap();
  swap.assign(bridge);
  try {
    swap.sync();
  } catch (error) {
    swap.assign(previous);
    restorePresentation();
    rendererSwap.rollback();
    throw error;
  }
  rendererSwap.commit();
}
