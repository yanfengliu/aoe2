// Scenario boot. The bridge enters one of two paths at startup:
//   (1) fresh start  → register component types, lay terrain, run the
//       scenario spawn loop, then validate that no two entities collide.
//   (2) load          → skip spawning (the deserialized world already has
//       every entity), then hydrate every side map from the saved blob.
// Both paths are pure mutators over the bridge's side maps + world; this
// module just bundles the long, sequential mutation lists so
// createSimulationBridge stays readable.

import type { EntityRef, Position, World } from 'civ-engine';
import type {
  AgeType,
  BuildableBuildingType,
  BuildingComponent,
  GathererComponent,
  MatchState,
  PlayerResources,
  ResearchableTechnologyType,
  ResourceComponent,
  ResourceKind,
  TerrainComponent,
  TrainableUnitType,
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
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from './pureHelpers';
import { updateSheepOwnership } from './visibility';
import type { AiPlan, DifficultyLevel } from '../ai';
import type {
  PrototypeScenario,
} from '../prototypeScenario';
import type { SaveBlob } from '../saveSchema';
import type { UnitCommand } from '../createSimulationBridge';
import type { MemoryEntry } from './memoryTypes';

type CivWorld = World<GameEvents, GameCommands>;

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
    state,
    ensureAiState,
  } = deps;
  const {
    playerAges,
    playerCivilizations,
    researchedTechnologies,
    playerResources,
    population,
    villagerOrdinals,
    wonderCountdownOverrides,
    relicCountdownOverrides,
  } = state;

  for (const start of scenario.starts) {
    playerAges.set(start.owner, start.startingAge ?? 'dark-age');
    playerCivilizations.set(
      start.owner,
      start.civilization ?? defaultCivilizationName(start.owner),
    );
    researchedTechnologies.set(
      start.owner,
      new Set(start.startingResearchedTechnologies ?? []),
    );
    playerResources.set(
      start.owner,
      cloneResources(start.startingResources ?? standardStartingResources),
    );
    population.set(start.owner, {
      current: 0,
      cap: standardPopulationCap,
    });
    villagerOrdinals.set(start.owner, 0);
    if (typeof start.wonderCountdownOverrideTicks === 'number') {
      wonderCountdownOverrides.set(
        start.owner,
        Math.max(1, start.wonderCountdownOverrideTicks),
      );
    }
    if (typeof start.relicCountdownOverrideTicks === 'number') {
      relicCountdownOverrides.set(
        start.owner,
        Math.max(1, start.relicCountdownOverrideTicks),
      );
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
    state,
  } = deps;
  const { buildingHealthStates, combatStates, relicsInMonastery } = state;

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
        const healthState = buildingHealthStates.get(buildingId);
        if (healthState) {
          healthState.currentHp = Math.max(1, Math.min(healthState.maxHp, spawn.startHp));
        }
      }
      if (typeof spawn.startingRelicsInMonastery === 'number' && spawn.kind === 'monastery') {
        relicsInMonastery.set(buildingId, Math.max(0, spawn.startingRelicsInMonastery));
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
        const combat = combatStates.get(unitId);
        if (combat) {
          combat.currentHp = Math.max(1, Math.min(combat.maxHp, spawn.startHp));
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

export interface SaveLoadHydrationDeps {
  world: GameWorld;
  savedGame: SaveBlob;
  matchState: MatchState;
  state: import('./bridgeState').BridgeState;
  setUnitCommand: (id: number, command: UnitCommand) => void;
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
}

export function hydrateFromSavedGame(deps: SaveLoadHydrationDeps): void {
  const { world, savedGame, matchState, state, setUnitCommand, inFlightTechSetFor } = deps;
  const {
    trackedVisibilitySources,
    playerAges,
    playerCivilizations,
    researchedTechnologies,
    playerResources,
    marketExchangeRates,
    population,
    townCenterRefs,
    villagerOrdinals,
    sheepMoveOrders,
    rallyPoints,
    monkTasks,
    conversionState,
    monkCarriedRelic,
    monkHealCounters,
    relicsInMonastery,
    wonderCountdowns,
    wonderCountdownOverrides,
    relicCountdowns,
    relicCountdownOverrides,
    playerScoreCounters,
    trebuchetPackStates,
    lastSeenStatic,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
    garrisonedUnitVisionSources,
    productionQueues,
    constructionStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    wildlifeStates,
    aiStates,
    unitCommands,
  } = state;

  const blob = savedGame.sideMaps;
  const refFromSerialized = (s: { id: number; generation: number }): EntityRef | null => {
    const ref = world.getEntityRef(s.id);
    if (!ref || ref.generation !== s.generation) return null;
    return ref;
  };

  for (const [k, v] of blob.trackedVisibilitySources) {
    trackedVisibilitySources.set(k, v);
  }
  for (const [owner, age] of blob.playerAges) {
    playerAges.set(owner, age as AgeType);
  }
  for (const [owner, civ] of blob.playerCivilizations) {
    playerCivilizations.set(owner, civ);
  }
  for (const [owner, techs] of blob.researchedTechnologies) {
    researchedTechnologies.set(owner, new Set(techs as ResearchableTechnologyType[]));
  }
  for (const [owner, res] of blob.playerResources) {
    playerResources.set(owner, { ...res });
  }
  marketExchangeRates.food = blob.marketExchangeRates.food;
  marketExchangeRates.wood = blob.marketExchangeRates.wood;
  marketExchangeRates.stone = blob.marketExchangeRates.stone;
  for (const [owner, pop] of blob.population) {
    population.set(owner, { ...pop });
  }
  for (const [owner, refData] of blob.townCenterRefs) {
    const ref = refFromSerialized(refData);
    if (ref) townCenterRefs.set(owner, ref);
  }
  for (const [owner, ord] of blob.villagerOrdinals) {
    villagerOrdinals.set(owner, ord);
  }
  for (const [id, cmd] of blob.unitCommands) {
    const restored: UnitCommand = {
      type: cmd.type,
      target: { x: cmd.target.x, y: cmd.target.y },
    };
    if (cmd.targetEntityKind) {
      restored.targetEntityKind = cmd.targetEntityKind;
    }
    if (cmd.targetEntityRef) {
      const ref = refFromSerialized(cmd.targetEntityRef);
      if (ref) restored.targetEntityRef = ref;
    }
    if (cmd.buildingRef) {
      const ref = refFromSerialized(cmd.buildingRef);
      if (ref) restored.buildingRef = ref;
    }
    setUnitCommand(id, restored);
  }
  for (const [id, pos] of blob.sheepMoveOrders) {
    sheepMoveOrders.set(id, { x: pos.x, y: pos.y });
  }
  for (const [id, pos] of blob.rallyPoints) {
    rallyPoints.set(id, { x: pos.x, y: pos.y });
  }
  for (const [id, task] of blob.monkTasks) {
    const ref = refFromSerialized(task.targetEntityRef);
    if (ref) monkTasks.set(id, { kind: task.kind, targetEntityRef: ref });
  }
  for (const [id, state] of blob.conversionState) {
    conversionState.set(id, { byOwner: state.byOwner, progress: state.progress });
  }
  for (const [id, relicId] of blob.monkCarriedRelic) {
    monkCarriedRelic.set(id, relicId);
  }
  for (const [id, count] of blob.monkHealCounters) {
    monkHealCounters.set(id, count);
  }
  for (const [id, count] of blob.relicsInMonastery) {
    relicsInMonastery.set(id, count);
  }
  for (const [id, entry] of blob.wonderCountdowns) {
    wonderCountdowns.set(id, {
      remainingTicks: entry.remainingTicks,
      totalTicks: entry.totalTicks,
      lastCompletedTick: entry.lastCompletedTick ?? null,
    });
  }
  for (const [owner, ticks] of blob.wonderCountdownOverrides) {
    wonderCountdownOverrides.set(owner, ticks);
  }
  for (const [owner, entry] of blob.relicCountdowns) {
    relicCountdowns.set(owner, {
      remainingTicks: entry.remainingTicks,
      totalTicks: entry.totalTicks,
      lastCompletedTick: entry.lastCompletedTick ?? null,
    });
  }
  for (const [owner, ticks] of blob.relicCountdownOverrides) {
    relicCountdownOverrides.set(owner, ticks);
  }
  for (const [owner, counters] of blob.playerScoreCounters) {
    playerScoreCounters.set(owner, {
      unitsProduced: counters.unitsProduced,
      buildingsProduced: counters.buildingsProduced,
      resourcesGathered: counters.resourcesGathered,
      unitsKilled: counters.unitsKilled ?? 0,
      wonderCompleted: counters.wonderCompleted,
    });
  }
  for (const [id, state] of blob.trebuchetPackStates ?? []) {
    trebuchetPackStates.set(id, {
      packed: state.packed,
      transitionTicksRemaining: state.transitionTicksRemaining,
    });
  }
  for (const [playerId, innerEntries] of blob.lastSeenStatic) {
    const inner = new Map<number, MemoryEntry>();
    for (const [entityId, entry] of innerEntries) {
      inner.set(entityId, {
        kind: entry.kind,
        entityType: entry.entityType as MemoryEntry['entityType'],
        position: { x: entry.position.x, y: entry.position.y },
        footprintWidth: entry.footprintWidth,
        footprintHeight: entry.footprintHeight,
        tint: entry.tint,
        owner: entry.owner,
        size: entry.size,
        visualVariant: entry.visualVariant as MemoryEntry['visualVariant'],
        lastSeenTick: entry.lastSeenTick,
      });
    }
    lastSeenStatic.set(playerId, inner);
  }
  for (const [id, list] of blob.garrisonedByBuilding) {
    garrisonedByBuilding.set(id, [...list]);
  }
  for (const [id, buildingId] of blob.garrisonedUnitToBuilding) {
    garrisonedUnitToBuilding.set(id, buildingId);
  }
  for (const [id, src] of blob.garrisonedUnitVisionSources) {
    garrisonedUnitVisionSources.set(id, { playerId: src.playerId, radius: src.radius });
  }
  // Cross-reference invariant for the garrison maps (Iter-1 H-3).
  for (const [buildingId, list] of garrisonedByBuilding) {
    for (const unitId of list) {
      const reverse = garrisonedUnitToBuilding.get(unitId);
      if (reverse !== buildingId) {
        throw new Error(
          `Save invariant violated: garrison cross-reference mismatch for unit ${unitId} / building ${buildingId} (garrisonedUnitToBuilding=${reverse ?? 'absent'}).`,
        );
      }
    }
  }
  for (const [unitId, buildingId] of garrisonedUnitToBuilding) {
    const list = garrisonedByBuilding.get(buildingId);
    if (!list || !list.includes(unitId)) {
      throw new Error(
        `Save invariant violated: garrison cross-reference mismatch for unit ${unitId} / building ${buildingId} (not present in garrisonedByBuilding).`,
      );
    }
  }
  for (const [id, queue] of blob.productionQueues) {
    productionQueues.set(
      id,
      queue.map((entry) => ({
        kind: entry.kind,
        label: entry.label,
        ...(entry.unitType !== undefined ? { unitType: entry.unitType as TrainableUnitType } : {}),
        ...(entry.technologyType !== undefined
          ? { technologyType: entry.technologyType as ResearchableTechnologyType }
          : {}),
        remainingTicks: entry.remainingTicks,
        totalTicks: entry.totalTicks,
        isBlocked: entry.isBlocked,
      })),
    );
  }
  // Iter-3 V3-6: rebuild inFlightTechByOwner from the loaded queues.
  for (const [buildingId, queue] of productionQueues.entries()) {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) continue;
    for (const entry of queue) {
      if (entry.kind === 'technology' && entry.technologyType) {
        inFlightTechSetFor(building.owner).add(entry.technologyType);
      }
    }
  }
  for (const [id, state] of blob.constructionStates) {
    constructionStates.set(id, { ...state });
  }
  for (const [id, state] of blob.combatStates) {
    combatStates.set(id, { ...state });
  }
  for (const [id, state] of blob.buildingHealthStates) {
    buildingHealthStates.set(id, { ...state });
  }
  for (const [id, state] of blob.buildingCombatStates) {
    buildingCombatStates.set(id, { ...state });
  }
  for (const [owner, state] of blob.aiStates ?? []) {
    aiStates.set(owner, {
      difficulty: state.difficulty,
      plan: state.plan as AiPlan,
      villagerTargets: { ...state.villagerTargets },
      attackGroup: [...state.attackGroup],
      lastDecisionTick: state.lastDecisionTick,
      lastEnemySightingTick: state.lastEnemySightingTick,
      lastEnemySightingPosition: state.lastEnemySightingPosition
        ? { x: state.lastEnemySightingPosition.x, y: state.lastEnemySightingPosition.y }
        : null,
    });
  }
  for (const [id, state] of blob.wildlifeStates) {
    const ref = state.targetEntityRef ? refFromSerialized(state.targetEntityRef) : null;
    wildlifeStates.set(id, {
      currentHp: state.currentHp,
      maxHp: state.maxHp,
      attackDamage: state.attackDamage,
      attackRange: state.attackRange,
      reloadTicks: state.reloadTicks,
      cooldownTicks: state.cooldownTicks,
      armor: state.armor,
      autoAggro: state.autoAggro,
      isAlive: state.isAlive,
      corpsePersists: state.corpsePersists,
      aggroRange: state.aggroRange,
      targetEntityRef: ref,
    });
  }

  matchState.outcome = savedGame.matchState.outcome;
  matchState.summary = savedGame.matchState.summary;
  matchState.winCondition = savedGame.matchState.winCondition;
  matchState.scores = savedGame.matchState.scores
    ? { ...savedGame.matchState.scores }
    : null;
  matchState.wonderCountdownTicks = savedGame.matchState.wonderCountdownTicks;
  matchState.relicCountdownTicks = savedGame.matchState.relicCountdownTicks;

  // Iter-3 V3-8: orphan-key prune across every entity-id-keyed side map.
  const pruneOrphanEntityKeys = (sideMap: Map<number, unknown>): void => {
    for (const id of [...sideMap.keys()]) {
      if (!world.getEntityRef(id)) {
        sideMap.delete(id);
      }
    }
  };
  pruneOrphanEntityKeys(unitCommands);
  pruneOrphanEntityKeys(sheepMoveOrders);
  pruneOrphanEntityKeys(rallyPoints);
  pruneOrphanEntityKeys(monkTasks);
  pruneOrphanEntityKeys(conversionState);
  pruneOrphanEntityKeys(monkCarriedRelic);
  pruneOrphanEntityKeys(monkHealCounters);
  pruneOrphanEntityKeys(relicsInMonastery);
  pruneOrphanEntityKeys(wonderCountdowns);
  pruneOrphanEntityKeys(trebuchetPackStates);
  pruneOrphanEntityKeys(productionQueues);
  pruneOrphanEntityKeys(constructionStates);
  pruneOrphanEntityKeys(combatStates);
  pruneOrphanEntityKeys(buildingHealthStates);
  pruneOrphanEntityKeys(buildingCombatStates);
  pruneOrphanEntityKeys(wildlifeStates);
  pruneOrphanEntityKeys(garrisonedUnitVisionSources);
  pruneOrphanEntityKeys(garrisonedByBuilding);
  pruneOrphanEntityKeys(garrisonedUnitToBuilding);
}
