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
