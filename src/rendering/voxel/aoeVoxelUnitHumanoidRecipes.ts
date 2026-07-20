import type { UnitType } from '../../game/simulation/types';
import { shade, VOXEL_COLORS } from './aoeVoxelRecipeTypes';
import { addUnitPart as add, type UnitRecipeContext } from './aoeVoxelUnitRecipeContext';
import type { UnitVisualProfile } from './aoeVoxelUnitVisualProfiles';

type HumanoidRole = 'villager' | 'infantry' | 'archer';

function humanoidBase(
  context: UnitRecipeContext,
  role: HumanoidRole,
  torsoTint: number,
): void {
  add(context, `${role}-boot-left`, 'matte', VOXEL_COLORS.leather, -0.17, 0, 0.04, 0.18, 0.13, 0.25);
  add(context, `${role}-boot-right`, 'matte', VOXEL_COLORS.leather, 0.17, 0, -0.04, 0.18, 0.13, 0.25);
  add(context, `${role}-leg-left`, 'matte', shade(torsoTint, 0.62), -0.15, 0.13, 0.02, 0.16, 0.42, 0.18);
  add(context, `${role}-leg-right`, 'matte', shade(torsoTint, 0.62), 0.15, 0.13, -0.02, 0.16, 0.42, 0.18);
  add(context, `${role}-tunic`, 'matte', torsoTint, 0, 0.5, 0, 0.52, 0.62, 0.36);
  add(context, `${role}-belt`, 'matte', VOXEL_COLORS.leather, 0, 0.68, 0.19, 0.55, 0.1, 0.08);
  add(context, `${role}-arm-left`, 'matte', VOXEL_COLORS.skin, -0.34, 0.62, 0.02, 0.14, 0.52, 0.15, { roll: -0.14 });
  add(context, `${role}-arm-right`, 'matte', VOXEL_COLORS.skin, 0.34, 0.62, -0.02, 0.14, 0.52, 0.15, { roll: 0.14 });
  add(context, `${role}-head`, 'matte', VOXEL_COLORS.skin, 0, 1.12, 0, 0.34, 0.34, 0.32);
}

function signature(
  context: UnitRecipeContext,
  unitType: UnitType,
  token: string,
  tint: number,
  offsetX: number,
  bottom: number,
  offsetZ: number,
  width: number,
  height: number,
  depth: number,
): void {
  add(context, `detail-${unitType}-${token}`, 'matte', tint, offsetX, bottom, offsetZ, width, height, depth);
}

function villager(context: UnitRecipeContext): void {
  humanoidBase(context, 'villager', context.team);
  add(context, 'villager-hair', 'matte', VOXEL_COLORS.timberDark, 0, 1.43, -0.01, 0.36, 0.12, 0.34);
  add(context, 'villager-apron', 'matte', VOXEL_COLORS.cloth, 0, 0.55, 0.21, 0.34, 0.45, 0.06);
  add(context, 'villager-tool-handle', 'matte', VOXEL_COLORS.timber, 0.48, 0.32, 0.02, 0.08, 1.08, 0.08, { roll: -0.42 });
  add(context, 'villager-tool-head', 'metal', VOXEL_COLORS.steelDark, 0.7, 1.18, 0.02, 0.32, 0.16, 0.09, { roll: -0.42 });
  signature(context, 'villager', 'rolled-sleeve', VOXEL_COLORS.cloth, -0.35, 0.79, 0.02, 0.18, 0.12, 0.18);
}

function infantryHeadgear(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  const metal = profile.headgear !== 'leather-cap';
  add(
    context,
    'infantry-helmet',
    metal ? 'metal' : 'matte',
    metal ? VOXEL_COLORS.steel : VOXEL_COLORS.leather,
    0, 1.38, 0, profile.headgear === 'kettle-helmet' ? 0.5 : 0.42, 0.2, 0.38,
  );
  if (profile.headgear === 'nasal-helmet') {
    add(context, 'infantry-helmet-nasal', 'metal', VOXEL_COLORS.steelDark, 0, 1.24, 0.19, 0.07, 0.25, 0.07);
  } else if (profile.headgear === 'sallet') {
    add(context, 'infantry-helmet-visor', 'metal', VOXEL_COLORS.steelDark, 0, 1.38, 0.2, 0.38, 0.1, 0.07);
  } else if (profile.headgear === 'crested-helmet') {
    add(context, 'infantry-helmet-crest', 'matte', context.team, 0, 1.58, 0, 0.12, 0.24, 0.34);
  }
}

