import type { UnitType } from '../../game/simulation/types';
import { shade, VOXEL_COLORS } from './aoeVoxelRecipeTypes';
import { addUnitPart as add, type UnitRecipeContext } from './aoeVoxelUnitRecipeContext';
import type { UnitVisualProfile } from './aoeVoxelUnitVisualProfiles';

function elephantBody(context: UnitRecipeContext, unitType: UnitType): void {
  // Nothing about an elephant reads as a horse, so it gets its own body rather
  // than a scaled one: a deep barrel chest, four columnar legs, a hanging trunk
  // and a pair of tusks.
  const hide = 0x8e8b86;
  add(context, 'cavalry-horse-body', 'matte', hide, 0, 0.62, 0, 1.36, 0.86, 0.78, { yaw: -0.45 });
  for (const [name, x, z] of [
    ['front-left', 0.42, -0.24], ['front-right', 0.24, -0.46],
    ['back-left', -0.34, 0.26], ['back-right', -0.52, 0.08],
  ] as const) {
    add(context, `cavalry-horse-leg-${name}`, 'matte', shade(hide, 0.78), x, 0, z, 0.26, 0.66, 0.26);
  }
  add(context, 'cavalry-horse-neck', 'matte', hide, 0.52, 0.86, -0.4, 0.42, 0.5, 0.46, { roll: -0.12 });
  add(context, 'cavalry-horse-head', 'matte', shade(hide, 0.94), 0.68, 1.16, -0.52, 0.52, 0.46, 0.5, { yaw: -0.42 });
  add(context, 'cavalry-horse-ear-left', 'matte', shade(hide, 0.86), 0.56, 1.2, -0.28, 0.08, 0.34, 0.3, { yaw: -0.42 });
  add(context, 'cavalry-horse-ear-right', 'matte', shade(hide, 0.86), 0.86, 1.2, -0.68, 0.08, 0.34, 0.3, { yaw: -0.42 });
  add(context, 'cavalry-horse-mane', 'matte', shade(hide, 0.72), 0.82, 0.66, -0.66, 0.16, 0.72, 0.16, { roll: -0.14 });
  add(context, `detail-${unitType}-tusk-left`, 'matte', 0xe6e0cf, 0.78, 0.92, -0.36, 0.5, 0.08, 0.08, { yaw: -0.42, roll: 0.16 });
  add(context, `detail-${unitType}-tusk-right`, 'matte', 0xe6e0cf, 0.98, 0.92, -0.62, 0.5, 0.08, 0.08, { yaw: -0.42, roll: 0.16 });
  add(context, 'cavalry-horse-tail', 'matte', shade(hide, 0.7), -0.66, 0.62, 0.44, 0.1, 0.48, 0.1, { roll: 0.4 });
}

function mountBody(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  if (profile.mount === 'elephant') {
    elephantBody(context, unitType);
    return;
  }
  const camel = profile.mount === 'camel';
  const coat = camel ? 0xb68b5e : profile.tier >= 2 ? 0x604331 : 0x76513a;
  add(context, 'cavalry-horse-body', 'matte', coat, 0, 0.34, 0, camel ? 1.02 : 0.94, camel ? 0.52 : 0.56, 0.45, { yaw: -0.45 });
  for (const [name, x, z] of [
    ['front-left', 0.32, -0.2], ['front-right', 0.18, -0.35],
    ['back-left', -0.28, 0.2], ['back-right', -0.4, 0.08],
  ] as const) {
    add(context, `cavalry-horse-leg-${name}`, 'matte', shade(coat, 0.72), x, 0, z, 0.14, camel ? 0.58 : 0.48, 0.14);
  }
  add(context, 'cavalry-horse-neck', 'matte', coat, camel ? 0.34 : 0.38, camel ? 0.64 : 0.65, -0.28, camel ? 0.24 : 0.27, camel ? 0.75 : 0.56, 0.3, { roll: camel ? -0.15 : -0.25 });
  add(context, 'cavalry-horse-head', 'matte', shade(coat, 0.9), camel ? 0.48 : 0.5, camel ? 1.2 : 1.02, -0.36, camel ? 0.32 : 0.38, 0.32, 0.34, { yaw: -0.42 });
  add(context, 'cavalry-horse-mane', 'matte', VOXEL_COLORS.timberDark, 0.28, camel ? 0.96 : 0.83, -0.25, 0.1, camel ? 0.38 : 0.54, 0.16, { roll: -0.25 });
  add(context, 'cavalry-horse-tail', 'matte', VOXEL_COLORS.timberDark, -0.55, 0.4, 0.34, 0.12, 0.62, 0.12, { roll: 0.48 });
  if (camel) {
    add(context, `detail-${unitType}-hump`, 'matte', shade(coat, 0.92), -0.12, 0.73, 0.03, 0.55, 0.54, 0.42, { yaw: -0.45 });
  }
}

