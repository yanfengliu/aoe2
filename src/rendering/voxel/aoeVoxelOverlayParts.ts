import type {
  ProjectedEntityView,
  ProjectedFrameView,
} from '../../game/simulation/types';
import type { PlacementPreviewViewState } from '../viewTypes';
import { ISO_TILE_HEIGHT } from '../isometricProjection';
import { VOXEL_VERTICAL_PIXELS_PER_WORLD_UNIT } from './aoeVoxelGeometry';
import type { VoxelPart, VoxelSurface } from './aoeVoxelRecipeTypes';

export interface VoxelOverlayEntity {
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly ground: number;
  readonly visualTop: number;
}

export interface AoeVoxelOverlayInput {
  readonly frame: ProjectedFrameView | null;
  readonly placementPreview: PlacementPreviewViewState | null;
  readonly selectionPreviewEntityIds: readonly number[];
  readonly selectionMarqueeWorldCorners?: readonly {
    readonly x: number;
    readonly z: number;
  }[] | null;
  readonly hitEntityIdentities?: readonly string[];
}

export const EMPTY_VOXEL_OVERLAYS: AoeVoxelOverlayInput = {
  frame: null,
  placementPreview: null,
  selectionPreviewEntityIds: [],
};

function part(
  key: string,
  surface: VoxelSurface,
  tint: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  width: number,
  height: number,
  depth: number,
  yaw?: number,
): VoxelPart {
  return {
    key,
    surface,
    tint,
    centerX,
    centerY,
    centerZ,
    width,
    height,
    depth,
    ...(yaw === undefined ? {} : { yaw }),
  };
}

function selectionParts(
  entities: readonly VoxelOverlayEntity[],
  previewIds: readonly number[],
): VoxelPart[] {
  const preview = new Set(previewIds);
  return entities.flatMap(({ entity, identity, ground }) => {
    if ((!entity.selected && !preview.has(entity.id)) || entity.isMemory) return [];
    const tint = entity.selected ? 0xf2cf5b : 0x6ed6ff;
    const width = entity.kind === 'building'
      ? entity.footprintWidth
      : Math.max(0.72, entity.size);
    const depth = entity.kind === 'building'
      ? entity.footprintHeight
      : Math.max(0.72, entity.size);
    const centerX = entity.x + (entity.kind === 'building' ? width / 2 : 0.5);
    const centerZ = entity.y + (entity.kind === 'building' ? depth / 2 : 0.5);
    const thickness = 0.075;
    const y = ground + 0.055;
    const prefix = `ui:selection:${identity}`;
    return [
      part(`${prefix}:north`, 'ui', tint, centerX, y, centerZ - depth / 2, width, 0.07, thickness),
      part(`${prefix}:south`, 'ui', tint, centerX, y, centerZ + depth / 2, width, 0.07, thickness),
      part(`${prefix}:west`, 'ui', tint, centerX - width / 2, y, centerZ, thickness, 0.07, depth),
      part(`${prefix}:east`, 'ui', tint, centerX + width / 2, y, centerZ, thickness, 0.07, depth),
    ];
  });
}

function healthParts(entities: readonly VoxelOverlayEntity[]): VoxelPart[] {
  return entities.flatMap(({ entity, identity, visualTop }) => {
    if (
      entity.isMemory
      || entity.kind === 'tile'
      || entity.currentHp === null
      || entity.maxHp === null
      || entity.maxHp <= 0
      || (!entity.selected && entity.currentHp >= entity.maxHp)
    ) return [];
    const ratio = Math.max(0, Math.min(1, entity.currentHp / entity.maxHp));
    const width = entity.kind === 'building'
      ? Math.min(1.2, Math.max(0.72, entity.footprintWidth * 0.36))
      : Math.max(0.42, entity.size * 0.58);
    const fillWidth = Math.max(0.025, width * ratio);
    const centerX = entity.x + (entity.kind === 'building' ? entity.footprintWidth / 2 : 0.5);
    const centerZ = entity.y + (entity.kind === 'building' ? entity.footprintHeight / 2 : 0.5);
    const y = visualTop + 0.18;
    const fillTint = ratio > 0.6 ? 0x77d26a : ratio > 0.3 ? 0xdab85a : 0xd76464;
    const prefix = `ui:health:${identity}`;
    return [
      part(`${prefix}:background`, 'ui', 0x15191a, centerX, y, centerZ, width + 0.05, 0.055, 0.08),
      part(
        `${prefix}:fill`,
        'ui',
        fillTint,
        centerX - width / 2 + fillWidth / 2,
        y + 0.008,
        centerZ - 0.003,
        fillWidth,
        0.06,
        0.062,
      ),
    ];
  });
}

