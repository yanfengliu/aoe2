import type { BuildingType, ProjectedEntityView } from '../../game/simulation/types';
import {
  hash01,
  makePart,
  shade,
  VOXEL_COLORS,
  type VoxelPart,
  type VoxelSurface,
} from './aoeVoxelRecipeTypes';

interface DetailContext {
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly ground: number;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly team: number;
  readonly parts: VoxelPart[];
}

interface Rotation {
  readonly yaw?: number;
  readonly pitch?: number;
  readonly roll?: number;
}

function add(
  context: DetailContext,
  suffix: string,
  surface: VoxelSurface,
  tint: number,
  xFraction: number,
  bottom: number,
  zFraction: number,
  widthFraction: number,
  height: number,
  depthFraction: number,
  rotation: Rotation = {},
): void {
  context.parts.push(makePart(
    context.entity,
    context.identity,
    `detail-${suffix}`,
    surface,
    tint,
    context.x + context.width * xFraction,
    context.ground + bottom + height / 2,
    context.z + context.depth * zFraction,
    Math.max(0.045, context.width * widthFraction),
    height,
    Math.max(0.045, context.depth * depthFraction),
    rotation,
  ));
}

function townCenter(context: DetailContext): void {
  add(context, 'town-center-roof-ridge', 'matte', VOXEL_COLORS.roofTileDark, 0.5, 1.91, 0.5, 0.6, 0.08, 0.045);
  add(context, 'town-center-bell', 'metal', VOXEL_COLORS.gold, 0.5, 2.15, 0.602, 0.055, 0.16, 0.035);
  add(context, 'town-center-bell-yoke', 'matte', VOXEL_COLORS.timberDark, 0.5, 2.31, 0.604, 0.12, 0.05, 0.03);
}

function house(context: DetailContext): void {
  add(context, 'house-roof-ridge', 'matte', VOXEL_COLORS.timberDark, 0.5, 1.49, 0.5, 0.82, 0.09, 0.045);
  add(context, 'house-shutter-left', 'matte', VOXEL_COLORS.timber, 0.625, 0.5, 0.812, 0.045, 0.28, 0.025);
  add(context, 'house-shutter-right', 'matte', VOXEL_COLORS.timber, 0.775, 0.5, 0.812, 0.045, 0.28, 0.025);
}

function mill(context: DetailContext): void {
  add(context, 'mill-blade-hub', 'metal', VOXEL_COLORS.steel, 0.5, 1.01, 0.91, 0.11, 0.18, 0.035);
  add(context, 'mill-grain-sack-left', 'matte', VOXEL_COLORS.thatch, 0.69, 0.15, 0.79, 0.13, 0.25, 0.11);
  add(context, 'mill-grain-sack-right', 'matte', shade(VOXEL_COLORS.thatch, 0.82), 0.82, 0.15, 0.76, 0.12, 0.21, 0.1);
}

function lumberCamp(context: DetailContext): void {
  add(context, 'lumber-camp-log-low', 'matte', VOXEL_COLORS.timberDark, 0.76, 0.14, 0.81, 0.32, 0.12, 0.1);
  add(context, 'lumber-camp-log-high', 'matte', VOXEL_COLORS.timber, 0.76, 0.26, 0.81, 0.3, 0.11, 0.09);
  add(context, 'lumber-camp-axe-handle', 'matte', VOXEL_COLORS.timber, 0.22, 0.16, 0.84, 0.035, 0.62, 0.03, { roll: -0.35 });
  add(context, 'lumber-camp-axe-head', 'metal', VOXEL_COLORS.steelDark, 0.18, 0.69, 0.842, 0.1, 0.12, 0.035, { roll: -0.35 });
}

