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
  ATTACK_WARNING_FLASH_MS,
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
    // every match, on purpose, in full view. `readAttackParticipants` leaves
    // the field undefined for a wildlife attacker or target.
    expect(isAttackOnOwnEconomy(swing(undefined), HUMAN)).toBe(false);
  });

  it('does NOT count an entry restored from a save, whose participants are dropped', () => {
    expect(isAttackOnOwnEconomy({ participants: undefined }, HUMAN)).toBe(false);
  });
});

describe('the mark on the minimap', () => {
  beforeEach(() => clearAttackWarning());

  it('is nothing at all until a warning is raised', () => {
    expect(getAttackWarning(1_000)).toBeNull();
    // The repaint key's warning term must be EMPTY in a quiet frame, or every
    // still frame in the game would differ from the one before it.
    expect(attackWarningSignature(1_000)).toBe('');
  });

  it('marks the cell that was hit, and pulses without ever going dark', () => {
    raiseAttackWarning(12, 34, 1_000);
    for (let ms = 0; ms < ATTACK_WARNING_FLASH_MS; ms += 37) {
      const mark = getAttackWarning(1_000 + ms);
      expect(mark, `at +${ms}ms`).not.toBeNull();
      expect(mark!.x).toBe(12);
      expect(mark!.y).toBe(34);
      // A mark that vanishes half the time is a mark a player misses.
      expect(mark!.intensity, `at +${ms}ms`).toBeGreaterThanOrEqual(0.5);
      expect(mark!.intensity, `at +${ms}ms`).toBeLessThanOrEqual(1);
    }
  });

  it('pulses: the repaint key changes while it is up', () => {
    raiseAttackWarning(12, 34, 1_000);
    expect(attackWarningSignature(1_000)).not.toBe(attackWarningSignature(1_400));
  });

  it('clears itself, and the quiet frame is byte-identical again', () => {
    raiseAttackWarning(12, 34, 1_000);
    expect(getAttackWarning(1_000 + ATTACK_WARNING_FLASH_MS)).toBeNull();
    expect(attackWarningSignature(1_000 + ATTACK_WARNING_FLASH_MS)).toBe('');
  });

  it('moves to the newest raid rather than keeping the first', () => {
    raiseAttackWarning(12, 34, 1_000);
    raiseAttackWarning(50, 51, 2_000);
    expect(getAttackWarning(2_100)).toMatchObject({ x: 50, y: 51 });
  });
});

describe('the throttle', () => {
  it('spaces warnings well apart: 200 ticks, 20 s at 10 TPS', () => {
    expect(ATTACK_WARNING_THROTTLE_TICKS).toBe(200);
  });
});
