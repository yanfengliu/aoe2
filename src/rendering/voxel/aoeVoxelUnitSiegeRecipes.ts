import type { UnitType } from '../../game/simulation/types';
import { shade, VOXEL_COLORS } from './aoeVoxelRecipeTypes';
import { addUnitPart as add, type UnitRecipeContext } from './aoeVoxelUnitRecipeContext';
import type { UnitVisualProfile } from './aoeVoxelUnitVisualProfiles';

function chassis(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  const long = profile.weapon === 'ram' || profile.weapon === 'trebuchet';
  add(context, 'siege-chassis', 'matte', VOXEL_COLORS.timber, 0, 0.24, 0, long ? 1.25 : 0.92, 0.42, long ? 0.56 : 0.78, { yaw: -0.42 });
  add(context, 'siege-deck', 'matte', VOXEL_COLORS.timberDark, 0, 0.66, 0, long ? 1.08 : 0.75, 0.16, long ? 0.48 : 0.68, { yaw: -0.42 });
  for (const [name, x, z] of [
    ['left', -0.38, 0.34], ['right', 0.38, -0.34],
    ['rear-left', -0.48, 0.1], ['rear-right', 0.48, -0.1],
  ] as const) {
    add(context, `siege-wheel-${name}`, 'matte', VOXEL_COLORS.timberDark, x, 0.08, z, 0.3, 0.3, 0.16, { roll: Math.PI / 4, yaw: -0.42 });
  }
  add(context, 'siege-team-panel', 'matte', context.team, 0, 0.42, 0.43, 0.5, 0.28, 0.08, { yaw: -0.42 });
}

function stoneThrower(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  add(context, 'siege-throwing-arm', 'matte', VOXEL_COLORS.timberDark, 0.18, 0.72, -0.12, 0.14, profile.tier >= 2 ? 1.42 : 1.25, 0.14, { roll: -0.52 });
  add(context, 'siege-bucket', 'metal', VOXEL_COLORS.steelDark, 0.48, profile.tier >= 2 ? 1.82 : 1.66, -0.24, 0.34, 0.26, 0.32, { roll: -0.52 });
  add(context, 'siege-brace', 'matte', VOXEL_COLORS.timber, -0.2, 0.62, 0.15, 0.12, 0.8, 0.12, { roll: 0.42 });
  const heavy = profile.tier >= 2;
  add(context, `detail-${unitType}-${profile.signature}`, 'matte', heavy ? VOXEL_COLORS.stoneDark : VOXEL_COLORS.leather, -0.33, 0.71, -0.22, heavy ? 0.34 : 0.28, heavy ? 0.34 : 0.24, 0.28);
  if (heavy) {
    add(context, `detail-${unitType}-torsion-frame`, 'metal', VOXEL_COLORS.steelDark, 0.03, 0.54, -0.12, 0.52, 0.22, 0.52, { yaw: -0.42 });
  }
  // Siege Onager: the reinforced axle and iron-shod wheels that let it throw
  // heavy enough to fell trees.
  if (profile.tier >= 3) {
    add(context, `detail-${unitType}-braced-axle`, 'metal', VOXEL_COLORS.steel, 0, 0.34, 0, 0.78, 0.14, 0.14, { yaw: -0.42 });
    add(context, `detail-${unitType}-wheel-left`, 'metal', VOXEL_COLORS.steelDark, -0.3, 0.16, 0.26, 0.14, 0.34, 0.34, { yaw: -0.42 });
    add(context, `detail-${unitType}-wheel-right`, 'metal', VOXEL_COLORS.steelDark, 0.3, 0.16, -0.26, 0.14, 0.34, 0.34, { yaw: -0.42 });
  }
}

function scorpion(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  add(context, 'siege-scorpion-rail', 'matte', VOXEL_COLORS.timberDark, 0.15, 0.76, -0.12, 1.3, 0.15, 0.16, { yaw: -0.42 });
  add(context, 'siege-scorpion-bolt', 'metal', VOXEL_COLORS.steel, 0.42, 0.86, -0.25, 1.18, 0.07, 0.07, { yaw: -0.42 });
  add(context, 'siege-scorpion-bow-left', 'matte', VOXEL_COLORS.timber, 0.38, 0.78, 0.22, 0.1, 0.72, 0.1, { roll: -0.63, yaw: -0.42 });
  add(context, 'siege-scorpion-bow-right', 'matte', VOXEL_COLORS.timber, 0.58, 0.78, -0.42, 0.1, 0.72, 0.1, { roll: 0.63, yaw: -0.42 });
  add(context, 'siege-scorpion-winch', 'metal', VOXEL_COLORS.steelDark, -0.32, 0.77, 0.18, 0.34, 0.2, 0.34, { yaw: -0.42 });
  add(context, `detail-${unitType}-${profile.signature}`, profile.tier === 3 ? 'metal' : 'matte', profile.tier === 3 ? VOXEL_COLORS.steel : VOXEL_COLORS.leather, 0.04, 0.69, -0.04, 0.42, 0.12, 0.42, { yaw: -0.42 });
}