function marqueeParts(
  corners: AoeVoxelOverlayInput['selectionMarqueeWorldCorners'],
): VoxelPart[] {
  if (!corners || corners.length !== 4) return [];
  const lift = 8;
  // Move toward the isometric camera along its view ray. The equal x/z
  // offset cancels the lift in screen space, so the marquee stays under the
  // pointer while depth-testing in front of authored buildings and units.
  const screenLockedDepthOffset = lift
    * VOXEL_VERTICAL_PIXELS_PER_WORLD_UNIT / ISO_TILE_HEIGHT;
  return corners.map((start, index) => {
    const end = corners[(index + 1) % corners.length]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.04, Math.hypot(dx, dz));
    return part(
      `ui:marquee:${String(index)}`,
      'ui',
      0x6ed6ff,
      (start.x + end.x) / 2 + screenLockedDepthOffset,
      lift,
      (start.z + end.z) / 2 + screenLockedDepthOffset,
      length,
      0.075,
      0.055,
      Math.atan2(-dz, dx),
    );
  });
}

function placementParts(preview: PlacementPreviewViewState | null): VoxelPart[] {
  if (!preview?.active) return [];
  const tint = preview.isValid ? 0x66d17a : 0xe35b55;
  const prefix = [
    'ui:placement',
    preview.buildingType,
    String(preview.cellX),
    String(preview.cellY),
  ].join(':');
  const parts: VoxelPart[] = [];
  for (let z = 0; z < preview.height; z += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      parts.push(part(
        `${prefix}:cell:${String(x)}:${String(z)}`,
        'ui',
        tint,
        preview.cellX + x + 0.5,
        0.07,
        preview.cellY + z + 0.5,
        0.82,
        0.08,
        0.82,
      ));
    }
  }
  if (!preview.isValid) {
    parts.push(part(
      `${prefix}:blocked`,
      'ui',
      0xff4a45,
      preview.cellX + preview.width / 2,
      0.48,
      preview.cellY + preview.height / 2,
      0.14,
      0.82,
      0.14,
    ));
  }
  return parts;
}

function deathParts(frame: ProjectedFrameView | null): VoxelPart[] {
  if (!frame) return [];
  return frame.recentUnitDeaths.flatMap((death) => {
    const prefix = `ui:death:${String(death.id)}:${String(death.tick)}`;
    return [
      part(`${prefix}:debris-a`, 'ui', death.tint, death.x + 0.35, 0.18, death.y + 0.42, 0.22, 0.22, 0.22),
      part(`${prefix}:debris-b`, 'ui', 0x6d4430, death.x + 0.58, 0.12, death.y + 0.58, 0.18, 0.16, 0.26),
      part(`${prefix}:debris-c`, 'ui', 0xb9a889, death.x + 0.48, 0.1, death.y + 0.3, 0.14, 0.13, 0.14),
    ];
  });
}

function hitParts(
  entities: readonly VoxelOverlayEntity[],
  hitIdentities: readonly string[],
): VoxelPart[] {
  const active = new Set(hitIdentities);
  return entities.flatMap(({ entity, identity, visualTop }) => {
    if (!active.has(identity) || entity.isMemory) return [];
    const x = entity.x + (entity.kind === 'building' ? entity.footprintWidth / 2 : 0.5);
    const z = entity.y + (entity.kind === 'building' ? entity.footprintHeight / 2 : 0.5);
    const y = visualTop + 0.18;
    const prefix = `ui:hit:${identity}`;
    return [
      part(`${prefix}:spark-a`, 'ui', 0xffe6a1, x - 0.25, y + 0.2, z, 0.12, 0.12, 0.12),
      part(`${prefix}:spark-b`, 'ui', 0xff8a4c, x + 0.23, y, z - 0.16, 0.1, 0.1, 0.1),
      part(`${prefix}:spark-c`, 'ui', 0xfff3cf, x + 0.05, y + 0.32, z + 0.18, 0.08, 0.08, 0.08),
    ];
  });
}

export function createAoeVoxelOverlayParts(
  entities: readonly VoxelOverlayEntity[],
  input: AoeVoxelOverlayInput,
): VoxelPart[] {
  return [
    ...selectionParts(entities, input.selectionPreviewEntityIds),
    ...marqueeParts(input.selectionMarqueeWorldCorners),
    ...healthParts(entities),
    ...placementParts(input.placementPreview),
    ...hitParts(entities, input.hitEntityIdentities ?? []),
    ...deathParts(input.frame),
  ];
}
