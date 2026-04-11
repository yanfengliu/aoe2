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
  HudState,
  ProjectedEntityView,
  ProjectedFrameView,
  RenderState,
  RenderableComponent,
  ResourceComponent,
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
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toCellIndex(x: number, y: number): number {
  return y * MAP_WIDTH + x;
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

function createWorld(seed: string, visibility: VisibilityMap): World<GameEvents, GameCommands> {
  const world = new World<GameEvents, GameCommands>({
    gridWidth: MAP_WIDTH,
    gridHeight: MAP_HEIGHT,
    tps: TPS,
    seed,
  });

  const trackedVisibilitySources = new Map<number, number>();

  world.registerComponent<Position>('position');
  world.registerComponent<TerrainComponent>('terrain');
  world.registerComponent<RenderableComponent>('renderable');
  world.registerComponent<UnitComponent>('unit');
  world.registerComponent<BuildingComponent>('building');
  world.registerComponent<ResourceComponent>('resource');
  world.registerComponent<VelocityComponent>('velocity');
  world.registerComponent<VisionSourceComponent>('visionSource');
  world.registerComponent<WanderBoundsComponent>('wanderBounds');

  const scenario = createPrototypeScenario(seed);
  const tiles = createTileGrid(world);

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
      world.addComponent(entity, 'building', {
        owner: spawn.owner ?? HUMAN_PLAYER_ID,
        buildingType: 'town-center',
      });
      world.addComponent(entity, 'renderable', {
        kind: 'building',
        layer: 'building',
        tint: spawn.owner === HUMAN_PLAYER_ID ? 0xd8b36c : 0xa15c5c,
        size: 1.4,
      });
    }

    if (spawn.kind === 'villager' || spawn.kind === 'scout') {
      world.addComponent(entity, 'unit', {
        owner: spawn.owner ?? HUMAN_PLAYER_ID,
        unitType: spawn.kind,
      });
      world.addComponent(entity, 'renderable', {
        kind: 'unit',
        layer: 'unit',
        tint:
          spawn.kind === 'villager'
            ? spawn.owner === HUMAN_PLAYER_ID
              ? 0xf3e2b7
              : 0xf0b8b8
            : spawn.owner === HUMAN_PLAYER_ID
              ? 0xead74a
              : 0xef7d57,
        size: spawn.kind === 'villager' ? 0.45 : 0.55,
      });
    }

    if (
      spawn.kind === 'berry-bush' ||
      spawn.kind === 'gold-mine' ||
      spawn.kind === 'stone-mine' ||
      spawn.kind === 'boar' ||
      spawn.kind === 'sheep'
    ) {
      const tintByResource: Record<ResourceComponent['resourceType'], number> = {
        'berry-bush': 0x7a4c8e,
        'gold-mine': 0xd8b44c,
        'stone-mine': 0x8f9aa4,
        boar: 0x6a3b2e,
        sheep: 0xe7ece6,
      };
      const sizeByResource: Record<ResourceComponent['resourceType'], number> = {
        'berry-bush': 0.45,
        'gold-mine': 0.8,
        'stone-mine': 0.8,
        boar: 0.48,
        sheep: 0.42,
      };

      world.addComponent(entity, 'resource', {
        resourceType: spawn.kind,
        amount: spawn.amount ?? 0,
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
    name: 'prototypeVisibility',
    phase: 'update',
    execute(activeWorld) {
      syncVisibilitySources(activeWorld, visibility, trackedVisibilitySources);
    },
  });

  syncVisibilitySources(world, visibility, trackedVisibilitySources);

  return world;
}

export function createSimulationBridge(seed = DEFAULT_SEED): SimulationBridge {
  const visibility = new VisibilityMap(MAP_WIDTH, MAP_HEIGHT);
  const world = createWorld(seed, visibility);
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
      };
    },
  };
}
