import { describe, expect, it, vi } from 'vitest';

import { replaceLiveBridgeAfterReplayExit } from '../../src/app/bootstrap/replaceBridgeForLoad';
import type { ReplayController } from '../../src/game/replay/ReplayController';

function replayController(
  modeRef: { value: ReplayController['mode'] },
  order: string[],
): Pick<ReplayController, 'mode' | 'exitReplay'> {
  return {
    get mode() {
      return modeRef.value;
    },
    exitReplay: vi.fn(() => {
      order.push('exitReplay');
      modeRef.value = 'live';
    }),
  };
}

describe('replaceLiveBridgeAfterReplayExit', () => {
  it('exits replay before creating and installing a replacement bridge', () => {
    const order: string[] = [];
    const modeRef: { value: ReplayController['mode'] } = { value: 'replay' };
    const controller = replayController(modeRef, order);
    const nextBridge = { id: 'replacement' };

    const result = replaceLiveBridgeAfterReplayExit({
      replayController: controller,
      createBridge: () => {
        order.push(`create:${modeRef.value}`);
        return nextBridge;
      },
      replaceBridge: (bridge) => {
        order.push(`replace:${modeRef.value}:${bridge.id}`);
      },
    });

    expect(result).toBe(nextBridge);
    expect(order).toEqual(['create:replay', 'exitReplay', 'replace:live:replacement']);
    expect(controller.exitReplay).toHaveBeenCalledTimes(1);
  });

  it('keeps replay active when the replacement bridge cannot be created', () => {
    const order: string[] = [];
    const modeRef: { value: ReplayController['mode'] } = { value: 'replay' };
    const controller = replayController(modeRef, order);
    const replaceBridge = vi.fn();

    expect(() =>
      replaceLiveBridgeAfterReplayExit({
        replayController: controller,
        createBridge: () => {
          order.push(`create:${modeRef.value}`);
          throw new Error('invalid save');
        },
        replaceBridge,
      }),
    ).toThrow('invalid save');

    expect(order).toEqual(['create:replay']);
    expect(modeRef.value).toBe('replay');
    expect(controller.exitReplay).not.toHaveBeenCalled();
    expect(replaceBridge).not.toHaveBeenCalled();
  });

  it('replaces the bridge without exiting when the host is already live', () => {
    const order: string[] = [];
    const modeRef: { value: ReplayController['mode'] } = { value: 'live' };
    const controller = replayController(modeRef, order);

    replaceLiveBridgeAfterReplayExit({
      replayController: controller,
      createBridge: () => {
        order.push(`create:${modeRef.value}`);
        return { id: 'replacement' };
      },
      replaceBridge: (bridge) => {
        order.push(`replace:${modeRef.value}:${bridge.id}`);
      },
    });

    expect(order).toEqual(['create:live', 'replace:live:replacement']);
    expect(controller.exitReplay).not.toHaveBeenCalled();
  });
});
