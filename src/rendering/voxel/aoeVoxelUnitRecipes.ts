import type { ProjectedEntityView, UnitType } from '../../game/simulation/types';
import { unitRole } from '../roles/unitRole';
import {
  contactShadow,
  makePart,
  shade,
  VOXEL_COLORS,
  type VoxelPart,
  type VoxelSurface,
} from './aoeVoxelRecipeTypes';
import {
  animateUnitParts,
  phaseForUnitIdentity,
  type AoeUnitAnimationState,
} from './aoeVoxelUnitAnimation';

interface UnitContext {
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly ground: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly scale: number;
  readonly team: number;
  readonly parts: VoxelPart[];
}

function add(
  context: UnitContext,
  suffix: string,
  surface: VoxelSurface,
  tint: number,
  offsetX: number,
  bottom: number,
  offsetZ: number,
  width: number,
  height: number,
  depth: number,
  rotation: { readonly yaw?: number; readonly pitch?: number; readonly roll?: number } = {},
): void {
  const scale = context.scale;
  context.parts.push(makePart(
    context.entity,
    context.identity,
    suffix,
    surface,
    tint,
    context.centerX + offsetX * scale,
    context.ground + (bottom + height / 2) * scale,
    context.centerZ + offsetZ * scale,
    width * scale,
    height * scale,
    depth * scale,
    rotation,
  ));
}

