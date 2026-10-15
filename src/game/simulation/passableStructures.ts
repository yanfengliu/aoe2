// Which structures a unit walks across, and how each claims its footprint.
//
// In Definitive Edition a farm is ground with crops on it: every land unit of
// every player walks over it, and only the Mill or Town Centre beside it
// blocks. Here a building's footprint is normally an ENGINE occupancy claim,
// and the engine's sub-cell grid refuses a unit slot on any cell another
// entity occupies (`occupancy-cell-grid.isBlocked`). So a farm that keeps that
// claim can never be walked on whatever the passability predicate says: units
// would route through it and then stack on it as overflow. The answer is
// therefore a CLAIM KIND, decided once here and read by
// `worldOccupancy.syncBuilding`: a 'farm' claim is recorded on this side only,
// where placement still counts it and movement, spawn and wildlife do not
// (`worldOccupancyCells.blocksWholeCell` is the one list they read).
//
// A foundation nobody has started building is the same kind of ground (work
// 126). Definitive Edition update 185872: "Fixed a bug preventing Villagers
// from walking over unbuilt Foundations" and "Fixed a bug causing unbuilt
// building Foundations to prevent players from building upon them". So until
// its first build progress a building claims a 'foundation', kept on this side
// like a farm: every unit and animal walks over it (in DE a sheep is a unit),
// units spawn on it, and placement counts it unless it stands aside for the
// asker (an enemy of its owner, foundationClaims.ts). From the first build
// progress it claims as a building, a wall; the builder's step re-claims it
// the tick that progress lands (builderWorkStep.ts).
//
// The Fish Trap is the water analogue of the farm question — a building that
// stands on the ground ships move over — and this module does not answer it:
// `tests/simulation/fishTrapBlocks.test.ts` pins a finished trap as a wall to
// ships, and a line that takes the trap on decides against DE first. Until
// then a started trap is a 'building' claim like everything else.

import type { BuildingType } from './types';

/** How a structure claims its footprint in `worldOccupancy`. */
export type StructureClaimKind = 'building' | 'farm' | 'foundation';

/**
 * 'farm' for a farm, started or not; for anything else 'foundation' until its
 * construction has started and 'building' from then on. A farm's footprint is
 * walkable ground that refuses further placement; a foundation's is walkable
 * ground that refuses its owner's and its allies' placement; a building's is a
 * wall. `started` is unstartedFoundations.ts's one meaning of the word.
 */
export function structureClaimKind(buildingType: BuildingType, started = true): StructureClaimKind {
  if (buildingType === 'farm') return 'farm';
  return started ? 'building' : 'foundation';
}