function ram(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  // The ram line is told apart by its ROOF, exactly as AoE2 tells it apart:
  // Battering Ram carries stretched hide, Capped Ram is capped with planking
  // over a steel ridge, Siege Ram is plated over. Rendering tier 2 as tier 1
  // (which this did until v0.3.46) makes the Capped Ram upgrade invisible.
  // 0.30 / 0.34 / 0.38 — the outer two are exactly what the Battering and
  // Siege Ram already had, so only the new middle tier moves.
  const head = 0.3 + (profile.tier - 1) * 0.04;
  add(context, 'siege-ram-beam', 'matte', VOXEL_COLORS.timberDark, 0.24, 0.63, -0.16, 1.55, 0.18, 0.18, { yaw: -0.42 });
  add(context, 'siege-ram-head', 'metal', VOXEL_COLORS.steelDark, 0.88, 0.6, -0.43, head, head, head, { yaw: -0.42 });
  const plated = profile.tier >= 3;
  const capped = profile.tier === 2;
  const roofTint = plated ? VOXEL_COLORS.steelDark : capped ? VOXEL_COLORS.timber : VOXEL_COLORS.leather;
  add(context, `detail-${unitType}-${profile.signature}`, plated ? 'metal' : 'matte', roofTint, -0.05, 0.8, 0, 1.2, 0.5 + (capped ? 0.06 : 0), 0.62, { yaw: -0.42 });
  add(
    context,
    `detail-${unitType}-roof-ridge`,
    profile.tier >= 2 ? 'metal' : 'matte',
    profile.tier >= 2 ? VOXEL_COLORS.steel : VOXEL_COLORS.timber,
    0, 1.25 + (capped ? 0.06 : 0), 0, 1.0, 0.12, 0.2,
    { yaw: -0.42 },
  );
  // What CAPPED means, and the only thing that tells this tier from the one
  // below at gameplay zoom: bright iron caps banding the roof ends. Timber and
  // hide are 0x744927 and 0x5b3c28 — two browns nobody can tell apart on a
  // moving unit, so the tier difference has to be metal.
  if (capped) {
    for (const [name, offset] of [['fore', 0.52], ['aft', -0.52]] as const) {
      add(context, `detail-${unitType}-iron-cap-${name}`, 'metal', VOXEL_COLORS.steel, offset * 0.9, 0.86, offset * -0.42, 0.16, 0.44, 0.6, { yaw: -0.42 });
    }
  }
}

function cannon(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  add(context, 'siege-cannon-barrel', 'metal', VOXEL_COLORS.steelDark, 0.27, 0.72, -0.18, 1.34, 0.25, 0.25, { yaw: -0.42 });
  add(context, 'siege-cannon-muzzle', 'metal', VOXEL_COLORS.steel, 0.84, 0.7, -0.47, 0.28, 0.34, 0.34, { yaw: -0.42 });
  add(context, 'siege-cannon-breech', 'metal', VOXEL_COLORS.steel, -0.32, 0.73, 0.13, 0.38, 0.36, 0.36, { yaw: -0.42 });
  add(context, 'siege-cannon-trunnion', 'metal', VOXEL_COLORS.gold, 0.03, 0.68, -0.02, 0.16, 0.5, 0.16, { roll: Math.PI / 2, yaw: -0.42 });
  add(context, `detail-${unitType}-${profile.signature}`, 'matte', shade(context.team, 0.65), -0.38, 0.51, 0.33, 0.36, 0.34, 0.32, { yaw: -0.42 });
}

function trebuchet(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  add(context, 'siege-trebuchet-frame-left', 'matte', VOXEL_COLORS.timber, -0.3, 0.45, 0.18, 0.16, 1.35, 0.16, { roll: -0.3 });
  add(context, 'siege-trebuchet-frame-right', 'matte', VOXEL_COLORS.timber, 0.3, 0.45, -0.18, 0.16, 1.35, 0.16, { roll: 0.3 });
  add(context, 'siege-trebuchet-axle', 'metal', VOXEL_COLORS.steelDark, 0, 1.28, 0, 0.75, 0.16, 0.16, { yaw: -0.42 });
  add(context, 'siege-trebuchet-arm', 'matte', VOXEL_COLORS.timberDark, 0.02, 0.83, -0.02, 0.14, 1.76, 0.14, { roll: -0.42 });
  add(context, 'siege-trebuchet-sling', 'matte', VOXEL_COLORS.leather, 0.4, 2.28, -0.18, 0.1, 0.64, 0.1, { roll: -0.42 });
  add(context, 'siege-trebuchet-counterweight', 'matte', VOXEL_COLORS.stoneDark, -0.35, 0.45, 0.16, 0.48, 0.58, 0.46, { roll: -0.42 });
  add(context, `detail-${unitType}-${profile.signature}`, 'matte', VOXEL_COLORS.stone, 0.51, 2.76, -0.24, 0.32, 0.32, 0.32);
}

export function addSiegeUnitParts(
  context: UnitRecipeContext,
  unitType: UnitType,
  profile: UnitVisualProfile,
): void {
  chassis(context, profile);
  if (profile.weapon === 'stone-thrower') stoneThrower(context, unitType, profile);
  else if (profile.weapon === 'bolt-thrower') scorpion(context, unitType, profile);
  else if (profile.weapon === 'ram') ram(context, unitType, profile);
  else if (profile.weapon === 'cannon') cannon(context, unitType, profile);
  else trebuchet(context, unitType, profile);
}
