import {
  RenderAdapter,
  VisibilityMap,
  World,
  WorldDebugger,
  createTileGrid,
  type Position,
  type RenderProjector,
} from 'civ-engine';

import {
  DEFAULT_SEED,
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
  TPS,
  createPrototypeScenario,
} from './prototypeScenario';
import { RenderStore } from './renderStore';
import type {
  BuildableBuildingType,
  BuildingType,
  BuildingComponent,
  EconomyResourceKind,
  EconomyState,
  GathererComponent,
  HudState,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  ProjectedEntityView,
  ProjectedFrameView,
  RenderState,
  RenderableComponent,
  ResourceComponent,
  ResourceKind,
  SelectionState,
  TerrainComponent,
  UnitComponent,
  UnitTaskState,
  UnitType,
  VelocityComponent,
  VisionSourceComponent,
  WanderBoundsComponent,
} from './types';

type GameEvents = Record<string, never>;
type GameCommands = Record<string, never>;

export interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): RenderState;
  getHudState(): HudState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  selectEntityAtCell(x: number, y: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number): boolean;
  issueMoveCommand(x: number, y: number): boolean;
  queueTrainUnit(unitType: Extract<UnitType, 'villager'>): boolean;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
  confirmBuildingPlacement(x: number, y: number): boolean;
}

const STANDARD_STARTING_RESOURCES: PlayerResources = {
  food: 200,
  wood: 200,
  gold: 100,
  stone: 200,
};

const STANDARD_POPULATION_CAP = 5;
const VILLAGER_TRAIN_TIME_TICKS = 250;
const HOUSE_BUILD_TIME_TICKS = 120;
const DROPOFF_BUILD_TIME_TICKS = 180;

interface UnitCommand {
  type: 'move' | 'build';
  target: Position;
  buildingId?: number;
}

interface ConstructionState {
  isComplete: boolean;
  buildProgressTicks: number;
  totalBuildTicks: number;
  populationProvided: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toCellIndex(x: number, y: number): number {
  return y * MAP_WIDTH + x;
}

function cloneResources(resources: PlayerResources): PlayerResources {
  return {
    food: resources.food,
    wood: resources.wood,
    gold: resources.gold,
    stone: resources.stone,
  };
}

function resourceKindToEconomyResource(kind: ResourceKind): EconomyResourceKind {
  switch (kind) {
    case 'gold-mine':
      return 'gold';
    case 'stone-mine':
      return 'stone';
    case 'tree':
      return 'wood';
    case 'berry-bush':
    case 'boar':
    case 'sheep':
      return 'food';
  }
}

function gatherTicksFor(kind: ResourceKind): number {
  switch (kind) {
    case 'sheep':
    case 'berry-bush':
      return 4;
    case 'boar':
    case 'tree':
      return 5;
    case 'gold-mine':
    case 'stone-mine':
      return 6;
  }
}

function gatherAmountFor(kind: ResourceKind): number {
  switch (kind) {
    case 'sheep':
    case 'berry-bush':
    case 'tree':
      return 1;
    case 'boar':
      return 2;
    case 'gold-mine':
    case 'stone-mine':
      return 1;
  }
}

function stepToward(current: Position, target: Position): Position {
  if (current.x !== target.x) {
    return {
      x: current.x + Math.sign(target.x - current.x),
      y: current.y,
    };
  }

  if (current.y !== target.y) {
    return {
      x: current.x,
      y: current.y + Math.sign(target.y - current.y),
    };
  }

  return current;
}

function isAtTarget(current: Position, target: Position): boolean {
  return current.x === target.x && current.y === target.y;
}

function assignVillagerRole(owner: number, ordinal: number): EconomyResourceKind {
  if (ordinal === 0 || ordinal === 1) {
    return 'food';
  }
  if (ordinal === 2) {
    return 'wood';
  }
  if (ordinal === 3) {
    return 'gold';
  }
  return owner === HUMAN_PLAYER_ID ? 'food' : 'wood';
}

function isResourceCandidate(
  entry: {
    id: number;
    position: Position | undefined;
    resource: ResourceComponent | undefined;
  },
): entry is {
  id: number;
  position: Position;
  resource: ResourceComponent;
} {
  return Boolean(entry.position && entry.resource);
}

function isEconomyVillager(
  entry: {
    owner: number;
    task: UnitTaskState;
    desiredResource: GathererComponent['desiredResource'];
    carriedResource: GathererComponent['carriedResource'];
    carriedAmount: number;
  } | null,
): entry is {
  owner: number;
  task: UnitTaskState;
  desiredResource: GathererComponent['desiredResource'];
  carriedResource: GathererComponent['carriedResource'];
  carriedAmount: number;
} {
  return entry !== null;
}

function isEconomyResourceEntry(
  entry: {
    resourceType: ResourceKind;
    amount: number;
    maxAmount: number;
    baseOwner: number | null;
    x: number;
    y: number;
  } | null,
): entry is {
  resourceType: ResourceKind;
  amount: number;
  maxAmount: number;
  baseOwner: number | null;
  x: number;
  y: number;
} {
  return entry !== null;
}

function cloneQueue(queue: ProductionQueueEntry[]): ProductionQueueEntry[] {
  return queue.map((entry) => ({ ...entry }));
}

function manhattanDistance(left: Position, right: Position): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function buildingFootprint(buildingType: BuildingType): { width: number; height: number } {
  switch (buildingType) {
    case 'house':
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return { width: 2, height: 2 };
    case 'town-center':
      return { width: 1, height: 1 };
  }
}

function buildingPopulationProvided(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'house':
      return 5;
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
    case 'town-center':
      return 0;
  }
}

