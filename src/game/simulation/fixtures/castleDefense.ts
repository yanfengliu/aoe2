// Barrel module that re-exports every Castle-defense fixture factory
// from the per-theme sub-files. The single consumer (`fixtures/index.ts`)
// pulls these names through this file, so adding a new Castle fixture
// means dropping it into the right sub-module and re-exporting it here.

export {
  createLongbowmanRangedFixture,
  createCastleFletchingFixture,
  createCastleGarrisonFixture,
  createGarrisonHealFixture,
  createGarrisonHealHerbalFixture,
} from './castleDefense/fletching';

export {
  createFu3PalisadeWallFixture,
  createFu3StoneWallFixture,
  createFu3StoneWallBlockingFixture,
  createFu3StoneWallCombatFixture,
} from './castleDefense/fu3Walls';

export {
  createFu3CastleNoArchersFixture,
  createFu3CastleThreeArchersFixture,
  createFu3CastleFiveArchersFixture,
  createFu3CastleEdgeRangeFixture,
} from './castleDefense/fu3Archers';

export {
  createCastleNonBritonsFixture,
  createCastleUniqueFixture,
  createCastleAiTargetPriorityFixture,
  createCastleDefensiveFireFixture,
} from './castleDefense/towerAndCastle';
