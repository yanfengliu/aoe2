// Wildlife combat. Wolves / boars target the nearest hostile unit within
// their aggro range, walk into attack range, and deal damage every reload
// cycle. Cooldown ticks down each tick so multiple wildlife sharing a
// target don't stack hits in the same tick.

import type { EntityRef, Position, World } from 'civ-engine';
import { manhattanDistance, type GameCommands, type GameEvents, type GameWorld } from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
import type { CombatState, WildlifeState } from './systemTypes';

type CivWorld = World<GameEvents, GameCommands>;

export interface WildlifeCombatSystemDeps {
  world: GameWorld;
  wildlifeStates: Map<number, WildlifeState>;
  combatStates: Map<number, CombatState>;
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null) => number | null;
  getEntityRef: (id: number) => EntityRef | null;
  findNearestHostileWildlifeTarget: (
    position: Position,
    aggroRange: number,
    activeWorld: CivWorld,
  ) => number | null;
  findWildlifeRangePlan: (
    entityId: number,
    target: Position,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  setPositionAndSyncOccupancy: (
    entityId: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  destroyUnitEntity: (id: number) => void;
  markOutOfBandRenderChange: () => void;
}

export function registerWildlifeCombatSystem(deps: WildlifeCombatSystemDeps): void {
  const {
    world,
    wildlifeStates,
    combatStates,
    currentEntityId,
    getEntityRef,
    findNearestHostileWildlifeTarget,
    findWildlifeRangePlan,
    setPositionAndSyncOccupancy,
    destroyUnitEntity,
    markOutOfBandRenderChange,
  } = deps;

  world.registerSystem({
    name: 'prototypeWildlifeCombat',
    phase: 'update',
    after: ['prototypeVillagerEconomy'],
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'resource')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const wildlife = wildlifeStates.get(id);
        if (!position || !wildlife?.isAlive) {
          continue;
        }

        if (wildlife.cooldownTicks > 0) {
          wildlife.cooldownTicks -= 1;
        }

        let targetId = currentEntityId(activeWorld, wildlife.targetEntityRef);
        let targetPosition = targetId === null
          ? null
          : activeWorld.getComponent<Position>(targetId, 'position');
        let targetCombat = targetId === null ? null : combatStates.get(targetId);

        if (!targetPosition || !targetCombat || targetCombat.currentHp <= 0) {
          wildlife.targetEntityRef = null;
          targetId = null;
        }

        if (targetId === null && wildlife.autoAggro) {
          targetId = findNearestHostileWildlifeTarget(position, wildlife.aggroRange, activeWorld);
          wildlife.targetEntityRef = targetId === null ? null : getEntityRef(targetId);
          targetPosition = targetId === null
            ? null
            : activeWorld.getComponent<Position>(targetId, 'position');
          targetCombat = targetId === null ? null : combatStates.get(targetId);
        }

        if (!targetId || !targetPosition || !targetCombat) {
          continue;
        }

        if (manhattanDistance(position, targetPosition) > wildlife.attackRange) {
          const movePlan = findWildlifeRangePlan(id, targetPosition, wildlife.attackRange, activeWorld);
          if (!movePlan) {
            wildlife.targetEntityRef = null;
            continue;
          }

          setPositionAndSyncOccupancy(id, movePlan.nextStep, activeWorld);
          continue;
        }

        if (wildlife.cooldownTicks > 0) {
          continue;
        }

        // FU1: wildlife hits respect target armor, floored at 1 so a
        // heavily-armored unit still takes a scrape per hit.
        targetCombat.currentHp -= Math.max(1, wildlife.attackDamage - targetCombat.armor);
        wildlife.cooldownTicks = wildlife.reloadTicks;
        markOutOfBandRenderChange();

        if (targetCombat.currentHp <= 0) {
          destroyUnitEntity(targetId);
          wildlife.targetEntityRef = null;
        }
      }
    },
  });
}
