// Per-architecture roof palettes (v0.3.105): the two canonical roof slots —
// the civilian THATCH and the military TILE — re-coloured per building set,
// so a Saracen town wears pale clay where a Briton town wears straw and a
// Chinese town wears glazed dark tile. Owner colour still blends ON TOP of
// these (steppedRoof's mixTint), so an architecture is a material family,
// not a player colour. Western European is the identity: the pre-v0.3.105
// palette, and the default when a view carries no architecture (units,
// legacy saves, replays without civs).

import type { ArchitectureStyle } from '../../game/simulation/architectureStyles';
import { VOXEL_COLORS } from './aoeVoxelRecipeTypes';

interface RoofPalette {
  readonly thatch: number;
  readonly tile: number;
  readonly tileDark: number;
}

const ROOF_PALETTES: Readonly<Record<ArchitectureStyle, RoofPalette>> = {
  'western-european': { thatch: VOXEL_COLORS.thatch, tile: VOXEL_COLORS.roofTile, tileDark: VOXEL_COLORS.roofTileDark },
  'central-european': { thatch: 0x8f7a55, tile: 0x6e4f3a, tileDark: 0x4d3728 },
  'middle-eastern': { thatch: 0xd8c391, tile: 0xb98d4e, tileDark: 0x826236 },
  'east-asian': { thatch: 0x5d7a72, tile: 0x3f5a56, tileDark: 0x2c3f3c },
  mediterranean: { thatch: 0xcf8a55, tile: 0xa9502e, tileDark: 0x763820 },
  mesoamerican: { thatch: 0xb59a62, tile: 0x8c6b46, tileDark: 0x624b31 },
};

/** Re-key one of the three canonical roof colours (thatch, tile, and the
 *  dark tile used for ridges and caps) into the given set; any OTHER colour
 *  (stone, timber, pottery) passes through untouched, so a castle is a
 *  castle in every architecture. */
export function architectureRoofTint(
  architecture: ArchitectureStyle | undefined,
  tint: number,
): number {
  if (!architecture || architecture === 'western-european') return tint;
  const palette = ROOF_PALETTES[architecture];
  if (tint === VOXEL_COLORS.thatch) return palette.thatch;
  if (tint === VOXEL_COLORS.roofTile) return palette.tile;
  if (tint === VOXEL_COLORS.roofTileDark) return palette.tileDark;
  return tint;
}
