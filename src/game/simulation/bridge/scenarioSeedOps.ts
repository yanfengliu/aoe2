// Scenario boot. The bridge enters one of two paths at startup:
//   (1) fresh start  → register component types, lay terrain, run the
//       scenario spawn loop, then validate that no two entities collide.
//   (2) load          → skip spawning (the deserialized world already has
//       every entity), then hydrate every side map from the saved blob.
// Both paths are pure mutators over the bridge's side maps + world; this
// module just bundles the long, sequential mutation lists so
// createSimulationBridge stays readable.

import type { Position } from 'civ-engine';
import type {
  BuildableBuildingType,
  BuildingComponent,
  GathererComponent,
  PlayerResources,
  ResourceComponent,
  ResourceKind,
  TerrainComponent,
  UnitComponent,
  UnitTransformComponent,
  UnitType,
  VelocityComponent,
  VisionSourceComponent,
  WanderBoundsComponent,
} from '../types';
import {
  buildingFootprint,
  cloneResources,
  defaultCivilizationName,
  type GameWorld,
} from './pureHelpers';
import { updateSheepOwnership } from './visibility';
import {
  playerAgesCodec,
  playerCivilizationsCodec,
  buildingHealthStatesCodec,
  combatStatesCodec,
  playerResourcesCodec,
  populationCodec,
  relicCountdownOverridesCodec,
  researchedTechnologiesCodec,
  relicsInMonasteryCodec,
  villagerOrdinalsCodec,
  wonderCountdownOverridesCodec,
} from './bridgeStateSerialize';
import type { DifficultyLevel } from '../ai';
import type {
  PrototypeScenario,
} from '../prototypeScenario';

type CivWorld = GameWorld;

export interface ScenarioSeedDeps {
  world: GameWorld;
  scenario: PrototypeScenario;
  tiles: number[][];
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  standardStartingResources: PlayerResources;
  standardPopulationCap: number;
  defaultDifficulty: DifficultyLevel;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — bridge-state migration. Slots that have moved to
  // `world.state.aoe2.*` flow through the accessor.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  // Helper closures.
  ensureAiState: (owner: number, difficulty: DifficultyLevel) => void;
  addBuildingEntity: (
    owner: number,
    buildingType: BuildableBuildingType,
    position: Position,
    isComplete: boolean,
    vision?: VisionSourceComponent,
  ) => number;
  addUnitEntity: (
    owner: number,
    unitType: UnitType,
    position: Position,
    vision?: VisionSourceComponent,
  ) => number;
  addResourceEntity: (
    resourceType: ResourceKind,
    position: Position,
    amount: number,
    baseOwner: number | null,
  ) => number;
  findScenarioSpawnPosition: (origin: Position) => Position | null;
  buildingOccupiesCell: (
    buildingId: number,
    x: number,
    y: number,
    activeWorld?: CivWorld,
  ) => boolean;
  isTerrainPassableForUnit: (x: number, y: number, activeWorld?: CivWorld) => boolean;
  isCellBlockedByBuilding: (x: number, y: number) => boolean;
}

export function registerComponentTypes(world: GameWorld): void {
  world.registerComponent<Position>('position');
  world.registerComponent<TerrainComponent>('terrain');
  world.registerComponent<import('../types').RenderableComponent>('renderable');
  world.registerComponent<UnitComponent>('unit');
  world.registerComponent<UnitTransformComponent>('unitTransform');
  world.registerComponent<BuildingComponent>('building');
  world.registerComponent<ResourceComponent>('resource');
  world.registerComponent<GathererComponent>('gatherer');
  world.registerComponent<VelocityComponent>('velocity');
  world.registerComponent<VisionSourceComponent>('visionSource');
  world.registerComponent<WanderBoundsComponent>('wanderBounds');
}

