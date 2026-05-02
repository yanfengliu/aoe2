// Phase 2E behavioral test: syncVisibilitySources fingerprint cache.
//
// Pre-Phase 2E (Codex impl-19 MAJOR finding): the per-tick visibilitySystem
// blindly called `visibility.setSource(...)` for every active source every
// tick, but never told the visibilityCell. Result: post-bootstrap, the
// `aoe2.visibility` slot was permanently frozen at tick-0 state — when a
// unit moved, the visibility map updated internally but the persisted
// snapshot did not.
//
// Phase 2E gate: syncVisibilitySources now compares each source's
// `(x, y, radius)` against a closure-scoped fingerprint cache and skips
// the no-op setSource calls. When a source actually changes (or is
// added / removed), it marks the visibilityCell dirty so tier3SyncSystem
// re-publishes `aoe2.visibility` at output phase.
//
// Tests pin both directions:
// 1. Stationary tick → visibility reference identity preserved (steady-
//    state cost is zero).
// 2. Moving a vision source → visibility reference changes (the dirty bit
//    actually flips when something happens).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { Position } from 'civ-engine';

describe('Phase 2E — visibility fingerprint cache', () => {
  it('stationary tick: aoe2.visibility reference is preserved', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    const before = bridge.world.getState(TIER_3_SLOTS.visibility);
    bridge.step(100);
    bridge.step(100);
    expect(bridge.world.getState(TIER_3_SLOTS.visibility)).toBe(before);
  });

  it('vision-source movement: aoe2.visibility reference changes', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    const before = bridge.world.getState(TIER_3_SLOTS.visibility);

    // Find a human-owned vision source (e.g., a scout) and shove its
    // position component to a new cell. We bypass the command path so
    // we test the visibility system in isolation, not the move handler.
    let movedId: number | null = null;
    let target: Position | null = null;
    for (const id of bridge.world.query('position', 'visionSource', 'unit')) {
      const unit = bridge.world.getComponent<{ owner: number; unitType: string }>(id, 'unit');
      if (unit?.owner !== 1) continue; // human player
      const pos = bridge.world.getComponent<Position>(id, 'position');
      if (!pos) continue;
      movedId = id;
      target = { x: pos.x + 5, y: pos.y };
      break;
    }
    expect(movedId).not.toBeNull();
    expect(target).not.toBeNull();

    // Mutate position directly — the per-tick visibilitySystem's
    // syncVisibilitySources should detect the new fingerprint, mark the
    // cell dirty, and tier3SyncSystem will re-publish on the next tick.
    const pos = bridge.world.getComponent<Position>(movedId!, 'position');
    pos!.x = target!.x;
    pos!.y = target!.y;

    bridge.step(100);
    const after = bridge.world.getState(TIER_3_SLOTS.visibility);
    expect(after).not.toBe(before);
  });

  // Regression for impl-27 MAJOR (Codex + Claude + Gemini): monk conversion
  // and sheep-claim transfer mutate visionSource.playerId in place WITHOUT
  // moving or resizing the source. Without playerId in the fingerprint, the
  // sync would skip setSource — the new owner never gets vision and the old
  // owner permanently retains it. Reference change after a pure playerId
  // flip proves the fingerprint caught it; the per-player source-list
  // assertion proves the owner-flip remove + re-insert branch (impl-28
  // Codex MEDIUM + Claude MINOR: pin the leak-cleanup half).
  it('vision-source ownership flip: visibility re-published, old owner cleared, new owner registered', () => {
    type Persisted = {
      players: Array<[number, { sources: Array<[number, unknown]>; explored: number[] }]>;
    };
    const bridge = createSimulationBridge('feudal-age-fixture');
    const before = bridge.world.getState(TIER_3_SLOTS.visibility);

    let unitId: number | null = null;
    for (const id of bridge.world.query('position', 'visionSource', 'unit')) {
      const unit = bridge.world.getComponent<{ owner: number; unitType: string }>(id, 'unit');
      if (unit?.owner !== 1) continue;
      unitId = id;
      break;
    }
    expect(unitId).not.toBeNull();

    // Pre-flip: old owner registers the source.
    const beforeState = before as Persisted;
    const oldOwnerSourcesBefore = beforeState.players.find(([pid]) => pid === 1)?.[1].sources ?? [];
    expect(oldOwnerSourcesBefore.some(([sid]) => sid === unitId)).toBe(true);

    const vs = bridge.world.getComponent<{ playerId: number; radius: number }>(
      unitId!,
      'visionSource',
    )!;
    vs.playerId = 2;
    bridge.step(100);

    const after = bridge.world.getState(TIER_3_SLOTS.visibility);
    expect(after).not.toBe(before);

    const afterState = after as Persisted;
    const oldOwnerSources = afterState.players.find(([pid]) => pid === 1)?.[1].sources ?? [];
    const newOwnerSources = afterState.players.find(([pid]) => pid === 2)?.[1].sources ?? [];
    // Old owner's (1, unitId) entry was removed by the owner-flip branch.
    expect(oldOwnerSources.some(([sid]) => sid === unitId)).toBe(false);
    // New owner's (2, unitId) entry was inserted by setSource.
    expect(newOwnerSources.some(([sid]) => sid === unitId)).toBe(true);
  });

  // Stationary tick where playerId, x, y, AND radius all match → no-op
  // path: tier3SyncSystem must not consume a dirty bit, reference identity
  // preserved. This is a separate gate from the all-stationary tick at the
  // top of this file because it specifically exercises the owner-flip
  // branch's downstream effect on the fingerprint write — after the flip,
  // the next stationary tick should re-stabilize.
  it('post-flip stationary tick: aoe2.visibility reference re-stabilizes', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    let unitId: number | null = null;
    for (const id of bridge.world.query('position', 'visionSource', 'unit')) {
      const unit = bridge.world.getComponent<{ owner: number; unitType: string }>(id, 'unit');
      if (unit?.owner !== 1) continue;
      unitId = id;
      break;
    }
    expect(unitId).not.toBeNull();

    const vs = bridge.world.getComponent<{ playerId: number; radius: number }>(
      unitId!,
      'visionSource',
    )!;
    vs.playerId = 2;
    bridge.step(100); // owner-flip tick: visibility re-published

    const afterFlip = bridge.world.getState(TIER_3_SLOTS.visibility);
    bridge.step(100);
    bridge.step(100);
    expect(bridge.world.getState(TIER_3_SLOTS.visibility)).toBe(afterFlip);
  });
});
