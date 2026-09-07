// Game audio CONTROLLER (spec north-star audio cues, v0.3.109): decides WHEN
// a cue sounds by diffing cheap projections each poll — an attack landing on
// something of yours (throttled: one horn per window, AoE2's rule), an age
// transition, the match outcome. It never touches the simulation and never
// constructs audio itself: the synth is injected, so the decision logic tests
// without an AudioContext and the app wires the real voices in.
//
// It is also the ATTACK EVENT hub, not only an audio one: the same decision
// that sounds the horn fixes where Space jumps to (v0.3.156) and where the
// minimap flashes (v0.3.215). One decision point is the point — a warning
// whose sound and picture could disagree is worse than either alone. The rule
// itself lives in ui/hud/attackWarning.ts, with the argument for each of its
// narrowings.

import type { UnitAttackParticipants } from '../game/simulation/types';
import {
  ATTACK_WARNING_THROTTLE_TICKS,
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
  getTick: () => number;
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
  storage: Pick<Storage, 'getItem' | 'setItem'>;
}

export interface GameAudioController {
  /** Space (v0.3.156): where the last town-under-attack landed. */
  getLastHomeAttackPosition(): { x: number; y: number } | null;
  poll(): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

export function createGameAudioController(deps: GameAudioControllerDeps): GameAudioController {
  const {
    humanPlayerId, getTick, getCurrentAge, getMatchOutcome, getRecentAttacks,
    getResearchedCount, getCountdownActive, getTownBellRings, getOrderAcks,
    getPrimarySelection, playCue, storage,
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
    const tick = getTick();
    const fresh = getRecentAttacks().filter((attack) => attack.tick > lastSeenAttackTick);
    if (fresh.length === 0) return;
    lastSeenAttackTick = Math.max(...fresh.map((attack) => attack.tick));
    if (tick - lastHornTick < ATTACK_WARNING_THROTTLE_TICKS) return;
    const hit = fresh.find((attack) => isAttackOnOwnEconomy(attack, humanPlayerId));
    if (!hit) return;
    lastHornTick = tick;
    // One decision, three cues: the horn, Space's jump target (v0.3.156), and
    // the minimap mark (v0.3.215). The mark is raised OUTSIDE `cue`, so a
    // muted player still sees where the raid is — which is the whole point,
    // since the horn is the cue a real player most easily loses.
    lastHomeAttack = { x: hit.targetX, y: hit.targetY };
    raiseAttackWarning(hit.targetX, hit.targetY);
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

  return {
    getLastHomeAttackPosition: () => lastHomeAttack,
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
        // precedent and was withdrawn in v0.3.196 with the second style, so
        // this is now the rule's only live example rather than its second.)
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
