import type { VoxelPart } from './aoeVoxelRecipeTypes';
import { transformUnitAttackPart, type Point3 } from './aoeVoxelUnitAttackGeometry';

export type UnitAttackStyle =
  | 'none'
  | 'tool-chop'
  | 'one-hand-slash'
  | 'two-hand-cleave'
  | 'polearm-thrust'
  | 'bow-draw'
  | 'crossbow-fire'
  | 'javelin-cast'
  | 'mounted-slash'
  | 'mounted-thrust'
  | 'mounted-polearm-thrust'
  | 'mounted-bow-draw'
  | 'stone-release'
  | 'bolt-recoil'
  | 'ram-thrust'
  | 'cannon-recoil'
  | 'trebuchet-release';

export type UnitAttackBodyGroup = 'villager' | 'infantry' | 'archer' | 'mounted-rider';

const BODY_GROUP_PATTERNS = {
  villager: /^villager-(?:tunic|belt|head|hair|apron)$/u,
  infantry: /^(?:infantry-(?:tunic|belt|head|helmet(?:-.+)?|leather-vest|mail-skirt|breastplate|pauldrons)|detail-)/u,
  archer: /^(?:archer-(?:tunic|belt|head|hood|headband|cap|mail-vest|quiver|arrow-fletching|pavise)|detail-)/u,
  'mounted-rider': /^cavalry-(?:rider-(?:tunic|head|helmet|crest|mail)|archer-quiver)$/u,
} as const satisfies Record<UnitAttackBodyGroup, RegExp>;

export function unitAttackBodyGroupControlsPart(
  group: UnitAttackBodyGroup,
  suffix: string,
): boolean {
  return BODY_GROUP_PATTERNS[group].test(suffix);
}

export interface ConcreteAttackPoseState {
  readonly directionX: number;
  readonly directionZ: number;
}

interface PoseContext {
  readonly state: ConcreteAttackPoseState;
  readonly scale: number;
  readonly arc: number;
  readonly pivot?: Point3;
}

function weaponTransform(
  part: VoxelPart,
  context: PoseContext,
  forward: number,
  vertical: number,
  pitch: number,
  roll = 0,
): VoxelPart {
  return transformUnitAttackPart(
    part,
    context.state,
    forward * context.scale,
    vertical * context.scale,
    pitch,
    roll,
    context.pivot,
  );
}

function humanoidWeaponPose(
  part: VoxelPart,
  suffix: string,
  style: UnitAttackStyle,
  context: PoseContext,
): VoxelPart {
  const lunge = Math.max(0, context.arc);
  const windup = Math.max(0, -context.arc);
  if (style === 'tool-chop' && suffix.includes('villager-tool')) {
    return weaponTransform(part, context, lunge * 0.2 - windup * 0.075, windup * 0.17 - lunge * 0.075, context.arc * 1.6, context.arc * -0.27);
  }
  if (style === 'one-hand-slash' && suffix.includes('infantry-sword')) {
    return weaponTransform(part, context, lunge * 0.2 - windup * 0.075, windup * 0.17 - lunge * 0.075, context.arc * 1.25, context.arc * 0.21);
  }
  if (style === 'two-hand-cleave' && /(infantry-greatsword|infantry-sword)/u.test(suffix)) {
    return weaponTransform(part, context, lunge * 0.24 - windup * 0.1, windup * 0.22 - lunge * 0.1, context.arc * 1.45, context.arc * 0.12);
  }
  if (style === 'polearm-thrust' && /(polearm|halberd)/u.test(suffix)) {
    return weaponTransform(part, context, lunge * 0.48 - windup * 0.2, windup * 0.07 - lunge * 0.03, -context.arc * 0.2);
  }
  if ((style === 'bow-draw') && /(archer-bow|archer-longbow)/u.test(suffix)) {
    return weaponTransform(part, context, lunge * 0.19 - windup * 0.06, windup * 0.04, -context.arc * 0.34);
  }
  if (style === 'crossbow-fire' && suffix.includes('archer-crossbow')) {
    return weaponTransform(part, context, lunge * 0.18 - windup * 0.08, windup * 0.035, -context.arc * 0.28);
  }
  if (style === 'javelin-cast' && suffix.includes('archer-javelin')) {
    return weaponTransform(part, context, lunge * 0.32 - windup * 0.14, windup * 0.16 - lunge * 0.04, context.arc * 1.05, -context.arc * 0.16);
  }
  return part;
}

function humanoidBodyPose(
  part: VoxelPart,
  suffix: string,
  style: UnitAttackStyle,
  context: PoseContext,
): VoxelPart {
  const lunge = Math.max(0, context.arc);
  const windup = Math.max(0, -context.arc);
  const archer = style === 'bow-draw' || style === 'crossbow-fire';
  if (archer && suffix.includes('arm-left')) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.13, 0, -context.arc * 0.7);
  }
  if (archer && suffix.includes('arm-right')) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.06 - windup * 0.18, windup * 0.06, context.arc * 0.85);
  }
  if (style === 'javelin-cast' && suffix.includes('arm-right')) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.18 - windup * 0.12, windup * 0.12, context.arc * 0.95);
  }
  const meleeArm = style === 'tool-chop'
    ? /(villager-arm-left|villager-arm-right|detail-villager-rolled-sleeve)/u.test(suffix)
    : style === 'one-hand-slash'
      ? suffix.includes('infantry-arm-right')
      : style === 'two-hand-cleave' || style === 'polearm-thrust'
        ? /(infantry-arm-left|infantry-arm-right)/u.test(suffix)
        : false;
  if (meleeArm) {
    const thrust = style === 'polearm-thrust';
    return weaponTransform(
      part,
      { ...context, pivot: undefined },
      lunge * (thrust ? 0.24 : 0.2) - windup * 0.075,
      windup * (thrust ? 0.08 : 0.17) - lunge * 0.05,
      context.arc * (thrust ? -0.18 : style === 'tool-chop' ? 1.35 : 1.05),
    );
  }
  const bodyGroup: UnitAttackBodyGroup = style === 'tool-chop'
    ? 'villager'
    : style === 'one-hand-slash' || style === 'two-hand-cleave' || style === 'polearm-thrust'
      ? 'infantry'
      : 'archer';
  if (unitAttackBodyGroupControlsPart(bodyGroup, suffix)) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.07, 0, -lunge * 0.16);
  }
  if (style === 'javelin-cast' && /(archer-arm-left|archer-round-shield)/u.test(suffix)) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.08, 0, -lunge * 0.18);
  }
  if (style === 'one-hand-slash' && /(infantry-shield|infantry-arm-left)/u.test(suffix)) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.08, 0, -lunge * 0.24);
  }
  if (style === 'polearm-thrust' && suffix.includes('infantry-shield')) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.24 - windup * 0.075, windup * 0.08 - lunge * 0.05, -context.arc * 0.18);
  }
  return part;
}

