import { describe, expect, it, vi } from 'vitest';
import type { SessionBundle, SessionMetadata } from 'civ-engine';

import { loadCurrentSessionAsReplay } from '../../src/game/replay/loadCurrentSession';
import type { ReplayController } from '../../src/game/replay/ReplayController';

const stubMetadata = (overrides: Partial<SessionMetadata> = {}): SessionMetadata => ({
  sessionId: 'test-session',
  sourceKind: 'session',
  sourceLabel: 'test',
  startTick: 0,
  endTick: 0,
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
  mode: ReplayController['mode'] = 'live',
): Pick<ReplayController, 'enterReplay' | 'mode'> => ({
  enterReplay: enterReplay as unknown as ReplayController['enterReplay'],
  mode,
});

describe('loadCurrentSessionAsReplay', () => {
  it('returns no-bundle when recording.bundle() is null', () => {
    const enterReplay = vi.fn();
    const result = loadCurrentSessionAsReplay({
      replayController: stubController(enterReplay),
      recording: { bundle: () => null },
    });
    expect(result).toEqual({ status: 'no-bundle' });
    expect(enterReplay).not.toHaveBeenCalled();
  });

  it('returns no-payloads when bundle has no commands and endTick === startTick', () => {
    const enterReplay = vi.fn();
    const bundle = stubBundle({
      commands: [],
      metadata: stubMetadata({ startTick: 5, endTick: 5 }),
    });
    const result = loadCurrentSessionAsReplay({
      replayController: stubController(enterReplay),
      recording: { bundle: () => bundle },
    });
    expect(result).toEqual({ status: 'no-payloads' });
    expect(enterReplay).not.toHaveBeenCalled();
  });

  it('returns ok and calls enterReplay when bundle has commands', () => {
    const enterReplay = vi.fn();
    const bundle = stubBundle({
      commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }] as SessionBundle['commands'],
      metadata: stubMetadata({ startTick: 0, endTick: 0 }),
    });
    const result = loadCurrentSessionAsReplay({
      replayController: stubController(enterReplay),
      recording: { bundle: () => bundle },
    });
    expect(result).toEqual({ status: 'ok' });
    expect(enterReplay).toHaveBeenCalledWith(bundle);
  });

  it('returns no-payloads when bundle has elapsed ticks but no commands (matches replayer contract)', () => {
    const enterReplay = vi.fn();
    const bundle = stubBundle({
      commands: [],
      metadata: stubMetadata({ startTick: 0, endTick: 10 }),
    });
    const result = loadCurrentSessionAsReplay({
      replayController: stubController(enterReplay),
      recording: { bundle: () => bundle },
    });
    expect(result.status).toBe('no-payloads');
    expect(enterReplay).not.toHaveBeenCalled();
  });

  it('returns error wrapping the thrown Error when enterReplay throws', () => {
    const err = new Error('replay open failed');
    const enterReplay = vi.fn(() => {
      throw err;
    });
    const bundle = stubBundle({
      commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }] as SessionBundle['commands'],
      metadata: stubMetadata({ startTick: 0, endTick: 5 }),
    });
    const result = loadCurrentSessionAsReplay({
      replayController: stubController(enterReplay),
      recording: { bundle: () => bundle },
    });
    expect(result.status).toBe('error');
    expect(result.error).toBe(err);
  });

  it('wraps non-Error throws into Error instances', () => {
    const enterReplay = vi.fn(() => {
      throw 'string error';
    });
    const bundle = stubBundle({
      commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }] as SessionBundle['commands'],
      metadata: stubMetadata({ startTick: 0, endTick: 5 }),
    });
    const result = loadCurrentSessionAsReplay({
      replayController: stubController(enterReplay),
      recording: { bundle: () => bundle },
    });
    expect(result.status).toBe('error');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('string error');
  });
});
