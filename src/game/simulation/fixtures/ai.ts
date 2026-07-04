// Barrel re-export for the ai/* split. Original 565-LOC monolith with 9
// fixture factories splits 2 ways per the 500-LOC hard-limit rule.
// Existing imports from `./ai` continue to work.

export {
  createAiPlannerFixture,
  createAiMonkFixture,
  createAiMonkHealFixture,
  createAiWonderFixture,
} from './ai/plannerAndMonk';

export {
  createAiMonkRelicFixture,
  createAiScoutingResponseFixture,
  createAiDifficultyFixture,
  createAiRushFixture,
  createAiEconomyFixture,
  createAiAgeUpPriorityFixture,
  createAiVillagerReserveFixture,
  createAiMarketAgeUpFixture,
} from './ai/scoutingAndRush';