function infantryArmor(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  if (profile.armor === 'leather') {
    add(context, 'infantry-leather-vest', 'matte', VOXEL_COLORS.leather, 0, 0.61, -0.015, 0.46, 0.42, 0.39);
  }
  if (profile.armor === 'mail' || profile.armor === 'plate') {
    add(context, 'infantry-mail-skirt', 'metal', VOXEL_COLORS.steelDark, 0, 0.42, 0, 0.55, 0.28, 0.38);
  }
  if (profile.armor === 'plate') {
    add(context, 'infantry-breastplate', 'metal', VOXEL_COLORS.steel, 0, 0.74, 0.02, 0.5, 0.4, 0.39);
    add(context, 'infantry-pauldrons', 'metal', profile.tier === 3 ? VOXEL_COLORS.gold : VOXEL_COLORS.steelDark, 0, 0.91, 0, 0.82, 0.15, 0.32);
  }
  const signatureTint = profile.tier === 3 ? VOXEL_COLORS.gold : shade(context.team, 0.74);
  signature(context, unitType, profile.signature, signatureTint, -0.23 + profile.tier * 0.15, 0.87, 0.2, 0.16 + profile.tier * 0.03, 0.22, 0.07);
}

function infantryShield(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  if (profile.shield === 'none') return;
  const height = profile.shield === 'kite' ? 0.72 : 0.58;
  const width = profile.shield === 'heater' ? 0.34 : 0.42;
  add(context, 'infantry-shield', 'matte', shade(context.team, 0.78), -0.44, 0.58, 0.22, width, height, 0.12, { yaw: -0.24 });
  add(context, 'infantry-shield-boss', 'metal', VOXEL_COLORS.steel, -0.44, 0.78, 0.3, 0.12, 0.12, 0.08);
}

function infantryWeapon(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  if (profile.weapon === 'sword') {
    add(context, 'infantry-sword', 'metal', VOXEL_COLORS.steel, 0.5, 0.56, -0.08, 0.09, 0.9 + profile.tier * 0.06, 0.08, { roll: -0.4 });
    add(context, 'infantry-sword-hilt', 'matte', VOXEL_COLORS.gold, 0.33, 0.48, -0.08, 0.28, 0.08, 0.11, { roll: -0.4 });
    return;
  }
  if (profile.weapon === 'greatsword') {
    add(context, 'infantry-greatsword', 'metal', VOXEL_COLORS.steel, 0.35, 0.48, -0.06, 0.11, 1.22, 0.09, { roll: -0.34 });
    add(context, 'infantry-greatsword-hilt', 'metal', VOXEL_COLORS.gold, 0.16, 0.42, -0.06, 0.4, 0.1, 0.12, { roll: -0.34 });
    return;
  }
  add(context, 'infantry-polearm-shaft', 'matte', VOXEL_COLORS.timber, 0.46, 0.18, -0.05, 0.08, profile.weapon === 'halberd' ? 1.72 : 1.55, 0.08, { roll: -0.23 });
  add(context, 'infantry-polearm-grip', 'matte', VOXEL_COLORS.leather, 0.33, 0.6, -0.05, 0.12, 0.34, 0.11, { roll: -0.23 });
  if (profile.weapon === 'halberd') {
    add(context, 'infantry-halberd-blade', 'metal', VOXEL_COLORS.steel, 0.68, 1.72, -0.05, 0.3, 0.34, 0.1, { roll: -0.23 });
    add(context, 'infantry-halberd-hook', 'metal', VOXEL_COLORS.steelDark, 0.51, 1.61, -0.05, 0.24, 0.1, 0.1, { roll: 0.42 });
  } else {
    add(context, 'infantry-polearm-head', 'metal', VOXEL_COLORS.steel, 0.66, 1.56, -0.05, 0.16, 0.38, 0.1, { roll: -0.23 });
  }
}

function infantry(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  humanoidBase(context, 'infantry', context.team);
  infantryHeadgear(context, profile);
  infantryArmor(context, unitType, profile);
  infantryShield(context, profile);
  infantryWeapon(context, profile);
}

