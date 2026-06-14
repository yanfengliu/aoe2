// Engine 1.2.0 typed-recording adoption: the toEngineWorld/fromEngineWorld cast
// seam was removed at the SessionRecorder / SessionReplayer boundary. The two
// `_*` functions below are COMPILE-TIME contract assertions — never executed,
// but type-checked by `npm run typecheck` (tsconfig includes tests/). They fail if the
// recorder config stops accepting a typed world, or if `ReplayReplayer` re-erases
// TComponents so `openAt` no longer yields `GameWorld` (reverting the alias to the 2-arg
// form, or an engine regression). A stray explicit `<E,C>` at another call site is caught
// at that site's own typecheck, not here.
import { describe, it, expect } from 'vitest';
import { SessionRecorder } from 'civ-engine';

import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { ReplayReplayer } from '../../src/game/replay/ReplayController';

// A component-typed GameWorld flows into SessionRecorder by INFERENCE — no cast,
// no explicit type args. Explicit <GameEvents, GameCommands> would default
// TComponents to Record<string, unknown> and reject GameWorld (invariance).
function _recorderAcceptsTypedWorld(world: GameWorld) {
  return new SessionRecorder({ world });
}

// ReplayReplayer.openAt returns a component-typed GameWorld, not the erased
// default-component world. Assignability to GameWorld fails under TComponents
// invariance the moment the registry is erased.
function _openAtReturnsTypedWorld(replayer: ReplayReplayer): GameWorld {
  return replayer.openAt(0);
}

describe('engine 1.2.0 typed recording/replay seam', () => {
  it('exposes the typed-world contract (assertions are compile-time)', () => {
    expect(typeof _recorderAcceptsTypedWorld).toBe('function');
    expect(typeof _openAtReturnsTypedWorld).toBe('function');
  });
});
