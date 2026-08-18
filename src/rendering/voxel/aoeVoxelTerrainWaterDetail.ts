// Water-cell surface detail: dark ripples, animated wave crests, sky
// reflections, and the shoreline surf curve. Split out of aoeVoxelTerrain.ts
// (file-size budget) when the static straight foam bar was replaced.
//
// The surf is a CONNECTED meandering polyline, not independent dashes
// (user feedback 2026-08-17: "still looks discontinued"). Each shoreline
// edge samples a smooth offset curve and lays overlapping boxes along it;
// the curve's terminal offsets are hashed from the CORNER coordinates, so
// the two tiles sharing a corner agree and the line continues across tile
// boundaries, rounds concave (inner) corners by meeting its neighbour chain
// at the shared diagonal point, and pinches to the land point at convex
// (headland) corners.
import type { ProjectedEntityView, TerrainKind } from '../../game/simulation/types';
import { hash01, makePart, VOXEL_COLORS, type VoxelPart } from './aoeVoxelRecipeTypes';

// One shared lap rhythm; the phase varies with the along-coast world
// coordinate so the wave sweeps down the shoreline instead of blinking in
// unison. Per-segment periods would drift the sweep apart over time.
const SURF_PERIOD_MS = 2_800;
// Seven curve samples -> six overlapping boxes per edge.
const SURF_SAMPLES = 7;

type CornerCase = 'concave' | 'straight' | 'convex';

interface ShoreEdge {
  readonly suffix: 'north' | 'east' | 'south' | 'west';
  /** Direction from the water cell to the land cell across this edge. */
  readonly dx: number;
  readonly dz: number;
}

const SHORE_EDGES: readonly ShoreEdge[] = [
  { suffix: 'north', dx: 0, dz: -1 },
  { suffix: 'east', dx: 1, dz: 0 },
  { suffix: 'south', dx: 0, dz: 1 },
  { suffix: 'west', dx: -1, dz: 0 },
];

