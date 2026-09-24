// Where the chosen art style is remembered between sessions.
//
// A player setting, not world state: it never enters the save format, so
// loading someone else's game does not impose their look, and a replay of a
// match played in one style can be watched in the other (spec §14.5).
//
// Reads fail soft. A stored id naming a style this build does not ship falls
// back to the default rather than throwing — `painted`, stored by builds
// before v0.3.196, is one — because withdrawing a style must not strand the
// players who had it selected. A storage read that throws (private browsing,
// a disabled origin, a quota error) must not stop the game from booting over
// a question about looks.

import { DEFAULT_ART_STYLE_ID, isArtStyleId, type ArtStyleId } from './artStyles';

export const ART_STYLE_STORAGE_KEY = 'aoe2:art-style';

export interface ArtStyleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ArtStyleStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Access itself throws when the origin has storage disabled.
    return null;
  }
}

export function readArtStylePreference(storage = defaultStorage()): ArtStyleId {
  if (!storage) return DEFAULT_ART_STYLE_ID;

  let stored: string | null;
  try {
    stored = storage.getItem(ART_STYLE_STORAGE_KEY);
  } catch {
    return DEFAULT_ART_STYLE_ID;
  }

  return isArtStyleId(stored) ? stored : DEFAULT_ART_STYLE_ID;
}

export function writeArtStylePreference(
  id: ArtStyleId,
  storage = defaultStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(ART_STYLE_STORAGE_KEY, id);
  } catch {
    // A preference that cannot be persisted still applies to this session.
  }
}
