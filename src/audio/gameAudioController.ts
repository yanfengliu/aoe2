// Game audio CONTROLLER (spec north-star audio cues, v0.3.109): decides WHEN
// a cue sounds by diffing cheap projections each poll — an attack landing on
// something of yours (throttled: one horn per window, AoE2's rule), an age
// transition, the match outcome. It never touches the simulation and never
// constructs audio itself: the synth is injected, so the decision logic tests
// without an AudioContext and the app wires the real voices in.
//
// It is also the ATTACK EVENT hub, not only an audio one: the same decision
// that sounds the horn raises the words (v0.3.229), and the same hit fixes
// where Space jumps to (v0.3.156) and where the minimap flashes (v0.3.217).
// One decision point is the point — a warning whose sound and picture could
// disagree is worse than either alone. The rule itself lives in
// ui/hud/attackWarning.ts, with the argument for each of its narrowings.

import type { UnitAttackParticipants } from '../game/simulation/types';
import {
  ATTACK_WARNING_TEXT,
  ATTACK_WARNING_THROTTLE_TICKS,
  clearAttackWarning,
  isAttackOnOwnEconomy,
  raiseAttackWarning,
} from '../ui/hud/attackWarning';

export type GameAudioCue =
  | 'town-under-attack'
  | 'age-up'
  | 'victory'
  | 'defeat'
  | 'research-complete'
  | 'countdown-started'
  | 'town-bell'
  | 'order-ack'
  | 'select-villager'
  | 'select-military'
  | 'select-monk'
  | 'select-siege'
  | 'select-ship';

const MUTED_KEY = 'aoe2.audio.muted';

interface AttackViewLike {
  tick: number;
  targetX: number;
  targetY: number;
  participants?: UnitAttackParticipants;
}

export interface GameAudioControllerDeps {
  humanPlayerId: number;
  getCurrentAge: () => string;
  getMatchOutcome: () => string | null;
  getRecentAttacks: () => readonly AttackViewLike[];
  /** How many technologies the human has completed (any monotonic count). */
  getResearchedCount: () => number;
  /** Whether a wonder or relic victory countdown is currently running. */
  getCountdownActive: () => boolean;
  /** Successful town-bell rings so far (monotonic; 0 where bells cannot ring). */
  getTownBellRings: () => number;
  /** Successful order gestures so far (monotonic; the ack-click source). */
  getOrderAcks: () => number;
  /** The primary selected OWN unit and its role family, or null. */
  getPrimarySelection: () => { id: number; role: string } | null;
  playCue: (cue: GameAudioCue) => void;
  /** Shows the attack warning's words (v0.3.229). Called outside the mute
   *  switch, on the horn's throttled decision, with the tick of the blow the
   *  words announce: the tick the throttle counts from. The page draws them
   *  up to a frame of ticks later, so the tick it is at by then is not this
   *  one (defect register 2026-09-24). */
  announce: (text: string, hitTick: number) => void;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
}

