import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function resolveOutcome(bridge: Bridge): boolean {
  return stepBridgeUntil(bridge, () => bridge.getMatchState().outcome !== 'running', { maxSteps: 40 });
}

// Spec §4.3 — score-timer victory. A scenario with `gameLength` set ends the
// match at that tick; the highest scorer wins from the human's perspective
// (victory if sole top, draw if tied top, defeat otherwise). All three
// fixtures use gameLength = 30 and keep every player alive (each has a Town
// Center), so the score timer is the ONLY condition that can resolve them.
describe('score-timer victory (spec §4.3)', () => {
  it('resolves exactly at the game-length boundary — not a tick early or late', () => {
    const bridge = createSimulationBridge('score-timer-victory-fixture');
    // gameLength = 30. The score timer fires on the first postUpdate where
    // `world.tick >= gameLength`; because systems run before the tick counter
    // advances, that resolution is observable after the 31st bridge step. Pin
    // BOTH edges: the match must still be running through the 30th step (so an
    // early / off-by-one fire fails here) and must have resolved on the 31st.
    for (let step = 1; step <= 30; step += 1) {
      bridge.step(100);
      expect(bridge.getMatchState().outcome).toBe('running');
    }
    bridge.step(100);
    expect(bridge.getMatchState().outcome).not.toBe('running');
  });

  it('victory: the sole highest-score player (human) wins on score', () => {
    const bridge = createSimulationBridge('score-timer-victory-fixture');
    expect(resolveOutcome(bridge)).toBe(true);

    const matchState = bridge.getMatchState();
    expect(matchState.outcome).toBe('victory');
    expect(matchState.winCondition).toBe('score');
    expect(matchState.scores).toBeDefined();
    // Player 1 (TC + 3 villagers + 2 houses = 180) outscores player 2 (TC = 50).
    expect(matchState.scores![1]).toBe(180);
    expect(matchState.scores![2]).toBe(50);
    expect(matchState.scores![1]).toBeGreaterThan(matchState.scores![2]);
  });

  it('draw: the human tied for the top score draws', () => {
    const bridge = createSimulationBridge('score-timer-draw-fixture');
    expect(resolveOutcome(bridge)).toBe(true);

    const matchState = bridge.getMatchState();
    expect(matchState.outcome).toBe('draw');
    expect(matchState.winCondition).toBe('score');
    // Both players 180 — a tie at the top.
    expect(matchState.scores![1]).toBe(180);
    expect(matchState.scores![2]).toBe(180);
  });

  it('defeat: the human is not the top scorer in a 3-player game', () => {
    const bridge = createSimulationBridge('score-timer-defeat-fixture');
    expect(resolveOutcome(bridge)).toBe(true);

    const matchState = bridge.getMatchState();
    expect(matchState.outcome).toBe('defeat');
    expect(matchState.winCondition).toBe('score');
    // P1 (human) 50 < P3 100 < P2 180 — P2 is the sole top scorer.
    expect(matchState.scores![1]).toBe(50);
    expect(matchState.scores![2]).toBe(180);
    expect(matchState.scores![3]).toBe(100);
  });
});
