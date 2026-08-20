// The base colour of each terrain kind, in one place.
//
// These are simulation-seeded (they ride the tile's renderable component) but
// they are a presentation decision, and the renderer's patch fields and seam
// softening are tuned against them — so they live in one module that both the
// seeder and the tests that judge the result read from.

import type { TerrainKind } from './types';

export const TERRAIN_TINTS: Record<TerrainKind, number> = {
  grass: 0x587f4e,
  forest: 0x2f5e34,
  water: 0x295a75,
  // A hill is GRASS ON HIGH GROUND, not bare dirt. It was a khaki 0x8c7d5a,
  // which is a large jump in both hue and brightness from the grass beside it
  // — and since raised terrain is still flattened by the renderer, a hill has
  // no height to explain that jump. It read as an arbitrary tan blotch with a
  // hard edge. Drier and sun-caught, in the same family, reads as high ground
  // and lets the seam softening actually soften something.
  hill: 0x6f8a4c,
};
