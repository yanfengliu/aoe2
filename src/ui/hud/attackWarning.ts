// The attack warning (v0.3.217): AoE2 tells you when your economy is being
// killed. It sounds a horn, it says so in words, it flashes the minimap where
// the blow landed, and Space jumps the camera there. The horn and the jump
// already existed; this module owns the RULE they share, the mark, and the
// words (v0.3.229).
//
// Found by playing (defect register 2026-09-06): at tick 3084 of
// `aoe2-prototype` an enemy militia hit a villager twice, 25 -> 21 -> 17 HP,
// and the screen said nothing at all. The horn did sound — but a horn is the
// one cue a muted tab, a headphone-less player or a busy moment loses, and
// nothing on screen said an attack was happening or where.
//
// And again (defect register 2026-09-24): the mark that fixed it was a dot
// with a 3-pixel core that lived 8 s of WALL CLOCK, while the throttle that
// re-raises it counts 200 SIMULATION ticks — 13.3 s at normal speed (1.5x). So
// a sustained raid left the minimap dark for about 40% of the time, a paused
// game lost the mark after 8 s, and the real play screenshots held 16 alert
// pixels out of 1.44 million. It was also the only alert in the game with no
// words. The mark now holds on simulation time and every hit refreshes it,
// the words ride the horn's throttled decision, and the mark is sized in
// DISPLAY pixels (minimap.ts) so it is findable at the minimap's real size.
//
// THE RULE. A warning is raised when a unit owned by ANOTHER PLAYER swings at
// a villager or a building owned by the human. Each half is a deliberate
// narrowing:
//
//  - Another player's unit, so a lured boar biting the villager that shot it
//    raises nothing. Boar luring happens in the opening of every match, on
//    purpose, under the player's eye; a horn for it is the storm this rule
//    exists to avoid. Wildlife attackers carry no `participants` at all.
//  - A villager or a building, so a pitched battle between armies is silent.
//    A soldier taking a hit is the fight you went looking for. Villagers and
//    buildings are the economy: nobody puts a villager in a fight on purpose,
//    so a villager losing HP is news by definition.
//  - Owned by the human, so the Town Centre shooting BACK raises nothing —
//    the rule keys on who was hit, never on who swung or on what happens to
//    be standing nearby.
//
// What it deliberately does NOT do: suppress the warning when the camera is
// already looking at the spot. That reading is tempting and it is exactly
// backwards — the defect above happened INSIDE the player's own base with the
// camera on it, so a "you are already looking" rule would have suppressed the
// very case this exists for.
//
// Known bound, stated because a gate is only as good as its edges: the feed
// records a SWING, and only a unit can be an attacker in it. An enemy tower or
// castle shooting a villager raises nothing today. That is the same gap the
// horn already had; the case that matters (a raid, which is units) is covered.

import type { ProjectedUnitAttackView } from '../../game/simulation/types';

// DE's own spacing was NOT settled from an authoritative source. The best
// statement found is one post on the official Age of Empires forum (HestiaAoE,
// 2023-10-14, thread "Under-Attack notifications are annoying and useless"):
// the alarm is suppressed only for two attacks within 10 TILES *and* ten
// seconds. That is a different SHAPE from this throttle, which has no spatial
// half — two raids far apart alarm once here and twice there — so there is no
// single DE number to copy, and no developer statement, data file or official
// document was found. The value below is therefore what this comment always
// intended, not a measured DE figure, and the ten-tile half is unimplemented.

/** How far apart two "town under attack" warnings may be: 20 s at 10 TPS.
 *  The number said 400 while the comment said twenty seconds, from the day the
 *  horn shipped until 2026-09-06 (defect register). */
export const ATTACK_WARNING_THROTTLE_TICKS = 200;
/** How long the minimap mark stays up after the LAST hit, in simulation
 *  ticks. Equal to the throttle on purpose: every hit refreshes the mark, so
 *  it goes dark only once a whole throttle window has passed with no blow —
 *  and then the next blow is sure to sound the horn and show the words again.
 *  So a raid is never in progress with the minimap dark and the horn silent.
 *  Counted in ticks, never on the wall clock, so a paused game keeps it and a
 *  faster game speed shortens it exactly as it shortens the throttle. */
