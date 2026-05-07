import type { ReplayController } from '../../game/replay/ReplayController';

export function gateAnnotationHotkeyOnReplayMode(
  controller: Pick<ReplayController, 'mode'>,
  innerHandler: () => void,
): () => void {
  return () => {
    if (controller.mode === 'replay') return;
    innerHandler();
  };
}