function miningCamp(context: DetailContext): void {
  add(context, 'mining-camp-ore-bin', 'matte', VOXEL_COLORS.timberDark, 0.74, 0.14, 0.81, 0.3, 0.28, 0.16);
  add(context, 'mining-camp-ore', 'matte', VOXEL_COLORS.stoneDark, 0.74, 0.42, 0.81, 0.22, 0.13, 0.12, { yaw: Math.PI / 4 });
  add(context, 'mining-camp-ore-glint', 'metal', VOXEL_COLORS.gold, 0.78, 0.53, 0.83, 0.055, 0.07, 0.04, { yaw: Math.PI / 4 });
}

function barracks(context: DetailContext): void {
  add(context, 'barracks-shield', 'matte', context.team, 0.73, 0.38, 0.83, 0.13, 0.3, 0.025, { roll: Math.PI / 4 });
  add(context, 'barracks-spear-shaft', 'matte', VOXEL_COLORS.timber, 0.22, 0.2, 0.84, 0.025, 0.76, 0.025, { roll: -0.18 });
  add(context, 'barracks-spear-head', 'metal', VOXEL_COLORS.steel, 0.2, 0.91, 0.842, 0.06, 0.16, 0.03, { roll: -0.18 });
}

function watchTower(context: DetailContext): void {
  add(context, 'watch-tower-arrow-slit-front', 'matte', VOXEL_COLORS.stoneDark, 0.5, 0.75, 0.755, 0.08, 0.34, 0.025);
  add(context, 'watch-tower-arrow-slit-side', 'matte', VOXEL_COLORS.stoneDark, 0.755, 1.15, 0.5, 0.025, 0.32, 0.1);
  add(context, 'watch-tower-brace', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.28, 0.77, 0.04, 0.54, 0.025, { roll: Math.PI / 4 });
}

function bombardTower(context: DetailContext): void {
  // A Bombard Tower is a Watch Tower with a gun in it, so it shares the
  // silhouette and adds the barrel — that is the whole visual difference, and
  // it is enough to tell them apart at default zoom.
  // Near-black cast iron, NOT steelDark: the tower's own stone is close enough
  // to steelDark that the first version of this barrel was invisible against
  // it in the showcase capture. The brass band at the muzzle is the other half
  // of making it read at default zoom, and it does the work that the barrel
  // length cannot — every part has to stay inside the 1x1 footprint, because
  // hit testing and selection are built from these parts.
  add(context, 'bombard-tower-barrel', 'metal', 0x201f22, 0.66, 1.5, 0.66, 0.46, 0.18, 0.18, { yaw: -0.78 });
  add(context, 'bombard-tower-muzzle', 'metal', 0xc9a227, 0.86, 1.5, 0.86, 0.2, 0.24, 0.24);
  add(context, 'bombard-tower-powder-keg', 'matte', 0x4a3524, 0.24, 0.18, 0.82, 0.2, 0.24, 0.2);
}

function stable(context: DetailContext): void {
  add(context, 'stable-hitch-post-left', 'matte', VOXEL_COLORS.timberDark, 0.22, 0.14, 0.89, 0.035, 0.48, 0.035);
  add(context, 'stable-hitch-post-right', 'matte', VOXEL_COLORS.timberDark, 0.78, 0.14, 0.89, 0.035, 0.48, 0.035);
  add(context, 'stable-hitch-rail', 'matte', VOXEL_COLORS.timber, 0.5, 0.43, 0.89, 0.56, 0.07, 0.035);
  add(context, 'stable-hay-bale', 'matte', VOXEL_COLORS.thatch, 0.77, 0.14, 0.72, 0.18, 0.28, 0.18);
}

function archeryRange(context: DetailContext): void {
  add(context, 'archery-range-bow-rack', 'matte', VOXEL_COLORS.timberDark, 0.23, 0.28, 0.84, 0.23, 0.08, 0.035);
  add(context, 'archery-range-arrow-shaft', 'matte', VOXEL_COLORS.timber, 0.23, 0.34, 0.845, 0.025, 0.54, 0.025, { roll: -0.28 });
  add(context, 'archery-range-arrow-head', 'metal', VOXEL_COLORS.steel, 0.2, 0.83, 0.847, 0.055, 0.13, 0.03, { roll: -0.28 });
}

