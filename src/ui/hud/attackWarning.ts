// The attack warning (v0.3.215): AoE2 tells you when your economy is being
// killed. It sounds a horn, it flashes the minimap where the blow landed, and
// Space jumps the camera there. The horn and the jump already existed; this
// module owns the RULE they share and the flash that was missing.
//
// Found by playing (defect register 2026-09-06): at tick 3084 of
// `aoe2-prototype` an enemy militia hit a villager twice, 25 -> 21 -> 17 HP,
// and the screen said nothing at all. The horn did sound — but a horn is the
// one cue a muted tab, a headphone-less player or a busy moment loses, and
// nothing on screen said an attack was happening or where.
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

/** AoE2 spaces its "town under attack" warnings well apart; ~20s at 20 TPS. */
export const ATTACK_WARNING_THROTTLE_TICKS = 400;
/** How long the minimap mark stays up. Outlives the 1.15s horn several times
 *  over, so a player who looks up a moment later still finds the raid. */
export const ATTACK_WARNING_FLASH_MS = 8_000;
/** One pulse of the mark. */
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
}

interface RaisedWarning {
  x: number;
  y: number;
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

/** Put the mark on the minimap at a world cell. Called on the same decision
 *  that sounds the horn, so the two never disagree — and, because it is not
 *  routed through `playCue`, it still shows when the sound is muted. */
export function raiseAttackWarning(x: number, y: number, at = nowMs()): void {
  raised = { x, y, raisedAtMs: at };
}

/** The live mark, or null once it has expired. */
export function getAttackWarning(at = nowMs()): AttackWarningMark | null {
  if (!raised) return null;
  const age = at - raised.raisedAtMs;
  if (age < 0 || age >= ATTACK_WARNING_FLASH_MS) {
    raised = null;
    return null;
  }
  const phase = (age % ATTACK_WARNING_PULSE_MS) / ATTACK_WARNING_PULSE_MS;
  return {
    x: raised.x,
    y: raised.y,
    intensity: 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI)),
  };
}

/** Repaint key: empty while nothing is up, so a quiet frame is byte-identical
 *  to one drawn before this existed. */
export function attackWarningSignature(at = nowMs()): string {
  const mark = getAttackWarning(at);
  if (!mark) return '';
  return `${mark.x},${mark.y},${Math.floor(at / PULSE_STEP_MS)}`;
}

/** Tests and teardown. */
export function clearAttackWarning(): void {
  raised = null;
}
