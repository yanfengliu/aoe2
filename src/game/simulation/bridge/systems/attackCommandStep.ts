// One tick of an ATTACK command (spec §10): trebuchet gating, wildlife,
// unit-vs-unit delivery (with blast and the Persian team bonus), and
// unit-vs-building delivery (Sappers, Goth and team bonuses, capture of
// kills, and building destruction). Moved VERBATIM from playerCommandsSystem
// for the 500-LOC budget — one role, "advance an attack one tick"; the
// system's loop now reads as a dispatch table.

import type { EntityRef, Position } from 'civ-engine';
type CivWorld = GameWorld;
import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import type { UnitCommand } from '../sharedTypes';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  projectilesCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
  wildlifeStatesCodec,
} from '../bridgeStateSerialize';
import {
  deliverUnitAttackOnBuilding,
  deliverUnitAttackOnUnit,
} from '../attackDelivery';
import { teamAntiArcherBonus, teamBuildingAttackBonus } from '../../teamCombatBonuses';
import { EMPTY_TECH_SET } from '../../economyTechEffects';
import { manhattanDistance, type GameWorld } from '../pureHelpers';
import { unitMinAttackRange } from '../../prototypeUnitRules';
import type { UnitMovementPlan } from '../movementTypes';

export interface AttackStepDeps {
  activeWorld: CivWorld;
  accessor: BridgeStateAccessor;
  id: number;
  unit: UnitComponent;
  position: Position;
  command: UnitCommand;
  currentEntityId: (world: CivWorld, ref: EntityRef | null | undefined) => number | null;
  getEntityRef: (id: number) => EntityRef | null;
  clearUnitCommand: (id: number) => void;
  findUnitRangePlan: (
    id: number, target: Position, range: number, world: CivWorld,
  ) => UnitMovementPlan | null;
  findBuildingApproachPlan: (
    id: number, buildingId: number, range: number, world: CivWorld,
  ) => UnitMovementPlan | null;
  distanceToBuilding: (buildingId: number, from: Position) => number;
  moveUnitOneSubgridStep: (id: number, step: Position, world: CivWorld) => void;
  advanceTrebuchetTransition: (id: number) => void;
  isTrebuchetStationary: (id: number) => boolean;
  isTrebuchetSilent: (id: number) => boolean;
  beginTrebuchetUnpack: (id: number) => unknown;
  recordUnitAttack: (attackerId: number, targetId: number) => void;
  markOutOfBandRenderChange: () => void;
  ensurePlayerScoreCounters: (owner: number) => { unitsKilled: number };
  destroyUnitEntity: (id: number) => void;
  killWildlifeEntity: (id: number) => void;
  destroyBuildingEntity: (id: number) => void;
}

export function runAttackCommandStep(deps: AttackStepDeps): boolean {
  const {
    activeWorld, accessor, id, unit, position, command,
    currentEntityId, getEntityRef, clearUnitCommand,
    findUnitRangePlan, findBuildingApproachPlan, distanceToBuilding,
    moveUnitOneSubgridStep,
    advanceTrebuchetTransition, isTrebuchetStationary, isTrebuchetSilent,
    beginTrebuchetUnpack,
    recordUnitAttack, markOutOfBandRenderChange,
    ensurePlayerScoreCounters, destroyUnitEntity, killWildlifeEntity,
    destroyBuildingEntity,
  } = deps;
  {

          const attackerCombat = accessor.get(combatStatesCodec).get(id);
          const targetId = currentEntityId(activeWorld, command.targetEntityRef);
          if (targetId === null || !attackerCombat || !command.targetEntityKind) {
            clearUnitCommand(id);
            return true;
          }

          if (attackerCombat.cooldownTicks > 0) {
            attackerCombat.cooldownTicks -= 1;
            accessor.markDirty(combatStatesCodec);
          }

          if (unit.unitType === 'trebuchet' && advanceTrebuchetTransition(id)) {
            return true;
          }

          if (command.targetEntityKind === 'unit') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
            const targetCombat = accessor.get(combatStatesCodec).get(targetId);
            if (!targetPosition || !targetUnit || !targetCombat || targetUnit.owner === unit.owner) {
              clearUnitCommand(id);
              return true;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              if (isTrebuchetStationary(id)) {
                return true;
              }
              const unitRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!unitRangePlan) {
                clearUnitCommand(id);
                return true;
              }
              moveUnitOneSubgridStep(id, unitRangePlan.nextStep, activeWorld);
              return true;
            }

            if (
              manhattanDistance(position, targetPosition) < unitMinAttackRange(unit.unitType)
            ) {
              return true;
            }

            if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
              beginTrebuchetUnpack(id);
              return true;
            }

            if (attackerCombat.cooldownTicks > 0) {
              return true;
            }

            // Primary hit + mangonel blast (spec §10.2/§10.7); splash hits
            // friend and foe alike.
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
              teamUnitBonus: teamAntiArcherBonus(
                accessor.get(playerTeamsCodec),
                accessor.get(playerCivilizationsCodec),
                unit.owner,
                unit.unitType,
                targetUnit.unitType,
              ),
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
            return true;
          }

          if (command.targetEntityKind === 'resource') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetResource = activeWorld.getComponent<ResourceComponent>(targetId, 'resource');
            const targetWildlife = accessor.get(wildlifeStatesCodec).get(targetId);
            if (!targetPosition || !targetResource || !targetWildlife?.isAlive) {
              clearUnitCommand(id);
              return true;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              if (isTrebuchetStationary(id)) {
                return true;
              }
              const wildlifeRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!wildlifeRangePlan) {
                clearUnitCommand(id);
                return true;
              }
              moveUnitOneSubgridStep(id, wildlifeRangePlan.nextStep, activeWorld);
              return true;
            }

            if (
              manhattanDistance(position, targetPosition) < unitMinAttackRange(unit.unitType)
            ) {
              return true;
            }

            if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
              beginTrebuchetUnpack(id);
              return true;
            }

            if (attackerCombat.cooldownTicks > 0) {
              return true;
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
            return true;
          }

          const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
          const targetBuilding = activeWorld.getComponent<BuildingComponent>(targetId, 'building');
          const targetHealth = accessor.get(buildingHealthStatesCodec).get(targetId);
          if (!targetPosition || !targetBuilding || !targetHealth || targetBuilding.owner === unit.owner) {
            clearUnitCommand(id);
            return true;
          }

          if (distanceToBuilding(targetId, position) > attackerCombat.attackRange) {
            if (isTrebuchetStationary(id)) {
              return true;
            }
            const buildingApproachPlan = findBuildingApproachPlan(
              id,
              targetId,
              attackerCombat.attackRange,
              activeWorld,
            );
            if (!buildingApproachPlan) {
              clearUnitCommand(id);
              return true;
            }
            moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
            return true;
          }

          if (
            distanceToBuilding(targetId, position) < unitMinAttackRange(unit.unitType)
          ) {
            return true;
          }

          if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
            beginTrebuchetUnpack(id);
            return true;
          }

          if (attackerCombat.cooldownTicks > 0) {
            return true;
          }

          // DERIVED vs-building bonuses: Sappers, Goths, and team lines,
          // read fresh from owner state — no per-unit copy.
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
            attackerAge: accessor.get(playerAgesCodec).get(unit.owner) ?? 'dark-age',
            teamBuildingBonus: teamBuildingAttackBonus(
              accessor.get(playerTeamsCodec),
              accessor.get(playerCivilizationsCodec),
              unit.owner,
              unit.unitType,
            ),
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
          return true;
        }
  return true;
}
