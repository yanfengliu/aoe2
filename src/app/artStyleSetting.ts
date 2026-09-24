// The game menu's art-style row: switch the canvas, then remember the choice.
//
// A player setting, never world state (spec §14.5): it is kept per browser by
// `artStylePreference.ts` and never enters a save or a replay.

import { artStyleById, nextArtStyleId, type ArtStyleId } from '../rendering/artStyles';
import { writeArtStylePreference, type ArtStyleStorage } from '../rendering/artStylePreference';

/** What draws in a style: the game view in the app, a fake in tests. */
export interface ArtStyleTarget {
  artStyleId(): ArtStyleId;
  setArtStyle(id: ArtStyleId): void;
}

/**
 * Advances to the next style and returns its label for the menu row. The
 * choice is persisted only after the canvas has taken it: a switch that throws
 * leaves both the canvas and the stored choice on the old style, so the next
 * boot cannot open in a style this session never managed to draw.
 */
export function cycleArtStyle(target: ArtStyleTarget, storage?: ArtStyleStorage | null): string {
  const next = nextArtStyleId(target.artStyleId());
  target.setArtStyle(next);
  writeArtStylePreference(next, storage);
  return artStyleById(next).label;
}

/** The label of the style the canvas is drawn in. */
export function artStyleLabel(target: ArtStyleTarget): string {
  return artStyleById(target.artStyleId()).label;
}
