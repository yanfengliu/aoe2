// Barrel module that re-exports every Monastery fixture factory from the
// per-theme sub-files. The single consumer (`fixtures/index.ts`) pulls
// these names through this file, so adding a new Monastery fixture means
// dropping it into the right sub-module and re-exporting it here.

export {
  createMonkHealFixture,
  createMonkHealthyFriendlyWithEnemyFixture,
  createMonkHealOverConvertFixture,
} from './monastery/heal';

export {
  createMonkConvertFixture,
  createMonkDoubleConvertFixture,
  createMonkFlipFlopFixture,
  createMonkConvertCleanupFixture,
  createMonkConvertVisionFixture,
  createMonkFogFixture,
} from './monastery/convert';

export {
  createMonasteryFixture,
  createMonkRelicDropCrampedFixture,
  createMonkRelicDropFixture,
  createMonkRelicFixture,
} from './monastery/relic';
