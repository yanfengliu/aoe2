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
  BuildingComponent,
  EconomyResourceKind,
  EconomyState,
  GathererComponent,
  HudState,
  PlayerResources,
  PopulationState,
  ProjectedEntityView,
  ProjectedFrameView,
  RenderState,
  RenderableComponent,
  ResourceComponent,
  ResourceKind,
  TerrainComponent,
  UnitComponent,
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
}

const STANDARD_STARTING_RESOURCES: PlayerResources = {
  food: 200,
  wood: 200,
  gold: 100,
  stone: 200,
};

const STANDARD_POPULATION_CAP = 5;

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
    task: GathererComponent['task'];
    desiredResource: GathererComponent['desiredResource'];
    carriedResource: GathererComponent['carriedResource'];
    carriedAmount: number;
  } | null,
): entry is {
  owner: number;
  task: GathererComponent['task'];
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

function createProjector(
  visibility: VisibilityMap,
  playerId: number,
  seed: string,
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
        kind: renderable.kind,
        layer: renderable.layer,
        entityType,
        owner,
        x: position.x,
        y: position.y,
        tint: renderable.tint,
        size: renderable.size,
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

  for (const spawn of scenario.spawns) {
    const entity = world.createEntity();
    world.setPosition(entity, { x: spawn.x, y: spawn.y });

    if (spawn.kind === 'town-center') {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      townCenterIds.set(owner, entity);
      world.addComponent(entity, 'building', {
        owner,
        buildingType: 'town-center',
      });
      world.addComponent(entity, 'renderable', {
        kind: 'building',
        layer: 'building',
        tint: owner === HUMAN_PLAYER_ID ? 0xd8b36c : 0xa15c5c,
        size: 1.4,
      });
    }

    if (spawn.kind === 'villager' || spawn.kind === 'scout') {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      world.addComponent(entity, 'unit', {
        owner,
        unitType: spawn.kind,
      });
      world.addComponent(entity, 'renderable', {
        kind: 'unit',
        layer: 'unit',
        tint:
          spawn.kind === 'villager'
            ? owner === HUMAN_PLAYER_ID
              ? 0xf3e2b7
              : 0xf0b8b8
            : owner === HUMAN_PLAYER_ID
              ? 0xead74a
              : 0xef7d57,
        size: spawn.kind === 'villager' ? 0.45 : 0.55,
      });

      const populationState = population.get(owner);
      if (populationState) {
        populationState.current += 1;
      }

      if (spawn.kind === 'villager') {
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
    }

    if (
      spawn.kind === 'berry-bush' ||
      spawn.kind === 'gold-mine' ||
      spawn.kind === 'stone-mine' ||
      spawn.kind === 'boar' ||
      spawn.kind === 'sheep' ||
      spawn.kind === 'tree'
    ) {
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
        resourceType: spawn.kind,
        amount: spawn.amount ?? 0,
        maxAmount: spawn.amount ?? 0,
        baseOwner: spawn.baseOwner,
      });
      world.addComponent(entity, 'renderable', {
        kind: 'resource',
        layer: 'resource',
        tint: tintByResource[spawn.kind],
        size: sizeByResource[spawn.kind],
      });
    }

    if (spawn.velocity) {
      world.addComponent(entity, 'velocity', spawn.velocity);
    }
    if (spawn.wanderBounds) {
      world.addComponent(entity, 'wanderBounds', spawn.wanderBounds);
    }
    if (spawn.vision) {
      world.addComponent(entity, 'visionSource', spawn.vision);
    }
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
        const leftDistance =
          Math.abs(left.position.x - villagerPosition.x)
          + Math.abs(left.position.y - villagerPosition.y);
        const rightDistance =
          Math.abs(right.position.x - villagerPosition.x)
          + Math.abs(right.position.y - villagerPosition.y);
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
    gatherer.dropOffBuildingId = townCenterIds.get(owner) ?? null;
    gatherer.gatherProgressTicks = 0;
  }

  world.registerSystem({
    name: 'prototypeScoutMovement',
    phase: 'update',
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'velocity', 'wanderBounds')) {
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
          const dropOffId = gatherer.dropOffBuildingId ?? townCenterIds.get(unit.owner) ?? null;
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
            task: gatherer.task,
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
  };
}

export function createSimulationBridge(seed = DEFAULT_SEED): SimulationBridge {
  const visibility = new VisibilityMap(MAP_WIDTH, MAP_HEIGHT);
  const { world, getEconomyState, getPopulationState, getPlayerResources } =
    createWorld(seed, visibility);
  const renderStore = new RenderStore();
  const debuggerView = new WorldDebugger({ world });
  const renderAdapter = new RenderAdapter({
    world,
    projector: createProjector(visibility, HUMAN_PLAYER_ID, seed),
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
  };
}
