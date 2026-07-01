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

export interface CreateWorldOptions {
  disableAiForOwners?: ReadonlySet<number>;
  forceAiForOwners?: ReadonlySet<number>;
  // Playtest-harness override: force the score timer on (spec §4.3) by
  // stamping `gameLength` onto the freshly-built scenario, even when the
  // scenario bakes none. Lets the corpus terminate an otherwise-stalemating
  // match on score. Ignored on the save-load path (scenario is null).
  gameLength?: number;
}

export function createWorld(
  seed: string,
  visibility: VisibilityMap,
  savedGame: SaveBlob | undefined,
  systemMode: 'live' | 'replay' = 'live',
  options: CreateWorldOptions = {},
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
  // LLM-agent harness: ?disableAi=2,3 plumbs through createSimulationBridge
  // → here. We toggle the existing PlayerStartSpec.disableAi flag so the
  // existing aiStates.has(owner) gate (aiSystem + autoAggressionSystem)
  // skips those owners. Closure-local — never enters world.state.
  if (scenario && options.disableAiForOwners && options.disableAiForOwners.size > 0) {
    for (const start of scenario.starts) {
      if (options.disableAiForOwners.has(start.owner)) {
        start.disableAi = true;
      }
    }
  }
  // Headless AI-vs-AI harness: force an AI onto the listed owners (typically the
  // human slot) so a deterministic playtest runs a competitive match instead of
  // AI-vs-inert. Closure-local — never enters world.state; the real game never
  // sets this, so the human keeps control.
  if (scenario && options.forceAiForOwners && options.forceAiForOwners.size > 0) {
    for (const start of scenario.starts) {
      if (options.forceAiForOwners.has(start.owner)) {
        start.forceAi = true;
      }
    }
  }
  // Harness override: stamp a game-length onto the scenario so the score
  // timer resolves the match. Only when explicitly provided — the real game
  // leaves the scenario's own (usually absent) gameLength untouched.
  if (scenario && options.gameLength !== undefined) {
    scenario.gameLength = options.gameLength;
  }
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
