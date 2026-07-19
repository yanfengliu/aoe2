import type { UnitType } from '../../game/simulation/types';
import type { UnitRole } from '../roles/unitRole';
import type { VoxelPart } from './aoeVoxelRecipeTypes';
import {
  centerOfUnitPart,
  findUnitPart,
  lowerEndOfUnitPart,
  midpointOfUnitParts,
  type Point3,
} from './aoeVoxelUnitAttackGeometry';

type AttackPivotName = 'tool' | 'sword' | 'bow' | 'throwingArm';

type AttackPivotSpec =
  | {
    readonly name: AttackPivotName;
    readonly kind: 'center' | 'lower-end';
    readonly suffix: string;
  }
  | {
    readonly name: AttackPivotName;
    readonly kind: 'midpoint';
    readonly firstSuffix: string;
    readonly secondSuffix: string;
  };

export interface UnitAttackRig {
  readonly controlledPartPattern?: RegExp;
  readonly pivot?: AttackPivotSpec;
  readonly meleeReach?: {
    readonly tipSuffix: string;
    readonly maxLeanScale: number;
  };
}

export interface UnitAttackPivots {
  readonly tool?: Point3;
  readonly sword?: Point3;
  readonly bow?: Point3;
  readonly throwingArm?: Point3;
}

const VILLAGER_RIG: UnitAttackRig = {
  controlledPartPattern: /(tool|arm-left|arm-right|tunic)/u,
  pivot: { name: 'tool', kind: 'lower-end', suffix: 'villager-tool-handle' },
  meleeReach: { tipSuffix: 'villager-tool-head', maxLeanScale: 0.25 },
};

const INFANTRY_RIG: UnitAttackRig = {
  controlledPartPattern: /(sword|arm-right|shield|arm-left|tunic)/u,
  pivot: { name: 'sword', kind: 'center', suffix: 'infantry-sword-hilt' },
  meleeReach: { tipSuffix: 'infantry-sword', maxLeanScale: 0.25 },
};

const ARCHER_RIG: UnitAttackRig = {
  controlledPartPattern: /(bow|arm-left|arm-right|tunic)/u,
  pivot: { name: 'bow', kind: 'center', suffix: 'archer-bow-grip' },
};

const CAVALRY_RIG: UnitAttackRig = {
  controlledPartPattern: /(lance|rider-tunic|shield)/u,
  meleeReach: { tipSuffix: 'cavalry-lance', maxLeanScale: 0.35 },
};

const CAVALRY_ARCHER_RIG: UnitAttackRig = {
  controlledPartPattern: /(archer-bow|rider-tunic)/u,
  pivot: {
    name: 'bow',
    kind: 'midpoint',
    firstSuffix: 'cavalry-archer-bow-upper',
    secondSuffix: 'cavalry-archer-bow-lower',
  },
};

const SIEGE_RIG: UnitAttackRig = {
  controlledPartPattern: /(ram-beam|ram-head|throwing-arm|bucket|chassis|deck)/u,
  pivot: { name: 'throwingArm', kind: 'lower-end', suffix: 'siege-throwing-arm' },
};

const MONK_RIG: UnitAttackRig = {};

const ROLE_ATTACK_RIGS = {
  villager: VILLAGER_RIG,
  infantry: INFANTRY_RIG,
  archer: ARCHER_RIG,
  cavalry: CAVALRY_RIG,
  'cavalry-archer': CAVALRY_ARCHER_RIG,
  siege: SIEGE_RIG,
  monk: MONK_RIG,
} as const satisfies Record<UnitRole, UnitAttackRig>;

const UNIT_ATTACK_RIGS = {
  villager: VILLAGER_RIG,
  militia: INFANTRY_RIG,
  'man-at-arms': INFANTRY_RIG,
  'long-swordsman': INFANTRY_RIG,
  'two-handed-swordsman': INFANTRY_RIG,
  champion: INFANTRY_RIG,
  spearman: INFANTRY_RIG,
  pikeman: INFANTRY_RIG,
  halberdier: INFANTRY_RIG,
  archer: ARCHER_RIG,
  crossbowman: ARCHER_RIG,
  arbalest: ARCHER_RIG,
  skirmisher: ARCHER_RIG,
  longbowman: ARCHER_RIG,
  'elite-longbowman': ARCHER_RIG,
  scout: CAVALRY_RIG,
  'light-cavalry': CAVALRY_RIG,
  hussar: CAVALRY_RIG,
  camel: CAVALRY_RIG,
  'heavy-camel': CAVALRY_RIG,
  knight: CAVALRY_RIG,
  cavalier: CAVALRY_RIG,
  paladin: CAVALRY_RIG,
  'cavalry-archer': CAVALRY_ARCHER_RIG,
  'heavy-cavalry-archer': CAVALRY_ARCHER_RIG,
  mangonel: SIEGE_RIG,
  onager: SIEGE_RIG,
  scorpion: SIEGE_RIG,
  'heavy-scorpion': SIEGE_RIG,
  'battering-ram': SIEGE_RIG,
  'siege-ram': SIEGE_RIG,
  'bombard-cannon': SIEGE_RIG,
  trebuchet: SIEGE_RIG,
  monk: MONK_RIG,
} as const satisfies Record<UnitType, UnitAttackRig>;

export function unitAttackRig(unitType: UnitType): UnitAttackRig {
  return UNIT_ATTACK_RIGS[unitType];
}

export function unitAttackRigForRole(role: UnitRole): UnitAttackRig {
  return ROLE_ATTACK_RIGS[role];
}

export function unitAttackRigControlsPart(rig: UnitAttackRig, suffix: string): boolean {
  return rig.controlledPartPattern?.test(suffix) ?? false;
}

function namedPivot(name: AttackPivotName, point: Point3): UnitAttackPivots {
  switch (name) {
    case 'tool': return { tool: point };
    case 'sword': return { sword: point };
    case 'bow': return { bow: point };
    case 'throwingArm': return { throwingArm: point };
  }
}

export function resolveUnitAttackPivots(
  parts: readonly VoxelPart[],
  rig: UnitAttackRig,
): UnitAttackPivots {
  const pivot = rig.pivot;
  if (!pivot) return {};
  if (pivot.kind === 'midpoint') {
    const first = findUnitPart(parts, pivot.firstSuffix);
    const second = findUnitPart(parts, pivot.secondSuffix);
    return first && second
      ? namedPivot(pivot.name, midpointOfUnitParts(first, second))
      : {};
  }
  const part = findUnitPart(parts, pivot.suffix);
  if (!part) return {};
  return namedPivot(
    pivot.name,
    pivot.kind === 'center' ? centerOfUnitPart(part) : lowerEndOfUnitPart(part),
  );
}
