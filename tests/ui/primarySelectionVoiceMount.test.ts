// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/audio/proceduralVoices', () => ({ playProceduralCue: vi.fn() }));
vi.mock('../../src/audio/proceduralAmbience', () => ({
  startAmbience: () => ({ tick: () => undefined, setMuted: () => undefined, dispose: () => undefined }),
}));

import { mountGameAudio, type MountedGameAudio } from '../../src/audio/mountGameAudio';
import { playProceduralCue } from '../../src/audio/proceduralVoices';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

// Review round 1 of work 142: the voice test called the role helper directly,
// and putting back the old mount, which read the group's type, left every
// audio test green. This drives the real mount over the real bridge, with an
// AudioContext stand-in and frames run by hand, and reads the cue it plays.
// BOUND: the selection cue only, on the selection-controls fixture's box
// group; what each cue sounds like is outside it.
let frames: FrameRequestCallback[] = [];
let mounted: MountedGameAudio | null = null;

class FakeAudioContext {
  state = 'running';
  resume(): Promise<void> { return Promise.resolve(); }
  close(): Promise<void> { return Promise.resolve(); }
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  vi.stubGlobal('AudioContext', FakeAudioContext);
  window.localStorage.clear();
  // Sound on, as the speaker toggle stores it: the game starts muted (the
  // owner, 2026-11-05), and this case reads the cue that plays.
  window.localStorage.setItem('aoe2.audio.muted', '0');
  vi.mocked(playProceduralCue).mockClear();
});

afterEach(() => {
  mounted?.dispose();
  mounted = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('the mounted audio voices a group by its first unit', () => {
  it('plays the villager cue for three villagers and a sheep', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    expect(bridge.selectUnitsInBox(13, 7, 15, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({ selectedCount: 4, selectedEntityType: null });
    const hudRoot = document.createElement('div');
    document.body.appendChild(hudRoot);
    mounted = mountGameAudio(() => bridge, hudRoot, () => undefined, { onModeChange: () => () => undefined });
    const due = frames;
    frames = [];
    for (const callback of due) callback(0);
    expect(vi.mocked(playProceduralCue).mock.calls.map(([, cue]) => cue)).toContain('select-villager');
  });
});