function mountedPose(
  part: VoxelPart,
  suffix: string,
  style: UnitAttackStyle,
  context: PoseContext,
): VoxelPart {
  const lunge = Math.max(0, context.arc);
  const windup = Math.max(0, -context.arc);
  if (style === 'mounted-bow-draw' && suffix.includes('cavalry-archer-bow')) {
    return weaponTransform(part, context, lunge * 0.24 - windup * 0.09, windup * 0.06, -context.arc * 0.42);
  }
  if (style === 'mounted-thrust' && suffix.includes('cavalry-lance')) {
    return weaponTransform(
      part,
      context,
      lunge * 0.45 - windup * 0.18,
      -lunge * 0.04,
      context.arc * 0.55,
    );
  }
  if (style === 'mounted-polearm-thrust' && suffix.includes('cavalry-polearm')) {
    return weaponTransform(part, context, lunge * 0.48 - windup * 0.19, -lunge * 0.03, -context.arc * 0.32);
  }
  if (style === 'mounted-slash' && suffix.includes('cavalry-sword')) {
    return weaponTransform(part, context, lunge * 0.22 - windup * 0.09, windup * 0.13 - lunge * 0.05, context.arc * 1.15, context.arc * 0.18);
  }
  if (unitAttackBodyGroupControlsPart('mounted-rider', suffix)) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.1, 0, -lunge * 0.18);
  }
  if (suffix.includes('cavalry-rider-arm-right') || (
    style === 'mounted-bow-draw' && suffix.includes('cavalry-rider-arm-left')
  )) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.12 - windup * 0.06, windup * 0.05, context.arc * 0.65);
  }
  if (suffix.includes('cavalry-shield')) {
    return weaponTransform(part, { ...context, pivot: undefined }, lunge * 0.06, 0, -lunge * 0.15);
  }
  return part;
}

function siegePose(
  part: VoxelPart,
  suffix: string,
  style: UnitAttackStyle,
  context: PoseContext,
): VoxelPart {
  const lunge = Math.max(0, context.arc);
  const windup = Math.max(0, -context.arc);
  if (style === 'ram-thrust' && /(siege-ram-beam|siege-ram-head)/u.test(suffix)) {
    return weaponTransform(part, context, lunge * 0.34 - windup * 0.16, 0, 0);
  }
  if (style === 'stone-release' && /(siege-throwing-arm|siege-bucket)/u.test(suffix)) {
    return weaponTransform(part, context, 0, windup * 0.06 - lunge * 0.03, context.arc * 1.1, context.arc * 0.08);
  }
  if (style === 'bolt-recoil' && /(siege-scorpion-rail|siege-scorpion-bolt)/u.test(suffix)) {
    return weaponTransform(part, context, lunge * 0.22 - windup * 0.1, 0, -context.arc * 0.08);
  }
  if (style === 'cannon-recoil' && /(siege-cannon-barrel|siege-cannon-muzzle|siege-cannon-breech)/u.test(suffix)) {
    return weaponTransform(part, context, lunge * 0.24 - windup * 0.12, windup * 0.02, -context.arc * 0.06);
  }
  if (style === 'trebuchet-release' && /(siege-trebuchet-arm|siege-trebuchet-sling|siege-trebuchet-counterweight|detail-trebuchet-stone-sling)/u.test(suffix)) {
    return weaponTransform(part, context, 0, windup * 0.05 - lunge * 0.03, context.arc * 1.18, context.arc * 0.05);
  }
  if (suffix.includes('siege-chassis') || suffix.includes('siege-deck')) {
    return weaponTransform(part, { ...context, pivot: undefined }, -lunge * 0.035, 0, lunge * 0.04);
  }
  return part;
}

export function poseConcreteUnitAttackPart(
  part: VoxelPart,
  suffix: string,
  style: UnitAttackStyle,
  state: ConcreteAttackPoseState,
  scale: number,
  arc: number,
  pivot?: Point3,
): VoxelPart {
  const context: PoseContext = { state, scale, arc, pivot };
  if (style === 'none') return part;
  if (style === 'tool-chop' || style === 'one-hand-slash' || style === 'two-hand-cleave'
    || style === 'polearm-thrust' || style === 'bow-draw' || style === 'crossbow-fire'
    || style === 'javelin-cast') {
    const weapon = humanoidWeaponPose(part, suffix, style, context);
    return weapon === part ? humanoidBodyPose(part, suffix, style, context) : weapon;
  }
  if (style.startsWith('mounted-')) return mountedPose(part, suffix, style, context);
  return siegePose(part, suffix, style, context);
}
