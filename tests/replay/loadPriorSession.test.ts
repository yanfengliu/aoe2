import { describe, expect, it, vi } from 'vitest';
import type { SessionBundle, SessionMetadata } from 'civ-engine';

import { loadPriorSessionAsReplay } from '../../src/game/replay/loadPriorSession';
import type { ReplayController } from '../../src/game/replay/ReplayController';

const stubMetadata = (overrides: Partial<SessionMetadata> = {}): SessionMetadata => ({
  sessionId: 'test-session',
  sourceKind: 'session',
  sourceLabel: 'test',
  startTick: 0,
  endTick: 100,
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  ...overrides,
} as SessionMetadata);

const stubBundle = (overrides: Partial<SessionBundle> = {}): SessionBundle => ({
  metadata: stubMetadata(),
  commands: [],
  initialSnapshot: { tick: 0, state: [] } as unknown as SessionBundle['initialSnapshot'],
  ticks: [],
  executions: [],
  failures: [],
  snapshots: [],
  markers: [],
  attachments: [],
  ...overrides,
} as SessionBundle);

const stubController = (
  enterReplay: (bundle: SessionBundle) => void = vi.fn(),
): Pick<ReplayController, 'enterReplay'> => ({
  enterReplay: enterReplay as unknown as ReplayController['enterReplay'],
});

describe('loadPriorSessionAsReplay', () => {
  it('returns ok and calls enterReplay when bundle has commands', async () => {
    const enterReplay = vi.fn();
    const bundle = stubBundle({
      commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }] as SessionBundle['commands'],
    });
    const recording = { loadPriorSessionBundle: vi.fn(() => Promise.resolve(bundle)) };
    const result = await loadPriorSessionAsReplay(
      { replayController: stubController(enterReplay), recording },
      's1',
    );
    expect(result).toEqual({ status: 'ok' });
    expect(recording.loadPriorSessionBundle).toHaveBeenCalledWith('s1');
    expect(enterReplay).toHaveBeenCalledWith(bundle);
  });

  it('returns no-payloads when bundle has zero commands (matches replayer contract)', async () => {
    const enterReplay = vi.fn();
    const bundle = stubBundle({
      commands: [],
      metadata: stubMetadata({ startTick: 0, endTick: 50 }),
    });
    const recording = { loadPriorSessionBundle: vi.fn(() => Promise.resolve(bundle)) };
    const result = await loadPriorSessionAsReplay(
      { replayController: stubController(enterReplay), recording },
      's1',
    );
    expect(result.status).toBe('no-payloads');
    expect(enterReplay).not.toHaveBeenCalled();
  });

  it('returns error when enterReplay throws', async () => {
    const err = new Error('replay open failed');
    const enterReplay = vi.fn(() => {
      throw err;
    });
    const bundle = stubBundle({
      commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }] as SessionBundle['commands'],
    });
    const recording = { loadPriorSessionBundle: vi.fn(() => Promise.resolve(bundle)) };
    const result = await loadPriorSessionAsReplay(
      { replayController: stubController(enterReplay), recording },
      's1',
    );
    expect(result.status).toBe('error');
    expect(result.error).toBe(err);
  });

  it('propagates rejection from loadPriorSessionBundle', async () => {
    const err = new Error('not found');
    const recording = { loadPriorSessionBundle: vi.fn(() => Promise.reject(err)) };
    await expect(
      loadPriorSessionAsReplay({ replayController: stubController(), recording }, 's-missing'),
    ).rejects.toBe(err);
  });

  it('wraps non-Error throws into Error instances', async () => {
    const enterReplay = vi.fn(() => {
      throw 'string error';
    });
    const bundle = stubBundle({
      commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }] as SessionBundle['commands'],
    });
    const recording = { loadPriorSessionBundle: vi.fn(() => Promise.resolve(bundle)) };
    const result = await loadPriorSessionAsReplay(
      { replayController: stubController(enterReplay), recording },
      's1',
    );
    expect(result.status).toBe('error');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('string error');
  });

  it('returns cancelled and skips enterReplay when signal is tripped after the bundle await', async () => {
    const enterReplay = vi.fn();
    const bundle = stubBundle({
      commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }] as SessionBundle['commands'],
    });
    const recording = { loadPriorSessionBundle: vi.fn(() => Promise.resolve(bundle)) };
    let cancelled = false;
    const result = await loadPriorSessionAsReplay(
      { replayController: stubController(enterReplay), recording },
      's1',
      { isCancelled: () => cancelled },
    );
    // Sanity: without cancel the call enters replay.
    expect(result.status).toBe('ok');
    expect(enterReplay).toHaveBeenCalledTimes(1);

    // Now repeat with cancel flipped after the bundle resolves.
    enterReplay.mockClear();
    let resolveBundle: ((b: SessionBundle) => void) | null = null;
    const slowRecording = {
      loadPriorSessionBundle: vi.fn(
        () => new Promise<SessionBundle>((r) => { resolveBundle = r; }),
      ),
    };
    const promise = loadPriorSessionAsReplay(
      { replayController: stubController(enterReplay), recording: slowRecording },
      's1',
      { isCancelled: () => cancelled },
    );
    cancelled = true;
    resolveBundle!(bundle);
    const cancelledResult = await promise;
    expect(cancelledResult).toEqual({ status: 'cancelled' });
    expect(enterReplay).not.toHaveBeenCalled();
  });
});
