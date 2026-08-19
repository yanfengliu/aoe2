// agent-affordances: single construction site for the per-command
// semantic-validator dep bags, factored out of wireBridgeOps when the
// A1/A3 actionable-message collaborators pushed the inline literals
// past its 605-line budget. One place to read every validator wiring;
// also owns the research reason engine so the queue.research validator
// and buildingOptionsOps share one source of "why not".

import type { Position } from 'civ-engine';

import type {
  BuildableBuildingType,
  BuildingType,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitType,
} from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { CommandHandlerDeps } from './registerCommandHandlers';
import type { PlacementBlockReport } from './cellPassability';
import type { ResearchAvailability } from './researchAvailability';

export interface CommandValidatorDepsInputs {
  accessor: BridgeStateAccessor;
  // The shared reason engine (created once in wireBridgeOps; also
  // consumed by buildingOptionsOps for the agent snapshot).
  researchUnavailableReason: ResearchAvailability['researchUnavailableReason'];
  // optionsRules collaborators
  getTrainOptions: (owner: number, buildingType: BuildingType) => readonly TrainableUnitType[];
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => readonly ResearchableTechnologyType[];
  getMarketOptions: (owner: number, buildingType: BuildingType) => readonly MarketActionType[];
  getBuildOptions: (owner: number, unitType: UnitType) => readonly BuildableBuildingType[];
  // bridge-local collaborators
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
  playerOwnsCompletedMarket: (owner: number) => boolean;
  isPlacementBlocked: (
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
  ) => boolean;
  describePlacementBlockers: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => PlacementBlockReport | null;
  findOpenPlacementAnchors: (
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    opts: {
      max: number;
      maxRadius?: number;
      isCellVisible: (x: number, y: number) => boolean;
    },
  ) => Position[];
  isCellVisibleToOwner: (owner: number, x: number, y: number) => boolean;
  marketFeeRate: number;
  marketTransactionAmount: number;
  mapWidth: number;
  mapHeight: number;
}

type ValidatorDepsBundle = Pick<
  CommandHandlerDeps,
  | 'queueTrainValidatorDeps'
  | 'queueResearchValidatorDeps'
  | 'marketActionValidatorDeps'
  | 'buildingPlaceConfirmValidatorDeps'
  | 'buildingSetRallyPointValidatorDeps'
  | 'buildingActionValidatorDeps'
  | 'trebuchetPackValidatorDeps'
  | 'trebuchetUnpackValidatorDeps'
>;

export interface CommandValidatorDepsResult {
  validatorDeps: ValidatorDepsBundle;
}

export function buildCommandValidatorDeps(
  inputs: CommandValidatorDepsInputs,
): CommandValidatorDepsResult {
  return {
    validatorDeps: {
      queueTrainValidatorDeps: {
        accessor: inputs.accessor,
        getTrainOptions: inputs.getTrainOptions,
      },
      queueResearchValidatorDeps: {
        accessor: inputs.accessor,
        getResearchOptions: inputs.getResearchOptions,
        inFlightTechSetFor: inputs.inFlightTechSetFor,
        researchUnavailableReason: inputs.researchUnavailableReason,
      },
      marketActionValidatorDeps: {
        accessor: inputs.accessor,
        getMarketOptions: inputs.getMarketOptions,
        playerOwnsCompletedMarket: inputs.playerOwnsCompletedMarket,
        marketFeeRate: inputs.marketFeeRate,
        marketTransactionAmount: inputs.marketTransactionAmount,
      },
      buildingPlaceConfirmValidatorDeps: {
        accessor: inputs.accessor,
        getBuildOptions: inputs.getBuildOptions,
        isPlacementBlocked: inputs.isPlacementBlocked,
        describePlacementBlockers: inputs.describePlacementBlockers,
        findOpenPlacementAnchors: inputs.findOpenPlacementAnchors,
        isCellVisibleToOwner: inputs.isCellVisibleToOwner,
        mapWidth: inputs.mapWidth,
        mapHeight: inputs.mapHeight,
      },
      buildingSetRallyPointValidatorDeps: {
        accessor: inputs.accessor,
        mapWidth: inputs.mapWidth,
        mapHeight: inputs.mapHeight,
      },
      buildingActionValidatorDeps: { accessor: inputs.accessor },
      trebuchetPackValidatorDeps: { accessor: inputs.accessor },
      trebuchetUnpackValidatorDeps: { accessor: inputs.accessor },
    },
  };
}
