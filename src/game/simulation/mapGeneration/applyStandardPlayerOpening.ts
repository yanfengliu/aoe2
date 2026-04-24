import type { Position } from 'civ-engine';

import type { ResourceKind } from '../types';
import type { PlayerStartSpec } from '../prototypeScenario';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createSpawnList, type SpawnList } from './spawnList';
import {
  distanceSquared,
  isAccessibleShorelineCell,
  isInBounds,
  orientationFor,
  paintDisc,
  projectOffset,
  seedToNumber,
  setTerrainKind,
  type Offset,
  type TerrainCellSpec,
} from './sharedTerrainHelpers';
import {
  createStartingScoutSpawn,
  SHORE_FISH_AMOUNT,
  STARTING_BERRIES,
  STARTING_BOARS,
  STARTING_GOLD,
  STARTING_SHEEP,
  STARTING_STONE,
  STARTING_VILLAGERS,
} from './startingOffsets';

export function createPlayerStarts(): PlayerStartSpec[] {
  return [
    { owner: 1, townCenter: { x: 8, y: 8 }, civilization: 'Britons' },
    { owner: 2, townCenter: { x: 48, y: 24 }, civilization: 'Franks' },
  ];
}

export function applyResourcePatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  kind: ResourceKind,
  amount: number,
  baseOwner: number,
  spawns: SpawnList,
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    if (!isInBounds(position.x, position.y)) {
      continue;
    }

    setTerrainKind(terrain, position.x, position.y, 'grass');
    spawns.addResourceSpawn({
      kind,
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount,
    });
  }
}

export function applyForestPatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  baseOwner: number,
  spawns: SpawnList,
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    setTerrainKind(terrain, position.x, position.y, 'forest');
    if (!isInBounds(position.x, position.y)) {
      continue;
    }
    spawns.addResourceSpawn({
      kind: 'tree',
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount: 100,
    });
  }
}

