// Player command resolver. Drives every unit's `unitCommands` slot once
// per tick: attack runs cooldown / range / damage / kill loops; move walks
// one subgrid step toward the cached path; build walks toward the site
// then ticks the construction counter. Trebuchets get pack / unpack
// transitions woven through the attack and move branches.

import type { EntityRef, Position, World } from 'civ-engine';
import type {
  BuildingComponent,
  PopulationState,
  RenderableComponent,
  ResourceComponent,
  UnitComponent,
  VisionSourceComponent,
} from '../../types';
import { manhattanDistance, type GameCommands, type GameEvents, type GameWorld } from '../pureHelpers';
import {
  buildingTint,
  buildingVisionRadius,
  createBuildingCombatState,
} from '../../prototypeBuildingRules';
import {
  attackBonusAgainstBuilding,
  attackBonusAgainstUnit,
  unitMinAttackRange,
} from '../../prototypeUnitRules';
import type { UnitMovementPlan } from '../movementTypes';
import type {
  BuildingCombatState,
  UnitCommand,
  WildlifeState,
} from './systemTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
} from '../bridgeStateSerialize';

type CivWorld = World<GameEvents, GameCommands>;

interface PlayerScoreCountersLike {
  unitsKilled: number;
}

export interface PlayerCommandsSystemDeps {
  world: GameWorld;
  unitCommands: Map<number, UnitCommand>;
  buildingCombatStates: Map<number, BuildingCombatState>;
  // Phase 2D: constructionStates + combatStates + buildingHealthStates
  // migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  wildlifeStates: Map<number, WildlifeState>;
  population: Map<number, PopulationState>;
  clearUnitCommand: (unitId: number) => void;
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
  isUnitAtTarget: (
    unitId: number,
    target: Position,
    activeWorld: CivWorld,
  ) => boolean;
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
  onBuildingConstructionComplete: (
    buildingId: number,
    owner: number,
    buildingType: BuildingComponent['buildingType'],
  ) => void;
}

export function registerPlayerCommandsSystem(deps: PlayerCommandsSystemDeps): void {
  const {
    world,
    unitCommands,
    buildingCombatStates,
    accessor,
    wildlifeStates,
    population,
    clearUnitCommand,
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
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity,
    killWildlifeEntity,
    destroyBuildingEntity,
    getEntityRef,
    onBuildingConstructionComplete,
  } = deps;

  world.registerSystem({
    name: 'prototypePlayerCommands',
    phase: 'update',
    after: ['prototypeAi', 'prototypeAutoAggression'],
    execute(activeWorld) {
      // Map iteration is delete-during-iterate-safe per ECMAScript spec, so
      // clearUnitCommand(id) inside the loop body does not need a snapshot.
      for (const [id, command] of unitCommands.entries()) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!position || !unit) {
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

            const rawDamage =
              attackerCombat.attackDamage + attackBonusAgainstUnit(unit.unitType, targetUnit.unitType);
            targetCombat.currentHp -= Math.max(1, rawDamage - targetCombat.armor);
            attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
            accessor.markDirty(combatStatesCodec);
            markOutOfBandRenderChange();

            if (targetCombat.currentHp <= 0) {
              ensurePlayerScoreCounters(unit.owner).unitsKilled += 1;
              destroyUnitEntity(targetId);
              clearUnitCommand(id);
            }
            continue;
          }

          if (command.targetEntityKind === 'resource') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetResource = activeWorld.getComponent<ResourceComponent>(targetId, 'resource');
            const targetWildlife = wildlifeStates.get(targetId);
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

            targetWildlife.currentHp -= attackerCombat.attackDamage;
            targetWildlife.targetEntityRef = getEntityRef(id);
            attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
            accessor.markDirty(combatStatesCodec);
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

          targetHealth.currentHp -= Math.max(
            0,
            attackerCombat.attackDamage + attackBonusAgainstBuilding(unit.unitType),
          );
          accessor.markDirty(buildingHealthStatesCodec);
          attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
          accessor.markDirty(combatStatesCodec);
          markOutOfBandRenderChange();

          if (targetHealth.currentHp <= 0) {
            destroyBuildingEntity(targetId);
            clearUnitCommand(id);
          }
          continue;
        }

        if (command.type === 'move') {
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
        if (!building || !construction || construction.isComplete || !buildingApproachPlan) {
          clearUnitCommand(id);
          continue;
        }

        if (!isUnitAtTarget(id, buildingApproachPlan.destination, activeWorld)) {
          moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
          continue;
        }

        construction.buildProgressTicks += 1;
        accessor.markDirty(constructionStatesCodec);
        const buildingHealth = accessor.get(buildingHealthStatesCodec).get(buildingId);
        if (buildingHealth && construction.totalBuildTicks > 0) {
          const startHp = Math.max(1, Math.floor(buildingHealth.maxHp * 0.1));
          const hpPerTick = (buildingHealth.maxHp - startHp) / construction.totalBuildTicks;
          buildingHealth.currentHp = Math.min(
            buildingHealth.maxHp,
            buildingHealth.currentHp + hpPerTick,
          );
          accessor.markDirty(buildingHealthStatesCodec);
        }
        if (construction.buildProgressTicks >= construction.totalBuildTicks) {
          construction.buildProgressTicks = construction.totalBuildTicks;
          construction.isComplete = true;
          if (buildingHealth) {
            buildingHealth.currentHp = Math.min(
              buildingHealth.maxHp,
              Math.round(buildingHealth.currentHp),
            );
            accessor.markDirty(buildingHealthStatesCodec);
          }

          const renderable = activeWorld.getComponent<RenderableComponent>(buildingId, 'renderable');
          if (renderable) {
            renderable.tint = buildingTint(building.buildingType, building.owner, true);
            renderable.visualVariant = 'complete';
            markOutOfBandRenderChange();
          }

          const defaultVisionRadius = buildingVisionRadius(building.buildingType);
          if (
            defaultVisionRadius !== null
            && !activeWorld.getComponent<VisionSourceComponent>(buildingId, 'visionSource')
          ) {
            activeWorld.addComponent(buildingId, 'visionSource', {
              playerId: building.owner,
              radius: defaultVisionRadius,
            });
          }

          const buildingCombatState = createBuildingCombatState(building.buildingType);
          if (buildingCombatState) {
            buildingCombatStates.set(buildingId, buildingCombatState);
          }

          const populationState = population.get(building.owner);
          if (populationState) {
            populationState.cap += construction.populationProvided;
          }

          onBuildingConstructionComplete(buildingId, building.owner, building.buildingType);

          clearUnitCommand(id);
        }
      }
    },
  });
}
