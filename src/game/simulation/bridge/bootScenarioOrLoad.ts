// Boots a bridge's world content: seed a fresh scenario, or hydrate a save —
// schema 1 through the legacy blob reader, schema 2 from world state — and,
// on any load, re-derive every owner's population cap against the match's
// persisted §4.6 setting (the codec paths cannot see the settings slot from
// inside a codec, so they re-derive at the standard 200 and this pass is
// where a custom cap lands). Split from wireBridgeOps for the 500-LOC budget:
// one role, "get the match's content into the world".

import type { PrototypeScenario } from '../prototypeScenario';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
import type { SaveBlob } from '../saveSchema';
import { isSaveBlobV1 } from '../saveSchema';
import { hydrateFromSavedGame, seedFreshScenario } from './scenarioSeedOps';
import { hydrateRuntimeFromWorldState } from './hydrateFromWorldState';
import { RESOURCE_PRESETS, type ResourcePreset } from '../matchOptions';
import { DEFAULT_DIFFICULTY, type DifficultyLevel } from '../ai';
import {
  deriveCap,
  STANDARD_POPULATION_CAP,
  STANDARD_STARTING_RESOURCES,
} from './bridgeConstants';
import { ownerHardPopCap } from './ownerPopCap';
import { populationCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';

interface BootDeps {
  world: GameWorld;
  scenario: PrototypeScenario | null;
  savedGame: SaveBlob | undefined;
  tiles: number[][];
  matchState: Parameters<typeof hydrateFromSavedGame>[0]['matchState'];
  state: Parameters<typeof hydrateFromSavedGame>[0]['state'];
  accessor: BridgeStateAccessor;
  difficulty?: DifficultyLevel;
  victory?: 'standard' | 'conquest-only';
  resourcePreset?: ResourcePreset;
  populationCap?: number;
  ensureAiState: Parameters<typeof seedFreshScenario>[0]['ensureAiState'];
  inFlightTechSetFor: Parameters<typeof hydrateFromSavedGame>[0]['inFlightTechSetFor'];
  addBuildingEntity: Parameters<typeof seedFreshScenario>[0]['addBuildingEntity'];
  addUnitEntity: Parameters<typeof seedFreshScenario>[0]['addUnitEntity'];
  addResourceEntity: Parameters<typeof seedFreshScenario>[0]['addResourceEntity'];
  findScenarioSpawnPosition: Parameters<typeof seedFreshScenario>[0]['findScenarioSpawnPosition'];
  buildingOccupiesCell: Parameters<typeof seedFreshScenario>[0]['buildingOccupiesCell'];
  isTerrainPassableForUnitId: Parameters<typeof seedFreshScenario>[0]['isTerrainPassableForUnitId'];
  isCellBlockedByBuilding: Parameters<typeof seedFreshScenario>[0]['isCellBlockedByBuilding'];
}

export function bootScenarioOrLoad(deps: BootDeps): void {
  const { world, scenario, savedGame, matchState, state, accessor, tiles } = deps;
  if (!savedGame && scenario) {
    seedFreshScenario({
      world,
      scenario,
      tiles,
      humanPlayerId: HUMAN_PLAYER_ID,
      mapWidth: world.grid.width,
      mapHeight: world.grid.height,
      standardStartingResources: deps.resourcePreset
        ? RESOURCE_PRESETS[deps.resourcePreset]
        : STANDARD_STARTING_RESOURCES,
      standardPopulationCap: STANDARD_POPULATION_CAP,
      defaultDifficulty: deps.difficulty ?? DEFAULT_DIFFICULTY,
      victory: deps.victory,
      populationCap: deps.populationCap,
      state,
      accessor,
      ensureAiState: deps.ensureAiState,
      addBuildingEntity: deps.addBuildingEntity,
      addUnitEntity: deps.addUnitEntity,
      addResourceEntity: deps.addResourceEntity,
      findScenarioSpawnPosition: deps.findScenarioSpawnPosition,
      buildingOccupiesCell: deps.buildingOccupiesCell,
      isTerrainPassableForUnitId: deps.isTerrainPassableForUnitId,
      isCellBlockedByBuilding: deps.isCellBlockedByBuilding,
    });
  }

  if (savedGame) {
    if (isSaveBlobV1(savedGame)) {
      hydrateFromSavedGame({
        world,
        savedGame,
        matchState,
        state,
        accessor,
        inFlightTechSetFor: deps.inFlightTechSetFor,
      });
    } else {
      hydrateRuntimeFromWorldState({
        world,
        matchState,
        state,
        accessor,
        inFlightTechSetFor: deps.inFlightTechSetFor,
      });
    }
  }

  if (savedGame) {
    // §4.6 population cap: the codec paths re-derive caps at the standard 200
    // (they cannot see the settings slot from inside a codec), so a loaded
    // match with a custom cap re-derives once more here, where the whole
    // world — settings included — is in hand.
    // Unconditional: the decode-time cap used the default hard cap, which
    // loses both a custom match cap and the Goth Imperial +10 — the owner's
    // real limit needs civs and ages, which are only all in hand here.
    accessor.mutate(populationCodec, (m) => {
      for (const [owner, population] of m) {
        population.cap = deriveCap(population.rawSupply, ownerHardPopCap(accessor, owner));
      }
    });
  }

}