function blacksmith(context: DetailContext): void {
  add(context, 'blacksmith-chimney-band', 'metal', VOXEL_COLORS.steelDark, 0.72, 1.68, 0.42, 0.13, 0.08, 0.13);
  add(context, 'blacksmith-tongs-left', 'metal', VOXEL_COLORS.steel, 0.26, 0.46, 0.89, 0.025, 0.42, 0.025, { roll: -0.35 });
  add(context, 'blacksmith-tongs-right', 'metal', VOXEL_COLORS.steel, 0.3, 0.46, 0.892, 0.025, 0.42, 0.025, { roll: 0.2 });
}

function market(context: DetailContext): void {
  add(context, 'market-pot-left', 'matte', VOXEL_COLORS.roofTile, 0.42, 0.14, 0.83, 0.09, 0.2, 0.08);
  add(context, 'market-pot-right', 'matte', VOXEL_COLORS.roofTileDark, 0.52, 0.14, 0.84, 0.08, 0.16, 0.075);
  add(context, 'market-counter-goods', 'metal', VOXEL_COLORS.gold, 0.68, 0.72, 0.72, 0.17, 0.07, 0.12);
}

function siegeWorkshop(context: DetailContext): void {
  add(context, 'siege-workshop-spare-wheel', 'matte', VOXEL_COLORS.timberDark, 0.76, 0.18, 0.84, 0.14, 0.38, 0.035, { roll: Math.PI / 4 });
  add(context, 'siege-workshop-axle', 'metal', VOXEL_COLORS.steelDark, 0.32, 0.3, 0.85, 0.28, 0.08, 0.03);
  add(context, 'siege-workshop-timber-brace', 'matte', VOXEL_COLORS.timber, 0.34, 0.42, 0.847, 0.035, 0.58, 0.025, { roll: Math.PI / 4 });
}

function monastery(context: DetailContext): void {
  add(context, 'monastery-rose-window', 'matte', shade(context.team, 0.76), 0.5, 1.73, 0.615, 0.12, 0.2, 0.025, { roll: Math.PI / 4 });
  add(context, 'monastery-buttress-left', 'matte', VOXEL_COLORS.stone, 0.2, 0.12, 0.8, 0.09, 0.68, 0.1);
  add(context, 'monastery-buttress-right', 'matte', VOXEL_COLORS.stone, 0.8, 0.12, 0.8, 0.09, 0.68, 0.1);
}

// University: a lecture hall marked as a place of study — an astronomer's
// quadrant angled at the sky above the door, flanked by scroll racks.
function university(context: DetailContext): void {
  add(context, 'university-quadrant-arc', 'metal', VOXEL_COLORS.gold, 0.5, 1.66, 0.62, 0.26, 0.035, 0.025, { roll: Math.PI / 5 });
  add(context, 'university-quadrant-mast', 'matte', VOXEL_COLORS.timberDark, 0.5, 1.5, 0.618, 0.03, 0.34, 0.025);
  add(context, 'university-scroll-rack-left', 'matte', VOXEL_COLORS.plaster, 0.24, 0.3, 0.79, 0.11, 0.4, 0.09);
  add(context, 'university-scroll-rack-right', 'matte', VOXEL_COLORS.plaster, 0.76, 0.3, 0.79, 0.11, 0.4, 0.09);
}

// Dock: the working clutter of a working quay.
function dock(context: DetailContext): void {
  add(context, 'dock-net-rack', 'matte', VOXEL_COLORS.cloth, 0.22, 0.14, 0.5, 0.12, 0.26, 0.05);
  add(context, 'dock-fish-crate', 'matte', VOXEL_COLORS.timberDark, 0.78, 0.06, 0.62, 0.16, 0.14, 0.16);
  add(context, 'dock-lantern', 'matte', VOXEL_COLORS.gold, 0.7, 0.42, 0.95, 0.06, 0.08, 0.06);
}