export const ATTACK_WARNING_HOLD_TICKS = ATTACK_WARNING_THROTTLE_TICKS;
/** The words, raised on the same throttled decision that sounds the horn.
 *  DE says it in text as well as with the horn: the horn is lost by a muted
 *  tab, and a minimap mark is lost by a player watching the fight in front of
 *  them. */
export const ATTACK_WARNING_TEXT = 'You are under attack!';
/** One pulse of the mark. Wall clock on purpose: this is animation only, and
 *  it keeps moving while paused so a still frame still draws the eye. */
export const ATTACK_WARNING_PULSE_MS = 640;
/** Pulse quantisation for the minimap's repaint signature: the mark animates
 *  at 20 steps a second while it is up, and the minimap is otherwise repainted
 *  only when its content or the camera changes. */
const PULSE_STEP_MS = 50;

export interface AttackWarningMark {
  x: number;
  y: number;
  /** 0..1 pulse, never 0 at the trough — a mark that vanishes half the time is
   *  a mark a player misses, and a pixel check lands on a blank frame. */
  intensity: number;
  /** 0..1 position of the outgoing ripple within its pulse. */
  ripple: number;
}

interface RaisedWarning {
  x: number;
  y: number;
  /** Simulation tick of the newest hit; the hold counts from here. */
  lastHitTick: number;
  /** Wall-clock anchor of the pulse animation only. */
  raisedAtMs: number;
}

// Module state, deliberately. This is per-page cosmetic state with exactly one
// producer (the audio mount's poll) and one consumer (the minimap's paint),
// and routing it through the HUD controller would grow a file that is at its
// 500-line cap for no behavioural gain. It is never simulation state: nothing
// here is read back by the world, saved, or replayed.
let raised: RaisedWarning | null = null;

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/**
 * Does this recorded swing mean "your economy is under attack"?
 *
 * Exact, not proximity-based. The rule this replaced compared the swing's
 * target CELL against the render origin of each own building and villager
 * within one cell — and a building's target cell is its visual centre,
 * `origin + (footprint - 1) / 2`, so for anything 4x4 the two are 1.5 cells
 * apart and the test could never pass. Attacks on the Town Centre, the Castle
 * and the Wonder were silently dropped by the very rule meant to catch them.
 */
export function isAttackOnOwnEconomy(
  attack: Pick<ProjectedUnitAttackView, 'participants'>,
  humanPlayerId: number,
): boolean {
  const participants = attack.participants;
  return (
    participants !== undefined
    && participants.targetOwner === humanPlayerId
    && participants.attackerOwner !== humanPlayerId
    && participants.targetIsEconomy
  );
}

/** Put the mark on the minimap at a world cell, or move it and restart its
 *  hold. Called on EVERY hit on the human's economy — not only the throttled
 *  ones that sound the horn — so a sustained raid keeps it lit. Not routed
 *  through `playCue`, so it still shows when the sound is muted. */
export function raiseAttackWarning(x: number, y: number, tick: number, at = nowMs()): void {
  raised = { x, y, lastHitTick: tick, raisedAtMs: raised?.raisedAtMs ?? at };
}

/** The live mark at simulation tick `tick`, or null once a whole hold has
 *  passed since the last hit. A tick BEFORE the last hit (a load or a replay
 *  seek went back in time) clears it: that hit has not happened yet. */
export function getAttackWarning(tick: number, at = nowMs()): AttackWarningMark | null {
  if (!raised) return null;
  const age = tick - raised.lastHitTick;
  if (age < 0 || age >= ATTACK_WARNING_HOLD_TICKS) {
    raised = null;
    return null;
  }
  const elapsed = Math.max(0, at - raised.raisedAtMs);
  const phase = (elapsed % ATTACK_WARNING_PULSE_MS) / ATTACK_WARNING_PULSE_MS;
  return {
    x: raised.x,
    y: raised.y,
    intensity: 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI)),
    ripple: phase,
  };
}

/** Repaint key: empty while nothing is up, so a quiet frame is byte-identical
 *  to one drawn before this existed. */
export function attackWarningSignature(tick: number, at = nowMs()): string {
  const mark = getAttackWarning(tick, at);
  if (!mark) return '';
  return `${mark.x},${mark.y},${Math.floor(at / PULSE_STEP_MS)}`;
}

/** Tests and teardown. */
export function clearAttackWarning(): void {
  raised = null;
}
