import type { UnitType } from '../../game/simulation/types';
import type { UnitRole } from '../roles/unitRole';
import type { VoxelPart } from './aoeVoxelRecipeTypes';
import {
  unitAttackBodyGroupControlsPart,
  type UnitAttackBodyGroup,
  type UnitAttackStyle,
} from './aoeVoxelUnitAttackPoseStyles';
import {
  centerOfUnitPart,
  findUnitPart,
  lowerEndOfUnitPart,
  midpointOfUnitParts,
  type Point3,
} from './aoeVoxelUnitAttackGeometry';

type AttackPivotSpec =
  | {
    readonly kind: 'center' | 'lower-end';
    readonly suffix: string;
  }
  | {
    readonly kind: 'midpoint';
    readonly firstSuffix: string;
    readonly secondSuffix: string;
  };

export interface UnitAttackRig {
  readonly style: UnitAttackStyle;
  readonly controlledPartPattern?: RegExp;
  readonly bodyGroup?: UnitAttackBodyGroup;
  readonly pivot?: AttackPivotSpec;
  readonly meleeReach?: {
    readonly tipSuffix: string;
    readonly maxLeanScale: number;
  };
}

const VILLAGER_RIG: UnitAttackRig = {
  style: 'tool-chop',
  controlledPartPattern: /(?:villager-(tool|arm-left|arm-right|tunic)|detail-villager-rolled-sleeve)/u,
  bodyGroup: 'villager',
  pivot: { kind: 'lower-end', suffix: 'villager-tool-handle' },
  meleeReach: { tipSuffix: 'villager-tool-head', maxLeanScale: 0.25 },
};
const SWORD_RIG: UnitAttackRig = {
  style: 'one-hand-slash',
  controlledPartPattern: /infantry-(sword|arm-right|shield|arm-left|tunic)/u,
  bodyGroup: 'infantry',
  pivot: { kind: 'center', suffix: 'infantry-sword-hilt' },
  meleeReach: { tipSuffix: 'infantry-sword', maxLeanScale: 0.25 },
};
const GREATSWORD_RIG: UnitAttackRig = {
  style: 'two-hand-cleave',
  controlledPartPattern: /infantry-(greatsword|sword|arm-left|arm-right|tunic)/u,
  bodyGroup: 'infantry',
  pivot: { kind: 'center', suffix: 'infantry-greatsword-hilt' },
  meleeReach: { tipSuffix: 'infantry-greatsword', maxLeanScale: 0.28 },
};
const POLEARM_RIG: UnitAttackRig = {
  style: 'polearm-thrust',
  controlledPartPattern: /infantry-(polearm|halberd|arm-left|arm-right|shield|tunic)/u,
  bodyGroup: 'infantry',
  pivot: { kind: 'lower-end', suffix: 'infantry-polearm-shaft' },
  meleeReach: { tipSuffix: 'infantry-polearm-head', maxLeanScale: 0.32 },
};
const HALBERD_RIG: UnitAttackRig = {
  ...POLEARM_RIG,
  meleeReach: { tipSuffix: 'infantry-halberd-blade', maxLeanScale: 0.32 },
};
const BOW_RIG: UnitAttackRig = {
  style: 'bow-draw',
  controlledPartPattern: /archer-(bow|arm-left|arm-right|tunic)/u,
  bodyGroup: 'archer',
  pivot: { kind: 'midpoint', firstSuffix: 'archer-bow-upper', secondSuffix: 'archer-bow-lower' },
};
const LONGBOW_RIG: UnitAttackRig = {
  style: 'bow-draw',
  controlledPartPattern: /archer-(longbow|arm-left|arm-right|tunic)/u,
  bodyGroup: 'archer',
  pivot: { kind: 'midpoint', firstSuffix: 'archer-longbow-upper', secondSuffix: 'archer-longbow-lower' },
};
const CROSSBOW_RIG: UnitAttackRig = {
  style: 'crossbow-fire',
  controlledPartPattern: /archer-(crossbow|arm-left|arm-right|tunic)/u,
  bodyGroup: 'archer',
  pivot: { kind: 'center', suffix: 'archer-crossbow-stock' },
};
const JAVELIN_RIG: UnitAttackRig = {
  style: 'javelin-cast',
  controlledPartPattern: /archer-(javelin|arm-left|arm-right|tunic|round-shield)/u,
  bodyGroup: 'archer',
  pivot: { kind: 'lower-end', suffix: 'archer-javelin-shaft' },
};
const MOUNTED_SWORD_RIG: UnitAttackRig = {
  style: 'mounted-slash',
  controlledPartPattern: /cavalry-(sword|rider-(arm-right|tunic)|shield)/u,
  bodyGroup: 'mounted-rider',
  pivot: { kind: 'center', suffix: 'cavalry-sword-hilt' },
  meleeReach: { tipSuffix: 'cavalry-sword', maxLeanScale: 0.28 },
};
const LANCE_RIG: UnitAttackRig = {
  style: 'mounted-thrust',
  controlledPartPattern: /cavalry-(lance|rider-(arm-right|tunic)|shield)/u,
  bodyGroup: 'mounted-rider',
  pivot: { kind: 'lower-end', suffix: 'cavalry-lance' },
  meleeReach: { tipSuffix: 'cavalry-lance-tip', maxLeanScale: 0.35 },
};
const MOUNTED_POLEARM_RIG: UnitAttackRig = {
  style: 'mounted-polearm-thrust',
  controlledPartPattern: /cavalry-(polearm|rider-(arm-right|tunic))/u,
  bodyGroup: 'mounted-rider',
  pivot: { kind: 'lower-end', suffix: 'cavalry-polearm-shaft' },
  meleeReach: { tipSuffix: 'cavalry-polearm-head', maxLeanScale: 0.35 },
};
const MOUNTED_BOW_RIG: UnitAttackRig = {
  style: 'mounted-bow-draw',
  controlledPartPattern: /cavalry-(archer-bow|rider-(arm-left|arm-right|tunic))/u,
  bodyGroup: 'mounted-rider',
  pivot: {
    kind: 'midpoint',
    firstSuffix: 'cavalry-archer-bow-upper',
    secondSuffix: 'cavalry-archer-bow-lower',
  },
};
const STONE_RIG: UnitAttackRig = {
  style: 'stone-release',
  controlledPartPattern: /siege-(throwing-arm|bucket|chassis|deck)/u,
  pivot: { kind: 'lower-end', suffix: 'siege-throwing-arm' },
};
const SCORPION_RIG: UnitAttackRig = {
  style: 'bolt-recoil',
  controlledPartPattern: /siege-(scorpion-(rail|bolt)|chassis|deck)/u,
  pivot: { kind: 'center', suffix: 'siege-scorpion-rail' },
};
const RAM_RIG: UnitAttackRig = {
  style: 'ram-thrust',
  controlledPartPattern: /siege-(ram-beam|ram-head|chassis|deck)/u,
};
const CANNON_RIG: UnitAttackRig = {
  style: 'cannon-recoil',
  controlledPartPattern: /siege-(cannon-(barrel|muzzle|breech)|chassis|deck)/u,
  pivot: { kind: 'center', suffix: 'siege-cannon-breech' },
};
const TREBUCHET_RIG: UnitAttackRig = {
  style: 'trebuchet-release',
  controlledPartPattern: /(?:siege-(trebuchet-(arm|sling|counterweight)|chassis|deck)|detail-trebuchet-stone-sling)/u,
  pivot: { kind: 'center', suffix: 'siege-trebuchet-axle' },
};
const MONK_RIG: UnitAttackRig = { style: 'none' };

