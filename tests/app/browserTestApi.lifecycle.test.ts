// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { installBrowserTestApi } from '../../src/app/bootstrap/browserTestApi';

afterEach(() => {
  delete window.__AOE2_TEST__;
});

describe('installBrowserTestApi lifecycle', () => {
  it('restores only the global installation that it still owns', () => {
    const options = {
      replay: {
        getReplayMode: () => 'live' as const,
        getReplayCurrentTick: () => 0,
        openReplayLoadDialog: () => undefined,
        seedPriorSession: async () => undefined,
      },
      getRecording: () => ({} as never),
    };
    const disposeFirst = installBrowserTestApi(
      window,
      () => ({} as never),
      {} as never,
      options,
    );
    const first = window.__AOE2_TEST__;
    expect(first).toBeDefined();
    expect(Object.isFrozen(first)).toBe(true);

    const disposeSecond = installBrowserTestApi(
      window,
      () => ({} as never),
      {} as never,
      options,
    );
    const second = window.__AOE2_TEST__;
    expect(second).not.toBe(first);

    disposeFirst();
    expect(window.__AOE2_TEST__).toBe(second);
    disposeSecond();
    expect(window.__AOE2_TEST__).toBeUndefined();
    disposeFirst();
    expect(window.__AOE2_TEST__).toBeUndefined();
  });

  it('restores a still-live previous installation during in-order teardown', () => {
    const options = {
      replay: {
        getReplayMode: () => 'live' as const,
        getReplayCurrentTick: () => 0,
        openReplayLoadDialog: () => undefined,
        seedPriorSession: async () => undefined,
      },
      getRecording: () => ({} as never),
    };
    const disposeFirst = installBrowserTestApi(
      window,
      () => ({} as never),
      {} as never,
      options,
    );
    const first = window.__AOE2_TEST__;
    const disposeSecond = installBrowserTestApi(
      window,
      () => ({} as never),
      {} as never,
      options,
    );

    disposeSecond();
    expect(window.__AOE2_TEST__).toBe(first);
    disposeFirst();
    expect(window.__AOE2_TEST__).toBeUndefined();
  });

  it('binds each automation API to its own view canvas', () => {
    const options = {
      replay: {
        getReplayMode: () => 'live' as const,
        getReplayCurrentTick: () => 0,
        openReplayLoadDialog: () => undefined,
        seedPriorSession: async () => undefined,
      },
      getRecording: () => ({} as never),
    };
    const firstRect = { x: 1, y: 2, width: 300, height: 200 };
    installBrowserTestApi(
      window,
      () => ({} as never),
      { getWorldCanvasRect: () => firstRect } as never,
      options,
    );
    const first = window.__AOE2_TEST__!;
    const secondRect = { x: 10, y: 20, width: 640, height: 480 };
    installBrowserTestApi(
      window,
      () => ({} as never),
      { getWorldCanvasRect: () => secondRect } as never,
      options,
    );
    const second = window.__AOE2_TEST__!;

    expect(first.agent.getCanvasBboxForScreenshot()).toEqual(firstRect);
    expect(second.agent.getCanvasBboxForScreenshot()).toEqual(secondRect);
  });
});
