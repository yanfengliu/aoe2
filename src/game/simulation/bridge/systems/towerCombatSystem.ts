// Tower / Town Center / Castle ranged combat. Each completed building
// with a combat state fires up to `arrowCount` arrows per reload cycle at
// the highest-priority visible enemy unit in range. Arrow count scales
// with garrisoned units (Castle gets +2 per archer-line garrisoned).

import type { Position } from 'civ-engine';
import type { BuildingComponent, UnitComponent } from '../../types';
import { buildingFootprint, type GameWorld } from '../pureHelpers';
import { buildingArrowCount } from '../../prototypeBuildingRules';
import { isArcherLineUnit } from '../../prototypeUnitRules';
import type { BuildingCombatState, CombatState } from './systemTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { garrisonedByBuildingCodec } from '../bridgeStateSerialize';

interface ConstructionStateLike {
  isComplete: boolean;
}

interface PlayerScoreCountersLike {
  unitsKilled: number;
}

export interface TowerCombatSystemDeps {
  world: GameWorld;
  constructionStates: Map<number, ConstructionStateLike>;
  buildingCombatStates: Map<number, BuildingCombatState>;
  combatStates: Map<number, CombatState>;
  // Phase 2D: garrisonedByBuilding migrated to world.state.aoe2.* via accessor.
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
    constructionStates,
    buildingCombatStates,
    combatStates,
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
        const construction = constructionStates.get(id);
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

        const targetCombat = combatStates.get(targetId);
        if (!targetCombat) {
          continue;
        }

        for (let shotIndex = 0; shotIndex < arrowCount; shotIndex += 1) {
          const activeTargetCombat = combatStates.get(targetId);
          if (!activeTargetCombat) {
            break;
          }

          activeTargetCombat.currentHp -= Math.max(
            1,
            buildingCombat.attackDamage - activeTargetCombat.armor,
          );
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
