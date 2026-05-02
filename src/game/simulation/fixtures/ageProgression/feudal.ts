// Barrel re-export for the feudal/* split. Pre-iter-3 this was a
// 694-LOC monolith with 10 fixture factories; split into prereqAndAge +
// stableAndScout + marketAndUnits per the 500-LOC hard-limit rule.
// Existing imports from `./ageProgression/feudal` continue to work.

export {
  createFeudalMissingPrereqFixture,
  createFeudalAgeFixture,
} from './feudal/prereqAndAge';

export {
  createFeudalBlacksmithFixture,
  createFeudalStableFixture,
  createBlockedStableSpawnFixture,
  createIsolatedScoutSpawnFixture,
} from './feudal/stableAndScout';

export {
  createFeudalMarketFixture,
  createFeudalSpearmanFixture,
  createFeudalSkirmisherFixture,
  createFeudalWatchTowerFixture,
} from './feudal/marketAndUnits';
