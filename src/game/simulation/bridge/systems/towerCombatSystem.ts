// Tower / Town Center / Castle ranged combat. Each completed building
// with a combat state fires up to `arrowCount` arrows per reload cycle at
// the highest-priority visible enemy unit in range. Arrow count scales
// with garrisoned units (Castle gets +2 per archer-line garrisoned).

import type { Position } from 'civ-engine';
import type { BuildingComponent, UnitComponent } from '../../types';
import { buildingFootprint, type GameWorld } from '../pureHelpers';
import { buildingArrowCount } from '../../prototypeBuildingRules';
import { combatDamageAfterArmor, effectivePierceArmor, isArcherLineUnit } from '../../prototypeUnitRules';
import { pierceArmorTechBonus } from '../../armorTechBonuses';
import { towerAttackBonus, towerRangeBonus } from '../../towerTechEffects';
import { EMPTY_TECH_SET } from '../../economyTechEffects';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  buildingCombatStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  garrisonedByBuildingCodec,
  researchedTechnologiesCodec,
} from '../bridgeStateSerialize';

interface PlayerScoreCountersLike {
  unitsKilled: number;
}

export interface TowerCombatSystemDeps {
  world: GameWorld;
  // Phase 2D: garrisonedByBuilding + constructionStates + combatStates +
  // buildingCombatStates migrated to world.state.aoe2.* via accessor.
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
        const buildingCombat = accessor.get(buildingCombatStatesCodec).get(id);

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
          accessor.markDirty(buildingCombatStatesCodec);
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
        // Guard Tower / Keep bonuses are DERIVED from the owner's researched
        // set at the fire site — no per-building state. Only Watch Towers get
        // them (Town Center / Castle fire is unchanged). Un-teched owners read
        // 0/0, so behaviour is identical to before.
        const towerTechs = building.buildingType === 'watch-tower'
          ? accessor.get(researchedTechnologiesCodec).get(building.owner) ?? EMPTY_TECH_SET
          : EMPTY_TECH_SET;
        const effectiveRange = buildingCombat.attackRange + towerRangeBonus(towerTechs);
        const effectiveAttackDamage = buildingCombat.attackDamage + towerAttackBonus(towerTechs);
        const footprint = buildingFootprint(building.buildingType);
        const targetId = findPreferredVisibleEnemyUnitInRangeOfBuilding(
          building.owner,
          position,
          footprint,
          effectiveRange,
        );
        if (targetId === null || buildingCombat.cooldownTicks > 0 || arrowCount <= 0) {
          continue;
        }

        const targetCombat = accessor.get(combatStatesCodec).get(targetId);
        if (!targetCombat) {
          continue;
        }
        // Tower / Town Center / castle arrows are PIERCE: reduced by the
        // target's pierce armor (base + its armor-tech bonus), not melee armor,
        // so skirmishers/rams shrug off building fire and teched units keep
        // their arrow mitigation.
        const targetUnitForArrows = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
        const targetArrowPierceArmor = targetUnitForArrows
          ? effectivePierceArmor(targetUnitForArrows.unitType, pierceArmorTechBonus(targetCombat))
          : 0;

        for (let shotIndex = 0; shotIndex < arrowCount; shotIndex += 1) {
          const activeTargetCombat = accessor.get(combatStatesCodec).get(targetId);
          if (!activeTargetCombat) {
            break;
          }

          activeTargetCombat.currentHp -= combatDamageAfterArmor(
            effectiveAttackDamage,
            'pierce',
            activeTargetCombat.armor,
            targetArrowPierceArmor,
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
        accessor.markDirty(buildingCombatStatesCodec);
      }
    },
  });
}
