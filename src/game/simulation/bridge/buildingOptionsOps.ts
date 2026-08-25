// agent-affordances B: "what can each of my buildings do right now"
// payload for the LLM-agent snapshot (campaign-1 backlog #2). Per
// distinct COMPLETED owned building type: research available now (with
// cost), research visible-but-locked (with the WHY from the shared
// researchAvailability reason engine — including in-flight techs, so
// the agent doesn't double-queue), and trainable units. Plus the
// villager build menu with footprints + costs, which pairs with the
// snapshot's placementHints.
//
// Read-side only; composes existing optionsRules + playerQueries
// surfaces. Exposed publicly as SimulationBridge.getAgentBuildingOptions.

import { ownerConstructionCost } from './ownerCosts';
import { researchCost } from '../prototypeEconomyRules';
import type {
  BuildableBuildingType,
  BuildingComponent,
  BuildingType,
  PlayerResources,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitType,
} from '../types';
import { buildingFootprint, type GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { constructionStatesCodec } from './bridgeStateSerialize';

export interface AgentResearchOption {
  tech: ResearchableTechnologyType;
  cost: Partial<PlayerResources>;
}

export interface AgentLockedResearch {
  tech: ResearchableTechnologyType;
  reason: string;
}

export interface AgentBuildingTypeOptions {
  buildingType: BuildingType;
  research: AgentResearchOption[];
  researchLocked: AgentLockedResearch[];
  train: TrainableUnitType[];
}

export interface AgentBuildOption {
  buildingType: BuildableBuildingType;
  footprint: string; // e.g. "2x2" — pairs with placementHints anchors
  cost: Partial<PlayerResources>;
}

export interface AgentBuildingOptions {
  byBuildingType: AgentBuildingTypeOptions[];
  villagerCanBuild: AgentBuildOption[];
}

export interface BuildingOptionsDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => readonly ResearchableTechnologyType[];
  getVisibleResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => readonly ResearchableTechnologyType[];
  getTrainOptions: (owner: number, buildingType: BuildingType) => readonly TrainableUnitType[];
  getBuildOptions: (owner: number, unitType: UnitType) => readonly BuildableBuildingType[];
  /** The owner's civilization, for civ-priced building costs. */
  getPlayerCivilization?: (ownerId: number) => string;
  // Read-only probe (iter-1 Claude L2): unlike the command paths'
  // get-or-create inFlightTechSetFor, this must not insert an entry for
  // owners that have none — getAgentBuildingOptions is a pure read
  // surface and must not perturb bridge state.
  inFlightTechsFor: (owner: number) => ReadonlySet<ResearchableTechnologyType>;
  researchUnavailableReason: (
    owner: number,
    buildingType: BuildingType,
    tech: ResearchableTechnologyType,
  ) => string;
}

export interface BuildingOptionsOps {
  getAgentBuildingOptions(ownerId: number): AgentBuildingOptions;
}

export function createBuildingOptionsOps(deps: BuildingOptionsDeps): BuildingOptionsOps {
  function completedOwnedBuildingTypes(ownerId: number): BuildingType[] {
    const constructionStates = deps.accessor.get(constructionStatesCodec);
    const types = new Set<BuildingType>();
    for (const id of deps.world.query('building')) {
      const building = deps.world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== ownerId) continue;
      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) continue;
      types.add(building.buildingType);
    }
    return [...types].sort();
  }

  function getAgentBuildingOptions(ownerId: number): AgentBuildingOptions {
    const byBuildingType: AgentBuildingTypeOptions[] = [];
    const inFlight = deps.inFlightTechsFor(ownerId);
    for (const buildingType of completedOwnedBuildingTypes(ownerId)) {
      const available = deps.getResearchOptions(ownerId, buildingType);
      const research: AgentResearchOption[] = [];
      const researchLocked: AgentLockedResearch[] = [];
      for (const tech of available) {
        if (inFlight.has(tech)) {
          researchLocked.push({ tech, reason: `${tech} is already being researched.` });
        } else {
          research.push({ tech, cost: { ...researchCost(tech) } });
        }
      }
      // Visible-but-unavailable (today only the TC's next age-up): state
      // the unmet rule instead of hiding the button like the HUD does.
      for (const tech of deps.getVisibleResearchOptions(ownerId, buildingType)) {
        if (available.includes(tech)) continue;
        researchLocked.push({
          tech,
          reason: deps.researchUnavailableReason(ownerId, buildingType, tech),
        });
      }
      const train = [...deps.getTrainOptions(ownerId, buildingType)];
      // Skip pure-noise entries (e.g. houses) — nothing to do there.
      if (research.length + researchLocked.length + train.length === 0) continue;
      byBuildingType.push({ buildingType, research, researchLocked, train });
    }
    const villagerCanBuild: AgentBuildOption[] = deps
      .getBuildOptions(ownerId, 'villager')
      .map((buildingType) => {
        const footprint = buildingFootprint(buildingType);
        return {
          buildingType,
          footprint: `${footprint.width}x${footprint.height}`,
          cost: { ...ownerConstructionCost(deps.accessor, ownerId, buildingType) },
        };
      });
    return { byBuildingType, villagerCanBuild };
  }

  return { getAgentBuildingOptions };
}
