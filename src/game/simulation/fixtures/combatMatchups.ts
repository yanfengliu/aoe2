// Barrel module that re-exports every combat-matchup fixture factory
// from the per-theme sub-files. The single consumer (`fixtures/index.ts`)
// pulls these names through this file, so adding a new matchup fixture
// means dropping it into the right sub-module and re-exporting it here.

export {
  createPikemanVsKnightFixture,
  createCamelVsHussarFixture,
  createHalberdierVsCavalierFixture,
  createHalberdierVsKnightFixture,
  createCamelVsCavalryFixture,
  createSpearmanVsCamelFixture,
  createHeavyCamelVsKnightFixture,
  createPaladinFixture,
} from './combatMatchups/infantryAndCavalry';

export {
  createCavalryArcherRangedFixture,
  createSkirmisherVsCavalryArcherFixture,
} from './combatMatchups/rangedSkirmish';

export {
  createMilitiaCombatFixture,
  createMovingEnemyAttackFixture,
  createChampionVsHalberdierFixture,
  createChampionVsArmoredHalberdierFixture,
  createMilitiaLineFixture,
} from './combatMatchups/generalCombat';

export {
  createAutoAggroIdleMilitiaInVisionFixture,
  createAutoAggroIdleMilitiaOutOfVisionFixture,
  createAutoAggroArcherPursuitFixture,
  createAutoAggroPlayerMoveOverridesFixture,
  createAutoAggroVillagerAdjacentFixture,
  createAutoAggroVillagerNoPursuitFixture,
  createAutoAggroSequentialTargetsFixture,
} from './combatMatchups/autoAggression';
