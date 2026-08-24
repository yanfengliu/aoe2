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
  // A Turtle Ship is roofed over, so it supplies its own top structure and
  // the mast/sail/pennant would only poke through the shell.
  const covered = profile.signature === 'turtle-shell';
  const timber = shade(VOXEL_COLORS.timber, 1.05);
  const timberDark = VOXEL_COLORS.timberDark;
  // An upgraded warship is a BIGGER warship — a Galleon beside a Galley, a
  // Fast Fire Ship beside a Fire Ship. Every hull ignored `tier` until
  // v0.3.46, so the whole naval roster was one boat with swapped weapons and
  // no upgrade a player could see.
  const grade = Math.max(0, profile.tier - 1);
  const length = 0.86 + grade * 0.09;
  const beam = 0.42 + grade * 0.03;

  // Deck — long along +z (the authored forward axis).
  addUnitPart(context, 'ship-hull', 'matte', timber, 0, -0.04, 0, beam, 0.16 + grade * 0.02, length);
  // Gunwales down each side, so the deck reads as an open boat.
  const rail = beam / 2 - 0.02;
  addUnitPart(context, 'ship-gunwale-left', 'matte', timberDark, -rail, 0.1, 0, 0.05, 0.1 + grade * 0.03, length - 0.06);
  addUnitPart(context, 'ship-gunwale-right', 'matte', timberDark, rail, 0.1, 0, 0.05, 0.1 + grade * 0.03, length - 0.06);
  // Prow and stern blocks taper the ends.
  addUnitPart(context, 'ship-prow', 'matte', timber, 0, 0.02, length / 2 + 0.03, 0.2, 0.2, 0.16);
  addUnitPart(context, 'ship-stern', 'matte', timberDark, 0, 0.04, -(length / 2 + 0.01), 0.28, 0.18, 0.12);
  if (covered) return;
  // Mast with a crossyard. A higher-rated hull carries more canvas.
  const mastHeight = 0.62 + grade * 0.1;
  addUnitPart(context, 'ship-mast', 'matte', timberDark, 0, 0.14, 0.04, 0.055, mastHeight, 0.055);
  addUnitPart(context, 'ship-yard', 'matte', timberDark, 0, mastHeight - 0.02, 0.04, 0.05, 0.045, 0.44 + grade * 0.05);
  // Pale canvas sail — at this scale a team-tinted sail just reads as a dark
  // slab, so ownership rides on the hull tint and a pennant instead.
  addUnitPart(context, 'ship-sail', 'matte', VOXEL_COLORS.plasterLight, 0, 0.28, 0.02, 0.03, 0.32 + grade * 0.08, 0.42 + grade * 0.05);
  addUnitPart(context, 'ship-pennant', 'matte', context.team, 0, mastHeight + 0.04, 0.1, 0.02, 0.06, 0.16);
  // An Elite hull gilds its masthead — the same language the land roster
  // already uses to say top tier.
  if (profile.elite) {
    addUnitPart(context, 'ship-masthead', 'metal', VOXEL_COLORS.gold, 0, 0.14 + mastHeight, 0.04, 0.09, 0.08, 0.09);
  }
}

/** Galley line: archers' shield rack along the rail and a bow on the deck. */
function bowArmament(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  // One bow per tier, so a Galleon plainly out-shoots a Galley.
  const rail = 0.19 + Math.max(0, profile.tier - 1) * 0.015;
  addUnitPart(context, 'ship-bow-rack-left', 'matte', VOXEL_COLORS.leather, -rail, 0.2, 0.16, 0.03, 0.14, 0.3);
  addUnitPart(context, 'ship-bow-rack-right', 'matte', VOXEL_COLORS.leather, rail, 0.2, 0.16, 0.03, 0.14, 0.3);
  for (let index = 0; index < Math.max(1, profile.tier); index += 1) {
    const suffix = index === 0 ? 'ship-bow-stave' : `ship-bow-stave-${index + 1}`;
    addUnitPart(context, suffix, 'matte', VOXEL_COLORS.timberDark, 0, 0.2, 0.34 - index * 0.19, 0.26, 0.03, 0.03);
  }
}

/** Fire Ship: a bronze flame siphon at the bow with a live flame. */
function fireArmament(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  const grade = Math.max(0, profile.tier - 1);
  addUnitPart(context, 'ship-fire-siphon', 'metal', VOXEL_COLORS.gold, 0, 0.16, 0.42 + grade * 0.05, 0.12 + grade * 0.04, 0.12, 0.24);
  addUnitPart(context, 'ship-fire-flame', 'matte', 0xe2762f, 0, 0.26, 0.58 + grade * 0.06, 0.14 + grade * 0.07, 0.16 + grade * 0.08, 0.14 + grade * 0.07);
}

/** Demolition line: a powder keg amidships, lashed down and fused. */
function powderArmament(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  // A Heavy Demolition Ship carries a visibly bigger charge.
  const keg = 0.26 + Math.max(0, profile.tier - 1) * 0.08;
  addUnitPart(context, 'ship-powder-keg', 'matte', VOXEL_COLORS.timberDark, 0, 0.14, 0.06, keg, keg, keg);
  addUnitPart(context, 'ship-powder-band', 'metal', VOXEL_COLORS.steelDark, 0, 0.11 + keg / 2, 0.06, keg + 0.02, 0.04, keg + 0.02);
  addUnitPart(context, 'ship-powder-fuse', 'matte', VOXEL_COLORS.cloth, 0.06, 0.14 + keg, 0.06, 0.02, 0.12, 0.02);
}