function saddleAndRider(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  // An elephant's back is roughly half a unit higher than a horse's, so a
  // rider placed at horse height ends up INSIDE the animal with only the
  // helmet showing. Everything the rider owns lifts by the same amount.
  const lift = profile.mount === 'elephant' ? 0.5 : 0;
  add(context, 'cavalry-saddle-cloth', 'matte', context.team, -0.04, 0.77 + lift, 0.03, 0.6, 0.18, 0.48, { yaw: -0.45 });
  add(context, 'cavalry-rider-tunic', profile.armor === 'plate' ? 'metal' : 'matte', profile.armor === 'plate' ? VOXEL_COLORS.steel : context.team, 0, 0.91 + lift, 0, 0.38, 0.52, 0.3);
  add(context, 'cavalry-rider-arm-left', profile.armor === 'plate' ? 'metal' : 'matte', profile.armor === 'plate' ? VOXEL_COLORS.steelDark : context.team, -0.29, 1.01 + lift, 0.04, 0.13, 0.46, 0.14, { roll: -0.16 });
  add(context, 'cavalry-rider-arm-right', profile.armor === 'plate' ? 'metal' : 'matte', profile.armor === 'plate' ? VOXEL_COLORS.steelDark : context.team, 0.29, 1.01 + lift, -0.03, 0.13, 0.46, 0.14, { roll: 0.16 });
  add(context, 'cavalry-rider-head', 'matte', VOXEL_COLORS.skin, 0, 1.43 + lift, 0, 0.28, 0.28, 0.27);
  const helmetMetal = profile.headgear !== 'leather-cap' && profile.headgear !== 'headband';
  add(context, 'cavalry-rider-helmet', helmetMetal ? 'metal' : 'matte', helmetMetal ? VOXEL_COLORS.steel : VOXEL_COLORS.leather, 0, 1.67 + lift, 0, profile.headgear === 'crested-helmet' ? 0.36 : 0.32, 0.16, 0.3);
  if (profile.headgear === 'crested-helmet') {
    add(context, 'cavalry-rider-crest', 'matte', context.team, 0, 1.83 + lift, 0, 0.12, 0.26, 0.28);
  }
  if (profile.armor === 'mail') {
    add(context, 'cavalry-rider-mail', 'metal', VOXEL_COLORS.steelDark, 0, 0.92 + lift, 0.01, 0.4, 0.42, 0.32);
  }
  const signatureTint = profile.tier === 3 ? VOXEL_COLORS.gold : shade(context.team, 0.72);
  add(context, `detail-${unitType}-${profile.signature}`, 'matte', signatureTint, -0.18, 0.72 + lift, 0.27, 0.18 + profile.tier * 0.04, 0.32, 0.08, { yaw: -0.45 });
}

function mountedShield(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  if (profile.shield === 'none') return;
  const lift = profile.mount === 'elephant' ? 0.5 : 0;
  const height = profile.shield === 'kite' ? 0.62 : 0.48;
  const width = profile.shield === 'heater' ? 0.3 : 0.34;
  add(context, 'cavalry-shield', 'matte', shade(context.team, 0.76), -0.34, 0.98 + lift, 0.28, width, height, 0.1);
  add(context, 'cavalry-shield-boss', 'metal', VOXEL_COLORS.steel, -0.34, 1.12 + lift, 0.34, 0.1, 0.1, 0.07);
}