function humanoid(
  context: UnitContext,
  role: 'villager' | 'infantry' | 'archer',
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

function villager(context: UnitContext): void {
  humanoid(context, 'villager', context.team);
  add(context, 'villager-hair', 'matte', VOXEL_COLORS.timberDark, 0, 1.43, -0.01, 0.36, 0.12, 0.34);
  add(context, 'villager-apron', 'matte', VOXEL_COLORS.cloth, 0, 0.55, 0.21, 0.34, 0.45, 0.06);
  add(context, 'villager-tool-handle', 'matte', VOXEL_COLORS.timber, 0.48, 0.32, 0.02, 0.08, 1.08, 0.08, { roll: -0.42 });
  add(context, 'villager-tool-head', 'metal', VOXEL_COLORS.steelDark, 0.7, 1.18, 0.02, 0.32, 0.16, 0.09, { roll: -0.42 });
}

function infantry(context: UnitContext): void {
  humanoid(context, 'infantry', context.team);
  add(context, 'infantry-helmet', 'metal', VOXEL_COLORS.steel, 0, 1.4, 0, 0.42, 0.2, 0.38);
  add(context, 'infantry-helmet-crest', 'matte', context.team, 0, 1.6, 0, 0.12, 0.2, 0.34);
  add(context, 'infantry-shield', 'matte', shade(context.team, 0.78), -0.44, 0.62, 0.22, 0.38, 0.58, 0.12, { yaw: -0.24 });
  add(context, 'infantry-shield-boss', 'metal', VOXEL_COLORS.steel, -0.44, 0.83, 0.3, 0.12, 0.12, 0.08);
  add(context, 'infantry-sword', 'metal', VOXEL_COLORS.steel, 0.5, 0.56, -0.08, 0.09, 0.9, 0.08, { roll: -0.4 });
  add(context, 'infantry-sword-hilt', 'matte', VOXEL_COLORS.gold, 0.33, 0.48, -0.08, 0.28, 0.08, 0.11, { roll: -0.4 });
}

function archer(context: UnitContext): void {
  humanoid(context, 'archer', context.team);
  add(context, 'archer-hood', 'matte', shade(context.team, 0.72), 0, 1.39, -0.01, 0.4, 0.2, 0.37);
  add(context, 'archer-quiver', 'matte', VOXEL_COLORS.leather, -0.28, 0.66, -0.23, 0.18, 0.68, 0.16, { roll: -0.25 });
  add(context, 'archer-arrow-fletching', 'matte', 0xd7d0b8, -0.37, 1.24, -0.23, 0.16, 0.18, 0.12, { roll: -0.25 });
  add(context, 'archer-bow-upper', 'matte', VOXEL_COLORS.timber, 0.48, 0.94, 0.18, 0.07, 0.72, 0.07, { roll: -0.48 });
  add(context, 'archer-bow-lower', 'matte', VOXEL_COLORS.timber, 0.48, 0.34, 0.18, 0.07, 0.72, 0.07, { roll: 0.48 });
  add(context, 'archer-bow-grip', 'matte', VOXEL_COLORS.leather, 0.48, 0.66, 0.18, 0.1, 0.24, 0.09);
}

function cavalry(context: UnitContext, mountedArcher: boolean): void {
  const horse = context.entity.entityType === 'camel' || context.entity.entityType === 'heavy-camel'
    ? 0xb68b5e
    : 0x76513a;
  add(context, 'cavalry-horse-body', 'matte', horse, 0, 0.34, 0, 0.94, 0.56, 0.45, { yaw: -0.45 });
  for (const [name, x, z] of [
    ['front-left', 0.32, -0.2], ['front-right', 0.18, -0.35],
    ['back-left', -0.28, 0.2], ['back-right', -0.4, 0.08],
  ] as const) {
    add(context, `cavalry-horse-leg-${name}`, 'matte', shade(horse, 0.72), x, 0, z, 0.14, 0.48, 0.14);
  }
  add(context, 'cavalry-horse-neck', 'matte', horse, 0.38, 0.65, -0.28, 0.27, 0.56, 0.3, { roll: -0.25 });
  add(context, 'cavalry-horse-head', 'matte', shade(horse, 0.9), 0.5, 1.02, -0.36, 0.38, 0.32, 0.34, { yaw: -0.42 });
  add(context, 'cavalry-horse-mane', 'matte', VOXEL_COLORS.timberDark, 0.28, 0.83, -0.25, 0.1, 0.54, 0.16, { roll: -0.25 });
  add(context, 'cavalry-horse-tail', 'matte', VOXEL_COLORS.timberDark, -0.55, 0.4, 0.34, 0.12, 0.62, 0.12, { roll: 0.48 });
  add(context, 'cavalry-saddle-cloth', 'matte', context.team, -0.04, 0.77, 0.03, 0.6, 0.18, 0.48, { yaw: -0.45 });
  add(context, 'cavalry-rider-tunic', 'matte', context.team, 0, 0.91, 0, 0.38, 0.52, 0.3);
  add(context, 'cavalry-rider-head', 'matte', VOXEL_COLORS.skin, 0, 1.43, 0, 0.28, 0.28, 0.27);
  add(context, 'cavalry-rider-helmet', 'metal', VOXEL_COLORS.steel, 0, 1.69, 0, 0.32, 0.16, 0.3);
  if (mountedArcher) {
    add(context, 'cavalry-archer-bow-upper', 'matte', VOXEL_COLORS.timber, 0.38, 1.0, 0.2, 0.06, 0.65, 0.06, { roll: -0.5 });
    add(context, 'cavalry-archer-bow-lower', 'matte', VOXEL_COLORS.timber, 0.38, 0.48, 0.2, 0.06, 0.65, 0.06, { roll: 0.5 });
  } else {
    add(context, 'cavalry-lance', 'metal', VOXEL_COLORS.steel, 0.48, 0.74, -0.35, 0.07, 1.45, 0.07, { roll: -0.72 });
    add(context, 'cavalry-shield', 'matte', shade(context.team, 0.76), -0.32, 1.0, 0.28, 0.34, 0.48, 0.1);
  }
}

function siege(context: UnitContext): void {
  const ram = context.entity.entityType === 'battering-ram' || context.entity.entityType === 'siege-ram';
  add(context, 'siege-chassis', 'matte', VOXEL_COLORS.timber, 0, 0.24, 0, ram ? 1.25 : 0.92, 0.42, ram ? 0.56 : 0.78, { yaw: -0.42 });
  add(context, 'siege-deck', 'matte', VOXEL_COLORS.timberDark, 0, 0.66, 0, ram ? 1.08 : 0.75, 0.16, ram ? 0.48 : 0.68, { yaw: -0.42 });
  for (const [name, x, z] of [
    ['left', -0.38, 0.34], ['right', 0.38, -0.34],
    ['rear-left', -0.48, 0.1], ['rear-right', 0.48, -0.1],
  ] as const) {
    add(context, `siege-wheel-${name}`, 'matte', VOXEL_COLORS.timberDark, x, 0.08, z, 0.3, 0.3, 0.16, { roll: Math.PI / 4, yaw: -0.42 });
  }
  add(context, 'siege-team-panel', 'matte', context.team, 0, 0.42, 0.43, 0.5, 0.28, 0.08, { yaw: -0.42 });
  if (ram) {
    add(context, 'siege-ram-beam', 'matte', VOXEL_COLORS.timberDark, 0.24, 0.63, -0.16, 1.55, 0.18, 0.18, { yaw: -0.42 });
    add(context, 'siege-ram-head', 'metal', VOXEL_COLORS.steelDark, 0.88, 0.6, -0.43, 0.3, 0.3, 0.3, { yaw: -0.42 });
  } else {
    add(context, 'siege-throwing-arm', 'matte', VOXEL_COLORS.timberDark, 0.18, 0.72, -0.12, 0.14, 1.25, 0.14, { roll: -0.52 });
    add(context, 'siege-bucket', 'metal', VOXEL_COLORS.steelDark, 0.48, 1.66, -0.24, 0.34, 0.26, 0.32, { roll: -0.52 });
    add(context, 'siege-brace', 'matte', VOXEL_COLORS.timber, -0.2, 0.62, 0.15, 0.12, 0.8, 0.12, { roll: 0.42 });
  }
}

function monk(context: UnitContext): void {
  add(context, 'monk-robe-base', 'matte', shade(context.team, 0.62), 0, 0, 0, 0.7, 0.3, 0.52);
  add(context, 'monk-robe', 'matte', context.team, 0, 0.28, 0, 0.58, 0.82, 0.44);
  add(context, 'monk-cowl', 'matte', shade(context.team, 0.72), 0, 1.08, 0, 0.46, 0.36, 0.4);
  add(context, 'monk-face', 'matte', VOXEL_COLORS.skin, 0, 1.18, 0.21, 0.25, 0.22, 0.08);
  add(context, 'monk-sleeve-left', 'matte', context.team, -0.35, 0.52, 0, 0.16, 0.62, 0.2, { roll: -0.25 });
  add(context, 'monk-sleeve-right', 'matte', context.team, 0.35, 0.52, 0, 0.16, 0.62, 0.2, { roll: 0.25 });
  add(context, 'monk-staff', 'matte', VOXEL_COLORS.timber, 0.48, 0.05, 0.02, 0.07, 1.62, 0.07, { roll: 0.08 });
  add(context, 'monk-staff-crossbar', 'metal', VOXEL_COLORS.gold, 0.5, 1.4, 0.02, 0.26, 0.06, 0.07, { roll: 0.08 });
}

export function createUnitParts(
  entity: ProjectedEntityView,
  identity: string,
  ground: number,
  animationState: AoeUnitAnimationState = {
    mode: 'idle',
    phaseRadians: phaseForUnitIdentity(identity),
    gaitPhaseRadians: phaseForUnitIdentity(identity),
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase: 0,
    attackWeight: 0,
  },
): VoxelPart[] {
  const scale = Math.max(0.48, entity.size);
  const context: UnitContext = {
    entity,
    identity,
    ground,
    centerX: entity.x + 0.5,
    centerZ: entity.y + 0.5,
    scale,
    team: entity.tint,
    parts: [...contactShadow(entity, identity, 'unit-shadow', entity.x + 0.5, ground, entity.y + 0.5, scale * 0.78, scale * 0.58)],
  };
  switch (unitRole(entity.entityType as UnitType)) {
    case 'villager': villager(context); break;
    case 'infantry': infantry(context); break;
    case 'archer': archer(context); break;
    case 'cavalry': cavalry(context, false); break;
    case 'cavalry-archer': cavalry(context, true); break;
    case 'siege': siege(context); break;
    case 'monk': monk(context); break;
  }
  return animateUnitParts(context.parts, entity, animationState);
}