function buildingBuildTimeTicks(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'house':
      return HOUSE_BUILD_TIME_TICKS;
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return DROPOFF_BUILD_TIME_TICKS;
    case 'town-center':
      return 0;
  }
}

function buildingSize(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'house':
      return 1.1;
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return 1.15;
    case 'town-center':
      return 1.4;
  }
}

function buildingTint(
  buildingType: BuildingType,
  owner: number,
  isComplete: boolean,
): number {
  if (buildingType === 'house') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xc8a15e : 0x6d593d
      : isComplete ? 0xa66b6b : 0x6a4747;
  }

  if (buildingType === 'mill') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xb18f54 : 0x625033
      : isComplete ? 0x9e7161 : 0x654540;
  }

  if (buildingType === 'lumber-camp') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x6c9154 : 0x43573a
      : isComplete ? 0x826c63 : 0x564642;
  }

  if (buildingType === 'mining-camp') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x7f8f9f : 0x4c5661
      : isComplete ? 0x8a7582 : 0x5b4b54;
  }

  return owner === HUMAN_PLAYER_ID
    ? isComplete ? 0xd8b36c : 0x7d6545
    : isComplete ? 0xa15c5c : 0x674040;
}

function canDropOffAt(
  buildingType: BuildingType,
  resourceKind: EconomyResourceKind,
): boolean {
  switch (resourceKind) {
    case 'food':
      return buildingType === 'town-center' || buildingType === 'mill';
    case 'wood':
      return buildingType === 'town-center' || buildingType === 'lumber-camp';
    case 'gold':
    case 'stone':
      return buildingType === 'town-center' || buildingType === 'mining-camp';
  }
}

function canAfford(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): boolean {
  return (
    resources.food >= (cost.food ?? 0)
    && resources.wood >= (cost.wood ?? 0)
    && resources.gold >= (cost.gold ?? 0)
    && resources.stone >= (cost.stone ?? 0)
  );
}

function spendResources(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): void {
  resources.food -= cost.food ?? 0;
  resources.wood -= cost.wood ?? 0;
  resources.gold -= cost.gold ?? 0;
  resources.stone -= cost.stone ?? 0;
}

function trainingCost(unitType: Extract<UnitType, 'villager'>): Partial<PlayerResources> {
  switch (unitType) {
    case 'villager':
      return { food: 50 };
  }
}

function constructionCost(buildingType: BuildableBuildingType): Partial<PlayerResources> {
  switch (buildingType) {
    case 'house':
      return { wood: 25 };
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return { wood: 100 };
  }
}

function trainingTimeTicks(unitType: Extract<UnitType, 'villager'>): number {
  switch (unitType) {
    case 'villager':
      return VILLAGER_TRAIN_TIME_TICKS;
  }
}

function createProjector(
  visibility: VisibilityMap,
  playerId: number,
  seed: string,
  isSelected: (id: number) => boolean,
): RenderProjector<
  GameEvents,
  GameCommands,
  ProjectedEntityView,
  ProjectedFrameView
> {
  return {
    projectEntity(ref, world) {
      const position = world.getComponent<Position>(ref.id, 'position');
      const renderable = world.getComponent<RenderableComponent>(ref.id, 'renderable');
      if (!position || !renderable) {
        return null;
      }

      const terrain = world.getComponent<TerrainComponent>(ref.id, 'terrain');
      const unit = world.getComponent<UnitComponent>(ref.id, 'unit');
      const building = world.getComponent<BuildingComponent>(ref.id, 'building');
      const resource = world.getComponent<ResourceComponent>(ref.id, 'resource');

      let owner: number | null = null;
      let entityType: ProjectedEntityView['entityType'] = 'grass';

      if (terrain) {
        entityType = terrain.kind;
      }
      if (unit) {
        owner = unit.owner;
        entityType = unit.unitType;
      }
      if (building) {
        owner = building.owner;
        entityType = building.buildingType;
      }
      if (resource) {
        entityType = resource.resourceType;
      }

      if (
        renderable.kind !== 'tile' &&
        owner !== playerId &&
        !visibility.isVisible(playerId, position.x, position.y)
      ) {
        return null;
      }

      return {
        id: ref.id,
        kind: renderable.kind,
        layer: renderable.layer,
        entityType,
        owner,
        x: position.x,
        y: position.y,
        tint: renderable.tint,
        size: renderable.size,
        selected: isSelected(ref.id),
      };
    },
    projectFrame(world) {
      return {
        tick: world.tick,
        playerId,
        seed,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        visibleCells: visibility
          .getVisibleCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
        exploredCells: visibility
          .getExploredCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
      };
    },
  };
}

