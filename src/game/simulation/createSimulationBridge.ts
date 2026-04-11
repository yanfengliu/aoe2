import {
  RenderAdapter,
  World,
  WorldDebugger,
  createNoise2D,
  createTileGrid,
  octaveNoise2D,
  type Position,
  type RenderProjector,
} from 'civ-engine';

import { RenderStore } from './renderStore';
import type {
  BuildingComponent,
  HudState,
  ProjectedEntityView,
  ProjectedFrameView,
  RenderableComponent,
  TerrainComponent,
  UnitComponent,
  VelocityComponent,
  WanderBoundsComponent,
} from './types';

type GameEvents = Record<string, never>;
type GameCommands = Record<string, never>;

interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): { tick: number; entities: ProjectedEntityView[] };
  getHudState(): HudState;
}

const MAP_WIDTH = 36;
const MAP_HEIGHT = 24;
const TPS = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createProjector(): RenderProjector<
  GameEvents,
  GameCommands,
  ProjectedEntityView,
  ProjectedFrameView
> {
  return {
    projectEntity(ref, world) {
      const position = world.getComponent<Position>(ref.id, 'position');
      const renderable = world.getComponent<RenderableComponent>(
        ref.id,
        'renderable',
      );
      if (!position || !renderable) {
        return null;
      }

      return {
        kind: renderable.kind,
        layer: renderable.layer,
        x: position.x,
        y: position.y,
        tint: renderable.tint,
        size: renderable.size,
      };
    },
    projectFrame(world) {
      return { tick: world.tick };
    },
  };
}

function createWorld(): World<GameEvents, GameCommands> {
  const world = new World<GameEvents, GameCommands>({
    gridWidth: MAP_WIDTH,
    gridHeight: MAP_HEIGHT,
    tps: TPS,
    seed: 'aoe2-prototype',
  });

  world.registerComponent<Position>('position');
  world.registerComponent<TerrainComponent>('terrain');
  world.registerComponent<RenderableComponent>('renderable');
  world.registerComponent<UnitComponent>('unit');
  world.registerComponent<BuildingComponent>('building');
  world.registerComponent<VelocityComponent>('velocity');
  world.registerComponent<WanderBoundsComponent>('wanderBounds');

  const tiles = createTileGrid(world);
  const terrainNoise = createNoise2D(42);

  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      const tile = tiles[y][x];
      const noise = octaveNoise2D(terrainNoise, x * 0.12, y * 0.12, 3);
      const kind =
        noise < -0.28 ? 'water' : noise > 0.42 ? 'forest' : noise > 0.18 ? 'hill' : 'grass';
      const tintByKind: Record<TerrainComponent['kind'], number> = {
        grass: 0x587f4e,
        forest: 0x2f5e34,
        water: 0x295a75,
        hill: 0x8c7d5a,
      };

      world.addComponent(tile, 'terrain', {
        kind,
        buildable: kind !== 'water' && kind !== 'forest',
        elevation: kind === 'hill' ? 1 : 0,
      });
      world.addComponent(tile, 'renderable', {
        kind: 'tile',
        layer: 'terrain',
        tint: tintByKind[kind],
        size: 1,
      });
    }
  }

  function createTownCenter(owner: number, x: number, y: number): void {
    const entity = world.createEntity();
    world.setPosition(entity, { x, y });
    world.addComponent(entity, 'building', {
      owner,
      buildingType: 'town-center',
    });
    world.addComponent(entity, 'renderable', {
      kind: 'building',
      layer: 'building',
      tint: owner === 1 ? 0xd8b36c : 0xa15c5c,
      size: 1.4,
    });
  }

  function createVillager(owner: number, x: number, y: number): void {
    const entity = world.createEntity();
    world.setPosition(entity, { x, y });
    world.addComponent(entity, 'unit', {
      owner,
      unitType: 'villager',
    });
    world.addComponent(entity, 'renderable', {
      kind: 'unit',
      layer: 'unit',
      tint: owner === 1 ? 0xf3e2b7 : 0xf0b8b8,
      size: 0.45,
    });
  }

  function createScout(
    owner: number,
    x: number,
    y: number,
    dx: number,
    dy: number,
    bounds: WanderBoundsComponent,
  ): void {
    const entity = world.createEntity();
    world.setPosition(entity, { x, y });
    world.addComponent(entity, 'unit', {
      owner,
      unitType: 'scout',
    });
    world.addComponent(entity, 'renderable', {
      kind: 'unit',
      layer: 'unit',
      tint: owner === 1 ? 0xead74a : 0xef7d57,
      size: 0.55,
    });
    world.addComponent(entity, 'velocity', { dx, dy });
    world.addComponent(entity, 'wanderBounds', bounds);
  }

  createTownCenter(1, 8, 8);
  createVillager(1, 6, 8);
  createVillager(1, 6, 9);
  createVillager(1, 7, 9);
  createScout(1, 10, 7, 1, 0, { minX: 5, maxX: 14, minY: 5, maxY: 12 });

  createTownCenter(2, 27, 15);
  createVillager(2, 25, 15);
  createVillager(2, 26, 16);
  createVillager(2, 27, 16);
  createScout(2, 24, 14, -1, 0, {
    minX: 21,
    maxX: 30,
    minY: 11,
    maxY: 18,
  });

  world.registerSystem({
    name: 'prototypeScoutMovement',
    phase: 'update',
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'velocity', 'wanderBounds')) {
        const position = activeWorld.getComponent<Position>(id, 'position')!;
        const velocity = activeWorld.getComponent<VelocityComponent>(id, 'velocity')!;
        const bounds = activeWorld.getComponent<WanderBoundsComponent>(
          id,
          'wanderBounds',
        )!;

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

  return world;
}

export function createSimulationBridge(): SimulationBridge {
  const world = createWorld();
  const renderStore = new RenderStore();
  const debuggerView = new WorldDebugger({ world });
  const renderAdapter = new RenderAdapter({
    world,
    projector: createProjector(),
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
      };
    },
    getHudState() {
      const debugState = renderStore.getDebug();
      const metrics = debugState?.metrics;
      const tickDurationMs = metrics?.durationMs.total ?? 0;

      return {
        tick: renderStore.getTick(),
        entityCount: debugState?.entityCount ?? 0,
        visibleEntities: renderStore.getEntities().length,
        tickDurationMs,
        fpsTarget: TPS,
        worldSize: `${MAP_WIDTH}x${MAP_HEIGHT}`,
      };
    },
  };
}