export function seedPlayerStarts(deps: ScenarioSeedDeps): void {
  const {
    scenario,
    humanPlayerId,
    standardStartingResources,
    standardPopulationCap,
    defaultDifficulty,
    accessor,
    ensureAiState,
  } = deps;

  // Phase 2D — batch the per-player Map writes into single mutate calls
  // to mirror hydrateFromSavedGame's pattern. Functionally identical to
  // calling mutate per-player (BridgeStateAccessor's _dirty.add is
  // idempotent), but stylistically consistent so future heavier-weight
  // mutate semantics (per-call invariant checks) won't surprise this
  // call site.
  accessor.mutate(playerAgesCodec, (m) => {
    for (const start of scenario.starts) {
      m.set(start.owner, start.startingAge ?? 'dark-age');
    }
  });
  accessor.mutate(playerCivilizationsCodec, (m) => {
    for (const start of scenario.starts) {
      m.set(start.owner, start.civilization ?? defaultCivilizationName(start.owner));
    }
  });
  accessor.mutate(playerResourcesCodec, (m) => {
    for (const start of scenario.starts) {
      m.set(
        start.owner,
        cloneResources(start.startingResources ?? standardStartingResources),
      );
    }
  });
  for (const start of scenario.starts) {
    accessor.mutate(researchedTechnologiesCodec, (m) =>
      m.set(start.owner, new Set(start.startingResearchedTechnologies ?? [])),
    );
    accessor.mutate(populationCodec, (m) =>
      m.set(start.owner, {
        current: 0,
        cap: standardPopulationCap,
      }),
    );
    // Phase 2D — villagerOrdinals routes through the accessor.
    accessor.mutate(villagerOrdinalsCodec, (m) => m.set(start.owner, 0));
    if (typeof start.wonderCountdownOverrideTicks === 'number') {
      const ticks = Math.max(1, start.wonderCountdownOverrideTicks);
      accessor.mutate(wonderCountdownOverridesCodec, (m) => m.set(start.owner, ticks));
    }
    if (typeof start.relicCountdownOverrideTicks === 'number') {
      const ticks = Math.max(1, start.relicCountdownOverrideTicks);
      accessor.mutate(relicCountdownOverridesCodec, (m) => m.set(start.owner, ticks));
    }
    if (start.owner !== humanPlayerId && !start.disableAi) {
      ensureAiState(start.owner, start.difficulty ?? defaultDifficulty);
    }
  }
}

export function seedTerrain(deps: ScenarioSeedDeps): void {
  const { scenario, tiles, world } = deps;

  for (const row of scenario.terrain) {
    for (const cell of row) {
      const tile = tiles[cell.y][cell.x];
      const tintByKind: Record<TerrainComponent['kind'], number> = {
        grass: 0x587f4e,
        forest: 0x2f5e34,
        water: 0x295a75,
        hill: 0x8c7d5a,
      };

      world.addComponent(tile, 'terrain', {
        kind: cell.kind,
        buildable: cell.buildable,
        elevation: cell.elevation,
      });
      world.addComponent(tile, 'renderable', {
        kind: 'tile',
        layer: 'terrain',
        tint: tintByKind[cell.kind],
        size: 1,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
      });
    }
  }
}

const BUILDING_KINDS = new Set<string>([
  'town-center',
  'house',
  'mill',
  'lumber-camp',
  'mining-camp',
  'barracks',
  'watch-tower',
  'stable',
  'archery-range',
  'blacksmith',
  'market',
  'siege-workshop',
  'monastery',
  'castle',
  'wonder',
  'stone-wall',
  'palisade-wall',
]);

const UNIT_KINDS = new Set<string>([
  'villager',
  'scout',
  'militia',
  'spearman',
  'archer',
  'skirmisher',
  'knight',
  'crossbowman',
  'pikeman',
  'light-cavalry',
  'camel',
  'cavalry-archer',
  'mangonel',
  'scorpion',
  'battering-ram',
  'monk',
  'longbowman',
  'arbalest',
  'halberdier',
  'hussar',
  'heavy-cavalry-archer',
  'cavalier',
  'champion',
  'elite-longbowman',
  'onager',
  'heavy-scorpion',
  'siege-ram',
  'bombard-cannon',
  'trebuchet',
  'man-at-arms',
  'long-swordsman',
  'two-handed-swordsman',
  'paladin',
  'heavy-camel',
]);

