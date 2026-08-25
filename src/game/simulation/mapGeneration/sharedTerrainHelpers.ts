import {
  createNoise2D,
  octaveNoise2D,
  type Position,
} from 'civ-engine';

import type { TerrainComponent, TerrainKind } from '../types';
import { type MapSize, sizeOfTerrain } from './constants';

export interface TerrainCellSpec extends TerrainComponent {
  x: number;
  y: number;
}

export interface Offset {
  x: number;
  y: number;
}

export function seedToNumber(seed: string): number {
  let hash = 0;
  // Iter-3 V3-14: walk full Unicode code points so non-BMP characters
  // (e.g. emoji in user-supplied seeds) hash by their full codepoint
  // rather than the UTF-16 high surrogate alone. The previous
  // `character.charCodeAt(0)` loop returned the high surrogate for
  // every surrogate-pair character, collapsing distinct emoji to the
  // same hash value.
  for (const character of seed) {
    const codePoint = character.codePointAt(0) ?? 0;
    hash = (hash * 31 + codePoint) >>> 0;
  }
  return hash || 1;
}

export function createTerrainCell(x: number, y: number, kind: TerrainKind): TerrainCellSpec {
  return {
    x,
    y,
    kind,
    buildable: kind !== 'water' && kind !== 'forest',
    elevation: kind === 'hill' ? 1 : 0,
  };
}

// The map is no longer one size (§4's ladder grows it with the player count),
// so bounds are a property of the world being built rather than a constant.
// Where a terrain grid is already in hand it IS the answer — `sizeOfTerrain`
// reads it — and everywhere else the size is passed, which is deliberately not
// defaulted so the typechecker names every call site that has to decide.
export function isInBounds(x: number, y: number, size: MapSize): boolean {
  return x >= 0 && x < size.width && y >= 0 && y < size.height;
}

export function setTerrainKind(
  terrain: TerrainCellSpec[][],
  x: number,
  y: number,
  kind: TerrainKind,
): void {
  if (!isInBounds(x, y, sizeOfTerrain(terrain))) {
    return;
  }
  terrain[y][x] = createTerrainCell(x, y, kind);
}

export function paintDisc(
  terrain: TerrainCellSpec[][],
  center: Position,
  radius: number,
  kind: TerrainKind,
): void {
  const radiusSq = radius * radius;
  const size = sizeOfTerrain(terrain);

  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (!isInBounds(x, y, size)) {
        continue;
      }

      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy <= radiusSq) {
        setTerrainKind(terrain, x, y, kind);
      }
    }
  }
}

export function distanceSquared(left: Position, right: Position): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

// Which way a player's opening faces: resources are laid out away from the
// nearest corner, so the sign depends on which half of THIS map the town
// centre sits in.
export function orientationFor(center: Position, size: MapSize): { x: 1 | -1; y: 1 | -1 } {
  return {
    x: center.x < size.width / 2 ? 1 : -1,
    y: center.y < size.height / 2 ? 1 : -1,
  };
}

export function projectOffset(center: Position, offset: Offset, size: MapSize): Position {
  const orientation = orientationFor(center, size);
  return {
    x: center.x + offset.x * orientation.x,
    y: center.y + offset.y * orientation.y,
  };
}

export function createBaseTerrain(seed: string, size: MapSize): TerrainCellSpec[][] {
  const noise2d = createNoise2D(seedToNumber(seed));
  const terrain: TerrainCellSpec[][] = [];

  // The noise is sampled in WORLD coordinates, so a bigger map is more of the
  // same landscape rather than the same landscape stretched — the two-player
  // map's top-left 60x36 is identical on every rung of the ladder.
  for (let y = 0; y < size.height; y += 1) {
    const row: TerrainCellSpec[] = [];
    for (let x = 0; x < size.width; x += 1) {
      const noise = octaveNoise2D(noise2d, x * 0.12, y * 0.12, 3);
      const kind =
        noise < -0.28
          ? 'water'
          : noise > 0.42
            ? 'forest'
            : noise > 0.18
              ? 'hill'
              : 'grass';
      row.push(createTerrainCell(x, y, kind));
    }
    terrain.push(row);
  }

  return terrain;
}

export function isAccessibleShorelineCell(
  terrain: TerrainCellSpec[][],
  x: number,
  y: number,
): boolean {
  const size = sizeOfTerrain(terrain);
  if (!isInBounds(x, y, size) || terrain[y][x]?.kind !== 'water') {
    return false;
  }

  const orthogonalOffsets: Offset[] = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];

  return orthogonalOffsets.some((offset) => {
    const shoreX = x + offset.x;
    const shoreY = y + offset.y;
    if (!isInBounds(shoreX, shoreY, size)) {
      return false;
    }
    const shorelineCell = terrain[shoreY][shoreX];
    return shorelineCell.kind !== 'water' && shorelineCell.kind !== 'forest';
  });
}