const ROLE_ATTACK_RIGS = {
  villager: VILLAGER_RIG,
  infantry: SWORD_RIG,
  archer: BOW_RIG,
  cavalry: LANCE_RIG,
  'cavalry-archer': MOUNTED_BOW_RIG,
  siege: STONE_RIG,
  monk: MONK_RIG,
  // A Fishing Ship has no attack; armed ships get their own rig with the
  // warship slice.
  ship: MONK_RIG,
} as const satisfies Record<UnitRole, UnitAttackRig>;

const UNIT_ATTACK_RIGS = {
  villager: VILLAGER_RIG,
  militia: SWORD_RIG,
  'man-at-arms': SWORD_RIG,
  'long-swordsman': SWORD_RIG,
  'two-handed-swordsman': GREATSWORD_RIG,
  champion: GREATSWORD_RIG,
  spearman: POLEARM_RIG,
  pikeman: POLEARM_RIG,
  halberdier: HALBERD_RIG,
  archer: BOW_RIG,
  crossbowman: CROSSBOW_RIG,
  arbalest: CROSSBOW_RIG,
  skirmisher: JAVELIN_RIG,
  longbowman: LONGBOW_RIG,
  'elite-longbowman': LONGBOW_RIG,
  scout: MOUNTED_SWORD_RIG,
  'light-cavalry': MOUNTED_SWORD_RIG,
  hussar: MOUNTED_SWORD_RIG,
  camel: MOUNTED_SWORD_RIG,
  'heavy-camel': MOUNTED_POLEARM_RIG,
  knight: LANCE_RIG,
  cavalier: LANCE_RIG,
  paladin: LANCE_RIG,
  'cavalry-archer': MOUNTED_BOW_RIG,
  'heavy-cavalry-archer': MOUNTED_BOW_RIG,
  mangonel: STONE_RIG,
  onager: STONE_RIG,
  scorpion: SCORPION_RIG,
  'heavy-scorpion': SCORPION_RIG,
  'battering-ram': RAM_RIG,
  'siege-ram': RAM_RIG,
  'bombard-cannon': CANNON_RIG,
  trebuchet: TREBUCHET_RIG,
  monk: MONK_RIG,
  'fishing-ship': MONK_RIG,
} as const satisfies Record<UnitType, UnitAttackRig>;

export function unitAttackRig(unitType: UnitType): UnitAttackRig {
  return UNIT_ATTACK_RIGS[unitType];
}

export function unitAttackRigForRole(role: UnitRole): UnitAttackRig {
  return ROLE_ATTACK_RIGS[role];
}

export function unitAttackRigControlsPart(rig: UnitAttackRig, suffix: string): boolean {
  return (rig.controlledPartPattern?.test(suffix) ?? false)
    || (rig.bodyGroup !== undefined && unitAttackBodyGroupControlsPart(rig.bodyGroup, suffix));
}

export function resolveUnitAttackPivot(
  parts: readonly VoxelPart[],
  rig: UnitAttackRig,
): Point3 | undefined {
  const pivot = rig.pivot;
  if (!pivot) return undefined;
  if (pivot.kind === 'midpoint') {
    const first = findUnitPart(parts, pivot.firstSuffix);
    const second = findUnitPart(parts, pivot.secondSuffix);
    return first && second ? midpointOfUnitParts(first, second) : undefined;
  }
  const part = findUnitPart(parts, pivot.suffix);
  if (!part) return undefined;
  return pivot.kind === 'center' ? centerOfUnitPart(part) : lowerEndOfUnitPart(part);
}