function archerHeadgear(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  if (profile.headgear === 'hood') {
    add(context, 'archer-hood', 'matte', shade(context.team, 0.72), 0, 1.37, -0.01, 0.4, 0.22, 0.37);
  } else if (profile.headgear === 'headband') {
    add(context, 'archer-headband', 'matte', context.team, 0, 1.38, 0.03, 0.38, 0.09, 0.35);
  } else {
    add(context, 'archer-cap', profile.headgear === 'kettle-helmet' ? 'metal' : 'matte', profile.headgear === 'kettle-helmet' ? VOXEL_COLORS.steel : VOXEL_COLORS.leather, 0, 1.38, 0, profile.headgear === 'kettle-helmet' ? 0.46 : 0.38, 0.18, 0.36);
  }
}

function archerWeapon(context: UnitRecipeContext, profile: UnitVisualProfile): void {
  if (profile.weapon === 'bow' || profile.weapon === 'longbow') {
    const prefix = profile.weapon === 'longbow' ? 'archer-longbow' : 'archer-bow';
    const length = profile.weapon === 'longbow' ? 0.91 : 0.72;
    const upperBottom = profile.weapon === 'longbow' ? 0.9 : 0.94;
    const lowerBottom = profile.weapon === 'longbow' ? 0.2 : 0.34;
    add(context, `${prefix}-upper`, 'matte', VOXEL_COLORS.timber, 0.48, upperBottom, 0.18, 0.07, length, 0.07, { roll: -0.48 });
    add(context, `${prefix}-lower`, 'matte', VOXEL_COLORS.timber, 0.48, lowerBottom, 0.18, 0.07, length, 0.07, { roll: 0.48 });
    add(context, `${prefix}-grip`, 'matte', VOXEL_COLORS.leather, 0.48, 0.65, 0.18, 0.1, 0.25, 0.09);
    return;
  }
  if (profile.weapon === 'crossbow') {
    add(context, 'archer-crossbow-stock', 'matte', VOXEL_COLORS.timberDark, 0.43, 0.58, 0.08, 0.12, 0.83, 0.12, { roll: -0.43 });
    add(context, 'archer-crossbow-bow', 'metal', VOXEL_COLORS.steelDark, 0.55, 1.04, 0.09, 0.68, 0.08, 0.1, { yaw: -0.08 });
    add(context, 'archer-crossbow-bolt', 'metal', VOXEL_COLORS.steel, 0.55, 1.05, 0.13, 0.08, 0.78, 0.06, { roll: -0.43 });
    return;
  }
  add(context, 'archer-javelin-shaft', 'matte', VOXEL_COLORS.timber, 0.48, 0.36, -0.02, 0.07, 1.32, 0.07, { roll: -0.32 });
  add(context, 'archer-javelin-head', 'metal', VOXEL_COLORS.steel, 0.67, 1.53, -0.02, 0.12, 0.32, 0.09, { roll: -0.32 });
}

function archer(context: UnitRecipeContext, unitType: UnitType, profile: UnitVisualProfile): void {
  humanoidBase(context, 'archer', context.team);
  archerHeadgear(context, profile);
  if (profile.weapon === 'bow' || profile.weapon === 'longbow') {
    add(context, 'archer-quiver', 'matte', VOXEL_COLORS.leather, -0.28, 0.66, -0.23, 0.18, 0.68, 0.16, { roll: -0.25 });
    add(context, 'archer-arrow-fletching', 'matte', 0xd7d0b8, -0.37, 1.24, -0.23, 0.16, 0.18, 0.12, { roll: -0.25 });
  }
  if (profile.armor === 'mail') {
    add(context, 'archer-mail-vest', 'metal', VOXEL_COLORS.steelDark, 0, 0.62, 0, 0.48, 0.42, 0.38);
  }
  if (profile.shield === 'pavise') {
    add(context, 'archer-pavise', 'matte', shade(context.team, 0.72), -0.33, 0.46, -0.22, 0.42, 0.84, 0.12, { yaw: 0.18 });
  } else if (profile.shield === 'round') {
    add(context, 'archer-round-shield', 'matte', shade(context.team, 0.76), -0.38, 0.61, 0.18, 0.42, 0.46, 0.1);
  }
  archerWeapon(context, profile);
  signature(context, unitType, profile.signature, profile.tier === 3 ? VOXEL_COLORS.gold : shade(context.team, 0.76), -0.25, 0.86, 0.22, 0.14 + profile.tier * 0.03, 0.25, 0.07);
}

export function addHumanoidUnitParts(
  context: UnitRecipeContext,
  unitType: UnitType,
  profile: UnitVisualProfile,
): void {
  if (profile.role === 'villager') villager(context);
  else if (profile.role === 'infantry') infantry(context, unitType, profile);
  else archer(context, unitType, profile);
}