export interface GameAudioController {
  /** Space (v0.3.156): where the last town-under-attack landed. */
  getLastHomeAttackPosition(): { x: number; y: number } | null;
  poll(): void;
  /** A save was loaded: forget the old world (v0.3.229). A load only —
   *  never a replay step, whose bridge swap is the same recording. */
  resetForNewWorld(): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

export function createGameAudioController(deps: GameAudioControllerDeps): GameAudioController {
  const {
    humanPlayerId, getCurrentAge, getMatchOutcome, getRecentAttacks,
    getResearchedCount, getCountdownActive, getTownBellRings, getOrderAcks,
    getPrimarySelection, playCue, announce, storage,
  } = deps;

  let muted = readStoredMute(storage);
  let lastHornTick = Number.NEGATIVE_INFINITY;
  let lastSeenAttackTick = 0;
  // The age at first poll is the STARTING age, not a transition.
  let knownAge: string | null = null;
  let outcomePlayed = false;
  // First poll snapshots pre-seeded techs (a castle-age start arrives with
  // its age's research done) — only INCREASES after that ding.
  let knownResearched: number | null = null;
  let countdownWasActive = false;
  let knownBellRings: number | null = null;
  let knownOrderAcks: number | null = null;
  let knownSelectionId: number | null = null;
  let lastHomeAttack: { x: number; y: number } | null = null;

  function cue(name: GameAudioCue): void {
    if (!muted) playCue(name);
  }

  function pollHorn(): void {
    const fresh = getRecentAttacks().filter((attack) => attack.tick > lastSeenAttackTick);
    if (fresh.length === 0) return;
    lastSeenAttackTick = Math.max(...fresh.map((attack) => attack.tick));
    const hits = fresh.filter((attack) => isAttackOnOwnEconomy(attack, humanPlayerId));
    if (hits.length === 0) return;
    const hit = hits.reduce((newest, attack) => (attack.tick >= newest.tick ? attack : newest));
    // EVERY hit moves Space's jump target (v0.3.156) and refreshes the minimap
    // mark (v0.3.217), unthrottled: the mark holds on simulation time from the
    // newest blow, so it stays lit for as long as the raid lasts (v0.3.229).
    // Both happen OUTSIDE `cue`, so a muted player still sees the raid.
    lastHomeAttack = { x: hit.targetX, y: hit.targetY };
    raiseAttackWarning(hit.targetX, hit.targetY, hit.tick);
    // The horn and the words are one throttled decision: one of each per
    // window, because a warning on every blow is worse than none. The window
    // is measured between HIT ticks, the clock the mark's hold counts on, so
    // "the mark went dark" always means "the next hit sounds the horn", even
    // when one frame steps several ticks between a hit and the poll that sees
    // it (the independent review of v0.3.229 found the poll-tick version).
    if (hit.tick - lastHornTick < ATTACK_WARNING_THROTTLE_TICKS) return;
    lastHornTick = hit.tick;
    announce(ATTACK_WARNING_TEXT, hit.tick);
    cue('town-under-attack');
  }

  function pollAge(): void {
    const age = getCurrentAge();
    if (knownAge === null) {
      knownAge = age;
      return;
    }
    if (age !== knownAge) {
      knownAge = age;
      cue('age-up');
    }
  }

  function pollOutcome(): void {
    if (outcomePlayed) return;
    const outcome = getMatchOutcome();
    if (!outcome) return;
    outcomePlayed = true;
    cue(outcome === 'victory' ? 'victory' : 'defeat');
  }

  function pollResearch(): void {
    const researched = getResearchedCount();
    if (knownResearched === null) {
      knownResearched = researched;
      return;
    }
    if (researched > knownResearched) {
      // One ding per poll, however many completed since — a chord of dings
      // for a simultaneous batch would be noise, not information.
      knownResearched = researched;
      cue('research-complete');
    }
  }

  function pollBell(): void {
    const rings = getTownBellRings();
    if (knownBellRings === null) {
      knownBellRings = rings;
      return;
    }
    if (rings > knownBellRings) {
      knownBellRings = rings;
      cue('town-bell');
    }
  }

  function pollAcks(): void {
    const acks = getOrderAcks();
    if (knownOrderAcks === null) {
      knownOrderAcks = acks;
      return;
    }
    if (acks > knownOrderAcks) {
      // One click per poll however many gestures landed between frames — a
      // machine-gun burst for queued clicks would be noise.
      knownOrderAcks = acks;
      cue('order-ack');
    }
  }

  function pollSelection(): void {
    const selection = getPrimarySelection();
    if (!selection) {
      knownSelectionId = null;
      return;
    }
    if (selection.id === knownSelectionId) return;
    knownSelectionId = selection.id;
    const cueByRole: Record<string, GameAudioCue> = {
      villager: 'select-villager',
      monk: 'select-monk',
      siege: 'select-siege',
      ship: 'select-ship',
    };
    cue(cueByRole[selection.role] ?? 'select-military');
  }

  function pollCountdown(): void {
    const active = getCountdownActive();
    if (active && !countdownWasActive) cue('countdown-started');
    countdownWasActive = active;
  }

  // v0.3.229 (defect register 2026-09-24): after a LOAD, everything observed
  // so far belongs to the old world, so forget it, as at mount, and let the
  // next poll take a fresh look at the new one instead of diffing it against
  // the old. Called for a load only: a replay step, a scrub or a fog-owner
  // switch also swaps the bridge, over the same recording, and resetting there
  // re-announced the replayed world's recent hits on every step (found by the
  // independent review, before this shipped). Without
  // this, loading an earlier save kept the old horn's tick: the first raid
  // after the load was inside a "throttle window" measured across two
  // different worlds, and it came with no horn and no words — measured in the
  // real game by saving at tick 100, taking the tick-1444 raid, and loading.
  // The per-bridge tallies (bell rings, order gestures) restart at zero in a
  // new world, so the same stale memory silenced those cues until the new
  // count passed the old one. A match already decided, or a countdown already
  // running, in the loaded world is part of the snapshot, not news.
  function resetForNewWorld(): void {
    lastHornTick = Number.NEGATIVE_INFINITY;
    lastSeenAttackTick = 0;
    knownAge = null;
    outcomePlayed = getMatchOutcome() !== null;
    knownResearched = null;
    countdownWasActive = getCountdownActive();
    knownBellRings = null;
    knownOrderAcks = null;
    knownSelectionId = null;
    lastHomeAttack = null;
    clearAttackWarning();
  }

  return {
    getLastHomeAttackPosition: () => lastHomeAttack,
    resetForNewWorld,
    poll(): void {
      pollHorn();
      pollAge();
      pollOutcome();
      pollResearch();
      pollCountdown();
      pollBell();
      pollAcks();
      pollSelection();
    },
    isMuted: () => muted,
    setMuted(next: boolean): void {
      muted = next;
      try {
        storage.setItem(MUTED_KEY, next ? '1' : '0');
      } catch {
        // Private browsing or a full quota must never break the game; the
        // choice just does not persist. (The art-style preference set this
        // precedent, was withdrawn in v0.3.196 with the second style, and came
        // back with the DE style in v0.3.227; `artStylePreference.ts`.)
      }
    },
  };
}

function readStoredMute(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}