export function seedFreshScenario(deps: ScenarioSeedDeps): void {
  seedPlayerStarts(deps);
  seedTerrain(deps);
  seedScenarioEntities(deps);
}

export function seedScenarioEntities(deps: ScenarioSeedDeps): void {
  const {
    world,
    scenario,
    humanPlayerId,
    addBuildingEntity,
    addUnitEntity,
    addResourceEntity,
    findScenarioSpawnPosition,
    accessor,
  } = deps;

  const overlapWhitelist = new Set<number>();
  for (const spawn of scenario.spawns) {
    if (BUILDING_KINDS.has(spawn.kind)) {
      const owner = spawn.owner ?? humanPlayerId;
      const buildingId = addBuildingEntity(
        owner,
        spawn.kind as BuildableBuildingType,
        { x: spawn.x, y: spawn.y },
        true,
        spawn.vision,
      );
      if (typeof spawn.startHp === 'number') {
        const healthState = accessor.get(buildingHealthStatesCodec).get(buildingId);
        if (healthState) {
          healthState.currentHp = Math.max(1, Math.min(healthState.maxHp, spawn.startHp));
          accessor.markDirty(buildingHealthStatesCodec);
        }
      }
      if (typeof spawn.startingRelicsInMonastery === 'number' && spawn.kind === 'monastery') {
        accessor.mutate(relicsInMonasteryCodec, (m) =>
          m.set(buildingId, Math.max(0, spawn.startingRelicsInMonastery!)),
        );
      }
      if (spawn.allowOverlappingSpawn) {
        overlapWhitelist.add(buildingId);
      }
      continue;
    }

    if (UNIT_KINDS.has(spawn.kind)) {
      const owner = spawn.owner ?? humanPlayerId;
      const spawnPosition = spawn.requiresSafeSpawn
        ? findScenarioSpawnPosition({ x: spawn.x, y: spawn.y })
        : { x: spawn.x, y: spawn.y };
      if (!spawnPosition) {
        throw new Error(
          `Expected a safe spawn position for initial ${spawn.kind} at ${spawn.x},${spawn.y}.`,
        );
      }

      const unitId = addUnitEntity(owner, spawn.kind as UnitType, spawnPosition, spawn.vision);
      if (spawn.velocity) {
        world.addComponent(unitId, 'velocity', spawn.velocity);
      }
      if (spawn.wanderBounds) {
        world.addComponent(unitId, 'wanderBounds', spawn.wanderBounds);
      }
      if (typeof spawn.startHp === 'number') {
        const combat = accessor.get(combatStatesCodec).get(unitId);
        if (combat) {
          combat.currentHp = Math.max(1, Math.min(combat.maxHp, spawn.startHp));
          accessor.markDirty(combatStatesCodec);
        }
      }
      if (spawn.allowOverlappingSpawn) {
        overlapWhitelist.add(unitId);
      }
      continue;
    }

    const resourceId = addResourceEntity(
      spawn.kind as ResourceKind,
      { x: spawn.x, y: spawn.y },
      spawn.amount ?? 0,
      spawn.baseOwner,
    );
    if (spawn.allowOverlappingSpawn) {
      overlapWhitelist.add(resourceId);
    }
  }

  updateSheepOwnership(world);
  validateScenarioSpawns(deps, overlapWhitelist);
}

