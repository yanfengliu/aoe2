import {
  VisibilityMap,
  World,
  createTileGrid,
  type EntityRef,
  type Position,
} from 'civ-engine';

import {
  rebuildTileGridFromWorld,
  type GameEvents,
  type GameCommands,
  type GameComponents,
  type GameWorld,
} from './pureHelpers';
import {
  createBridgeHelpers,
  createCommandRejectionQueue,
} from './bridgeHelpers';
import { assembleBridgeApi } from './assembleBridgeApi';
import { createBridgeState } from './bridgeState';
import { BridgeStateAccessor } from './bridgeStateAccessor';
import { registerComponentTypes } from './scenarioSeedOps';
import { wireBridgeOps } from './wireBridgeOps';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  TPS,
  createPrototypeScenario,
} from '../prototypeScenario';
import type { SaveBlob } from '../saveSchema';
import { createWorldOccupancy } from '../worldOccupancy';
import type { BuildableBuildingType, MatchState } from '../types';

export type { CreateWorldResult } from './createWorldResult';
import type { CreateWorldResult } from './createWorldResult';

export function createWorld(
  seed: string,
  visibility: VisibilityMap,
  savedGame: SaveBlob | undefined,
  systemMode: 'live' | 'replay' = 'live',
): CreateWorldResult {
  // World.deserialize preserves entity ids + generations and restores
  // every component store, so EntityRefs captured by saved side maps
  // still resolve. We MUST skip registerComponent below in that branch
  // because duplicate registration throws.
  const world: GameWorld = savedGame
    ? World.deserialize<GameEvents, GameCommands, GameComponents>(savedGame.worldSnapshot)
    : new World<GameEvents, GameCommands, GameComponents>({
        gridWidth: MAP_WIDTH,
        gridHeight: MAP_HEIGHT,
        tps: TPS,
        seed,
      });
  const worldOccupancy = createWorldOccupancy(MAP_WIDTH, MAP_HEIGHT);
  worldOccupancy.attachWorld(world);

  const state = createBridgeState();
  // Phase 2D — accessor needs to be available to bridgeHelpers (which
  // reads playerAges via accessor in ensureAiState). Constructed here
  // so subsequent ops can consume it. wireBridgeOps does NOT re-construct;
  // it receives this instance.
  const accessor = new BridgeStateAccessor(() => world);
  const helpers = createBridgeHelpers({ world, state, accessor });

  const matchState: MatchState = {
    outcome: 'running',
    summary: '',
    winCondition: null,
    scores: null,
    wonderCountdownTicks: null,
    relicCountdownTicks: null,
  };
  const selection: { refs: EntityRef[]; focusCell: Position | null } = {
    refs: [],
    focusCell: null,
  };
  const placementMode: { current: BuildableBuildingType | null } = { current: null };
  const isBootstrappingScenarioRef = { current: !savedGame };
  const hasOutOfBandRenderChangeRef = { current: false };
  const { enqueueRejection, consumeCommandRejection } = createCommandRejectionQueue();

  function markOutOfBandRenderChange(): void {
    hasOutOfBandRenderChangeRef.current = true;
  }

  if (!savedGame) {
    registerComponentTypes(world);
  }

  // V4-8: scenario generation is only consumed by the fresh-bootstrap
  // path; on save-load it's discarded. Skip the procedural map build to
  // avoid wasted CPU on every load.
  const scenario = savedGame ? null : createPrototypeScenario(seed);
  // When loading a save, the deserialized world already has every tile
  // entity (deserialize preserves entity ids), so rebuild the lookup
  // grid instead of allocating a fresh set of tile entities.
  const tiles: number[][] = savedGame
    ? rebuildTileGridFromWorld(world)
    // createTileGrid's signature uses default `World` generics (Record<string, never>
    // for events/commands). Our GameWorld carries the GameCommands surface which
    // doesn't structurally fit `Record<string, never>`. Cast through `unknown`
    // since createTileGrid only reads world.grid + creates entities — doesn't
    // touch the command map.
    : createTileGrid(world as unknown as World);

  const ops = wireBridgeOps({
    world,
    systemMode,
    state,
    accessor,
    visibility,
    matchState,
    savedGame,
    scenario,
    worldOccupancy,
    tiles,
    selection,
    placementMode,
    isBootstrappingScenarioRef,
    ensurePlayerScoreCounters: helpers.ensurePlayerScoreCounters,
    ensureAiState: helpers.ensureAiState,
    inFlightTechSetFor: helpers.inFlightTechSetFor,
    clearUnitCommand: helpers.clearUnitCommand,
    setUnitCommand: helpers.setUnitCommand,
    getCurrentEntityId: helpers.getCurrentEntityId,
    getEntityRef: helpers.getEntityRef,
    getUnitTaskStateInternal: helpers.getUnitTaskState,
    enqueueRejection,
    markOutOfBandRenderChange,
    getSeed: () => seed,
  });

  return assembleBridgeApi({
    world,
    state,
    accessor,
    matchState,
    consumeCommandRejection,
    hasOutOfBandRenderChangeRef,
    ...ops,
  });
}