// Outpost: the rungs of the ladder and the rail the lookout leans on — the two
// parts that say "someone climbs up here and watches" rather than "this shoots".
function outpost(context: DetailContext): void {
  add(context, 'outpost-ladder', 'matte', VOXEL_COLORS.timber, 0.5, 0.62, 0.185, 0.2, 0.02, 0.012);
  add(context, 'outpost-rail', 'matte', VOXEL_COLORS.timberDark, 0.5, 1.2, 0.79, 0.6, 0.02, 0.02);
  add(context, 'outpost-horn', 'metal', VOXEL_COLORS.gold, 0.34, 1.14, 0.62, 0.06, 0.06, 0.06);
}

// Fish Trap: the slack of the net and a cork float riding the surface.
function fishTrap(context: DetailContext): void {
  add(context, 'fish-trap-net', 'matte', VOXEL_COLORS.cloth, 0.5, 0.1, 0.5, 0.42, 0.02, 0.42);
  add(context, 'fish-trap-float', 'matte', VOXEL_COLORS.thatch, 0.32, 0.12, 0.66, 0.08, 0.05, 0.08);
}

function castle(context: DetailContext): void {
  add(context, 'castle-portcullis-bar-left', 'metal', VOXEL_COLORS.steelDark, 0.46, 0.24, 0.802, 0.018, 0.78, 0.02);
  add(context, 'castle-portcullis-bar-right', 'metal', VOXEL_COLORS.steelDark, 0.54, 0.24, 0.802, 0.018, 0.78, 0.02);
  add(context, 'castle-portcullis-header', 'metal', VOXEL_COLORS.steelDark, 0.5, 0.91, 0.804, 0.16, 0.055, 0.018);
  add(context, 'castle-arrow-slit', 'matte', VOXEL_COLORS.stoneDark, 0.5, 1.3, 0.795, 0.045, 0.3, 0.018);
}

function wonder(context: DetailContext): void {
  add(context, 'wonder-relief-left', 'matte', VOXEL_COLORS.gold, 0.41, 0.72, 0.775, 0.09, 0.3, 0.025);
  add(context, 'wonder-relief-right', 'matte', VOXEL_COLORS.gold, 0.59, 0.72, 0.775, 0.09, 0.3, 0.025);
  add(context, 'wonder-finial', 'metal', VOXEL_COLORS.gold, 0.5, 3.2, 0.5, 0.065, 0.16, 0.065);
}

function stoneWall(context: DetailContext): void {
  add(context, 'stone-wall-course-low', 'matte', VOXEL_COLORS.stoneDark, 0.5, 0.24, 0.755, 0.88, 0.05, 0.025);
  add(context, 'stone-wall-course-high', 'matte', VOXEL_COLORS.stoneLight, 0.5, 0.52, 0.755, 0.88, 0.05, 0.025);
  add(context, 'stone-wall-cap', 'matte', VOXEL_COLORS.stoneDark, 0.5, 1.03, 0.5, 0.94, 0.08, 0.56);
}

function palisadeWall(context: DetailContext): void {
  add(context, 'palisade-wall-lashing', 'matte', VOXEL_COLORS.thatch, 0.5, 0.68, 0.65, 0.7, 0.07, 0.035);
  add(context, 'palisade-wall-brace', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.2, 0.66, 0.055, 0.72, 0.04, { roll: Math.PI / 4 });
}

// The two things that say "this opens": iron hinges on the doors, and the road
// worn through the threshold.
function stoneGate(context: DetailContext): void {
  add(context, 'stone-gate-hinge-band', 'matte', VOXEL_COLORS.steelDark, 0.5, 0.56, 0.58, 0.5, 0.05, 0.03);
  add(context, 'stone-gate-track', 'matte', VOXEL_COLORS.stoneDark, 0.5, 0.01, 0.5, 0.46, 0.02, 0.66);
}

function palisadeGate(context: DetailContext): void {
  add(context, 'palisade-gate-lashing', 'matte', VOXEL_COLORS.thatch, 0.5, 0.72, 0.58, 0.66, 0.06, 0.035);
  add(context, 'palisade-gate-track', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.01, 0.5, 0.42, 0.02, 0.62);
}

