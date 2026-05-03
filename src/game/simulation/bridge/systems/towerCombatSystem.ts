// Tower / Town Center / Castle ranged combat. Each completed building
// with a combat state fires up to `arrowCount` arrows per reload cycle at
// the highest-priority visible enemy unit in range. Arrow count scales
// with garrisoned units (Castle gets +2 per archer-line garrisoned).

import type { Position } from 'civ-engine';
import type { BuildingComponent, UnitComponent } from '../../types';
import { buildingFootprint, type GameWorld } from '../pureHelpers';
import { buildingArrowCount } from '../../prototypeBuildingRules';
import { isArcherLineUnit } from '../../prototypeUnitRules';
import type { BuildingCombatState } from './systemTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  combatStatesCodec,
  constructionStatesCodec,
  garrisonedByBuildingCodec,
} from '../bridgeStateSerialize';

interface PlayerScoreCountersLike {
  unitsKilled: number;
}

export interface TowerCombatSystemDeps {
  world: GameWorld;
  buildingCombatStates: Map<number, BuildingCombatState>;
  // Phase 2D: garrisonedByBuilding + constructionStates + combatStates
  // migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  findPreferredVisibleEnemyUnitInRangeOfBuilding: (
    owner: number,
    position: Position,
    footprint: { width: number; height: number },
    range: number,
  ) => number | null;
  destroyUnitEntity: (id: number) => void;
  markOutOfBandRenderChange: () => void;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
}

export function registerTowerCombatSystem(deps: TowerCombatSystemDeps): void {
  const {
    world,
    buildingCombatStates,
    accessor,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    destroyUnitEntity,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
  } = deps;

  world.registerSystem({
    name: 'prototypeTowerCombat',
    phase: 'update',
    after: ['prototypeVisibility'],
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'building')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        const construction = accessor.get(constructionStatesCodec).get(id);
        const buildingCombat = buildingCombatStates.get(id);

        if (
          !position
          || !building
          || !buildingCombat
          || (construction && !construction.isComplete)
        ) {
          continue;
        }

        if (buildingCombat.cooldownTicks > 0) {
          buildingCombat.cooldownTicks -= 1;
        }

        const garrisonIds = accessor.get(garrisonedByBuildingCodec).get(id) ?? [];
        let garrisonedArcherCount = 0;
        for (const garrisonedId of garrisonIds) {
          const garrisonedUnit = activeWorld.getComponent<UnitComponent>(garrisonedId, 'unit');
          if (garrisonedUnit && isArcherLineUnit(garrisonedUnit.unitType)) {
            garrisonedArcherCount += 1;
          }
        }

        const arrowCount = buildingArrowCount(
          building.buildingType,
          garrisonIds.length,
          garrisonedArcherCount,
        );
        const footprint = buildingFootprint(building.buildingType);
        const targetId = findPreferredVisibleEnemyUnitInRangeOfBuilding(
          building.owner,
          position,
          footprint,
          buildingCombat.attackRange,
        );
        if (targetId === null || buildingCombat.cooldownTicks > 0 || arrowCount <= 0) {
          continue;
        }

        const targetCombat = accessor.get(combatStatesCodec).get(targetId);
        if (!targetCombat) {
          continue;
        }

        for (let shotIndex = 0; shotIndex < arrowCount; shotIndex += 1) {
          const activeTargetCombat = accessor.get(combatStatesCodec).get(targetId);
          if (!activeTargetCombat) {
            break;
          }

          activeTargetCombat.currentHp -= Math.max(
            1,
            buildingCombat.attackDamage - activeTargetCombat.armor,
          );
          accessor.markDirty(combatStatesCodec);
          markOutOfBandRenderChange();
          if (activeTargetCombat.currentHp <= 0) {
            ensurePlayerScoreCounters(building.owner).unitsKilled += 1;
            destroyUnitEntity(targetId);
            break;
          }
        }

        buildingCombat.cooldownTicks = buildingCombat.reloadTicks;
      }
    },
  });
}
