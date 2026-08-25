import type { PlayerStartSpec } from '../../prototypeScenario';
import { type SpawnList } from '../spawnList';
import {
  orientationFor,
  paintDisc,
  projectOffset,
  seedToNumber,
  type Offset,
  type TerrainCellSpec,
} from '../sharedTerrainHelpers';
import { sizeOfTerrain } from '../constants';
import {
  createStartingScoutSpawn,
  STARTING_BERRIES,
  STARTING_BOARS,
  STARTING_GOLD,
  STARTING_SHEEP,
  STARTING_STONE,
  STARTING_VILLAGERS,
} from '../startingOffsets';
import { applyResourcePatch, applyShoreFishPatches } from './patches';
import { placeForestCluster, placeResourceCluster } from './clusters';

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
      const position = projectOffset(start.townCenter, offset, sizeOfTerrain(terrain));
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

    spawns.addUnitSpawn(
      createStartingScoutSpawn(start.owner, start.townCenter, sizeOfTerrain(terrain)),
    );
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
  // Iter-3 V3-13: extra cells the cluster placer must NOT spawn into
  // (e.g. defaultMap's FORWARD_ENEMY_HOUSE_POSITION, FORWARD_ENEMY_SCOUT_POSITION,
  // DEFAULT_RELIC_POSITIONS). Without this, owner-2's forest cluster
  // walker could land a tree on the forward-house anchor, and the
  // bridge bootstrap validator would throw on the building/resource
  // overlap.
  reservedCells: ReadonlyArray<{ x: number; y: number }> = [],
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
    for (const reserved of reservedCells) {
      if (reserved.x === x && reserved.y === y) {
        return true;
      }
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

  const orientation = orientationFor(start.townCenter, sizeOfTerrain(terrain));
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

  spawns.addUnitSpawn(
    createStartingScoutSpawn(start.owner, start.townCenter, sizeOfTerrain(terrain)),
  );
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