function mountedWeapon(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  // The weapon is held by the rider, so it rides the same lift.
  const lift = profile.mount === 'elephant' ? 0.5 : 0;
  if (profile.weapon === 'mounted-bow') {
    add(context, 'cavalry-archer-bow-upper', 'matte', VOXEL_COLORS.timber, 0.38, 1 + lift, 0.2, 0.06, 0.65, 0.06, { roll: -0.5 });
    add(context, 'cavalry-archer-bow-lower', 'matte', VOXEL_COLORS.timber, 0.38, 0.48 + lift, 0.2, 0.06, 0.65, 0.06, { roll: 0.5 });
    add(context, 'cavalry-archer-bow-grip', 'matte', VOXEL_COLORS.leather, 0.38, 0.75 + lift, 0.2, 0.1, 0.24, 0.09);
    add(context, 'cavalry-archer-quiver', 'matte', VOXEL_COLORS.leather, -0.27, 0.91 + lift, -0.24, 0.16, 0.62, 0.15, { roll: -0.22 });
    return;
  }
  if (profile.weapon === 'mounted-gun') {
    // The Conquistador fires from the saddle: barrel braced across the body,
    // powder charges on the belt (the signature box carries the flask).
    add(context, 'cavalry-gun-stock', 'matte', VOXEL_COLORS.timberDark, 0.26, 0.98 + lift, 0.12, 0.12, 0.44, 0.13, { roll: -0.7 });
    add(context, 'cavalry-gun-barrel', 'metal', VOXEL_COLORS.steelDark, 0.56, 1.14 + lift, 0.14, 0.86, 0.1, 0.1, { yaw: -0.08 });
    add(context, 'cavalry-gun-muzzle', 'metal', VOXEL_COLORS.steel, 0.98, 1.14 + lift, 0.14, 0.13, 0.14, 0.14);
    return;
  }
  if (profile.weapon === 'mounted-sword') {
    add(context, 'cavalry-sword', 'metal', VOXEL_COLORS.steel, 0.43, 0.86 + lift, -0.15, 0.09, 0.94, 0.08, { roll: -0.43 });
    add(context, 'cavalry-sword-hilt', 'metal', VOXEL_COLORS.gold, 0.27, 0.78 + lift, -0.12, 0.3, 0.09, 0.11, { roll: -0.43 });
    return;
  }
  if (profile.weapon === 'staff') {
    // The Missionary: a monk's staff held UPRIGHT with its gold crossbar —
    // the fallback below is a couched lance, which turned the first capture's
    // missionary into a charging knight in robes.
    add(context, 'cavalry-staff', 'matte', VOXEL_COLORS.timberDark, 0.36, 0.86 + lift, -0.1, 0.07, 1.15, 0.07);
    add(context, 'cavalry-staff-crossbar', 'metal', VOXEL_COLORS.gold, 0.36, 1.52 + lift, -0.1, 0.26, 0.09, 0.09);
    return;
  }
  if (profile.weapon === 'mounted-polearm') {
    add(context, 'cavalry-polearm-shaft', 'matte', VOXEL_COLORS.timber, 0.43, 0.6 + lift, -0.3, 0.08, 1.55, 0.08, { roll: -0.64 });
    add(context, 'cavalry-polearm-head', 'metal', VOXEL_COLORS.steel, 0.86, 1.78 + lift, -0.56, 0.17, 0.38, 0.1, { roll: -0.64 });
    return;
  }
  if (profile.mount === 'elephant') {
    // A mahout carries a short goad angled DOWN over the animal's shoulder. A
    // knight's couched lance is authored against a horse's narrow body: raised
    // to elephant height it hangs in the air beside the rider with its tip a
    // clear gap away, which is what the first capture of this unit showed.
    add(context, 'cavalry-lance', 'matte', VOXEL_COLORS.timber, 0.34, 1.24, 0.16, 0.06, 0.92, 0.06, { roll: -0.95 });
    add(context, 'cavalry-lance-tip', 'metal', VOXEL_COLORS.steel, 0.68, 0.94, 0.16, 0.11, 0.26, 0.08, { roll: -0.95 });
    return;
  }
  add(context, 'cavalry-lance', 'matte', VOXEL_COLORS.timber, 0.48, 0.74 + lift, -0.35, 0.07, 1.45, 0.07, { roll: -0.72 });
  add(context, 'cavalry-lance-tip', 'metal', VOXEL_COLORS.steel, 0.96, 1.58 + lift, -0.72, 0.14, 0.36, 0.09, { roll: -0.72 });
}

function mountArmor(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  // An elephant carries a howdah instead of barding; its own body is the
  // armour and horse-sized plates would float beside it.
  if (profile.mount === 'elephant') return;
  if (profile.tier < 2 && profile.mount !== 'camel') return;
  const tint = profile.armor === 'plate' ? VOXEL_COLORS.steelDark : shade(context.team, 0.68);
  add(context, `detail-${unitType}-barding-front`, profile.armor === 'plate' ? 'metal' : 'matte', tint, 0.27, 0.43, -0.18, 0.46, 0.38, 0.46, { yaw: -0.45 });
  if (profile.tier === 3) {
    add(context, `detail-${unitType}-barding-rear`, profile.armor === 'plate' ? 'metal' : 'matte', tint, -0.34, 0.42, 0.2, 0.42, 0.36, 0.4, { yaw: -0.45 });
  }
}

/**
 * The Elite tier's plume, matching the humanoid roster's. The Elite
 * Cataphract and Elite Conquistador were byte-identical to their base tier
 * until v0.3.46, so the upgrade bought nothing a player could see.
 */
function elitePlume(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  if (!profile.elite) return;
  const lift = profile.mount === 'elephant' ? 0.5 : 0;
  // Clear the helmet (top 1.83) or the crest that stands above it (top 2.09).
  const bottom = (profile.headgear === 'crested-helmet' ? 2.1 : 1.85) + lift;
  add(context, 'cavalry-elite-plume', 'metal', VOXEL_COLORS.gold, 0, bottom, -0.02, 0.09, 0.18, 0.09);
  add(context, 'cavalry-elite-collar', 'metal', VOXEL_COLORS.gold, 0, 1.3 + lift, 0, 0.34, 0.06, 0.3);
}

export function addMountedUnitParts(
  context: UnitRecipeContext,
  unitType: UnitType,
  profile: UnitVisualProfile,
): void {
  mountBody(context, unitType, profile);
  saddleAndRider(context, unitType, profile);
  mountArmor(context, unitType, profile);
  mountedShield(context, profile);
  mountedWeapon(context, profile);
  elitePlume(context, profile);
}