/** Cannon Galleon: a broadside gun run out over the rail. */
function cannonArmament(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  // A second gun runs out to port once the hull is rated for it.
  const guns = profile.tier >= 2 ? [0.16, -0.16] : [0.16];
  guns.forEach((x, index) => {
    const port = index === 0 ? '' : '-port';
    addUnitPart(context, `ship-cannon-barrel${port}`, 'metal', VOXEL_COLORS.steelDark, x, 0.2, 0.24, 0.1, 0.1, 0.36);
    addUnitPart(context, `ship-cannon-muzzle${port}`, 'metal', VOXEL_COLORS.steel, x, 0.2, 0.44, 0.12, 0.12, 0.06);
    addUnitPart(context, `ship-cannon-carriage${port}`, 'matte', VOXEL_COLORS.timberDark, x, 0.12, 0.14, 0.14, 0.1, 0.16);
  });
}

/**
 * Turtle Ship (Koreans): an iron-plated roof clamped over the whole deck with
 * spikes along the ridge, and a dragon's head at the prow that the cannon fires
 * through. Nothing else afloat has a closed top, so the silhouette reads at a
 * glance even at default zoom.
 */
function turtleShell(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  // Elite plating is thicker and darker.
  const heavy = profile.elite;
  const iron = shade(VOXEL_COLORS.steelDark, heavy ? 0.78 : 0.92);
  addUnitPart(context, 'ship-turtle-shell', 'metal', iron, 0, 0.2, 0, 0.44 + (heavy ? 0.05 : 0), 0.24 + (heavy ? 0.04 : 0), 0.78 + (heavy ? 0.07 : 0));
  addUnitPart(context, 'ship-turtle-ridge', 'metal', VOXEL_COLORS.steel, 0, 0.34, 0, 0.16, 0.1, 0.7);
  for (const [name, z] of [['fore', 0.24], ['mid', 0], ['aft', -0.24]] as const) {
    addUnitPart(context, `ship-turtle-spike-${name}`, 'metal', VOXEL_COLORS.steel, 0, 0.42, z, 0.05, 0.1, 0.05);
  }
  addUnitPart(context, 'ship-turtle-head', 'matte', context.team, 0, 0.2, 0.5, 0.16, 0.18, 0.18);
  addUnitPart(context, 'ship-turtle-jaw', 'metal', VOXEL_COLORS.gold, 0, 0.14, 0.6, 0.1, 0.08, 0.1);
}

/**
 * Longboat (Vikings): a carved dragon prow and a shield wall down the rail —
 * the two things that make a longship recognisable from any angle.
 */
function dragonProw(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  addUnitPart(context, 'ship-dragon-neck', 'matte', VOXEL_COLORS.timberDark, 0, 0.22, 0.48, 0.08, 0.4, 0.1, { roll: -0.22 });
  addUnitPart(context, 'ship-dragon-head', 'matte', shade(VOXEL_COLORS.timber, 0.9), 0, 0.44, 0.56, 0.12, 0.12, 0.2);
  addUnitPart(context, 'ship-dragon-crest', 'matte', context.team, 0, 0.52, 0.52, 0.04, 0.1, 0.14);
  // An Elite Longboat carries a fuller shield wall — one more shield a side.
  const stations = profile.elite
    ? ([['fore', 0.3], ['mid-fore', 0.08], ['mid-aft', -0.14], ['aft', -0.34]] as const)
    : ([['fore', 0.26], ['mid', 0.02], ['aft', -0.22]] as const);
  for (const [name, z] of stations) {
    for (const [side, x] of [['left', -0.22], ['right', 0.22]] as const) {
      addUnitPart(context, `ship-shield-${side}-${name}`, 'matte', shade(context.team, 0.78), x, 0.18, z, 0.05, 0.2, 0.2);
    }
  }
}

/** A Fishing Ship's working prop: a net slung over the stern rail. */
function fishingNet(context: UnitRecipeContext): void {
  addUnitPart(context, 'ship-fishing-net', 'matte', VOXEL_COLORS.cloth, 0, 0.06, -0.5, 0.24, 0.22, 0.08);
  addUnitPart(context, 'ship-net-float', 'matte', VOXEL_COLORS.plasterLight, 0.14, 0.2, -0.5, 0.07, 0.07, 0.07);
}

/** A Transport Ship's working prop: the ramp its cargo walks down, hinged at
 *  the bow and resting on the deck, with a low rail along the open hold. */
function boardingRamp(context: UnitRecipeContext): void {
  addUnitPart(context, 'ship-boarding-ramp', 'matte', VOXEL_COLORS.timber, 0, 0.13, 0.46, 0.3, 0.05, 0.34, { pitch: -0.42 });
  addUnitPart(context, 'ship-hold-rail-left', 'matte', VOXEL_COLORS.timberDark, -0.2, 0.17, 0, 0.05, 0.07, 0.5);
  addUnitPart(context, 'ship-hold-rail-right', 'matte', VOXEL_COLORS.timberDark, 0.2, 0.17, 0, 0.05, 0.07, 0.5);
}

export function addShipUnitParts(
  context: UnitRecipeContext,
  unitType: UnitType,
  profile: UnitVisualProfile,
): void {
  hull(context, profile);
  // The two unique hulls are chosen by SIGNATURE: both share an ordinary
  // warship's weapon, and what makes them recognisable is the hull itself.
  if (profile.signature === 'turtle-shell') turtleShell(context, profile);
  else if (profile.signature === 'dragon-prow') dragonProw(context, profile);
  if (profile.weapon === 'net') fishingNet(context);
  else if (profile.weapon === 'boarding-ramp') boardingRamp(context);
  else if (profile.weapon === 'ship-bow') bowArmament(context, profile);
  else if (profile.weapon === 'ship-fire') fireArmament(context, profile);
  else if (profile.weapon === 'ship-powder') powderArmament(context, profile);
  else if (profile.weapon === 'ship-cannon') cannonArmament(context, profile);
  void unitType;
}
