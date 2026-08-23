// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { installBrowserTestApi } from '../../src/app/bootstrap/browserTestApi';
import type { AoeVoxelGameView } from '../../src/app/AoeVoxelGameView';

afterEach(() => {
  delete window.__AOE2_TEST__;
});

const installOptions = {
  replay: {
    getReplayMode: () => 'live' as const,
    getReplayCurrentTick: () => 0,
    openReplayLoadDialog: () => undefined,
    seedPriorSession: async () => undefined,
  },
  getRecording: () => ({} as never),
};

/** A view stub that clamps like the real camera (0.7 – 2.4). */
function stubView(): { view: AoeVoxelGameView; zoom: () => number } {
  let zoom = 2;
  const view = {
    isBooted: () => true,
    syncFromBridge: () => undefined,
    setCameraZoom: (next: number) => {
      zoom = Math.min(2.4, Math.max(0.7, next));
      return zoom;
    },
  } as unknown as AoeVoxelGameView;
  return { view, zoom: () => zoom };
}

describe('browser test API camera zoom', () => {
  it('zooms the camera so one capture run can sweep several zoom levels', () => {
    const { view, zoom } = stubView();
    installBrowserTestApi(window, () => ({} as never), view, installOptions);

    expect(window.__AOE2_TEST__?.setCameraZoom(1.2)).toBe(1.2);
    expect(zoom()).toBe(1.2);
  });

  it('reports the zoom actually applied, so a caller past the limit is not misled', () => {
    const { view } = stubView();
    installBrowserTestApi(window, () => ({} as never), view, installOptions);

    expect(window.__AOE2_TEST__?.setCameraZoom(99)).toBe(2.4);
    expect(window.__AOE2_TEST__?.setCameraZoom(0)).toBe(0.7);
  });
});