function validateScenarioSpawns(
  deps: ScenarioSeedDeps,
  overlapWhitelist: Set<number>,
): void {
  const {
    world,
    scenario,
    mapWidth,
    mapHeight,
    buildingOccupiesCell,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
  } = deps;

  for (const buildingId of world.query('building', 'position')) {
    const position = world.getComponent<Position>(buildingId, 'position');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !building) continue;
    const footprint = buildingFootprint(building.buildingType);
    for (let offsetY = 0; offsetY < footprint.height; offsetY += 1) {
      for (let offsetX = 0; offsetX < footprint.width; offsetX += 1) {
        const cellX = position.x + offsetX;
        const cellY = position.y + offsetY;
        if (cellX < 0 || cellX >= mapWidth || cellY < 0 || cellY >= mapHeight) {
          throw new Error(
            `Scenario '${scenario.seed}': ${building.buildingType} anchored at (${position.x},${position.y}) extends past map bounds at cell (${cellX},${cellY}).`,
          );
        }
        if (overlapWhitelist.has(buildingId)) continue;
        for (const otherId of world.query('building', 'position')) {
          if (otherId === buildingId || overlapWhitelist.has(otherId)) continue;
          if (buildingOccupiesCell(otherId, cellX, cellY)) {
            const otherBuilding = world.getComponent<BuildingComponent>(otherId, 'building');
            throw new Error(
              `Scenario '${scenario.seed}': ${building.buildingType} at (${position.x},${position.y}) overlaps ${otherBuilding?.buildingType ?? 'another building'} at cell (${cellX},${cellY}).`,
            );
          }
        }
      }
    }
  }

  for (const unitId of world.query('unit', 'position')) {
    const position = world.getComponent<Position>(unitId, 'position');
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!position || !unit) continue;
    if (position.x < 0 || position.x >= mapWidth || position.y < 0 || position.y >= mapHeight) {
      throw new Error(
        `Scenario '${scenario.seed}': ${unit.unitType} (owner ${unit.owner}) spawns outside map bounds at (${position.x},${position.y}).`,
      );
    }
    if (!isTerrainPassableForUnit(position.x, position.y)) {
      throw new Error(
        `Scenario '${scenario.seed}': ${unit.unitType} (owner ${unit.owner}) spawns on impassable terrain at (${position.x},${position.y}).`,
      );
    }
    if (overlapWhitelist.has(unitId)) continue;
    if (isCellBlockedByBuilding(position.x, position.y)) {
      throw new Error(
        `Scenario '${scenario.seed}': ${unit.unitType} (owner ${unit.owner}) spawns inside a building footprint at (${position.x},${position.y}).`,
      );
    }
  }

  for (const resourceId of world.query('resource', 'position')) {
    const position = world.getComponent<Position>(resourceId, 'position');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    if (!position || !resource) continue;
    if (position.x < 0 || position.x >= mapWidth || position.y < 0 || position.y >= mapHeight) {
      throw new Error(
        `Scenario '${scenario.seed}': ${resource.resourceType} resource spawns outside map bounds at (${position.x},${position.y}).`,
      );
    }
    if (overlapWhitelist.has(resourceId)) continue;
    if (isCellBlockedByBuilding(position.x, position.y)) {
      throw new Error(
        `Scenario '${scenario.seed}': ${resource.resourceType} resource at (${position.x},${position.y}) overlaps a building footprint.`,
      );
    }
  }

  const resourceByCell = new Map<string, { id: number; kind: string }>();
  for (const resourceId of world.query('resource', 'position')) {
    if (overlapWhitelist.has(resourceId)) continue;
    const position = world.getComponent<Position>(resourceId, 'position');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    if (!position || !resource) continue;
    const key = `${position.x},${position.y}`;
    const existing = resourceByCell.get(key);
    if (existing) {
      throw new Error(
        `Scenario '${scenario.seed}': ${resource.resourceType} resource at (${position.x},${position.y}) overlaps ${existing.kind} at the same cell.`,
      );
    }
    resourceByCell.set(key, { id: resourceId, kind: resource.resourceType });
  }
}


export {
  hydrateFromSavedGame,
  type SaveLoadHydrationDeps,
} from './hydrateFromSavedGame';