function syncVisibilitySources(
  world: World<GameEvents, GameCommands>,
  visibility: VisibilityMap,
  trackedSources: Map<number, number>,
): void {
  const activeSources = new Map<number, number>();

  for (const id of world.query('position', 'visionSource')) {
    const position = world.getComponent<Position>(id, 'position');
    const source = world.getComponent<VisionSourceComponent>(id, 'visionSource');
    if (!position || !source) {
      continue;
    }

    visibility.setSource(source.playerId, id, {
      x: position.x,
      y: position.y,
      radius: source.radius,
    });
    activeSources.set(id, source.playerId);
  }

  for (const [id, playerId] of trackedSources.entries()) {
    if (activeSources.has(id)) {
      continue;
    }
    visibility.removeSource(playerId, id);
    trackedSources.delete(id);
  }

  for (const [id, playerId] of activeSources.entries()) {
    trackedSources.set(id, playerId);
  }

  visibility.update();
}

function createWorld(seed: string, visibility: VisibilityMap): {
  world: World<GameEvents, GameCommands>;
  getEconomyState: () => EconomyState;
  getPopulationState: (playerId: number) => PopulationState;
  getPlayerResources: (playerId: number) => PlayerResources;
  getSelectionState: () => SelectionState;
  selectEntityAtCell: (x: number, y: number) => boolean;
  clearSelection: () => void;
  issueContextCommand: (x: number, y: number) => boolean;
  issueMoveCommand: (x: number, y: number) => boolean;
  queueTrainUnit: (unitType: Extract<UnitType, 'villager'>) => boolean;
  beginBuildingPlacement: (buildingType: BuildableBuildingType) => boolean;
  confirmBuildingPlacement: (x: number, y: number) => boolean;
  isSelected: (id: number) => boolean;
} {
  const world = new World<GameEvents, GameCommands>({
    gridWidth: MAP_WIDTH,
    gridHeight: MAP_HEIGHT,
    tps: TPS,
    seed,
  });

  const trackedVisibilitySources = new Map<number, number>();
  const playerResources = new Map<number, PlayerResources>();
  const population = new Map<number, PopulationState>();
  const townCenterIds = new Map<number, number>();
  const villagerOrdinals = new Map<number, number>();
  const unitCommands = new Map<number, UnitCommand>();
  const productionQueues = new Map<number, ProductionQueueEntry[]>();
  const constructionStates = new Map<number, ConstructionState>();
  let selectedEntityId: number | null = null;
  let placementMode: BuildableBuildingType | null = null;

  world.registerComponent<Position>('position');
  world.registerComponent<TerrainComponent>('terrain');
  world.registerComponent<RenderableComponent>('renderable');
  world.registerComponent<UnitComponent>('unit');
  world.registerComponent<BuildingComponent>('building');
  world.registerComponent<ResourceComponent>('resource');
  world.registerComponent<GathererComponent>('gatherer');
  world.registerComponent<VelocityComponent>('velocity');
  world.registerComponent<VisionSourceComponent>('visionSource');
  world.registerComponent<WanderBoundsComponent>('wanderBounds');

  const scenario = createPrototypeScenario(seed);
  const tiles = createTileGrid(world);

  for (const start of scenario.starts) {
    playerResources.set(start.owner, cloneResources(STANDARD_STARTING_RESOURCES));
    population.set(start.owner, {
      current: 0,
      cap: STANDARD_POPULATION_CAP,
    });
    villagerOrdinals.set(start.owner, 0);
  }

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
      });
    }
  }

  function addUnitEntity(
    owner: number,
    unitType: UnitType,
    position: Position,
    vision?: VisionSourceComponent,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);
    world.addComponent(entity, 'unit', {
      owner,
      unitType,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'unit',
      layer: 'unit',
      tint:
        unitType === 'villager'
          ? owner === HUMAN_PLAYER_ID
            ? 0xf3e2b7
            : 0xf0b8b8
          : owner === HUMAN_PLAYER_ID
            ? 0xead74a
            : 0xef7d57,
      size: unitType === 'villager' ? 0.45 : 0.55,
    });

    const populationState = population.get(owner);
    if (populationState) {
      populationState.current += 1;
    }

    if (unitType === 'villager') {
      const ordinal = villagerOrdinals.get(owner) ?? 0;
      villagerOrdinals.set(owner, ordinal + 1);
      world.addComponent(entity, 'gatherer', {
        desiredResource: assignVillagerRole(owner, ordinal),
        task: 'idle',
        targetResourceId: null,
        dropOffBuildingId: null,
        carriedResource: null,
        carriedAmount: 0,
        carryCapacity: 10,
        gatherProgressTicks: 0,
      });
    }

    if (vision) {
      world.addComponent(entity, 'visionSource', vision);
    }

    return entity;
  }

  function addBuildingEntity(
    owner: number,
    buildingType: BuildingType,
    position: Position,
    isComplete: boolean,
    vision?: VisionSourceComponent,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);
    world.addComponent(entity, 'building', {
      owner,
      buildingType,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'building',
      layer: 'building',
      tint: buildingTint(buildingType, owner, isComplete),
      size: buildingSize(buildingType),
    });

    if (buildingType === 'town-center') {
      townCenterIds.set(owner, entity);
      if (!productionQueues.has(entity)) {
        productionQueues.set(entity, []);
      }
    }

    if (!isComplete) {
      const footprint = buildingFootprint(buildingType);
      constructionStates.set(entity, {
        isComplete: false,
        buildProgressTicks: 0,
        totalBuildTicks: buildingBuildTimeTicks(buildingType),
        populationProvided: buildingPopulationProvided(buildingType),
        width: footprint.width,
        height: footprint.height,
      });
    }

    if (vision) {
      world.addComponent(entity, 'visionSource', vision);
    }

    return entity;
  }

  function addResourceEntity(
    resourceType: ResourceKind,
    position: Position,
    amount: number,
    baseOwner: number | null,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);

    const tintByResource: Record<ResourceComponent['resourceType'], number> = {
      'berry-bush': 0x7a4c8e,
      'gold-mine': 0xd8b44c,
      'stone-mine': 0x8f9aa4,
      boar: 0x6a3b2e,
      sheep: 0xe7ece6,
      tree: 0x214d2d,
    };
    const sizeByResource: Record<ResourceComponent['resourceType'], number> = {
      'berry-bush': 0.45,
      'gold-mine': 0.8,
      'stone-mine': 0.8,
      boar: 0.48,
      sheep: 0.42,
      tree: 0.58,
    };

    world.addComponent(entity, 'resource', {
      resourceType,
      amount,
      maxAmount: amount,
      baseOwner,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'resource',
      layer: 'resource',
      tint: tintByResource[resourceType],
      size: sizeByResource[resourceType],
    });

    return entity;
  }

  for (const spawn of scenario.spawns) {
    if (spawn.kind === 'town-center') {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      addBuildingEntity(owner, 'town-center', { x: spawn.x, y: spawn.y }, true, spawn.vision);
      continue;
    }

    if (spawn.kind === 'villager' || spawn.kind === 'scout') {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      const unitId = addUnitEntity(owner, spawn.kind, { x: spawn.x, y: spawn.y }, spawn.vision);
      if (spawn.velocity) {
        world.addComponent(unitId, 'velocity', spawn.velocity);
      }
      if (spawn.wanderBounds) {
        world.addComponent(unitId, 'wanderBounds', spawn.wanderBounds);
      }
      continue;
    }

    addResourceEntity(
      spawn.kind,
      { x: spawn.x, y: spawn.y },
      spawn.amount ?? 0,
      spawn.baseOwner,
    );
  }

  function getUnitTaskState(id: number): UnitTaskState {
    const command = unitCommands.get(id);
    if (command) {
      return command.type === 'move' ? 'moving' : 'building';
    }

    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    return gatherer?.task ?? 'idle';
  }

  function buildingOccupiesCell(buildingId: number, x: number, y: number): boolean {
    const position = world.getComponent<Position>(buildingId, 'position');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !building) {
      return false;
    }

    const construction = constructionStates.get(buildingId);
    const footprint = construction ?? {
      width: buildingFootprint(building.buildingType).width,
      height: buildingFootprint(building.buildingType).height,
    };

    return (
      x >= position.x
      && x < position.x + footprint.width
      && y >= position.y
      && y < position.y + footprint.height
    );
  }

  function isPlacementBlocked(x: number, y: number, width: number, height: number): boolean {
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        if (cellX < 0 || cellX >= MAP_WIDTH || cellY < 0 || cellY >= MAP_HEIGHT) {
          return true;
        }

        const tile = tiles[cellY]?.[cellX];
        const terrain = tile === undefined ? null : world.getComponent<TerrainComponent>(tile, 'terrain');
        if (!terrain?.buildable) {
          return true;
        }

        for (const buildingId of world.query('building')) {
          if (buildingOccupiesCell(buildingId, cellX, cellY)) {
            return true;
          }
        }

        for (const id of world.query('position', 'resource')) {
          const position = world.getComponent<Position>(id, 'position');
          if (position?.x === cellX && position.y === cellY) {
            return true;
          }
        }

        for (const id of world.query('position', 'unit')) {
          const position = world.getComponent<Position>(id, 'position');
          if (position?.x === cellX && position.y === cellY) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function findSpawnPosition(origin: Position): Position {
    const offsets = [
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
    ];

    for (const offset of offsets) {
      const candidate = {
        x: clamp(origin.x + offset.x, 0, MAP_WIDTH - 1),
        y: clamp(origin.y + offset.y, 0, MAP_HEIGHT - 1),
      };
      if (!isPlacementBlocked(candidate.x, candidate.y, 1, 1)) {
        return candidate;
      }
    }

    return origin;
  }

  function clearGathererOrder(id: number): void {
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    if (!gatherer) {
      return;
    }

    gatherer.task = 'idle';
    gatherer.targetResourceId = null;
    gatherer.dropOffBuildingId = null;
    gatherer.gatherProgressTicks = 0;
  }

  function isVisibleToHuman(position: Position, owner: number | null): boolean {
    return owner === HUMAN_PLAYER_ID || visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y);
  }

  function findSelectableEntityAtCell(x: number, y: number): number | null {
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (position?.x === x && position.y === y && isVisibleToHuman(position, unit?.owner ?? null)) {
        return id;
      }
    }

    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (position && building && buildingOccupiesCell(id, x, y) && isVisibleToHuman(position, building.owner)) {
        return id;
      }
    }

    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      if (position?.x === x && position.y === y && visibility.isVisible(HUMAN_PLAYER_ID, x, y)) {
        return id;
      }
    }

    return null;
  }

  function findResourceAtCell(x: number, y: number): number | null {
    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (
        position?.x === x
        && position.y === y
        && resource
        && resource.amount > 0
        && visibility.isVisible(HUMAN_PLAYER_ID, x, y)
      ) {
        return id;
      }
    }

    return null;
  }

  function findNearestDropOffBuilding(
    activeWorld: World<GameEvents, GameCommands>,
    owner: number,
    resourceKind: EconomyResourceKind,
    origin: Position,
  ): number | null {
    let nearestBuildingId: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const id of activeWorld.query('position', 'building')) {
      const position = activeWorld.getComponent<Position>(id, 'position');
      const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
      if (!position || !building || building.owner !== owner) {
        continue;
      }

      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        continue;
      }

      if (!canDropOffAt(building.buildingType, resourceKind)) {
        continue;
      }

      const distance = manhattanDistance(origin, position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBuildingId = id;
      }
    }

    return nearestBuildingId;
  }

  function assignNearestResource(
    activeWorld: World<GameEvents, GameCommands>,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
  ): void {
    const villagerPosition = activeWorld.getComponent<Position>(villagerId, 'position');
    if (!villagerPosition) {
      return;
    }

    const matchingResources = [...activeWorld.query('position', 'resource')]
      .map((id) => ({
        id,
        position: activeWorld.getComponent<Position>(id, 'position'),
        resource: activeWorld.getComponent<ResourceComponent>(id, 'resource'),
      }))
      .filter(isResourceCandidate)
      .filter((entry) => entry.resource.amount > 0)
      .filter(
        (entry) => resourceKindToEconomyResource(entry.resource.resourceType) === gatherer.desiredResource,
      )
      .sort((left, right) => {
        const leftPreferred = left.resource.baseOwner === owner ? 0 : 1;
        const rightPreferred = right.resource.baseOwner === owner ? 0 : 1;
        if (leftPreferred !== rightPreferred) {
          return leftPreferred - rightPreferred;
        }
        const leftDistance = manhattanDistance(left.position, villagerPosition);
        const rightDistance = manhattanDistance(right.position, villagerPosition);
        return leftDistance - rightDistance;
      });

    const target = matchingResources[0];
    if (!target) {
      gatherer.task = 'idle';
      gatherer.targetResourceId = null;
      return;
    }

    gatherer.task = 'to-resource';
    gatherer.targetResourceId = target.id;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      activeWorld,
      owner,
      gatherer.desiredResource,
      target.position,
    );
    gatherer.gatherProgressTicks = 0;
  }

  world.registerSystem({
    name: 'prototypePlayerCommands',
    phase: 'update',
    execute(activeWorld) {
      for (const [id, command] of [...unitCommands.entries()]) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!position || !unit) {
          unitCommands.delete(id);
          continue;
        }

        if (command.type === 'move') {
          if (isAtTarget(position, command.target)) {
            unitCommands.delete(id);
            continue;
          }

          activeWorld.setPosition(id, stepToward(position, command.target));
          continue;
        }

        const buildingId = command.buildingId;
        if (buildingId === undefined) {
          unitCommands.delete(id);
          continue;
        }

        const buildingPosition = activeWorld.getComponent<Position>(buildingId, 'position');
        const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
        const construction = constructionStates.get(buildingId);
        if (!buildingPosition || !building || !construction || construction.isComplete) {
          unitCommands.delete(id);
          continue;
        }

        if (!isAtTarget(position, buildingPosition)) {
          activeWorld.setPosition(id, stepToward(position, buildingPosition));
          continue;
        }

        construction.buildProgressTicks += 1;
        if (construction.buildProgressTicks >= construction.totalBuildTicks) {
          construction.buildProgressTicks = construction.totalBuildTicks;
          construction.isComplete = true;

          const renderable = activeWorld.getComponent<RenderableComponent>(buildingId, 'renderable');
          if (renderable) {
            renderable.tint = buildingTint(building.buildingType, building.owner, true);
          }

          const populationState = population.get(building.owner);
          if (populationState) {
            populationState.cap += construction.populationProvided;
          }

          unitCommands.delete(id);
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeProductionQueues',
    phase: 'update',
    execute() {
      for (const [buildingId, queue] of productionQueues.entries()) {
        if (queue.length === 0) {
          continue;
        }

        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        const position = world.getComponent<Position>(buildingId, 'position');
        if (!building || !position) {
          productionQueues.set(buildingId, []);
          continue;
        }

        const entry = queue[0];
        const populationState = population.get(building.owner);
        if (!populationState) {
          continue;
        }

        if (populationState.current >= populationState.cap) {
          entry.isBlocked = true;
          continue;
        }

        entry.isBlocked = false;
        entry.remainingTicks -= 1;

        if (entry.remainingTicks > 0) {
          continue;
        }

        const spawnPosition = findSpawnPosition(position);
        addUnitEntity(building.owner, entry.unitType, spawnPosition, {
          playerId: building.owner,
          radius: 4,
        });
        queue.shift();
      }
    },
  });

  world.registerSystem({
    name: 'prototypeScoutMovement',
    phase: 'update',
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'velocity', 'wanderBounds')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const position = activeWorld.getComponent<Position>(id, 'position');
        const velocity = activeWorld.getComponent<VelocityComponent>(id, 'velocity');
        const bounds = activeWorld.getComponent<WanderBoundsComponent>(id, 'wanderBounds');
        if (!position || !velocity || !bounds) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!unit || unit.unitType !== 'scout') {
          continue;
        }

        const nextX = position.x + velocity.dx;
        const nextY = position.y + velocity.dy;

        if (nextX < bounds.minX || nextX > bounds.maxX) {
          velocity.dx *= -1;
        }
        if (nextY < bounds.minY || nextY > bounds.maxY) {
          velocity.dy *= -1;
        }

        activeWorld.setPosition(id, {
          x: clamp(position.x + velocity.dx, bounds.minX, bounds.maxX),
          y: clamp(position.y + velocity.dy, bounds.minY, bounds.maxY),
        });
      }
    },
  });

  world.registerSystem({
    name: 'prototypeVillagerEconomy',
    phase: 'update',
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'unit', 'gatherer')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        const position = activeWorld.getComponent<Position>(id, 'position');
        const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
        if (!unit || !position || !gatherer || unit.unitType !== 'villager') {
          continue;
        }

        if (gatherer.task === 'idle') {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }

        if (gatherer.task === 'to-resource') {
          const targetPosition = gatherer.targetResourceId === null
            ? null
            : activeWorld.getComponent<Position>(gatherer.targetResourceId, 'position');
          const targetResource = gatherer.targetResourceId === null
            ? null
            : activeWorld.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');

          if (!targetPosition || !targetResource || targetResource.amount <= 0) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
            gatherer.targetResourceId = null;
          } else if (isAtTarget(position, targetPosition)) {
            gatherer.task = 'gathering';
            gatherer.gatherProgressTicks = 0;
          } else {
            activeWorld.setPosition(id, stepToward(position, targetPosition));
          }
        }

        if (gatherer.task === 'gathering') {
          if (gatherer.targetResourceId === null) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
          } else {
            const targetPosition = activeWorld.getComponent<Position>(
              gatherer.targetResourceId,
              'position',
            );
            const targetResource = activeWorld.getComponent<ResourceComponent>(
              gatherer.targetResourceId,
              'resource',
            );

            if (
              !targetPosition
              || !targetResource
              || targetResource.amount <= 0
              || !isAtTarget(position, targetPosition)
            ) {
              gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
              gatherer.targetResourceId = null;
              gatherer.gatherProgressTicks = 0;
            } else {
              gatherer.gatherProgressTicks += 1;
              if (
                gatherer.gatherProgressTicks
                >= gatherTicksFor(targetResource.resourceType)
              ) {
                gatherer.gatherProgressTicks = 0;
                const gatherAmount = Math.min(
                  gatherAmountFor(targetResource.resourceType),
                  targetResource.amount,
                  gatherer.carryCapacity - gatherer.carriedAmount,
                );
                targetResource.amount -= gatherAmount;
                gatherer.carriedResource = resourceKindToEconomyResource(
                  targetResource.resourceType,
                );
                gatherer.carriedAmount += gatherAmount;

                if (
                  targetResource.amount <= 0
                  || gatherer.carriedAmount >= gatherer.carryCapacity
                ) {
                  gatherer.task = 'to-dropoff';
                }
              }
            }
          }
        }

        if (gatherer.task === 'to-dropoff') {
          const dropOffId =
            gatherer.carriedResource === null
              ? null
              : findNearestDropOffBuilding(
                activeWorld,
                unit.owner,
                gatherer.carriedResource,
                position,
              );
          gatherer.dropOffBuildingId = dropOffId;
          const dropOffPosition = dropOffId === null
            ? null
            : activeWorld.getComponent<Position>(dropOffId, 'position');

          if (!dropOffPosition || gatherer.carriedResource === null || gatherer.carriedAmount <= 0) {
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
          } else if (isAtTarget(position, dropOffPosition)) {
            const stockpile = playerResources.get(unit.owner);
            if (stockpile) {
              stockpile[gatherer.carriedResource] += gatherer.carriedAmount;
            }
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
            gatherer.targetResourceId = null;
            gatherer.gatherProgressTicks = 0;
          } else {
            activeWorld.setPosition(id, stepToward(position, dropOffPosition));
          }
        }

        if (gatherer.task === 'idle') {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeVisibility',
    phase: 'update',
    execute(activeWorld) {
      syncVisibilitySources(activeWorld, visibility, trackedVisibilitySources);
    },
  });

  syncVisibilitySources(world, visibility, trackedVisibilitySources);

  function getSelectionState(): SelectionState {
    if (selectedEntityId === null) {
      return {
        selectedEntityId: null,
        selectedKind: null,
        selectedEntityType: null,
        owner: null,
        x: null,
        y: null,
        buildOptions: [],
        trainOptions: [],
        queue: [],
        placementMode,
      };
    }

    const position = world.getComponent<Position>(selectedEntityId, 'position');
    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!position || (!unit && !building)) {
      selectedEntityId = null;
      return getSelectionState();
    }

    const trainOptions: UnitType[] =
      building?.buildingType === 'town-center' && building.owner === HUMAN_PLAYER_ID
        ? ['villager']
        : [];
    const buildOptions: BuildableBuildingType[] =
      unit?.unitType === 'villager' && unit.owner === HUMAN_PLAYER_ID
        ? ['house', 'mill', 'lumber-camp', 'mining-camp']
        : [];

    return {
      selectedEntityId,
      selectedKind: unit ? 'unit' : 'building',
      selectedEntityType: unit?.unitType ?? building?.buildingType ?? null,
      owner: unit?.owner ?? building?.owner ?? null,
      x: position.x,
      y: position.y,
      buildOptions,
      trainOptions,
      queue: cloneQueue(productionQueues.get(selectedEntityId) ?? []),
      placementMode,
    };
  }

  function selectEntityAtCell(x: number, y: number): boolean {
    const nextSelection = findSelectableEntityAtCell(x, y);
    selectedEntityId = nextSelection;
    if (nextSelection === null) {
      placementMode = null;
      return false;
    }

    return true;
  }

  function clearSelection(): void {
    selectedEntityId = null;
    placementMode = null;
  }

  function issueMoveCommand(x: number, y: number): boolean {
    if (selectedEntityId === null) {
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID) {
      return false;
    }

    placementMode = null;
    clearGathererOrder(selectedEntityId);
    unitCommands.set(selectedEntityId, {
      type: 'move',
      target: {
        x: clamp(x, 0, MAP_WIDTH - 1),
        y: clamp(y, 0, MAP_HEIGHT - 1),
      },
    });
    return true;
  }

  function issueContextCommand(x: number, y: number): boolean {
    if (selectedEntityId === null) {
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID) {
      return false;
    }

    const target = {
      x: clamp(x, 0, MAP_WIDTH - 1),
      y: clamp(y, 0, MAP_HEIGHT - 1),
    };
    const resourceId =
      unit.unitType === 'villager'
        ? findResourceAtCell(target.x, target.y)
        : null;

    if (resourceId === null) {
      return issueMoveCommand(target.x, target.y);
    }

    const gatherer = world.getComponent<GathererComponent>(selectedEntityId, 'gatherer');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    if (!gatherer || !resource) {
      return issueMoveCommand(target.x, target.y);
    }

    placementMode = null;
    unitCommands.delete(selectedEntityId);
    gatherer.desiredResource = resourceKindToEconomyResource(resource.resourceType);
    gatherer.task = 'to-resource';
    gatherer.targetResourceId = resourceId;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      world,
      unit.owner,
      gatherer.desiredResource,
      target,
    );
    gatherer.gatherProgressTicks = 0;
    return true;
  }

  function queueTrainUnit(unitType: Extract<UnitType, 'villager'>): boolean {
    if (selectedEntityId === null) {
      return false;
    }

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== HUMAN_PLAYER_ID || building.buildingType !== 'town-center') {
      return false;
    }

    const stockpile = playerResources.get(HUMAN_PLAYER_ID);
    if (!stockpile) {
      return false;
    }

    const cost = trainingCost(unitType);
    if (!canAfford(stockpile, cost)) {
      return false;
    }

    spendResources(stockpile, cost);
    const queue = productionQueues.get(selectedEntityId) ?? [];
    const totalTicks = trainingTimeTicks(unitType);
    queue.push({
      unitType,
      remainingTicks: totalTicks,
      totalTicks,
      isBlocked: false,
    });
    productionQueues.set(selectedEntityId, queue);
    return true;
  }

  function beginBuildingPlacement(buildingType: BuildableBuildingType): boolean {
    if (selectedEntityId === null) {
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID || unit.unitType !== 'villager') {
      return false;
    }

    placementMode = buildingType;
    return true;
  }

  function confirmBuildingPlacement(x: number, y: number): boolean {
    if (placementMode === null || selectedEntityId === null) {
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID || unit.unitType !== 'villager') {
      return false;
    }

    const stockpile = playerResources.get(HUMAN_PLAYER_ID);
    if (!stockpile) {
      return false;
    }

    const anchor = {
      x: clamp(x, 0, MAP_WIDTH - 1),
      y: clamp(y, 0, MAP_HEIGHT - 1),
    };
    const footprint = buildingFootprint(placementMode);
    if (isPlacementBlocked(anchor.x, anchor.y, footprint.width, footprint.height)) {
      return false;
    }

    const cost = constructionCost(placementMode);
    if (!canAfford(stockpile, cost)) {
      return false;
    }

    spendResources(stockpile, cost);
    const buildingId = addBuildingEntity(HUMAN_PLAYER_ID, placementMode, anchor, false);
    clearGathererOrder(selectedEntityId);
    unitCommands.set(selectedEntityId, {
      type: 'build',
      target: anchor,
      buildingId,
    });
    placementMode = null;
    return true;
  }

  return {
    world,
    getEconomyState() {
      const villagers = [...world.query('unit', 'gatherer')]
        .map((id) => {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
          if (!unit || !gatherer) {
            return null;
          }

          return {
            owner: unit.owner,
            task: getUnitTaskState(id),
            desiredResource: gatherer.desiredResource,
            carriedResource: gatherer.carriedResource,
            carriedAmount: gatherer.carriedAmount,
          };
        })
        .filter(isEconomyVillager);

      const resources = [...world.query('position', 'resource')]
        .map((id) => {
          const position = world.getComponent<Position>(id, 'position');
          const resource = world.getComponent<ResourceComponent>(id, 'resource');
          if (!position || !resource) {
            return null;
          }

          return {
            resourceType: resource.resourceType,
            amount: resource.amount,
            maxAmount: resource.maxAmount,
            baseOwner: resource.baseOwner,
            x: position.x,
            y: position.y,
          };
        })
        .filter(isEconomyResourceEntry);

      const units = [...world.query('position', 'unit')]
        .map((id) => {
          const position = world.getComponent<Position>(id, 'position');
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          if (!position || !unit) {
            return null;
          }

          return {
            id,
            owner: unit.owner,
            unitType: unit.unitType,
            x: position.x,
            y: position.y,
            task: getUnitTaskState(id),
          };
        })
        .filter((entry): entry is EconomyState['units'][number] => entry !== null);

      const buildings = [...world.query('position', 'building')]
        .map((id) => {
          const position = world.getComponent<Position>(id, 'position');
          const building = world.getComponent<BuildingComponent>(id, 'building');
          if (!position || !building) {
            return null;
          }

          const construction = constructionStates.get(id);
          return {
            id,
            owner: building.owner,
            buildingType: building.buildingType,
            x: position.x,
            y: position.y,
            isComplete: construction ? construction.isComplete : true,
            buildProgressTicks: construction
              ? construction.buildProgressTicks
              : buildingBuildTimeTicks(building.buildingType),
            totalBuildTicks: construction
              ? construction.totalBuildTicks
              : buildingBuildTimeTicks(building.buildingType),
            populationProvided: buildingPopulationProvided(building.buildingType),
            queue: cloneQueue(productionQueues.get(id) ?? []),
          };
        })
        .filter((entry): entry is EconomyState['buildings'][number] => entry !== null);

      return {
        playerResources: Object.fromEntries(
          [...playerResources.entries()].map(([playerId, resources]) => [
            playerId,
            cloneResources(resources),
          ]),
        ),
        population: Object.fromEntries(
          [...population.entries()].map(([playerId, value]) => [
            playerId,
            { ...value },
          ]),
        ),
        villagers,
        resources,
        units,
        buildings,
      };
    },
    getPopulationState(playerId: number) {
      return { ...(population.get(playerId) ?? { current: 0, cap: 0 }) };
    },
    getPlayerResources(playerId: number) {
      return cloneResources(
        playerResources.get(playerId) ?? STANDARD_STARTING_RESOURCES,
      );
    },
    getSelectionState,
    selectEntityAtCell,
    clearSelection,
    issueContextCommand,
    issueMoveCommand,
    queueTrainUnit,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    isSelected(id: number) {
      return selectedEntityId === id;
    },
  };
}

