import { describe, expect, it, vi } from 'vitest';

import { gateAnnotationHotkeyOnReplayMode } from '../../src/app/bootstrap/replayAnnotationGate';
import type { ReplayController } from '../../src/game/replay/ReplayController';

function replayController(modeRef: { value: ReplayController['mode'] }): Pick<ReplayController, 'mode'> {
  return {
    get mode() {
      return modeRef.value;
    },
  };
}

describe('gateAnnotationHotkeyOnReplayMode', () => {
  it('invokes the inner handler in live mode', () => {
    const inner = vi.fn();
    const modeRef: { value: ReplayController['mode'] } = { value: 'live' };
    const handler = gateAnnotationHotkeyOnReplayMode(replayController(modeRef), inner);
    handler();
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('skips the inner handler in replay mode', () => {
    const inner = vi.fn();
    const modeRef: { value: ReplayController['mode'] } = { value: 'replay' };
    const handler = gateAnnotationHotkeyOnReplayMode(replayController(modeRef), inner);
    handler();
    expect(inner).not.toHaveBeenCalled();
  });

  it('re-evaluates mode on each call (closure captures controller, not snapshot)', () => {
    const inner = vi.fn();
    const modeRef: { value: ReplayController['mode'] } = { value: 'live' };
    const handler = gateAnnotationHotkeyOnReplayMode(replayController(modeRef), inner);
    handler();
    modeRef.value = 'replay';
    handler();
    modeRef.value = 'live';
    handler();
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
