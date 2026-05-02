import type { ResourceKind } from '../../types';
import type { PlayerStartSpec } from '../../prototypeScenario';
import { type SpawnList } from '../spawnList';
import {
  isInBounds,
  setTerrainKind,
  type TerrainCellSpec,
} from '../sharedTerrainHelpers';

export interface ClusterOptions {
  minRing: number;
  maxRing: number;
  preferredAngle: number;
}

export function placeResourceCluster(
  terrain: TerrainCellSpec[][],
  start: PlayerStartSpec,
  kind: ResourceKind,
  count: number,
  amount: number,
  rng: () => number,
  isBlocked: (x: number, y: number) => boolean,
  spawns: SpawnList,
  options: ClusterOptions,
): void {
  // Perturb the preferred angle deterministically so different seeds
  // don't always put the sheep due east. Within +/- 45 degrees of the
  // preferred direction.
  const angleJitter = (rng() - 0.5) * (Math.PI / 2);
  const angle = options.preferredAngle + angleJitter;

  let placed = 0;
  const tried = new Set<string>();
  for (let ring = options.minRing; ring <= options.maxRing + 6 && placed < count; ring += 1) {
    // Walk around the ring starting from the chosen angle.
    const perimeter = Math.max(8, Math.floor(2 * Math.PI * ring));
    for (let step = 0; step < perimeter && placed < count; step += 1) {
      const theta = angle + (step * 2 * Math.PI) / perimeter;
      const x = Math.round(start.townCenter.x + Math.cos(theta) * ring);
      const y = Math.round(start.townCenter.y + Math.sin(theta) * ring);
      const key = `${x},${y}`;
      if (tried.has(key)) {
        continue;
      }
      tried.add(key);
      if (!isInBounds(x, y)) {
        continue;
      }
      if (isBlocked(x, y)) {
        continue;
      }
      setTerrainKind(terrain, x, y, 'grass');
      const result = spawns.addResourceSpawn({
        kind,
        x,
        y,
        owner: null,
        baseOwner: start.owner,
        amount,
      });
      if (result.accepted) {
        placed += 1;
      }
    }
  }

  if (placed < count) {
    throw new Error(
      `createDefaultMap: only placed ${placed}/${count} ${kind} near owner ${start.owner} TC (${start.townCenter.x},${start.townCenter.y}).`,
    );
  }
}

export function placeForestCluster(
  terrain: TerrainCellSpec[][],
  start: PlayerStartSpec,
  count: number,
  rng: () => number,
  isBlocked: (x: number, y: number) => boolean,
  spawns: SpawnList,
): void {
  // Forest clusters live farther out than starting resources (ring 7+)
  // so they rarely conflict. Spread across three seed-perturbed
  // directions to keep the starting map feeling similar to the pre-
  // procedural layout.
  let placed = 0;
  const directions = [
    Math.PI * 0.75 + rng() * 0.4,
    Math.PI * 1.25 + rng() * 0.4,
    Math.PI * 1.75 + rng() * 0.4,
  ];

  for (const baseAngle of directions) {
    if (placed >= count) {
      break;
    }
    for (let ring = 6; ring <= 12 && placed < count; ring += 1) {
      const perimeter = Math.max(10, Math.floor(2 * Math.PI * ring));
      for (let step = -4; step <= 4 && placed < count; step += 1) {
        const theta = baseAngle + (step * 2 * Math.PI) / perimeter;
        const x = Math.round(start.townCenter.x + Math.cos(theta) * ring);
        const y = Math.round(start.townCenter.y + Math.sin(theta) * ring);
        if (!isInBounds(x, y)) {
          continue;
        }
        if (isBlocked(x, y)) {
          continue;
        }
        setTerrainKind(terrain, x, y, 'forest');
        const result = spawns.addResourceSpawn({
          kind: 'tree',
          x,
          y,
          owner: null,
          baseOwner: start.owner,
          amount: 100,
        });
        if (result.accepted) {
          placed += 1;
        }
      }
    }
  }

  if (placed < count) {
    throw new Error(
      `createDefaultMap: only placed ${placed}/${count} trees near owner ${start.owner} TC (${start.townCenter.x},${start.townCenter.y}).`,
    );
  }
}

