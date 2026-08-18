// Water-cell surface detail: dark ripples, animated wave crests, sky
// reflections, and the shoreline surf band. Split out of aoeVoxelTerrain.ts
// (file-size budget) when the static straight foam bar was replaced by
// animated surf segments.
import type { ProjectedEntityView, TerrainKind } from '../../game/simulation/types';
import { hash01, makePart, VOXEL_COLORS, type VoxelPart } from './aoeVoxelRecipeTypes';

// One shared lap rhythm; the phase varies with the along-coast world
// coordinate so the wave sweeps down the shoreline instead of blinking in
// unison. Per-segment periods would drift the sweep apart over time.
const SURF_PERIOD_MS = 2_800;
// Three candidate segments per coast edge, individually kept/dropped and
// jittered so no two edges produce the same broken line.
const SURF_SLOTS = [0.25, 0.5, 0.75] as const;

interface ShoreEdge {
  readonly suffix: 'north' | 'east' | 'south' | 'west';
  readonly dx: number;
  readonly dz: number;
}

const SHORE_EDGES: readonly ShoreEdge[] = [
  { suffix: 'north', dx: 0, dz: -1 },
  { suffix: 'east', dx: 1, dz: 0 },
  { suffix: 'south', dx: 0, dz: 1 },
  { suffix: 'west', dx: -1, dz: 0 },
];

/** Animated, irregular surf segments along one water-cell edge that touches
 *  land. Travel and fade run perpendicular to the edge; placement, width,
 *  inshore distance, yaw, and phase are all position-hashed so the band never
 *  reads as a straight line. Amplitudes are budgeted so every sampled corner
 *  stays inside the source cell (see the containment test). */
function surfParts(
  entity: ProjectedEntityView,
  identity: string,
  x: number,
  z: number,
  edge: ShoreEdge,
  edgeIndex: number,
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  const horizontal = edge.dz === 0;
  for (let slot = 0; slot < SURF_SLOTS.length; slot += 1) {
    const salt = 131 + edgeIndex * 41 + slot * 7;
    if (hash01(x, z, salt) < 0.22) continue;
    const along = SURF_SLOTS[slot]! + (hash01(x, z, salt + 1) - 0.5) * 0.16;
    const inshore = 0.13 + hash01(x, z, salt + 2) * 0.07;
    const width = 0.14 + hash01(x, z, salt + 3) * 0.12;
    const depth = 0.04 + hash01(x, z, salt + 4) * 0.03;
    const yaw = (hash01(x, z, salt + 5) - 0.5) * 0.18;
    // Fractional coordinates: `along` runs along the edge, `inshore` runs
    // from the shared edge into the water.
    const fracX = horizontal ? (edge.dx < 0 ? inshore : 1 - inshore) : along;
    const fracZ = horizontal ? along : (edge.dz < 0 ? inshore : 1 - inshore);
    const alongWorld = horizontal ? z + along : x + along;
    // Travel points at the land so the swell peaks at the waterline.
    const travel = 0.05;
    // Surface 'water' keeps surf inside the single animated water batch lane
    // (the browser water spec pins one animated batch) and gives foam the wet
    // low-roughness sheen.
    const part = makePart(
      entity,
      identity,
      `water-shore-surf-${edge.suffix}-${String(slot)}`,
      'water',
      VOXEL_COLORS.waterFoam,
      x + fracX,
      0.026,
      z + fracZ,
      horizontal ? depth : width,
      0.018,
      horizontal ? width : depth,
      { yaw },
    );
    parts.push({
      ...part,
      animation: {
        periodMs: SURF_PERIOD_MS,
        phaseRadians: alongWorld * 1.15 + hash01(x, z, salt + 6) * 0.5,
        translationAmplitude: {
          x: horizontal ? travel * edge.dx : 0,
          y: 0,
          z: horizontal ? 0 : travel * edge.dz,
        },
        rotationAmplitude: { x: 0, y: 0.02, z: 0 },
        // Fade: at the trough the segment collapses to a sliver of its
        // inshore depth and height — the lap dissolving into the water.
        scaleAmplitude: {
          x: horizontal ? 0.85 : 0,
          y: 0.8,
          z: horizontal ? 0 : 0.85,
        },
      },
    });
  }
  return parts;
}

export function waterDetailParts(
  entity: ProjectedEntityView,
  identity: string,
  x: number,
  z: number,
  terrainKinds: ReadonlyMap<string, TerrainKind>,
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  const noise = hash01(x, z, 79);
  const accent = hash01(x, z, 83);
  const yaw = (hash01(x, z, 89) - 0.5) * 0.72;
  // Pinned Voxel 0.1.4 has no texture or environment-map contract, and a
  // mixed terrain chunk has one material. Raised, sparse instances provide
  // standard-material highlights while the opaque chunk remains fallback.
  if (noise < 0.72) {
    parts.push(makePart(
      entity,
      identity,
      'water-ripple-dark',
      'water',
      VOXEL_COLORS.waterDark,
      x + 0.5,
      0.022,
      z + 0.5,
      0.54,
      0.018,
      0.034,
      { yaw },
    ));
  }
  if (noise < 0.34) {
    const crest = makePart(
      entity,
      identity,
      'water-ripple-crest',
      'water',
      VOXEL_COLORS.waterGlint,
      x + 0.5,
      0.041,
      z + 0.5,
      0.61,
      0.022,
      0.044,
      { yaw },
    );
    parts.push({
      ...crest,
      animation: {
        periodMs: 2_100 + Math.floor(hash01(x, z, 97) * 900),
        phaseRadians: hash01(x, z, 101) * Math.PI * 2,
        translationAmplitude: {
          x: Math.sin(yaw) * 0.022,
          y: 0.016,
          z: Math.cos(yaw) * 0.022,
        },
        rotationAmplitude: { x: 0.025, y: 0.04, z: 0.018 },
        scaleAmplitude: { x: 0.12, y: 0, z: 0.18 },
      },
    });
  }
  if (accent < 0.24) {
    parts.push(makePart(
      entity,
      identity,
      'water-reflection-sky',
      'water',
      VOXEL_COLORS.waterReflection,
      x + 0.5 + (accent - 0.12) * 1.2,
      0.034,
      z + 0.5 - (accent - 0.12) * 0.8,
      0.24,
      0.019,
      0.095,
      { yaw: -yaw * 0.62 },
    ));
  }
  for (const [edgeIndex, edge] of SHORE_EDGES.entries()) {
    const neighbour = terrainKinds.get(`${String(x + edge.dx)}:${String(z + edge.dz)}`);
    if (neighbour === undefined || neighbour === 'water') continue;
    parts.push(...surfParts(entity, identity, x, z, edge, edgeIndex));
  }
  return parts;
}