export function createSimulationBridge(seed = DEFAULT_SEED): SimulationBridge {
  const visibility = new VisibilityMap(MAP_WIDTH, MAP_HEIGHT);
  const {
    world,
    getEconomyState,
    getPopulationState,
    getPlayerResources,
    getSelectionState,
    selectEntityAtCell,
    clearSelection,
    issueContextCommand,
    issueMoveCommand,
    queueTrainUnit,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    isSelected,
  } =
    createWorld(seed, visibility);
  const renderStore = new RenderStore();
  const debuggerView = new WorldDebugger({ world });
  const renderAdapter = new RenderAdapter({
    world,
    projector: createProjector(visibility, HUMAN_PLAYER_ID, seed, isSelected),
    debug: debuggerView,
    send(message) {
      renderStore.apply(message);
    },
  });

  renderAdapter.connect();

  let accumulatorMs = 0;

  return {
    step(deltaMs: number) {
      accumulatorMs += deltaMs;
      const tickMs = 1000 / TPS;

      while (accumulatorMs >= tickMs) {
        world.step();
        accumulatorMs -= tickMs;
      }
    },
    getRenderState() {
      return {
        tick: renderStore.getTick(),
        entities: renderStore.getEntities(),
        frame: renderStore.getFrame(),
      };
    },
    getHudState() {
      const debugState = renderStore.getDebug();
      const frame = renderStore.getFrame();
      const metrics = debugState?.metrics;
      const tickDurationMs = metrics?.durationMs.total ?? 0;

      return {
        tick: renderStore.getTick(),
        entityCount: debugState?.entityCount ?? 0,
        visibleEntities: renderStore.getEntities().length,
        visibleCells: frame?.visibleCells.length ?? 0,
        exploredCells: frame?.exploredCells.length ?? 0,
        tickDurationMs,
        fpsTarget: TPS,
        worldSize: `${MAP_WIDTH}x${MAP_HEIGHT}`,
        seed,
        playerResources: getPlayerResources(HUMAN_PLAYER_ID),
        population: getPopulationState(HUMAN_PLAYER_ID),
      };
    },
    getEconomyState,
    getSelectionState,
    selectEntityAtCell,
    clearSelection,
    issueContextCommand,
    issueMoveCommand,
    queueTrainUnit,
    beginBuildingPlacement,
    confirmBuildingPlacement,
  };
}
