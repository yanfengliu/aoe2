import { describe, expect, it, vi } from 'vitest';

import { WorldTickFailureError } from 'civ-engine';

import {
  createTickHaltState,
  tryTick,
  type EngineHaltDetails,
} from '../../src/game/simulation/bridge/tickHaltGuard';

function makeFailure(overrides: Partial<{
  tick: number;
  phase: 'commands' | 'systems' | 'resources' | 'diff' | 'listeners';
  code: string;
  systemName: string | null;
  errorMessage: string | null;
  topLevelMessage: string;
}> = {}) {
  const tick = overrides.tick ?? 5;
  const phase = overrides.phase ?? 'systems';
  const code = overrides.code ?? 'system_threw';
  const systemName = 'systemName' in overrides ? overrides.systemName! : 'mySystem';
  const errorMessage = overrides.errorMessage === undefined ? 'boom' : overrides.errorMessage;
  return {
    schemaVersion: 1 as const,
    tick,
    phase,
    code,
    message: overrides.topLevelMessage ?? 'system blew up',
    subsystem: 'system:mySystem',
    commandType: null,
    submissionSequence: null,
    systemName,
    details: null,
    error: errorMessage === null ? null : { name: 'Error', message: errorMessage, stack: null },
  };
}

describe('tickHaltGuard', () => {
  it('runs the worldStep and returns true on success', () => {
    const halt = createTickHaltState();
    let n = 0;
    const ok = tryTick(() => {
      n += 1;
    }, halt);
    expect(ok).toBe(true);
    expect(n).toBe(1);
    expect(halt.halted).toBeNull();
  });

  it('catches WorldTickFailureError, captures halt details, returns false', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const halt = createTickHaltState();
    const failure = makeFailure();

    const ok = tryTick(() => {
      throw new WorldTickFailureError(failure as never);
    }, halt);

    expect(ok).toBe(false);
    expect(halt.halted).toEqual<EngineHaltDetails>({
      tick: 5,
      phase: 'systems',
      code: 'system_threw',
      systemName: 'mySystem',
      message: 'boom',
    });
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it('falls back to top-level failure message when error.message missing', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const halt = createTickHaltState();
    const failure = makeFailure({ errorMessage: null, topLevelMessage: 'tick aborted' });

    tryTick(() => {
      throw new WorldTickFailureError(failure as never);
    }, halt);

    expect(halt.halted?.message).toBe('tick aborted');
    errSpy.mockRestore();
  });

  it('treats null systemName as null in halt details', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const halt = createTickHaltState();
    const failure = makeFailure({ systemName: null, phase: 'commands' });

    tryTick(() => {
      throw new WorldTickFailureError(failure as never);
    }, halt);

    expect(halt.halted).toMatchObject({ phase: 'commands', systemName: null });
    errSpy.mockRestore();
  });

  it('once halted, subsequent tryTick is a no-op and returns false', () => {
    const halt = createTickHaltState();
    halt.halted = {
      tick: 1,
      phase: 'systems',
      code: 'x',
      systemName: null,
      message: 'previously halted',
    };
    let invoked = 0;
    const ok = tryTick(() => {
      invoked += 1;
    }, halt);
    expect(ok).toBe(false);
    expect(invoked).toBe(0);
  });

  it('rethrows non-WorldTickFailureError exceptions and leaves halt state untouched', () => {
    const halt = createTickHaltState();
    expect(() =>
      tryTick(() => {
        throw new TypeError('unrelated');
      }, halt),
    ).toThrow(TypeError);
    expect(halt.halted).toBeNull();
  });
});