function isLand(kind: TerrainKind | undefined): boolean {
  return kind !== undefined && kind !== 'water';
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

interface SurfGeometry {
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly x: number;
  readonly z: number;
  readonly edge: ShoreEdge;
  readonly kindAt: (x: number, z: number) => TerrainKind | undefined;
}

/** How the coastline behaves at one end of an edge. `sEnd` is 0 or 1 along
 *  the edge direction. S = the next cell along the coast on the water side,
 *  D = the diagonal cell on the land side. */
function cornerCase(geometry: SurfGeometry, sEnd: 0 | 1): CornerCase {
  const { x, z, edge, kindAt } = geometry;
  const alongX = edge.dz !== 0 ? (sEnd === 1 ? 1 : -1) : 0;
  const alongZ = edge.dx !== 0 ? (sEnd === 1 ? 1 : -1) : 0;
  const side = kindAt(x + alongX, z + alongZ);
  if (isLand(side)) return 'concave';
  const diagonal = kindAt(x + alongX + edge.dx, z + alongZ + edge.dz);
  if (isLand(diagonal) || diagonal === undefined || side === undefined) return 'straight';
  return 'convex';
}

/** Integer world coordinates of the corner at one end of the edge — the
 *  same values from either adjoining tile, so hashes agree across tiles. */
function cornerCoordinates(geometry: SurfGeometry, sEnd: 0 | 1): { cx: number; cz: number } {
  const { x, z, edge } = geometry;
  if (edge.dz !== 0) {
    return { cx: x + sEnd, cz: edge.dz < 0 ? z : z + 1 };
  }
  return { cx: edge.dx < 0 ? x : x + 1, cz: z + sEnd };
}

function cornerHash(cx: number, cz: number): number {
  return 0.13 + hash01(cx, cz, 271) * 0.07;
}

/** World position of a curve sample: `s` runs along the edge, `offset` runs
 *  from the shared edge into the water. */
function samplePoint(
  geometry: SurfGeometry,
  s: number,
  offset: number,
): { px: number; pz: number } {
  const { x, z, edge } = geometry;
  if (edge.dz !== 0) {
    return { px: x + s, pz: edge.dz < 0 ? z + offset : z + 1 - offset };
  }
  return { px: edge.dx < 0 ? x + offset : x + 1 - offset, pz: z + s };
}

function surfParts(geometry: SurfGeometry): VoxelPart[] {
  const { identity, x, z, edge } = geometry;
  const edgeSalt = 131 + SHORE_EDGES.indexOf(edge) * 41;
  const startCase = cornerCase(geometry, 0);
  const endCase = cornerCase(geometry, 1);
  const startCorner = cornerCoordinates(geometry, 0);
  const endCorner = cornerCoordinates(geometry, 1);
  const offsetAt = (kase: CornerCase, cx: number, cz: number): number => (
    kase === 'convex' ? 0.04 : cornerHash(cx, cz)
  );
  const o0 = offsetAt(startCase, startCorner.cx, startCorner.cz);
  const o1 = offsetAt(endCase, endCorner.cx, endCorner.cz);
  // Concave ends pull the endpoint in along the edge too, so this chain and
  // the perpendicular neighbour chain meet at the shared diagonal point.
  const s0 = startCase === 'concave' ? o0 : 0.015;
  const s1 = endCase === 'concave' ? 1 - o1 : 0.985;
  // A quadratic through a hashed mid offset gives the curve its wander; a
  // minimum bend away from the endpoint average guarantees every edge
  // visibly curves even when the corner hashes land near the mid hash.
  const average = (o0 + o1) / 2;
  const rawMid = 0.13 + hash01(x, z, edgeSalt + 1) * 0.11;
  const bendSign = hash01(x, z, edgeSalt + 2) < 0.45 ? -1 : 1;
  const om = Math.abs(rawMid - average) < 0.035
    ? average + bendSign * (0.035 + hash01(x, z, edgeSalt + 3) * 0.02)
    : rawMid;
  const control = Math.min(0.3, Math.max(0.06, 2 * om - average));
  const offsets: number[] = [];
  const alongs: number[] = [];
  for (let index = 0; index < SURF_SAMPLES; index += 1) {
    const t = index / (SURF_SAMPLES - 1);
    let offset = (1 - t) ** 2 * o0 + 2 * t * (1 - t) * control + t ** 2 * o1;
    // Flatten toward each terminal offset so adjoining chains agree at the
    // corner within a box thickness, then clamp into the cell-safe band.
    const edgeDistance = Math.min(t, 1 - t);
    if (edgeDistance < 0.45) {
      const w = smooth(edgeDistance / 0.45);
      const anchor = t < 0.5 ? o0 : o1;
      offset = anchor + (offset - anchor) * w;
    }
    offsets.push(Math.min(0.26, Math.max(0.04, offset)));
    alongs.push(s0 + t * (s1 - s0));
  }
  const parts: VoxelPart[] = [];
  for (let index = 0; index < SURF_SAMPLES - 1; index += 1) {
    const alongMid = (alongs[index]! + alongs[index + 1]!) / 2;
    let offsetA = offsets[index]!;
    let offsetB = offsets[index + 1]!;
    const alongSpan = alongs[index + 1]! - alongs[index]!;
    const chord = Math.hypot(alongSpan, offsetB - offsetA);
    const length = chord * 1.3;
    // The middle of the lap washes hardest and carries the fattest band; the
    // pinned, thinning ends keep corner joints from tearing while adjoining
    // chains animate on different phase axes, and let the band wedge down
    // toward convex corner pinch points.
    const u = (alongMid - s0) / (s1 - s0);
    const arc = Math.sin(Math.PI * u);
    const bell = arc ** 1.6;
    const travel = 0.04 * bell;
    const thickness = (0.05 + hash01(x, z, edgeSalt + 20 + index) * 0.02)
      * (0.55 + 0.45 * arc);
    // Keep the tilted box inside the cell across every animation pose: its
    // reach toward the waterline includes the swollen thickness, the tilted
    // length (plus breathing and yaw wobble), and the lap travel. Lift both
    // samples outward when the curve dips closer than that.
    const tilt = Math.abs(offsetB - offsetA) / chord;
    const reach = (thickness / 2) * 1.7
      + (length / 2) * (tilt * 1.12 + 0.02)
      + travel
      + 0.01;
    const lift = Math.max(0, reach - Math.min(offsetA, offsetB));
    offsetA += lift;
    offsetB += lift;
    const offsetMid = (offsetA + offsetB) / 2;
    const from = samplePoint(geometry, alongs[index]!, offsetA);
    const to = samplePoint(geometry, alongs[index + 1]!, offsetB);
    const yaw = Math.atan2(-(to.pz - from.pz), to.px - from.px);
    // Clamp the box centre along the edge so the overlapping tips of the
    // terminal boxes (length exceeds the chord) never leave the cell.
    const halfAlong = (length / 2) * 1.12 + (thickness / 2) * 1.7 * tilt + 0.005;
    const alongClamped = Math.min(1.006 - halfAlong, Math.max(-0.006 + halfAlong, alongMid));
    const point = samplePoint(geometry, alongClamped, offsetMid);
    const alongWorld = edge.dz !== 0 ? x + alongMid : z + alongMid;
    const part = makePart(
      geometry.entity,
      identity,
      `water-shore-surf-${edge.suffix}-${String(index)}`,
      'water',
      VOXEL_COLORS.waterFoam,
      point.px,
      0.026,
      point.pz,
      length,
      0.018,
      thickness,
      { yaw },
    );
    parts.push({
      ...part,
      animation: {
        periodMs: SURF_PERIOD_MS,
        phaseRadians: alongWorld * 1.15 + hash01(x, z, edgeSalt + 30 + index) * 0.4,
        translationAmplitude: {
          x: travel * edge.dx,
          y: 0,
          z: travel * edge.dz,
        },
        rotationAmplitude: { x: 0, y: 0.015, z: 0 },
        // Fade: thickness and height collapse at the trough while length
        // barely breathes, so the line thins to a hairline but never breaks.
        scaleAmplitude: { x: 0.1, y: 0.55, z: 0.62 },
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
  const kindAt = (probeX: number, probeZ: number): TerrainKind | undefined => (
    terrainKinds.get(`${String(probeX)}:${String(probeZ)}`)
  );
  for (const edge of SHORE_EDGES) {
    if (!isLand(kindAt(x + edge.dx, z + edge.dz))) continue;
    parts.push(...surfParts({ entity, identity, x, z, edge, kindAt }));
  }
  return parts;
}
