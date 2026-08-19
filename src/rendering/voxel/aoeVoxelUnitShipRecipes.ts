// Ship silhouettes (M5 naval). A hull is nothing like a land unit: it has no
// legs to stride, no torso to swing, and it sits IN the surface rather than on
// it. So ships get their own recipe family rather than a variant of the siege
// chassis, and the shared parts here (hull, gunwale, mast) are what every
// later warship will build on.

import type { UnitType } from '../../game/simulation/types';
import { VOXEL_COLORS, shade } from './aoeVoxelRecipeTypes';
import { addUnitPart, type UnitRecipeContext } from './aoeVoxelUnitRecipeContext';
import type { UnitVisualProfile } from './aoeVoxelUnitVisualProfiles';

/**
 * The common wooden hull: a tapered deck sitting low in the water with a
 * raised gunwale, a bow block that reads as a prow from above, and a mast.
 * The waterline is deliberately at the unit's ground level so the hull looks
 * partly submerged rather than parked on the surface.
 */
function hull(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  const timber = shade(VOXEL_COLORS.timber, 1.05);
  const timberDark = VOXEL_COLORS.timberDark;

  // Deck — long along +z (the authored forward axis).
  addUnitPart(context, 'ship-hull', 'matte', timber, 0, -0.04, 0, 0.42, 0.16, 0.86);
  // Gunwales down each side, so the deck reads as an open boat.
  addUnitPart(context, 'ship-gunwale-left', 'matte', timberDark, -0.19, 0.1, 0, 0.05, 0.1, 0.8);
  addUnitPart(context, 'ship-gunwale-right', 'matte', timberDark, 0.19, 0.1, 0, 0.05, 0.1, 0.8);
  // Prow and stern blocks taper the ends.
  addUnitPart(context, 'ship-prow', 'matte', timber, 0, 0.02, 0.46, 0.2, 0.2, 0.16);
  addUnitPart(context, 'ship-stern', 'matte', timberDark, 0, 0.04, -0.44, 0.28, 0.18, 0.12);
  // Mast with a crossyard.
  addUnitPart(context, 'ship-mast', 'matte', timberDark, 0, 0.14, 0.04, 0.055, 0.62, 0.055);
  addUnitPart(context, 'ship-yard', 'matte', timberDark, 0, 0.6, 0.04, 0.05, 0.045, 0.44);
  // Pale canvas sail — at this scale a team-tinted sail just reads as a dark
  // slab, so ownership rides on the hull tint and a pennant instead.
  addUnitPart(context, 'ship-sail', 'matte', VOXEL_COLORS.plasterLight, 0, 0.28, 0.02, 0.03, 0.32, 0.42);
  addUnitPart(context, 'ship-pennant', 'matte', context.team, 0, 0.66, 0.1, 0.02, 0.06, 0.16);
  void profile;
}

/** A Fishing Ship's working prop: a net slung over the stern rail. */
function fishingNet(context: UnitRecipeContext): void {
  addUnitPart(context, 'ship-fishing-net', 'matte', VOXEL_COLORS.cloth, 0, 0.06, -0.5, 0.24, 0.22, 0.08);
  addUnitPart(context, 'ship-net-float', 'matte', VOXEL_COLORS.plasterLight, 0.14, 0.2, -0.5, 0.07, 0.07, 0.07);
}

export function addShipUnitParts(
  context: UnitRecipeContext,
  unitType: UnitType,
  profile: UnitVisualProfile,
): void {
  hull(context, profile);
  if (profile.weapon === 'net') fishingNet(context);
  void unitType;
}
