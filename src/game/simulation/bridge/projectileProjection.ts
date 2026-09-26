// Turning in-flight projectiles into something a frame can draw (spec §10.4).
//
// A shot is shown only where the viewing player can actually see it: the fog
// test is applied to the projectile's CURRENT position, so an arrow fired out
// of your vision becomes visible as it crosses into it and disappears again if
// it leaves — the same rule your own eyes would apply.

import type { ProjectedProjectileView } from '../types';
import type { MapSize } from '../mapGeneration/constants';
import type { ProjectileState } from './projectileTypes';

/**
 * Visual class, derived from what fired the shot: DE's shot wherever this game
 * has a look for it (spec §10.4). The Siege Onager, the Cannon Galleon line and
 * the Turtle Ship line fell through to an arrow until 2026-09-26. DE's musket
 * balls, thrown axes and scimitars, and fire-ship flames have no look here yet
 * and are drawn as arrows; tests/simulation/projectileLooks.test.ts names them.
 */
export function projectileVisualKind(
  attackerUnitType: string | null,
): ProjectedProjectileView['visual'] {
  switch (attackerUnitType) {
    case 'mangonel':
    case 'onager':
    case 'siege-onager':
      return 'stone';
    case 'trebuchet':
      return 'boulder';
    case 'bombard-cannon':
    case 'cannon-galleon':
    case 'elite-cannon-galleon':
    case 'turtle-ship':
    case 'elite-turtle-ship':
      return 'cannonball';
    case 'scorpion':
    case 'heavy-scorpion':
      return 'bolt';
    default:
      return 'arrow';
  }
}

/**
 * How far along its flight a shot is at `tick`, in [0,1]. Clamped at both ends
 * so a frame rendered slightly before launch or after impact still produces a
 * position on the path rather than one off the end of it.
 */
export function projectileProgress(shot: ProjectileState, tick: number): number {
  const span = shot.impactTick - shot.launchTick;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (tick - shot.launchTick) / span));
}

/** Where the shot is at `tick`. */
export function projectilePositionAt(
  shot: ProjectileState,
  tick: number,
): { x: number; y: number } {
  const progress = projectileProgress(shot, tick);
  return {
    x: shot.originX + (shot.aimX - shot.originX) * progress,
    y: shot.originY + (shot.aimY - shot.originY) * progress,
  };
}

/**
 * The shots this player can see right now, as frame views. `isCellVisible`
 * receives whole-cell coordinates; a shot over a fogged cell is omitted
 * entirely rather than drawn dimmed, because a projectile has no memory state
 * — you either watch it fly or you never knew it was fired.
 */
export function visibleProjectiles(
  shots: readonly ProjectileState[],
  tick: number,
  isCellVisible: (x: number, y: number) => boolean,
  size: MapSize,
): ProjectedProjectileView[] {
  const views: ProjectedProjectileView[] = [];
  for (const shot of shots) {
    // Still winding up: the shot exists in the simulation but has not left the
    // attacker yet, so there is nothing in the air to draw.
    if (tick < shot.launchTick) continue;
    const position = projectilePositionAt(shot, tick);
    const cellX = Math.floor(position.x);
    const cellY = Math.floor(position.y);
    // Off the map is not "not visible" — the engine's visibility map THROWS on
    // an out-of-range coordinate rather than answering, so the check has to
    // come first. Shots are clamped to the map at launch; this is the guard
    // that keeps a shot restored from an older save from ending the match.
    if (cellX < 0 || cellY < 0 || cellX >= size.width || cellY >= size.height) continue;
    if (!isCellVisible(cellX, cellY)) continue;
    views.push({
      id: shot.id,
      originX: shot.originX,
      originY: shot.originY,
      aimX: shot.aimX,
      aimY: shot.aimY,
      launchTick: shot.launchTick,
      impactTick: shot.impactTick,
      visual: projectileVisualKind(shot.attackerUnitType),
    });
  }
  // Ascending id: a stable draw order across frames.
  views.sort((a, b) => a.id - b.id);
  return views;
}
