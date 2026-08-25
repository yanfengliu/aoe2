// Shared map dimensions. Kept in a dedicated module so `mapGeneration/*`
// helpers never need to import from `../prototypeScenario`, which would
// otherwise cycle back through the fixture/dispatcher graph.
// `prototypeScenario.ts` re-exports these as its public surface.

/** The world's extent in tiles. Derived from the terrain grid wherever one is
 *  already in hand, and passed explicitly where one is not. */
export interface MapSize {
  readonly width: number;
  readonly height: number;
}

// The two-player map, unchanged since the first slice: every existing fixture,
// screenshot and test is written against these numbers, so they stay the
// meaning of "the map" for anything that does not ask for a player count.
export const MAP_WIDTH = 60;
export const MAP_HEIGHT = 36;

/**
 * Spec §4's size ladder, in tiles, by how many players are seated.
 *
 * AoE2 grows the map with the player count rather than crowding a fixed one,
 * and it has to: eight openings on a two-player map start inside each other.
 * The land per player is held roughly constant (about 1050 tiles a seat, the
 * two-player map's own figure) and the 5:3 shape is kept at every rung, so a
 * six-player game feels like the same game with more of it rather than a
 * different one.
 */
const SIZE_LADDER: Readonly<Record<number, MapSize>> = {
  2: { width: MAP_WIDTH, height: MAP_HEIGHT },
  3: { width: 72, height: 44 },
  4: { width: 84, height: 50 },
  5: { width: 92, height: 56 },
  6: { width: 100, height: 62 },
  7: { width: 110, height: 66 },
  8: { width: 116, height: 72 },
};

/** How many players a standard map can seat — spec §4.2's own range. */
export const MIN_STANDARD_PLAYERS = 2;
export const MAX_STANDARD_PLAYERS_LADDER = 8;

/**
 * The map a skirmish of this many players opens on.
 *
 * A count outside the range is clamped rather than throwing: this runs during
 * map generation, where refusing to build a map is a worse answer to a bad URL
 * than building a playable one.
 */
export function standardMapSize(playerCount = MIN_STANDARD_PLAYERS): MapSize {
  const count = Math.max(
    MIN_STANDARD_PLAYERS,
    Math.min(MAX_STANDARD_PLAYERS_LADDER, Math.floor(playerCount)),
  );
  return SIZE_LADDER[count] ?? SIZE_LADDER[MIN_STANDARD_PLAYERS]!;
}

/** The size of a terrain grid already in hand — rows are the height. */
export function sizeOfTerrain(terrain: ReadonlyArray<ReadonlyArray<unknown>>): MapSize {
  return { width: terrain[0]?.length ?? 0, height: terrain.length };
}
