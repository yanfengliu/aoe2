// FU7: helpers for the Trebuchet pack/unpack lifecycle. Centralized so every
// caller (attack pathway, move pathway, save/load hydration) keeps a single
// source of truth for transition semantics. All five operations share the
// same `trebuchetPackStates` side map; the factory closes over it so callers
// treat the returned ops as plain methods without threading the map through
// every call site.

import type { TrebuchetPackState } from '../createSimulationBridge';

const TREBUCHET_PACK_TRANSITION_TICKS = 50;

export interface TrebuchetStateOps {
  // Advance an in-flight pack/unpack transition by one tick. Returns true
  // iff a transition is currently in progress (caller should skip movement
  // and fire this tick). Once `transitionTicksRemaining` reaches zero, the
  // `packed` flag flips and the Trebuchet becomes stable in its new state
  // on the NEXT tick. The current tick is still considered "in transition"
  // so both halves of the flip are observed deterministically.
  advanceTrebuchetTransition(unitId: number): boolean;
  // Begin a packed → unpacked transition (Trebuchet is within range of an
  // attack target and wants to fire). No-op if the unit isn't a packed
  // Trebuchet or is already in a transition.
  beginTrebuchetUnpack(unitId: number): void;
  // Begin an unpacked → packed transition (Trebuchet received a move
  // order). No-op if the unit isn't an unpacked Trebuchet or is already
  // in a transition.
  beginTrebuchetPack(unitId: number): void;
  // True if the unit is a Trebuchet that cannot currently move (unpacked
  // stable OR mid-transition in either direction). Used to gate the
  // movement branches of the attack and move command loops so an
  // unpacked Trebuchet holds ground rather than walking into melee.
  isTrebuchetStationary(unitId: number): boolean;
  // True if the unit is a Trebuchet that cannot currently fire (packed
  // stable OR mid-transition in either direction).
  isTrebuchetSilent(unitId: number): boolean;
}

export function createTrebuchetStateOps(
  trebuchetPackStates: Map<number, TrebuchetPackState>,
): TrebuchetStateOps {
  function advanceTrebuchetTransition(unitId: number): boolean {
    const state = trebuchetPackStates.get(unitId);
    if (!state || state.transitionTicksRemaining <= 0) {
      return false;
    }
    state.transitionTicksRemaining -= 1;
    if (state.transitionTicksRemaining <= 0) {
      state.packed = !state.packed;
    }
    return true;
  }

  function beginTrebuchetUnpack(unitId: number): void {
    const state = trebuchetPackStates.get(unitId);
    if (!state || !state.packed || state.transitionTicksRemaining > 0) {
      return;
    }
    state.transitionTicksRemaining = TREBUCHET_PACK_TRANSITION_TICKS;
  }

  function beginTrebuchetPack(unitId: number): void {
    const state = trebuchetPackStates.get(unitId);
    if (!state || state.packed || state.transitionTicksRemaining > 0) {
      return;
    }
    state.transitionTicksRemaining = TREBUCHET_PACK_TRANSITION_TICKS;
  }

  function isTrebuchetStationary(unitId: number): boolean {
    const state = trebuchetPackStates.get(unitId);
    if (!state) {
      return false;
    }
    return !state.packed || state.transitionTicksRemaining > 0;
  }

  function isTrebuchetSilent(unitId: number): boolean {
    const state = trebuchetPackStates.get(unitId);
    if (!state) {
      return false;
    }
    return state.packed || state.transitionTicksRemaining > 0;
  }

  return {
    advanceTrebuchetTransition,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    isTrebuchetStationary,
    isTrebuchetSilent,
  };
}
