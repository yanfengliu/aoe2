import { isoToWorld } from '../rendering/isometricProjection';

// Small pure helpers for AoeVoxelGameView. Extracted for the 500-LOC budget;
// none of them touch the view's state, which is why they were free-standing
// functions at the bottom of that file already.

/** WASD and the arrow keys pan the camera; everything else belongs elsewhere. */
export function isCameraKey(code: string): boolean {
  return code === 'ArrowLeft'
    || code === 'ArrowRight'
    || code === 'ArrowUp'
    || code === 'ArrowDown'
    || code === 'KeyW'
    || code === 'KeyA'
    || code === 'KeyS'
    || code === 'KeyD';
}

/**
 * Whether a key event landed in something the player is typing into. Camera
 * keys must not steal a keystroke from a text field.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || Boolean(target.closest('input, textarea, select')));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The map cell a building ghost should be drawn on, or null for "no ghost".
 *
 * Two ways there is no ghost, and both of them shipped as one (play-test
 * 2026-09-11, `17-escape-during-placement.png`):
 *
 *  - the pointer has never been over the world. Arming a build from the command
 *    card and not moving the mouse left the pointer at its initial (0, 0);
 *  - the pointer is off the map. The old code CLAMPED to the nearest edge cell,
 *    so a pointer out in the black drew a foundation ghost on the map's corner —
 *    an offer to build somewhere the player was not pointing.
 */
export function placementGhostCell(
  pointer: { x: number; y: number; hasMoved: boolean },
  screenToIso: (screenX: number, screenY: number) => { x: number; y: number },
  map: { width: number; height: number },
): { cellX: number; cellY: number } | null {
  if (!pointer.hasMoved) return null;
  const iso = screenToIso(pointer.x, pointer.y);
  const raw = isoToWorld(iso.x, iso.y);
  const cellX = Math.floor(raw.cellX);
  const cellY = Math.floor(raw.cellY);
  if (cellX < 0 || cellY < 0 || cellX >= map.width || cellY >= map.height) return null;
  return { cellX, cellY };
}
