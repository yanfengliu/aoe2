// Game audio CONTROLLER (spec north-star audio cues, v0.3.109): decides WHEN
// a cue sounds by diffing cheap projections each poll — an attack landing on
// something of yours (throttled: one horn per window, AoE2's rule), an age
// transition, the match outcome. It never touches the simulation and never
// constructs audio itself: the synth is injected, so the decision logic tests
// without an AudioContext and the app wires the real voices in.

export type GameAudioCue = 'town-under-attack' | 'age-up' | 'victory' | 'defeat';

// AoE2 spaces its "town under attack" horns well apart; ~20s at 20 TPS.
const HORN_THROTTLE_TICKS = 400;
const MUTED_KEY = 'aoe2.audio.muted';

interface AttackViewLike {
  tick: number;
  targetX: number;
  targetY: number;
}

interface OwnEntityLike {
  x: number;
  y: number;
}

export interface GameAudioControllerDeps {
  humanPlayerId: number;
  getTick: () => number;
  getCurrentAge: () => string;
  getMatchOutcome: () => string | null;
  getRecentAttacks: () => readonly AttackViewLike[];
  getOwnTownEntities: () => readonly OwnEntityLike[];
  playCue: (cue: GameAudioCue) => void;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
}

export interface GameAudioController {
  poll(): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

export function createGameAudioController(deps: GameAudioControllerDeps): GameAudioController {
  const {
    getTick, getCurrentAge, getMatchOutcome,
    getRecentAttacks, getOwnTownEntities, playCue, storage,
  } = deps;

  let muted = readStoredMute(storage);
  let lastHornTick = Number.NEGATIVE_INFINITY;
  let lastSeenAttackTick = 0;
  // The age at first poll is the STARTING age, not a transition.
  let knownAge: string | null = null;
  let outcomePlayed = false;

  function cue(name: GameAudioCue): void {
    if (!muted) playCue(name);
  }

  function pollHorn(): void {
    const tick = getTick();
    const fresh = getRecentAttacks().filter((attack) => attack.tick > lastSeenAttackTick);
    if (fresh.length === 0) return;
    lastSeenAttackTick = Math.max(...fresh.map((attack) => attack.tick));
    if (tick - lastHornTick < HORN_THROTTLE_TICKS) return;
    const town = getOwnTownEntities();
    const hitsHome = fresh.some((attack) =>
      town.some((entity) =>
        Math.abs(entity.x - attack.targetX) <= 1 && Math.abs(entity.y - attack.targetY) <= 1,
      ),
    );
    if (!hitsHome) return;
    lastHornTick = tick;
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

  return {
    poll(): void {
      pollHorn();
      pollAge();
      pollOutcome();
    },
    isMuted: () => muted,
    setMuted(next: boolean): void {
      muted = next;
      try {
        storage.setItem(MUTED_KEY, next ? '1' : '0');
      } catch {
        // Private browsing or a full quota must never break the game (the
        // art-style setting establishes this rule); the choice just does not
        // persist.
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
