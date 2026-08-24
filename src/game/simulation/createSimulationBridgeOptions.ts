// The options a caller may open a simulation with.
//
// Split out of createSimulationBridge.ts for the 500-LOC budget. They belong
// together as a group: every one of them is a SCENARIO-time choice — how the
// map is built, who is playing, and who drives them — read once at boot and
// never written into world state, which is why none of them appears in a save.

import type { SaveBlob } from './saveSchema';

export interface CreateSimulationBridgeOptions {
  // Slice 9: when present, hydrate the new bridge from this save blob
  // instead of running the normal scenario bootstrap. The blob's
  // `schema` must equal `SAVE_SCHEMA_VERSION` exactly — the loader
  // throws on mismatch.
  savedGame?: SaveBlob;
  // LLM-agent harness: owners listed here have `disableAi: true`
  // applied to their PlayerStartSpec at scenario seed time. The
  // existing aiStates.has(owner) gate then skips them. Closure-local;
  // never serialized into world.state.
  disableAiForOwners?: ReadonlySet<number>;
  // Headless AI-vs-AI harness: force an AI onto the listed owners even if one is
  // the human slot, so a deterministic playtest runs a competitive match instead
  // of AI-vs-inert. Closure-local; the real game never sets it.
  forceAiForOwners?: ReadonlySet<number>;
  /** How many players the procedural map opens with (2..4; default 2).
   *  Fixtures decide their own, so this only reaches the default map. */
  playerCount?: number;
  // Playtest-harness override: force the score timer on (spec §4.3) with this
  // game length, even for a scenario that bakes none. Used by the corpus to
  // terminate an otherwise-stalemating deterministic match on score. Ignored
  // on the save-load path (no fresh scenario is built).
  gameLength?: number;
  // Civ selection (?civ=): override the freshly-built scenario start's civ for
  // the listed owners (closure-local; seeds playerCivilizations; ignored on load).
  civilizationsByOwner?: ReadonlyMap<number, string>;
}
