// Shared type contracts for the AI planner system (`prototypeAi`). The system
// entry point lives in `aiSystem.ts`; per-tick decision phases live in the
// `aiSystem*Phase.ts` siblings. `AiSystemDeps` is the injected dependency
// surface; `AiOwnerContext` bundles the per-owner, per-tick state the phases
// read/mutate.

import { type EntityRef, type Position, type VisibilityMap } from 'civ-engine';
import type {
  AgeType,
  BuildableBuildingType,
  BuildingType,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitType,
} from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { MonkTask, UnitCommand } from '../sharedTypes';
import type { AiState } from '../../ai';

export type CivWorld = GameWorld;
type PushMonkContextAtEntityIntention = (
  monkId: number,
  targetEntityId: number,
  options: { expectedOwner: number; intendedTaskKind: MonkTask['kind'] },
) => void;

export interface AiSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  // Phase 2D: townCenterRefs/aiStates/population/playerResources/unitCommands/
  // wildlifeStates migrated to world.state.aoe2.* — per-tick reads via accessor.
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor;
  monksByOwner: Map<number, Set<number>>;
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null | undefined) => number | null;
  getPlayerAge: (owner: number) => import('../../types').AgeType;
  villagerRebalance: (owner: number, targets: AiState['villagerTargets']) => void;
  findOwnedBuilding: (owner: number, buildingType: BuildingType) => number | null;
  findOwnedUnitOnMap: (owner: number, unitType: UnitType) => number | null;
  /** Whether a land unit can stand on this cell — the shore test for fish. */
  isLandCell: (x: number, y: number) => boolean;
  ownedMilitaryUnitIds: (owner: number) => Set<number>;
  findOwnedMilitaryUnits: (owner: number) => Array<{ id: number }>;
  hasOwnedWonder: (owner: number) => boolean;
  isConstructingBuilding: (owner: number, buildingType: BuildingType) => boolean;
  pickWatchTowerPlacement: (
    townCenterPosition: Position,
    enemyPosition: Position,
  ) => Position | null;
  // Phase 1C — AI-decision intention push (DESIGN v17 §6.5/§6.6). The
  // dispatcher's `drainPendingCommands` between ticks submits each via
  // `world.submitWithResult`; the corresponding handler runs at the start
  // of the NEXT tick's `processCommands`. Pre-1B `startConstruction` lives
  // on as `startConstructionDirect` for the handler delegate path.
  pushBuildingPlaceConfirmIntention: (
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ) => void;
  findBuildPlacementNear: (
    nearby: Position,
    buildingType: BuildingType,
  ) => Position | null;
  countOwnedUnits: (owner: number, unitType: UnitType) => number;
  countQueuedUnits: (buildingId: number, unitType: TrainableUnitType) => number;
  canAdvanceToFeudalAge: (owner: number) => boolean;
  canAdvanceToCastleAge: (owner: number) => boolean;
  canAdvanceToImperialAge: (owner: number) => boolean;
  pushQueueResearchIntention: (
    buildingId: number,
    technologyType: ResearchableTechnologyType,
  ) => void;
  pushQueueTrainIntention: (buildingId: number, unitType: TrainableUnitType) => void;
  pushMarketActionIntention: (playerId: number, actionType: MarketActionType) => void;
  pushUnitContextIntention: (
    unitId: number,
    target: { x: number; y: number },
    garrison: boolean,
  ) => void;
  pushTributeIntention: (
    playerId: number,
    toPlayerId: number,
    resource: import('../../types').EconomyResourceKind,
    amount: number,
  ) => void;
  // Phase 1C — read-only handle to the dispatcher's pending intention
  // queue. aiSystem inspects it each decision tick to compute "effective"
  // queue / in-flight counts: an intention pushed this tick won't appear in
  // `productionQueues` / `inFlightTechByOwner` until the handler runs at
  // the NEXT tick, so without this gate aiSystem would re-push every
  // decision tick and over-spend across the silent-no-op B2 surface.
  pendingCommands: Array<{ type: string; data: Record<string, unknown> }>;
  getTrainOptions: (owner: number, buildingType: BuildingType) => TrainableUnitType[];
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => ResearchableTechnologyType[];
  pushAiMonkTaskIntentions: (
    owner: number,
    pushMonkContextAtEntityIntention: PushMonkContextAtEntityIntention,
  ) => void;
  pushMonkContextAtEntityIntention: PushMonkContextAtEntityIntention;
  findPreferredVisibleEnemyUnit: (owner: number, position: Position) => number | null;
  findPreferredVisibleEnemyBuilding: (owner: number, position: Position) => number | null;
  // Phase 1C: AI-decision systems push intentions; the dispatcher submits
  // between ticks. These are NOT synchronous facades — return value is
  // always true (queued; handler runs at next tick). Renamed from
  // `issueUnit*Command` per full-review iter-1 R2-M2/R2-D4 to match the
  // contract: pre-1B's facade returned false on stale targets and the
  // fallback chain depended on that; post-1C the chain semantics changed
  // and the misleading name caused R2-M2's silent dead-fallback bug.
  submitUnitAttackIntention: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  submitUnitMoveIntention: (unitId: number, target: Position) => boolean;
  pushUnitContextAtEntityIntention: (
    unitId: number,
    targetEntityId: number,
    garrison: boolean,
  ) => void;
  pushBuildingActionIntention: (buildingId: number, actionType: 'ungarrison') => void;
}

// Per-owner, per-decision-tick context threaded into each decision phase. Bundles
// the state formerly closed over inside the single `execute` closure so the
// phases can live in sibling modules while sharing identical references (the
// pending-intention maps and `claimedVillagers` are mutated across phases and
// owners within a tick, so they must be the same instances).
export interface AiOwnerContext {
  activeWorld: CivWorld;
  owner: number;
  state: AiState;
  interval: number;
  currentTick: number;
  ownerTownCenterId: number | null;
  ownerTownCenterPosition: Position | null | undefined;
  /** The enemy this AI is attacking: its nearest one. Null when it has no
   *  enemy left with a Town Center. */
  targetOwner: number | null;
  targetTownCenterId: number | null;
  targetTownCenterPosition: Position | null | undefined;
  /**
   * Where to march when NO enemy Town Center is left anywhere — the nearest
   * surviving enemy building.
   *
   * READ BY THE ATTACK PHASE AND NOTHING ELSE, deliberately. A conquest match
   * ends only when a player has no units AND no buildings, so an AI that can
   * only aim at Town Centers stands beside a base it cannot finish and the
   * match never ends. Folding this into `targetTownCenterPosition` instead
   * looked simpler and REGRESSED the age-up: that field is also read by
   * `aiFerryPhase`, which stands down the ordinary march AND discretionary
   * building to fund a Transport Ship, so handing it a position stalled the
   * economy (`aiPlayer.test.ts` :: "ages up through the ages within a generous
   * tick budget" went red, reaching Feudal and never Castle). Keeping it in its
   * own field is what makes this change reach only the thing it is about.
   */
  lastResortTargetId: number | null;
  lastResortTargetPosition: Position | null | undefined;
  currentAge: AgeType;
  stockpile: PlayerResources | undefined;
  populationBlocked: boolean;
  unitCommands: Map<number, UnitCommand>;
  claimedVillagers: Set<number>;
  findAvailableVillagerForBuild: (ownerId: number) => number | null;
  findIdleProducerLocal: (buildingType: BuildingType) => number | null;
  pendingTrainsByBuilding: Map<number, number>;
  pendingResearchByBuilding: Map<number, number>;
  pendingResearchKeys: Set<string>;
  pendingBuildsByOwner: Map<number, number>;
}
