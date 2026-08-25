// Player command resolver. Drives every unit's `unitCommands` slot once
// per tick: attack runs cooldown / range / damage / kill loops; move walks
// one subgrid step toward the cached path; build walks toward the site
// then ticks the construction counter. Trebuchets get pack / unpack
// transitions woven through the attack and move branches.

import { runBuilderWorkStep } from './builderWorkStep';
import { runTradeStep } from '../tradeCommandStep';
import type { EntityRef, Position } from 'civ-engine';
import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import { manhattanDistance, type GameWorld } from '../pureHelpers';
import { unitMinAttackRange } from '../../prototypeUnitRules';
import { EMPTY_TECH_SET } from '../../economyTechEffects';
import {
  deliverUnitAttackOnBuilding,
  deliverUnitAttackOnUnit,
} from '../attackDelivery';
import { finalizeBuildingConstruction } from '../finalizeBuildingConstruction';
import type { UnitMovementPlan } from '../movementTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  playerCivilizationsCodec,
  projectilesCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
  wildlifeStatesCodec,
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
      // Map iteration is delete-during-iterate-safe per ECMAScript spec, so
      // clearUnitCommand(id) inside the loop body does not need a snapshot.
      for (const [id, command] of unitCommands.entries()) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!position || !unit || (command.type === 'attack' && unit.unitType === 'monk')) {
          clearUnitCommand(id);
          continue;
        }

        if (command.type === 'attack') {
          const attackerCombat = accessor.get(combatStatesCodec).get(id);
          const targetId = currentEntityId(activeWorld, command.targetEntityRef);
          if (targetId === null || !attackerCombat || !command.targetEntityKind) {
            clearUnitCommand(id);
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            attackerCombat.cooldownTicks -= 1;
            accessor.markDirty(combatStatesCodec);
          }

          if (unit.unitType === 'trebuchet' && advanceTrebuchetTransition(id)) {
            continue;
          }

          if (command.targetEntityKind === 'unit') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
            const targetCombat = accessor.get(combatStatesCodec).get(targetId);
            if (!targetPosition || !targetUnit || !targetCombat || targetUnit.owner === unit.owner) {
              clearUnitCommand(id);
              continue;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              if (isTrebuchetStationary(id)) {
                continue;
              }
              const unitRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!unitRangePlan) {
                clearUnitCommand(id);
                continue;
              }
              moveUnitOneSubgridStep(id, unitRangePlan.nextStep, activeWorld);
              continue;
            }

            if (
              manhattanDistance(position, targetPosition) < unitMinAttackRange(unit.unitType)
            ) {
              continue;
            }

            if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
              beginTrebuchetUnpack(id);
              continue;
            }

            if (attackerCombat.cooldownTicks > 0) {
              continue;
            }

            // Primary melee/pierce hit + mangonel-line blast/splash (spec
            // §10.2/§10.7). Splash hits enemy AND friendly units in the radius.
            recordUnitAttack(id, targetId);
            const primaryDied = deliverUnitAttackOnUnit({
              world: activeWorld,
              combatStates: accessor.get(combatStatesCodec),
              projectiles: accessor.get(projectilesCodec),
              tick: activeWorld.tick,
              // Ballistics/Thumb Ring derive from these at the launch site (§10.4).
              attackerTechs:
                accessor.get(researchedTechnologiesCodec).get(unit.owner) ?? EMPTY_TECH_SET,
              targetDestination:
                accessor.get(unitCommandsCodec).get(targetId)?.target ?? null,
              attacker: { id, unitType: unit.unitType, owner: unit.owner, combat: attackerCombat },
              target: {
                id: targetId,
                unitType: targetUnit.unitType,
                position: targetPosition,
                combat: targetCombat,
              },
              destroyUnit: destroyUnitEntity,
              addKill: (owner) => ensurePlayerScoreCounters(owner).unitsKilled++,
              markCombatDirty: () => { accessor.markDirty(combatStatesCodec); accessor.markDirty(projectilesCodec); },
              markRender: markOutOfBandRenderChange,
            });
            if (primaryDied) clearUnitCommand(id);
            continue;
          }

          if (command.targetEntityKind === 'resource') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetResource = activeWorld.getComponent<ResourceComponent>(targetId, 'resource');
            const targetWildlife = accessor.get(wildlifeStatesCodec).get(targetId);
            if (!targetPosition || !targetResource || !targetWildlife?.isAlive) {
              clearUnitCommand(id);
              continue;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              if (isTrebuchetStationary(id)) {
                continue;
              }
              const wildlifeRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!wildlifeRangePlan) {
                clearUnitCommand(id);
                continue;
              }
              moveUnitOneSubgridStep(id, wildlifeRangePlan.nextStep, activeWorld);
              continue;
            }

            if (
              manhattanDistance(position, targetPosition) < unitMinAttackRange(unit.unitType)
            ) {
              continue;
            }

            if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
              beginTrebuchetUnpack(id);
              continue;
            }

            if (attackerCombat.cooldownTicks > 0) {
              continue;
            }

            recordUnitAttack(id, targetId);
            targetWildlife.currentHp -= attackerCombat.attackDamage;
            targetWildlife.targetEntityRef = getEntityRef(id);
            attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
            accessor.markDirty(combatStatesCodec);
            accessor.markDirty(wildlifeStatesCodec); // full-review H1: persist the wildlife HP mutation
            markOutOfBandRenderChange();

            if (targetWildlife.currentHp <= 0) {
              killWildlifeEntity(targetId);
              clearUnitCommand(id);
            }
            continue;
          }

          const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
          const targetBuilding = activeWorld.getComponent<BuildingComponent>(targetId, 'building');
          const targetHealth = accessor.get(buildingHealthStatesCodec).get(targetId);
          if (!targetPosition || !targetBuilding || !targetHealth || targetBuilding.owner === unit.owner) {
            clearUnitCommand(id);
            continue;
          }

          if (distanceToBuilding(targetId, position) > attackerCombat.attackRange) {
            if (isTrebuchetStationary(id)) {
              continue;
            }
            const buildingApproachPlan = findBuildingApproachPlan(
              id,
              targetId,
              attackerCombat.attackRange,
              activeWorld,
            );
            if (!buildingApproachPlan) {
              clearUnitCommand(id);
              continue;
            }
            moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
            continue;
          }

          if (
            distanceToBuilding(targetId, position) < unitMinAttackRange(unit.unitType)
          ) {
            continue;
          }

          if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
            beginTrebuchetUnpack(id);
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            continue;
          }

          // DERIVED vs-building bonuses (no per-unit state): Sappers tech (+15
          // infantry) + Goths civ (+1 infantry), read fresh from owner state.
          const attackerTechs =
            accessor.get(researchedTechnologiesCodec).get(unit.owner) ?? EMPTY_TECH_SET;
          const attackerCiv = accessor.get(playerCivilizationsCodec).get(unit.owner);
          recordUnitAttack(id, targetId);
          deliverUnitAttackOnBuilding({
            world: activeWorld,
            combatStates: accessor.get(combatStatesCodec),
            projectiles: accessor.get(projectilesCodec),
            tick: activeWorld.tick,
            attacker: { id, unitType: unit.unitType, owner: unit.owner, combat: attackerCombat },
            attackerTechs,
            attackerCivilization: attackerCiv,
            target: { id: targetId, position: targetPosition },
            applyBuildingDamage: (_buildingId, damage) => {
              targetHealth.currentHp -= damage;
              accessor.markDirty(buildingHealthStatesCodec);
            },
            destroyUnit: destroyUnitEntity,
            addKill: (owner) => ensurePlayerScoreCounters(owner).unitsKilled++,
            markCombatDirty: () => { accessor.markDirty(combatStatesCodec); accessor.markDirty(projectilesCodec); },
            markRender: markOutOfBandRenderChange,
          });

          if (targetHealth.currentHp <= 0) {
            destroyBuildingEntity(targetId);
            clearUnitCommand(id);
          }
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
            // Spec §12.7 lazy redirect: a unit that arrived in a fully-packed
            // cell and overflowed rewrites its move-command target to the
            // nearest free-slot cell (not clearing it) and moves there next
            // tick; the movement system never re-aims at the full target.
            const redirectTarget = resolveArrivalRedirect(id, movePlan.destination);
            if (redirectTarget) {
              command.target = redirectTarget;
              accessor.markDirty(unitCommandsCodec);
              continue;
            }
            // Spec §12.6 arrival publication: isUnitAtTarget only succeeds
            // after the fine transform has converged on the allocated slot.
            // Republishing the same endpoint is therefore continuity-safe;
            // it never introduces an arrival snap.
            syncUnitTransformToPosition(id, movePlan.destination, activeWorld);
            clearUnitCommand(id);
            continue;
          }

          moveUnitOneSubgridStep(id, movePlan.nextStep, activeWorld);
          continue;
        }

        const buildingId = currentEntityId(activeWorld, command.buildingRef);
        if (buildingId === null) {
          clearUnitCommand(id);
          continue;
        }

        const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
        const construction = accessor.get(constructionStatesCodec).get(buildingId);
        const buildingApproachPlan = findBuildingApproachPlan(id, buildingId, 1, activeWorld);
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
          });
          clearUnitCommand(id);
        }
      }
    },
  });
}
