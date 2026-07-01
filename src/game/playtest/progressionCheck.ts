// Economy-progression check for the deterministic corpus. The drop-off
// deadlock (2026-07-01) froze an AI's economy so it never left the Dark Age
// for a full 8000-tick match, yet the corpus passed with 0 HIGH — no oracle
// checked whether the match actually PROGRESSED. This pure checker closes that
// gap: given the per-owner ages and the set of living owners at (near) match
// end, it flags a run in which NO living owner reached a required age. For a
// long deterministic AI-vs-AI run that is a real failure (a frozen economy or a
// broken age-up path), which is exactly the class the drop-off bug was in.
//
// It reads ground-truth ages from a replay of the recorded bundle (the corpus
// runner does the replay); this module is pure so the threshold logic is unit
// tested without a bundle.

export const AGE_ORDER = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'] as const;
export type AgeName = (typeof AGE_ORDER)[number];

export function isAgeName(value: string): value is AgeName {
  return (AGE_ORDER as readonly string[]).includes(value);
}

// True when `age` is at least `min` in the standard age ordering. An unknown
// age string sorts as the lowest (dark-age) so a bad value never satisfies a
// progression requirement.
export function ageAtLeast(age: string, min: AgeName): boolean {
  const ai = isAgeName(age) ? AGE_ORDER.indexOf(age) : 0;
  return ai >= AGE_ORDER.indexOf(min);
}

export interface AgeProgressionResult {
  ok: boolean;
  requiredAge: AgeName;
  // Per living owner: the age it was in at the sampled tick.
  reached: Array<{ owner: number; age: string }>;
  message: string;
}

// Flags a run where NO living owner reached `requiredAge`. Only LIVING owners
// count — an eliminated player that never aged up is not a progression failure
// (it lost), and a run where at least one side advanced is progressing. When
// there are no living owners at all (mutual elimination) the check passes: the
// match resolved, which is not a progression stall.
export function checkAgeProgression(
  ownerAges: Record<number, string>,
  aliveOwners: readonly number[],
  requiredAge: AgeName,
): AgeProgressionResult {
  const reached = aliveOwners.map((owner) => ({ owner, age: ownerAges[owner] ?? 'dark-age' }));
  const ok = reached.length === 0 || reached.some((r) => ageAtLeast(r.age, requiredAge));
  return {
    ok,
    requiredAge,
    reached,
    message: ok
      ? ''
      : `no living owner reached ${requiredAge} (living owner ages: `
        + `${reached.map((r) => `${r.owner}:${r.age}`).join(', ') || '(none)'})`,
  };
}
