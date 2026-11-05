import type { PrototypeScenario } from '../prototypeScenario';
import { createBuildingShowcaseFixture } from './buildingShowcase';

// Work 142 M2b-2: every building's command card under DE's keys. The building
// showcase's grid (one completed building of the human's of every type, in the
// Imperial Age, AIs off), with resources enough that every key of a card can
// queue its button in one match: a refusal for want of gold would hide whether
// the key pressed the right button. The `?civ=` parameter picks the Castle's
// unique unit and technologies.
export const BUILDING_CARD_KEYS_SEED = 'building-card-keys-fixture';

const PLENTY = 50_000;

export function createBuildingCardKeysFixture(seed: string): PrototypeScenario {
  const showcase = createBuildingShowcaseFixture(seed);
  return {
    ...showcase,
    starts: showcase.starts.map((start) => (start.owner === 1
      ? { ...start, startingResources: { food: PLENTY, wood: PLENTY, gold: PLENTY, stone: PLENTY } }
      : start)),
  };
}
