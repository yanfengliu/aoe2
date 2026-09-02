// Player command resolver. Drives every unit's `unitCommands` slot once
// per tick: attack runs cooldown / range / damage / kill loops; move walks
// one subgrid step toward the cached path; build walks toward the site
// then ticks the construction counter. Trebuchets get pack / unpack
// transitions woven through the attack and move branches.

import { runAttackCommandStep } from './attackCommandStep';
import { isMonasticUnit } from '../../monasticUnits';
import { advanceQueuedBuildCommand, runBuilderWorkStep } from './builderWorkStep';
import { runRepairUnitStep } from './repairUnitStep';
import { runAttackGroundStep } from './attackGroundStep';
import { runTradeStep } from '../tradeCommandStep';
import type { EntityRef, Position } from 'civ-engine';
import type {
  BuildingComponent,
  UnitComponent,
} from '../../types';
import { type GameWorld } from '../pureHelpers';
import { finalizeBuildingConstruction } from '../finalizeBuildingConstruction';
import type { UnitMovementPlan } from '../movementTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  constructionStatesCodec,
  unitCommandsCodec,
} from '../bridgeStateSerialize';

type CivWorld = GameWorld;

interface PlayerScoreCountersLike {
  unitsKilled: number;
}

export interface PlayerCommandsSystemDeps {
  world: GameWorld;
  // Phase 2D: constructionStates + combatStates + buildingHealthStates +
  // buildingCombatStates migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  // Phase 2D: population migrated to world.state.aoe2.* via accessor.
  clearUnitCommand: (unitId: number) => void;
  setUnitCommand: (unitId: number, command: import('../sharedTypes').UnitCommand) => void;
  // Puts a unit INSIDE a building. The garrison command walks it there first;
  // this is the arrival half.
  garrisonUnit: (unitId: number, buildingId: number) => boolean;
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null | undefined) => number | null;
  distanceToBuilding: (id: number, position: Position) => number;
  advanceTrebuchetTransition: (id: number) => boolean;
  isTrebuchetStationary: (id: number) => boolean;
  isTrebuchetSilent: (id: number) => boolean;
  beginTrebuchetUnpack: (id: number) => void;
  beginTrebuchetPack: (id: number) => void;
  findUnitRangePlan: (
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  findBuildingApproachPlan: (
    unitId: number,
    targetId: number,
    range: number,
    activeWorld: CivWorld,
    nearestFirst?: boolean,
  ) => UnitMovementPlan | null;
  moveUnitOneSubgridStep: (
    entityId: number,
    nextStep: Position,
    activeWorld?: CivWorld,
    stepPerTick?: number,
  ) => void;
  isUnitAtTarget: (unitId: number, target: Position, activeWorld: CivWorld) => boolean;
  // Spec §12.7 lazy redirect: null if the unit found a free slot at its arrival
  // cell; a redirected target Position if it overflowed and a neighbor has a
  // free slot (caller rewrites the move target there, preventing oscillation).
  resolveArrivalRedirect: (unitId: number, arrivalCell: Position) => Position | null;
  // Spec §12.6 visual non-overlap arrival publication: once movement has
  // converged on the engine-allocated slot, republish that exact endpoint so
  // stationary units in the same cell remain distinct without a final snap.
  syncUnitTransformToPosition: (
    unitId: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  resolveMovePlanFromCache: (
    unitId: number,
    target: Position,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  markOutOfBandRenderChange: () => void;
  notePassabilityChange: () => void;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
  destroyUnitEntity: (id: number) => void;
  killWildlifeEntity: (id: number) => void;
  destroyBuildingEntity: (id: number) => void;
  getEntityRef: (id: number) => EntityRef | null;
  recordUnitAttack: (attackerId: number, targetId: number) => void;
  onBuildingConstructionComplete: (
    buildingId: number,
    owner: number,
    buildingType: BuildingComponent['buildingType'],
    visionSourceAdded: boolean,
  ) => void;
}

export function registerPlayerCommandsSystem(deps: PlayerCommandsSystemDeps): void {
  const {
    world,
    accessor,
    clearUnitCommand,
    setUnitCommand,
    garrisonUnit,
    currentEntityId,
    distanceToBuilding,
    advanceTrebuchetTransition,
    isTrebuchetStationary,
    isTrebuchetSilent,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    findUnitRangePlan,
    findBuildingApproachPlan,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveArrivalRedirect,
    syncUnitTransformToPosition,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    notePassabilityChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity,
    killWildlifeEntity,
    destroyBuildingEntity,
    getEntityRef, recordUnitAttack,
    onBuildingConstructionComplete,
  } = deps;

  world.registerSystem({
    name: 'prototypePlayerCommands',
    phase: 'update',
    after: ['prototypeAi', 'prototypeAutoAggression'],
    execute(activeWorld) {
      const unitCommands = accessor.get(unitCommandsCodec);
      // Per-TICK builder tally, keyed by building id: the first villager to
      // work a site this tick adds a full tick of progress and the rest add a
      // third each, which is AoE2's 3 * base / (n + 2) curve. Rebuilt every
      // tick on purpose — nothing about the curve is persisted state.
      const buildersCreditedThisTick = new Map<number, number>();
      // Map iteration is delete-safe per spec: clearUnitCommand needs no snapshot.
      for (const [id, command] of unitCommands.entries()) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!position || !unit || (command.type === 'attack' && isMonasticUnit(unit.unitType))) {
          clearUnitCommand(id);
          continue;
        }

        if (command.type === 'attack') {
          const handled = runAttackCommandStep({
            activeWorld, accessor, id, unit, position, command,
            currentEntityId, getEntityRef, clearUnitCommand,
            findUnitRangePlan, findBuildingApproachPlan, distanceToBuilding,
            moveUnitOneSubgridStep,
            advanceTrebuchetTransition, isTrebuchetStationary, isTrebuchetSilent,
            beginTrebuchetUnpack,
            recordUnitAttack, markOutOfBandRenderChange,
            ensurePlayerScoreCounters, destroyUnitEntity, killWildlifeEntity,
            destroyBuildingEntity,
          });
          void handled;
          continue;
        }

        if (command.type === 'move' || command.type === 'attack-move') { // §12.4.2
          if (unit.unitType === 'trebuchet') {
            if (advanceTrebuchetTransition(id)) {
              continue;
            }
            if (isTrebuchetStationary(id)) {
              beginTrebuchetPack(id);
              continue;
            }
          }

          if (!command.target) {
            clearUnitCommand(id);
            continue;
          }
          const movePlan = resolveMovePlanFromCache(id, command.target, activeWorld);
          if (!movePlan) {
            clearUnitCommand(id);
            continue;
          }

          if (isUnitAtTarget(id, movePlan.destination, activeWorld)) {
            // Shift-queue (v0.3.125): an arrival with legs left starts the
            // next leg instead of clearing — the waypoint chain in one line.
            const nextLeg = command.queuedTargets?.[0];
            if (command.type === 'move' && nextLeg) {
              command.target = nextLeg;
              command.queuedTargets = command.queuedTargets!.slice(1);
              accessor.markDirty(unitCommandsCodec);
              continue;
            }
            // Spec §12.7 lazy redirect: an overflowed arrival rewrites the
            // move target to the nearest free-slot cell (never cleared) and
            // walks there next tick; nothing re-aims at the full cell.
            const redirectTarget = resolveArrivalRedirect(id, movePlan.destination);
            if (redirectTarget) {
              command.target = redirectTarget;
              accessor.markDirty(unitCommandsCodec);
              continue;
            }
            // Spec §12.6: isUnitAtTarget only succeeds after the fine
            // transform converged, so republishing the endpoint never snaps.
            syncUnitTransformToPosition(id, movePlan.destination, activeWorld);
            clearUnitCommand(id);
            continue;
          }

          moveUnitOneSubgridStep(id, movePlan.nextStep, activeWorld);
          continue;
        }

        // Attack-ground (spec §10.7, v0.3.117): bombard the ordered cell.
        if (command.type === 'attack-ground') {
          runAttackGroundStep({
            world: activeWorld, accessor, id, unit, position, command,
            findUnitRangePlan, moveUnitOneSubgridStep, clearUnitCommand,
            markRender: markOutOfBandRenderChange,
          });
          continue;
        }

        // Unit repair (spec §8.1, v0.3.107): 'repair' with a UNIT target ref is
        // the mechanical-unit branch — pursue and mend, no buildingRef at all.
        if (command.type === 'repair' && command.targetEntityKind === 'unit') {
          runRepairUnitStep({
            world: activeWorld, accessor, id, command,
            currentEntityId, findUnitRangePlan, isUnitAtTarget,
            moveUnitOneSubgridStep, clearUnitCommand,
          });
          continue;
        }

        const buildingId = currentEntityId(activeWorld, command.buildingRef);
        if (buildingId === null) {
          clearUnitCommand(id);
          continue;
        }

        const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
        const construction = accessor.get(constructionStatesCodec).get(buildingId);
        // Nearest-first for a walk to a CONSTRUCTION SITE only (finding F2):
        // that is the walk that took 22 s of game time to the far edge, and
        // the one that capped a crew at a single working builder.
        const buildingApproachPlan = findBuildingApproachPlan(
          id, buildingId, 1, activeWorld,
          command.type === 'build' && construction !== undefined && !construction.isComplete,
        );
        if (!building || !buildingApproachPlan) {
          clearUnitCommand(id);
          continue;
        }

        if (command.type === 'trade') {
          // Land trade (spec §6.7): the step module owns the whole cycle.
          runTradeStep({
            world: activeWorld,
            accessor,
            id,
            owner: unit.owner,
            command,
            buildingId,
            building,
            approachDestination: buildingApproachPlan.destination,
            approachStep: buildingApproachPlan.nextStep,
            isUnitAtTarget,
            moveUnitOneSubgridStep,
            clearUnitCommand,
            setUnitCommand,
            currentEntityId,
            getEntityRef,
          });
          continue;
        }

        if (command.type === 'garrison') {
          // Walk to the building, then go in — AoE2's behaviour, and the reason
          // garrison is a command at all rather than an instant effect.
          if (isUnitAtTarget(id, buildingApproachPlan.destination, activeWorld)) {
            garrisonUnit(id, buildingId);
            clearUnitCommand(id);
          } else {
            moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
          }
          continue;
        }

        const advanced = runBuilderWorkStep({
          world: activeWorld,
          accessor,
          id,
          unit,
          command,
          buildingId,
          building,
          construction,
          approachPlan: buildingApproachPlan,
          isUnitAtTarget,
          moveUnitOneSubgridStep,
          clearUnitCommand,
          buildersCreditedThisTick,
        });
        if (!advanced) continue;

        if (advanced.buildProgressTicks >= advanced.totalBuildTicks) {
          finalizeBuildingConstruction({
            world: activeWorld,
            accessor,
            buildingId,
            building,
            onComplete: onBuildingConstructionComplete,
            markRender: markOutOfBandRenderChange,
            notePassabilityChange,
          });
          // Build chain (v0.3.126): a queued next site takes over instead of
          // clearing — the builder walks straight from the finished roof to
          // the next foundation, AoE2's shift-build.
          if (!advanceQueuedBuildCommand(activeWorld, accessor, command)) {
            clearUnitCommand(id);
          }
        }
      }
    },
  });
}
