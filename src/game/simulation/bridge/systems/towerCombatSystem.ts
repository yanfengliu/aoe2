// Tower / Town Center / Castle ranged combat. Each completed building
// with a combat state fires up to `arrowCount` arrows per reload cycle at
// the highest-priority visible enemy unit in range. Arrow count scales
// with garrisoned units (Castle gets +2 per archer-line garrisoned).

import { heatedShotMultiplier } from '../../buildingTechEffects';
import { buildingMinimumRange } from '../../buildingMinimumRange';
import { uniqueBuildingBonus } from '../../uniqueTechnologies';
import type { Position } from 'civ-engine';
import type { BuildingComponent, UnitComponent } from '../../types';
import { buildingFootprint, type GameWorld } from '../pureHelpers';
import { buildingArrowCount } from '../../prototypeBuildingRules';
import { isArcherLineUnit } from '../../prototypeUnitRules';
import { towerAttackBonus, towerRangeBonus } from '../../towerTechEffects';
import { buildingArrowAttackBonus, buildingArrowRangeBonus } from '../../buildingArrowTechEffects';
import { koreanTowerRangeBonus } from '../../civBonusEffects';
import { EMPTY_TECH_SET } from '../../economyTechEffects';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  buildingCombatStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  garrisonedByBuildingCodec,
  projectilesCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
  playerCivilizationsCodec,
  playerAgesCodec,
} from '../bridgeStateSerialize';
import { launchProjectile } from '../projectileOps';
import { ballisticsLeadsShots } from '../../projectileTechEffects';

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
    // Cells too CLOSE to reach: an attacker pressed against a Tower or Castle
    // is under its arrow slits until Murder Holes is researched.
    minimumRange?: number,
  ) => number | null;
  destroyUnitEntity: (id: number) => void;
  refreshVisibilityAfterCombat: () => void;
  markOutOfBandRenderChange: () => void;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
}

export function registerTowerCombatSystem(deps: TowerCombatSystemDeps): void {
  const {
    world,
    accessor,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    markOutOfBandRenderChange,
  } = deps;

  world.registerSystem({
    name: 'prototypeTowerCombat',
    phase: 'update',
    after: ['prototypeVisibility'],
    execute(activeWorld) {
      // No kills happen here any more: a tower launches projectiles and the
      // projectile system applies the damage, counts the kill, and refreshes
      // visibility when something dies.
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
          // M11 perf: a tower still reloading after this tick's decrement can't
          // fire, so skip the garrison count + tech derive + (expensive) target
          // acquisition below — the post-decrement `cooldownTicks > 0` guard
          // discarded that work anyway. Behaviour-identical, just earlier.
          if (buildingCombat.cooldownTicks > 0) {
            continue;
          }
        }

        const garrisonIds = accessor.get(garrisonedByBuildingCodec).get(id) ?? [];
        let garrisonedArcherCount = 0;
        let garrisonedVillagerCount = 0;
        for (const garrisonedId of garrisonIds) {
          const garrisonedUnit = activeWorld.getComponent<UnitComponent>(garrisonedId, 'unit');
          if (garrisonedUnit && isArcherLineUnit(garrisonedUnit.unitType)) {
            garrisonedArcherCount += 1;
          }
          if (garrisonedUnit?.unitType === 'villager') {
            garrisonedVillagerCount += 1;
          }
        }

        const arrowCount = buildingArrowCount(
          building.buildingType,
          garrisonIds.length,
          garrisonedArcherCount,
          garrisonedVillagerCount,
        );
        // Building fire bonuses are DERIVED from the owner's researched set at
        // the fire site — no per-building state; un-teched owners read 0 so
        // behaviour is identical to before. Blacksmith arrow techs (Fletching /
        // Bodkin / Bracer, +1 atk +1 range each) boost EVERY arrow building
        // (Tower / TC / Castle), matching AoE2; Guard Tower / Keep additionally
        // boost Watch Towers only.
        const ownerTechs = accessor.get(researchedTechnologiesCodec).get(building.owner) ?? EMPTY_TECH_SET;
        const towerTechs = building.buildingType === 'watch-tower' ? ownerTechs : EMPTY_TECH_SET;
        // Civilization unique technologies that reach defensive buildings
        // (Britons' Yeomen, Teutons' Crenellations) add here, derived from the
        // researched set at the fire site like every other building bonus.
        const uniqueBonus = uniqueBuildingBonus(ownerTechs, building.buildingType);
        const effectiveRange =
          buildingCombat.attackRange + buildingArrowRangeBonus(ownerTechs)
          + towerRangeBonus(towerTechs) + uniqueBonus.attackRange
          // Koreans: watch towers reach +1 in Castle / +2 in Imperial.
          + koreanTowerRangeBonus(
            accessor.get(playerCivilizationsCodec).get(building.owner),
            building.buildingType,
            accessor.get(playerAgesCodec).get(building.owner) ?? 'dark-age',
          );
        const effectiveAttackDamage =
          buildingCombat.attackDamage + buildingArrowAttackBonus(ownerTechs)
          + towerAttackBonus(towerTechs) + uniqueBonus.attackDamage;
        const footprint = buildingFootprint(building.buildingType);
        const targetId = findPreferredVisibleEnemyUnitInRangeOfBuilding(
          building.owner,
          position,
          footprint,
          effectiveRange,
          buildingMinimumRange(building.buildingType, ownerTechs),
        );
        // cooldownTicks is guaranteed 0 here (the hoisted M11 guard above
        // `continue`d while reloading), so it no longer needs re-checking.
        if (targetId === null || arrowCount <= 0) {
          continue;
        }

        const targetCombat = accessor.get(combatStatesCodec).get(targetId);
        const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
        if (!targetCombat || !targetPosition) {
          continue;
        }
        // Arrows are PIERCE; the target's pierce armor is applied when the
        // shot LANDS (projectileOps), against the target as it is then.

        // Spec §10.4: a building's arrows FLY. Each shot in the volley is
        // launched toward the target's current cell and resolves on its own
        // impact tick, so a unit that keeps moving can be out from under the
        // volley when it lands — unless the owner has Ballistics, which aims
        // where the target is heading (technologies.csv scopes Ballistics to
        // buildings as well as units).
        const targetCommand = accessor.get(unitCommandsCodec).get(targetId);
        const projectiles = accessor.get(projectilesCodec);
        // Heated Shot: a defensive building's arrows burn, which matters
        // against a WOODEN HULL. Applied at launch rather than at impact so
        // the multiplier is fixed by what was aimed at, not by whatever the
        // shot happens to land on.
        const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
        const shotDamage = targetUnit
          ? Math.round(effectiveAttackDamage
            * heatedShotMultiplier(ownerTechs, targetUnit.unitType))
          : effectiveAttackDamage;
        for (let shotIndex = 0; shotIndex < arrowCount; shotIndex += 1) {
          launchProjectile({
            slot: projectiles,
            tick: activeWorld.tick,
            attacker: {
              id,
              owner: building.owner,
              unitType: null,
              position,
              baseDamage: shotDamage,
            },
            target: {
              id: targetId,
              kind: 'unit',
              position: targetPosition,
              destination: targetCommand?.target ?? null,
            },
            leads: ballisticsLeadsShots(ownerTechs),
            mapSize: activeWorld.grid,
          });
        }
        accessor.markDirty(projectilesCodec);
        markOutOfBandRenderChange();

        buildingCombat.cooldownTicks = buildingCombat.reloadTicks;
        accessor.markDirty(buildingCombatStatesCodec);
      }
    },
  });
}
