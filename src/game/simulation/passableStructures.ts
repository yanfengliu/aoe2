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
// The Fish Trap is the water analogue of this question — a building that
// stands on the ground ships move over — and this module does not answer it:
// `tests/simulation/fishTrapBlocks.test.ts` pins a trap as a wall to ships,
// and a line that takes the trap on decides against DE first. Until then it is
// a 'building' claim like everything else.

import type { BuildingType } from './types';

/** How a structure claims its footprint in `worldOccupancy`. */
export type StructureClaimKind = 'building' | 'farm';

/**
 * 'farm' for a farm, 'building' for everything else. A farm's footprint is
 * walkable ground that refuses further placement; a building's is a wall.
 */
export function structureClaimKind(buildingType: BuildingType): StructureClaimKind {
  return buildingType === 'farm' ? 'farm' : 'building';
}
