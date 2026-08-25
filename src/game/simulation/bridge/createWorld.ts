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
  type PrototypeScenario,
} from '../prototypeScenario';
import type { SaveBlob } from '../saveSchema';
import { createWorldOccupancy } from '../worldOccupancy';
import type { BuildableBuildingType, MatchState } from '../types';
import { populationCodec, TIER_3_SLOTS } from './bridgeStateSerialize';
import {
  hydrateUnitAttacks,
  initializeUnitAttackFeed,
  MAX_ATTACK_PLAYER_ID,
} from './unitAttackAnimationFeed';

export type { CreateWorldResult } from './createWorldResult';
import type { CreateWorldResult } from './createWorldResult';

export interface CreateWorldOptions {
  disableAiForOwners?: ReadonlySet<number>;
  forceAiForOwners?: ReadonlySet<number>;
  /** How many players the procedural map opens with (2..8; default 2). §4's
   *  size ladder picks the map to match. Fixtures decide their own, so this
   *  only reaches the default map. */
  playerCount?: number;
  /** The scenario to build the world from, when the caller has already built
   *  it — the visibility map is sized from the same scenario, so it has to be
   *  the SAME one rather than a second generation of the same seed. */
  scenario?: PrototypeScenario;
  // Playtest-harness override: force the score timer on (spec §4.3) by
  // stamping `gameLength` onto the freshly-built scenario, even when the
  // scenario bakes none. Lets the corpus terminate an otherwise-stalemating
  // match on score. Ignored on the save-load path (scenario is null).
  gameLength?: number;
  // Civ selection (?civ=): override the freshly-built scenario start's
  // civilization for the listed owners. Closure-local; the value flows into the
  // persisted playerCivilizations map via the normal seed path.
  civilizationsByOwner?: ReadonlyMap<number, string>;
  /** §4.6 AI difficulty for every AI seat (absent = standard). */
  difficulty?: import('../ai').DifficultyLevel;
  victory?: 'standard' | 'conquest-only';
  resourcePreset?: import('../matchOptions').ResourcePreset;
  /** Which side each owner is on (?teams=). Absent means a free-for-all. */
  teamsByOwner?: ReadonlyMap<number, number>;
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
  // The scenario is built FIRST because it decides how big the world is:
  // §4's size ladder grows the map with the player count, so a six-player
  // skirmish needs a grid the two-player constants cannot describe. A load
  // takes its dimensions from the snapshot instead, which already carries
  // whatever size the match was saved at.
  const freshScenario = savedGame
    ? null
    : options.scenario ?? createPrototypeScenario(seed, options.playerCount);
  const gridWidth = freshScenario?.width ?? MAP_WIDTH;
  const gridHeight = freshScenario?.height ?? MAP_HEIGHT;
  const world: GameWorld = savedGame
    ? World.deserialize<GameEvents, GameCommands, GameComponents>(savedGame.worldSnapshot)
    : new World<GameEvents, GameCommands, GameComponents>({
        gridWidth,
        gridHeight,
        tps: TPS,
        seed,
      });
  const worldOccupancy = createWorldOccupancy(
    savedGame ? world.grid.width : gridWidth,
    savedGame ? world.grid.height : gridHeight,
  );
  worldOccupancy.attachWorld(world);

  const state = createBridgeState();
  const accessor = new BridgeStateAccessor(() => world);
  const populations = accessor.get(populationCodec);
  const validAttackPlayerIds = new Set<number>();
  for (let playerId = 1; playerId <= MAX_ATTACK_PLAYER_ID; playerId += 1) {
    if (populations.has(playerId)) validAttackPlayerIds.add(playerId);
  }
  initializeUnitAttackFeed(
    state.unitAttackFeed,
    hydrateUnitAttacks(
      world.getState(TIER_3_SLOTS.replayUnitAttacks),
      world.tick,
      validAttackPlayerIds,
      world.grid,
    ),
    world.tick,
  );
  // Phase 2D — accessor needs to be available to bridgeHelpers (which
  // reads playerAges via accessor in ensureAiState). Constructed here
  // so subsequent ops can consume it. wireBridgeOps does NOT re-construct;
  // it receives this instance.
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
  const scenario = freshScenario;
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
  // Civ selection: ?civ=<name> → createSimulationBridge → here. Override the
  // start's civilization so the chosen civ's bonuses apply. The value already
  // enters the persisted playerCivilizations map via seedFreshScenario; this
  // just changes what that map is seeded with (closure-local, not a save field).
  if (scenario && options.civilizationsByOwner && options.civilizationsByOwner.size > 0) {
    for (const start of scenario.starts) {
      const civ = options.civilizationsByOwner.get(start.owner);
      if (civ !== undefined) {
        start.civilization = civ;
      }
    }
  }
  // Team selection: ?teams=1,1,2 → createSimulationBridge → here. Same shape
  // as the civ override above: it changes what seedFreshScenario seeds the
  // persisted playerTeams map with, rather than being a save field itself.
  if (scenario && options.teamsByOwner && options.teamsByOwner.size > 0) {
    for (const start of scenario.starts) {
      const team = options.teamsByOwner.get(start.owner);
      if (team !== undefined) {
        start.team = team;
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
    // §4.6 AI difficulty: the option overrides the standard default for every
    // AI seat the scenario itself does not pin.
    difficulty: options.difficulty,
    victory: options.victory,
    resourcePreset: options.resourcePreset,
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