function farm(context: DetailContext): void {
  add(context, 'farm-scarecrow-post', 'matte', VOXEL_COLORS.timberDark, 0.78, 0.08, 0.78, 0.035, 0.78, 0.035);
  add(context, 'farm-scarecrow-arms', 'matte', context.team, 0.78, 0.62, 0.78, 0.34, 0.08, 0.035);
  add(context, 'farm-scarecrow-head', 'matte', VOXEL_COLORS.thatch, 0.78, 0.84, 0.78, 0.13, 0.18, 0.13);
}

export function createBuildingDetailParts(
  entity: ProjectedEntityView,
  identity: string,
  ground: number,
): VoxelPart[] {
  const context: DetailContext = {
    entity,
    identity,
    ground,
    x: entity.x,
    z: entity.y,
    width: Math.max(0.5, entity.footprintWidth),
    depth: Math.max(0.5, entity.footprintHeight),
    team: entity.tint,
    parts: [],
  };
  const entityType = entity.entityType as BuildingType;
  switch (entityType) {
    case 'town-center': townCenter(context); break;
    case 'house': house(context); break;
    case 'mill': mill(context); break;
    case 'lumber-camp': lumberCamp(context); break;
    case 'mining-camp': miningCamp(context); break;
    case 'barracks': barracks(context); break;
    case 'watch-tower': watchTower(context); break;
    case 'bombard-tower': watchTower(context); bombardTower(context); break;
    case 'stable': stable(context); break;
    case 'archery-range': archeryRange(context); break;
    case 'blacksmith': blacksmith(context); break;
    case 'market': market(context); break;
    case 'siege-workshop': siegeWorkshop(context); break;
    case 'monastery': monastery(context); break;
    case 'university': university(context); break;
    case 'dock': dock(context); break;
    case 'outpost': outpost(context); break;
    case 'fish-trap': fishTrap(context); break;
    case 'castle': castle(context); break;
    case 'wonder': wonder(context); break;
    case 'stone-wall': stoneWall(context); break;
    case 'palisade-wall': palisadeWall(context); break;
    case 'stone-gate': stoneGate(context); break;
    case 'palisade-gate': palisadeGate(context); break;
    case 'farm': farm(context); break;
  }
  return context.parts;
}

// Fire on a wounded building (v0.3.97): two or three deterministic flame
// tongues — a broad orange base, a red tip, and a smoke cube drifting above —
// hashed off the building's cell so the same ruin always burns in the same
// places, saves and replays included. Memory ghosts inherit the reduced
// opacity automatically like every other part.
export function damageFlames(
  entity: ProjectedEntityView,
  identity: string,
  ground: number,
  width: number,
  depth: number,
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  const flameCount = 2 + Math.floor(hash01(entity.x, entity.y, 97) * 2); // 2..3
  for (let index = 0; index < flameCount; index += 1) {
    const fx = entity.x + 0.2 + hash01(entity.x + index, entity.y, 31) * (width - 0.4);
    const fz = entity.y + 0.2 + hash01(entity.x, entity.y + index, 57) * (depth - 0.4);
    const flameHeight = 0.7 + hash01(entity.x + index, entity.y + index, 73) * 0.5;
    parts.push(
      makePart(entity, identity, `flame-base-${index}`, 'matte', 0xe07818,
        fx, ground + flameHeight * 0.35, fz, 0.3, flameHeight * 0.7, 0.3),
      makePart(entity, identity, `flame-tip-${index}`, 'matte', 0xc23a1a,
        fx, ground + flameHeight * 0.85, fz, 0.18, flameHeight * 0.5, 0.18),
      makePart(entity, identity, `flame-smoke-${index}`, 'matte', 0x4a4642,
        fx + 0.08, ground + flameHeight + 0.45, fz - 0.06, 0.26, 0.26, 0.26),
    );
  }
  return parts;
}
