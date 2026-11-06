import { describe, expect, it } from 'vitest';

import {
  SHARED_FAR_SEED,
  SHARED_FARM_SEED,
  SHARED_GATHERING_SEED,
  SHARED_KINDS,
  SHARED_PILE_SEED,
  SHARED_TRAP_SEED,
  sharedGatheringScenarios,
  sharedKindSeed,
} from '../../src/game/simulation/fixtures/economyBasics/sharedGathering';

// `sharedGatheringScenarios` spells its seeds as literals, because the
// registry can call it before this module's constants exist (an import cycle
// through `prototypeScenario`, which a browser spec importing the fixture
// first walks into). This holds the literals to the constants the tests use,
// and every scene to its own seed.
describe('work 145 shared-gathering scenes', () => {
  it('register under the seeds the tests name, each scene carrying its own seed', () => {
    const entries = sharedGatheringScenarios();
    expect(entries.map(([seed]) => seed)).toEqual([
      SHARED_GATHERING_SEED,
      ...SHARED_KINDS.map(sharedKindSeed),
      SHARED_FAR_SEED,
      SHARED_FARM_SEED,
      SHARED_TRAP_SEED,
      SHARED_PILE_SEED,
    ]);
    for (const [seed, create] of entries) expect(create(seed).seed).toBe(seed);
  });
});
