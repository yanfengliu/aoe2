// The attack warning (v0.3.217) — the rule, the throttle, and the mark.
//
// GATES the class "a player under attack is not told". Found by playing
// (defect register 2026-09-06): at tick 3084 of `aoe2-prototype` an enemy
// militia hit a villager 25 -> 21 -> 17 HP with no banner, no toast, no
// minimap mark, no selection change and no message of any kind.
//
// BOUND, stated so nobody reads more into a green run than it holds: these
// cases exercise the DECISION over a synthetic feed. That the decision reaches
// pixels is `tests/browser/attack-warning.spec.ts`, on the real match, at the
// real tick — because a field can be correct and rendered by nothing.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  ATTACK_WARNING_HOLD_TICKS,
  ATTACK_WARNING_THROTTLE_TICKS,
  clearAttackWarning,
  getAttackWarning,
  isAttackOnOwnEconomy,
  raiseAttackWarning,
  attackWarningSignature,
} from '../../src/ui/hud/attackWarning';
import type { UnitAttackParticipants } from '../../src/game/simulation/types';

const HUMAN = 1;
const ENEMY = 2;

function swing(participants: UnitAttackParticipants | undefined) {
  return participants === undefined ? {} : { participants };
}

describe('what counts as an attack on you', () => {
  it('counts an enemy unit hitting your VILLAGER — the reproduced defect', () => {
    expect(isAttackOnOwnEconomy(
      swing({ attackerOwner: ENEMY, targetOwner: HUMAN, targetIsEconomy: true }),
      HUMAN,
    )).toBe(true);
  });

  it('counts an enemy unit hitting your BUILDING', () => {
    // A 4x4 Town Centre is the case the rule this replaced could never catch:
    // it compared the swing's target cell (the building's visual CENTRE,
    // origin + 1.5) against the building's render ORIGIN with a one-cell
    // tolerance, so every Town Centre, Castle and Wonder hit was dropped by
    // the very check meant to catch it.
    expect(isAttackOnOwnEconomy(
      swing({ attackerOwner: ENEMY, targetOwner: HUMAN, targetIsEconomy: true }),
      HUMAN,
    )).toBe(true);
  });

  it('does NOT count your own soldier taking a hit', () => {
    // A warning on every arrow in a pitched battle is worse than none.
    expect(isAttackOnOwnEconomy(
      swing({ attackerOwner: ENEMY, targetOwner: HUMAN, targetIsEconomy: false }),
      HUMAN,
    )).toBe(false);
  });

  it('does NOT count you hitting somebody else', () => {
    // Your Town Centre firing back, your scout killing a straggler: your
    // stuff is not being damaged, so there is nothing to warn about.
    expect(isAttackOnOwnEconomy(
      swing({ attackerOwner: HUMAN, targetOwner: ENEMY, targetIsEconomy: true }),
      HUMAN,
    )).toBe(false);
  });

  it('does NOT count a raid on somebody ELSE\'s villagers', () => {
    expect(isAttackOnOwnEconomy(
      swing({ attackerOwner: HUMAN, targetOwner: ENEMY, targetIsEconomy: true }),
      HUMAN,
    )).toBe(false);
    expect(isAttackOnOwnEconomy(
      swing({ attackerOwner: 3, targetOwner: ENEMY, targetIsEconomy: true }),
      HUMAN,
    )).toBe(false);
  });

  it('does NOT count wildlife, which carries no participants at all', () => {
    // A lured boar biting the villager that shot it happens in the opening of
    // every match, on purpose, in full view. The hit feed records the bite
    // with no participants (`playerHitFeed.ts`).
    expect(isAttackOnOwnEconomy(swing(undefined), HUMAN)).toBe(false);
  });

  it('does NOT count a blow that names no participants, whatever else it carries', () => {
    expect(isAttackOnOwnEconomy({ participants: undefined }, HUMAN)).toBe(false);
  });
});

describe('the mark on the minimap', () => {
  beforeEach(() => clearAttackWarning());

  it('is nothing at all until a warning is raised', () => {
    expect(getAttackWarning(100, 1_000)).toBeNull();
    // The repaint key's warning term must be EMPTY in a quiet frame, or every
    // still frame in the game would differ from the one before it.
    expect(attackWarningSignature(100, 1_000)).toBe('');
  });

  it('marks the cell that was hit, and pulses without ever going dark', () => {
    raiseAttackWarning(12, 34, 100, 1_000);
    for (let ms = 0; ms < 3_000; ms += 37) {
      const mark = getAttackWarning(100, 1_000 + ms);
      expect(mark, `at +${ms}ms`).not.toBeNull();
      expect(mark!.x).toBe(12);
      expect(mark!.y).toBe(34);
      // A mark that vanishes half the time is a mark a player misses.
      expect(mark!.intensity, `at +${ms}ms`).toBeGreaterThanOrEqual(0.5);
      expect(mark!.intensity, `at +${ms}ms`).toBeLessThanOrEqual(1);
    }
  });

  it('pulses: the repaint key changes while it is up', () => {
    raiseAttackWarning(12, 34, 100, 1_000);
    expect(attackWarningSignature(100, 1_000)).not.toBe(attackWarningSignature(100, 1_400));
  });

  // v0.3.229 (defect register 2026-09-24): the hold is SIMULATION time. It
  // was 8 s of wall clock, so it expired during a pause and fell dark between
  // horns of a sustained raid.
  it('holds for a whole throttle window of SIMULATION ticks after the last hit', () => {
    expect(ATTACK_WARNING_HOLD_TICKS).toBe(ATTACK_WARNING_THROTTLE_TICKS);
    raiseAttackWarning(12, 34, 100, 1_000);
    expect(getAttackWarning(100 + ATTACK_WARNING_HOLD_TICKS - 1, 1_000)).not.toBeNull();
    expect(getAttackWarning(100 + ATTACK_WARNING_HOLD_TICKS, 1_000)).toBeNull();
    expect(attackWarningSignature(100 + ATTACK_WARNING_HOLD_TICKS, 1_000)).toBe('');
  });

  it('does not expire on the wall clock: a paused game keeps it for an hour', () => {
    raiseAttackWarning(12, 34, 100, 1_000);
    expect(getAttackWarning(100, 1_000 + 3_600_000)).toMatchObject({ x: 12, y: 34 });
  });

  it('restarts its hold on every hit, so a raid that keeps hitting keeps it lit', () => {
    raiseAttackWarning(12, 34, 100, 1_000);
    raiseAttackWarning(12, 34, 280, 1_000);
    expect(getAttackWarning(100 + ATTACK_WARNING_HOLD_TICKS + 50, 1_000)).not.toBeNull();
  });

  it('clears when time goes backwards past the hit (a load or a replay seek)', () => {
    raiseAttackWarning(12, 34, 500, 1_000);
    expect(getAttackWarning(499, 1_000)).toBeNull();
    expect(getAttackWarning(500, 1_000)).toBeNull();
  });

  it('moves to the newest raid rather than keeping the first', () => {
    raiseAttackWarning(12, 34, 100, 1_000);
    raiseAttackWarning(50, 51, 110, 2_000);
    expect(getAttackWarning(110, 2_100)).toMatchObject({ x: 50, y: 51 });
  });
});

describe('the throttle', () => {
  it('spaces warnings well apart: 200 ticks, 20 s at 10 TPS', () => {
    expect(ATTACK_WARNING_THROTTLE_TICKS).toBe(200);
  });
});
