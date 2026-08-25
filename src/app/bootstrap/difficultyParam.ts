// Parse ?difficulty=easy|standard|hard (§4.6) — how sharp every AI seat is.
// The tiers drive the AI's decision interval (easy 60 ticks, standard 30,
// hard 15), so harder means "reacts and spends more often", not more cheats.
// An unusable value warns and yields undefined, leaving standard in place: a
// bad URL should open the ordinary game, not refuse to start.

import type { DifficultyLevel } from '../../game/simulation/ai';

const LEVELS: readonly DifficultyLevel[] = ['easy', 'standard', 'hard'];

export function parseDifficultyParam(url: string): DifficultyLevel | undefined {
  const raw = new URL(url).searchParams.get('difficulty');
  if (raw === null || raw.trim() === '') return undefined;
  const value = raw.trim().toLowerCase();
  const match = LEVELS.find((level) => level === value);
  if (!match) {
    console.warn(
      `[aoe2] ?difficulty= "${raw.trim()}" is not one of ${LEVELS.join('/')}; using standard.`,
    );
    return undefined;
  }
  return match;
}