export function applyShoreFishPatches(
  terrain: TerrainCellSpec[][],
  starts: PlayerStartSpec[],
  seed: string,
  spawns: SpawnList,
): void {
  const candidates: Position[] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (!isAccessibleShorelineCell(terrain, x, y)) {
        continue;
      }
      if (starts.some((start) => distanceSquared(start.townCenter, { x, y }) <= 81)) {
        continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return;
  }

  const placed: Position[] = [];
  const targetCount = Math.min(14, Math.max(4, Math.floor(candidates.length / 12)));
  const startIndex = seedToNumber(seed) % candidates.length;
  const stride = Math.max(3, Math.floor(candidates.length / Math.max(targetCount, 1)));

  for (let attempt = 0; attempt < candidates.length && placed.length < targetCount; attempt += 1) {
    const candidate = candidates[(startIndex + attempt * stride) % candidates.length];
    if (placed.some((position) => distanceSquared(position, candidate) < 9)) {
      continue;
    }

    spawns.addResourceSpawn({
      kind: 'fish',
      x: candidate.x,
      y: candidate.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
    placed.push(candidate);
  }

  if (placed.length === 0) {
    const fallback = candidates[0];
    spawns.addResourceSpawn({
      kind: 'fish',
      x: fallback.x,
      y: fallback.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
  }
}

// Procedural variant of applyShoreFishPatches that uses the spawn list.
export function applyShoreFishPatchesProcedural(
  terrain: TerrainCellSpec[][],
  starts: PlayerStartSpec[],
  seed: string,
  spawns: SpawnList,
): void {
  const candidates: Position[] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (!isAccessibleShorelineCell(terrain, x, y)) {
        continue;
      }
      if (starts.some((start) => distanceSquared(start.townCenter, { x, y }) <= 81)) {
        continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return;
  }

  const placed: Position[] = [];
  const targetCount = Math.min(14, Math.max(4, Math.floor(candidates.length / 12)));
  const startIndex = seedToNumber(seed) % candidates.length;
  const stride = Math.max(3, Math.floor(candidates.length / Math.max(targetCount, 1)));

  for (let attempt = 0; attempt < candidates.length && placed.length < targetCount; attempt += 1) {
    const candidate = candidates[(startIndex + attempt * stride) % candidates.length];
    if (placed.some((position) => distanceSquared(position, candidate) < 9)) {
      continue;
    }
    spawns.addResourceSpawn({
      kind: 'fish',
      x: candidate.x,
      y: candidate.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
    placed.push(candidate);
  }

  if (placed.length === 0) {
    const fallback = candidates[0];
    spawns.addResourceSpawn({
      kind: 'fish',
      x: fallback.x,
      y: fallback.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
  }
}

// Slice 11: helper shared by the alternate maps. Re-uses the default
// starting-resource / villager / scout patches so each map has the same
// economic baseline as Arabia. Everything is placed via the existing
// projectOffset + applyResourcePatch + applyForestPatch helpers, so the
// offset tables stay the single source of truth.
export function applyStandardPlayerOpening(
  terrain: TerrainCellSpec[][],
  starts: PlayerStartSpec[],
  spawns: SpawnList,
  seed: string,
): void {
  for (const start of starts) {
    paintDisc(terrain, start.townCenter, 4, 'grass');

    spawns.addBuildingSpawn({
      kind: 'town-center',
      x: start.townCenter.x,
      y: start.townCenter.y,
      owner: start.owner,
      baseOwner: start.owner,
      vision: { playerId: start.owner, radius: 7 },
    });

    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_SHEEP,
      'sheep',
      100,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_BOARS,
      'boar',
      340,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_BERRIES,
      'berry-bush',
      125,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_GOLD,
      'gold-mine',
      800,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_STONE,
      'stone-mine',
      350,
      start.owner,
      spawns,
    );

    for (const offset of STARTING_VILLAGERS) {
      const position = projectOffset(start.townCenter, offset);
      spawns.addUnitSpawn({
        kind: 'villager',
        x: position.x,
        y: position.y,
        owner: start.owner,
        baseOwner: start.owner,
        vision: { playerId: start.owner, radius: 4 },
        requiresSafeSpawn: true,
      });
    }

    spawns.addUnitSpawn(createStartingScoutSpawn(start.owner, start.townCenter));
  }

  // Keep a hint of the seed in the output so two different seeds never
  // produce identical scenarios. The shoreline-fish helper already hashes
  // the seed; we call it with deterministic candidates so the alternate
  // maps vary slightly too.
  applyShoreFishPatches(terrain, starts, seed, spawns);
}

// Procedural variant of applyStandardPlayerOpening used by the default
// map. Lays down each starting-resource type at seed-derived cluster
// directions, then forest clusters, with first-write-wins dedupe via
// the spawn list. Guarantees the per-owner counts required by the
// prototypeScenario contract (sheep 4, boar 2, berry 6, gold 4, stone
// 4, tree 24) because a spiral-outward fallback backfills whenever the
// primary cluster position is blocked.
export function applyStandardPlayerOpeningProcedural(
  terrain: TerrainCellSpec[][],
  start: PlayerStartSpec,
  spawns: SpawnList,
  seed: string,
): void {
  paintDisc(terrain, start.townCenter, 4, 'grass');

  spawns.addBuildingSpawn({
    kind: 'town-center',
    x: start.townCenter.x,
    y: start.townCenter.y,
    owner: start.owner,
    baseOwner: start.owner,
    vision: { playerId: start.owner, radius: 7 },
  });

  const rng = createSeedPerBaseRng(seed, start.owner);

  const cellBlockedByScenarioEntity = (x: number, y: number): boolean => {
    // Block TC footprint (4x4 starting at TC anchor) plus a 1-cell
    // buffer around it. The buffer keeps a walkable corridor around the
    // TC so villagers and the scout can always path out of the base —
    // resource clusters packed tight against the TC would otherwise
    // wall it off, especially when the procedural directions happen to
    // fire resources directly alongside the TC.
    if (
      x >= start.townCenter.x - 1
      && x < start.townCenter.x + 5
      && y >= start.townCenter.y - 1
      && y < start.townCenter.y + 5
    ) {
      return true;
    }
    // Guaranteed cardinal exit corridors. The cluster walker places resources
    // continuously around rings; adjacent clusters' arcs can meet and form an
    // impassable wall around the villager cluster. Reserving four corridors
    // aligned with the villager and scout cluster (horizontal two-row corridor
    // covering the villager row and the row below, vertical two-column corridor
    // covering the TC centerline) keeps a walkable gap in every resource ring.
    // Each corridor extends 13 cells past the TC center — enough to clear the
    // outermost forest ring (ring 12) so no cluster can wall the base off.
    const corridorExtent = 13;
    const onHorizontalCorridor =
      (y === start.townCenter.y || y === start.townCenter.y + 1)
      && Math.abs(x - (start.townCenter.x + 1)) <= corridorExtent;
    const onVerticalCorridor =
      (x === start.townCenter.x + 1 || x === start.townCenter.x + 2)
      && Math.abs(y - (start.townCenter.y + 1)) <= corridorExtent;
    if (onHorizontalCorridor || onVerticalCorridor) {
      return true;
    }
    return spawns.isCellOccupiedByResource(x, y);
  };

  placeResourceCluster(
    terrain,
    start,
    'sheep',
    4,
    100,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 3, maxRing: 5, preferredAngle: 0 },
  );
  placeResourceCluster(
    terrain,
    start,
    'boar',
    2,
    340,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 4, maxRing: 6, preferredAngle: Math.PI * 1.75 },
  );
  placeResourceCluster(
    terrain,
    start,
    'berry-bush',
    6,
    125,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 3, maxRing: 4, preferredAngle: Math.PI },
  );
  placeResourceCluster(
    terrain,
    start,
    'gold-mine',
    4,
    800,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 5, maxRing: 6, preferredAngle: Math.PI * 0.25 },
  );
  placeResourceCluster(
    terrain,
    start,
    'stone-mine',
    4,
    350,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 5, maxRing: 6, preferredAngle: Math.PI * 0.5 },
  );

  placeForestCluster(
    terrain,
    start,
    24,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
  );

  const orientation = orientationFor(start.townCenter);
  const villagerOffsets: Offset[] = [
    { x: -2, y: 0 },
    { x: -2, y: 1 },
    { x: -1, y: 1 },
  ];
  for (const offset of villagerOffsets) {
    const position = {
      x: start.townCenter.x + offset.x * orientation.x,
      y: start.townCenter.y + offset.y * orientation.y,
    };
    spawns.addUnitSpawn({
      kind: 'villager',
      x: position.x,
      y: position.y,
      owner: start.owner,
      baseOwner: start.owner,
      vision: { playerId: start.owner, radius: 4 },
      requiresSafeSpawn: true,
    });
  }

  spawns.addUnitSpawn(createStartingScoutSpawn(start.owner, start.townCenter));
}

function createSeedPerBaseRng(seed: string, owner: number): () => number {
  let state = (seedToNumber(seed) ^ (owner * 2654435761)) >>> 0;
  if (state === 0) {
    state = 1;
  }
  return () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
}

interface ClusterOptions {
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

// Re-export createSpawnList so callers that need it don't have to add an
// extra import — keeps the fixture-facing surface tight.
export { createSpawnList };
