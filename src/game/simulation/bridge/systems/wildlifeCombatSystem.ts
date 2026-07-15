// Wildlife combat. Wolves / boars target the nearest hostile unit within
// their aggro range, walk into attack range, and deal damage every reload
// cycle. Cooldown ticks down each tick so multiple wildlife sharing a
// target don't stack hits in the same tick.

import type { EntityRef, Position } from 'civ-engine';
import type { UnitComponent } from '../../types';
import { effectiveMeleeArmor } from '../../prototypeUnitRules';
import { manhattanDistance, type GameWorld } from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { combatStatesCodec, wildlifeStatesCodec } from '../bridgeStateSerialize';

type CivWorld = GameWorld;

export interface WildlifeCombatSystemDeps {
  world: GameWorld;
  // Phase 2D: combatStates + wildlifeStates migrated to world.state.aoe2.*
  // via accessor.
  accessor: BridgeStateAccessor;
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
  // Spec §14.5 wildlife retaliation animation: landed bites publish through
  // the same witnessed successful-hit feed as unit attacks.
  recordUnitAttack: (attackerId: number, targetId: number) => void;
}

export function registerWildlifeCombatSystem(deps: WildlifeCombatSystemDeps): void {
  const {
    world,
    accessor,
    currentEntityId,
    getEntityRef,
    findNearestHostileWildlifeTarget,
    findWildlifeRangePlan,
    setPositionAndSyncOccupancy,
    destroyUnitEntity,
    markOutOfBandRenderChange,
    recordUnitAttack,
  } = deps;

  world.registerSystem({
    name: 'prototypeWildlifeCombat',
    phase: 'update',
    after: ['prototypeVillagerEconomy'],
    execute(activeWorld) {
      const wildlifeStates = accessor.get(wildlifeStatesCodec);
      let wildlifeDirty = false;
      for (const id of activeWorld.query('position', 'resource')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const wildlife = wildlifeStates.get(id);
        if (!position || !wildlife?.isAlive) {
          continue;
        }

        if (wildlife.cooldownTicks > 0) {
          wildlife.cooldownTicks -= 1;
          wildlifeDirty = true;
        }

        let targetId = currentEntityId(activeWorld, wildlife.targetEntityRef);
        let targetPosition = targetId === null
          ? null
          : activeWorld.getComponent<Position>(targetId, 'position');
        let targetCombat = targetId === null ? null : accessor.get(combatStatesCodec).get(targetId);

        if (!targetPosition || !targetCombat || targetCombat.currentHp <= 0) {
          wildlife.targetEntityRef = null;
          wildlifeDirty = true;
          targetId = null;
        }

        if (targetId === null && wildlife.autoAggro) {
          targetId = findNearestHostileWildlifeTarget(position, wildlife.aggroRange, activeWorld);
          wildlife.targetEntityRef = targetId === null ? null : getEntityRef(targetId);
          wildlifeDirty = true;
          targetPosition = targetId === null
            ? null
            : activeWorld.getComponent<Position>(targetId, 'position');
          targetCombat = targetId === null ? null : accessor.get(combatStatesCodec).get(targetId);
        }

        if (!targetId || !targetPosition || !targetCombat) {
          continue;
        }

        if (manhattanDistance(position, targetPosition) > wildlife.attackRange) {
          const movePlan = findWildlifeRangePlan(id, targetPosition, wildlife.attackRange, activeWorld);
          if (!movePlan) {
            wildlife.targetEntityRef = null;
          wildlifeDirty = true;
            continue;
          }

          setPositionAndSyncOccupancy(id, movePlan.nextStep, activeWorld);
          continue;
        }

        if (wildlife.cooldownTicks > 0) {
          continue;
        }

        // FU1: wildlife hits (melee bites) respect the target's melee armor —
        // base melee armor (e.g. a Knight's 2) plus its armor-tech bonus —
        // floored at 1 so a heavily-armored unit still takes a scrape per hit.
        const biteTargetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
        const targetMeleeArmor = biteTargetUnit
          ? effectiveMeleeArmor(biteTargetUnit.unitType, targetCombat.armor)
          : targetCombat.armor;
        targetCombat.currentHp -= Math.max(1, wildlife.attackDamage - targetMeleeArmor);
        accessor.markDirty(combatStatesCodec);
        wildlife.cooldownTicks = wildlife.reloadTicks;
        wildlifeDirty = true;
        markOutOfBandRenderChange();
        // Spec §14.5: the landed bite is a witnessed successful hit — same
        // feed, witness rule, and replay semantics as a unit attack.
        recordUnitAttack(id, targetId);

        if (targetCombat.currentHp <= 0) {
          destroyUnitEntity(targetId);
          wildlife.targetEntityRef = null;
          wildlifeDirty = true;
        }
      }
      if (wildlifeDirty) {
        accessor.markDirty(wildlifeStatesCodec);
      }
    },
  });
}
