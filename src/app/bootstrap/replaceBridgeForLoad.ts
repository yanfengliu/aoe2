import {
  exitReplayBeforeLiveBridgeReplacement,
  type ReplayController,
} from '../../game/replay/ReplayController';

export interface ReplaceLiveBridgeAfterReplayExitConfig<TBridge> {
  readonly replayController: Pick<ReplayController, 'mode' | 'exitReplay'>;
  readonly createBridge: () => TBridge;
  readonly replaceBridge: (bridge: TBridge) => void;
}

export function replaceLiveBridgeAfterReplayExit<TBridge>(
  config: ReplaceLiveBridgeAfterReplayExitConfig<TBridge>,
): TBridge {
  const nextBridge = config.createBridge();
  exitReplayBeforeLiveBridgeReplacement(config.replayController);
  config.replaceBridge(nextBridge);
  return nextBridge;
}
