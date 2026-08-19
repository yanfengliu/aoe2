// Drawing shots in flight (spec §10.4). The simulation decides where a
// projectile is; this decides what it looks like getting there.
//
// Each shot is one box interpolated along origin->aim, lifted onto a shallow
// arc so it reads as thrown rather than slid along the ground, and yawed to
// point where it is going. Purely presentational: the arc height and the per
// class sizes exist nowhere in the simulation, which only knows the endpoints
// and the impact tick.

import type { ProjectedFrameView, ProjectedProjectileView } from '../../game/simulation/types';
import { VOXEL_COLORS, type VoxelPart } from './aoeVoxelRecipeTypes';

/** Peak height of the flight arc, in tiles, for a full-length shot. */
const ARC_PEAK = 0.55;

/** Height the shot leaves from and returns to — roughly chest height. */
const MUZZLE_HEIGHT = 0.42;

interface ProjectileLook {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly tint: number;
  /** Multiplies the arc: heavy ordnance lobs, arrows flatten out. */
  readonly arc: number;
}

const LOOKS: Record<ProjectedProjectileView['visual'], ProjectileLook> = {
  // A thin shaft, longer than it is wide, flying nearly flat.
  arrow: { width: 0.1, height: 0.1, depth: 0.52, tint: VOXEL_COLORS.plaster, arc: 0.55 },
  // A scorpion bolt: heavier and longer than an arrow.
  bolt: { width: 0.13, height: 0.13, depth: 0.62, tint: VOXEL_COLORS.timber, arc: 0.45 },
  // Mangonel stone.
  stone: { width: 0.34, height: 0.34, depth: 0.34, tint: VOXEL_COLORS.stoneDark, arc: 1.3 },
  // Trebuchet boulder: the biggest thing in the air, on the highest arc.
  boulder: { width: 0.46, height: 0.46, depth: 0.46, tint: VOXEL_COLORS.stone, arc: 1.75 },
  // Cannonball: small, dark iron, and nearly flat — it is fast.
  cannonball: { width: 0.24, height: 0.24, depth: 0.24, tint: VOXEL_COLORS.steelDark, arc: 0.3 },
};

function progressOf(shot: ProjectedProjectileView, tick: number): number {
  const span = shot.impactTick - shot.launchTick;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (tick - shot.launchTick) / span));
}

/**
 * One box per visible in-flight shot, positioned for this frame's tick.
 * Returns an empty list for a frame with nothing in the air.
 */
export function createProjectileParts(frame: ProjectedFrameView | null): VoxelPart[] {
  if (!frame || frame.projectiles.length === 0) return [];

  const parts: VoxelPart[] = [];
  for (const shot of frame.projectiles) {
    const progress = progressOf(shot, frame.tick);
    const spanX = shot.aimX - shot.originX;
    const spanY = shot.aimY - shot.originY;
    const look = LOOKS[shot.visual];

    // Parabola peaking at the midpoint, scaled by how far the shot travels —
    // a point-blank shot barely rises, a siege lob climbs.
    const distance = Math.hypot(spanX, spanY);
    const peak = ARC_PEAK * look.arc * Math.min(1, distance / 6);
    const height = MUZZLE_HEIGHT + peak * 4 * progress * (1 - progress);

    parts.push({
      key: `ui:projectile:${String(shot.id)}`,
      surface: 'ui',
      tint: look.tint,
      centerX: shot.originX + spanX * progress + 0.5,
      centerY: height,
      centerZ: shot.originY + spanY * progress + 0.5,
      width: look.width,
      height: look.height,
      depth: look.depth,
      // Point along the direction of travel. A zero-length flight keeps yaw 0
      // rather than producing NaN from atan2(0, 0)'s undefined heading.
      yaw: distance > 0 ? Math.atan2(spanX, spanY) : 0,
    });
  }
  return parts;
}
