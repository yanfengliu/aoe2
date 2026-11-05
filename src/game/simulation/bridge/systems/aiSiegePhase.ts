// What DE's ram goal reads, gathered for one owner's decision (work 141
// M2a-2b; the rules and their citations are in `aiSiege.ts`). It names the
// ram-line unit to train now, which the escrow phase buys ahead of the army,
// or none.

import type { BuildingComponent, ResearchableTechnologyType, UnitComponent } from '../../types';
import { attackGroupSize } from '../../ai';
import {
  imperialArmyTech,
  maxCivilianPopulation,
  RAM_LINE,
  ramWanted,
  siegePopulation,
  type RamLineUnit,
} from '../../aiSiege';
import { civImperialPopulationBonus } from '../../civBonusEffects';
import { RESEARCHES_BY_BUILDING } from '../../buildingProductionTables';
import { POP_HARD_CAP } from '../bridgeConstants';
import {
  constructionStatesCodec,
  inFlightTechByOwnerCodec,
  matchSettingsCodec,
  playerCivilizationsCodec,
  populationCodec,
  researchedTechnologiesCodec,
} from '../bridgeStateSerialize';
import { trainableInSameLine } from '../unitLines';
import type { AiOwnerContext, AiPhaseDeps } from './aiSystemTypes';

// DE's civilians: military-population is the rest of the population.
const CIVILIANS = new Set(['villager', 'trade-cart', 'fishing-ship', 'trade-cog']);
// threats.per 1292-1296: each found to 10, Kreposts too, which this game does not build.
const DEFENCES = new Set(['watch-tower', 'bombard-tower', 'castle']);
const DEFENCE_SEARCH_LIMIT = 10;
// The elite unique units, of which an owner can research only its own (`my-unique-unit-upgrade`, init.per 3847).
const ELITE_UNIQUE_UPGRADES: ReadonlySet<ResearchableTechnologyType> = new Set(
  (RESEARCHES_BY_BUILDING.get('castle') ?? []).filter((tech) => tech.startsWith('elite-')),
);

/** The ram-line unit DE's ram goal wants trained this decision, or none. */
export function ramToTrain(deps: AiPhaseDeps, ctx: AiOwnerContext): RamLineUnit | null {
  const { accessor, countQueuedUnits, getTrainOptions, ownedMilitaryUnitIdsOnMap, ownerHasUnitOnMap } = deps;
  const { activeWorld, owner, currentAge, targetOwner, pendingResearchKeys } = ctx;
  if (currentAge !== 'castle-age' && currentAge !== 'imperial-age') return null;
  const tier = trainableInSameLine('battering-ram', getTrainOptions(owner, 'siege-workshop'));
  if (tier === undefined) return null;

  let militaryPopulation = 0;
  let targetMilitaryPopulation = 0;
  let ramsStanding = 0;
  let ramsQueued = 0;
  let trebuchets = 0;
  let bombardCannons = 0;
  let petards = 0;
  for (const id of activeWorld.query('unit')) {
    const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
    if (!unit || CIVILIANS.has(unit.unitType)) continue;
    if (unit.owner === targetOwner) targetMilitaryPopulation += 1;
    if (unit.owner !== owner) continue;
    militaryPopulation += 1;
    if ((RAM_LINE as readonly string[]).includes(unit.unitType)) ramsStanding += 1;
    else if (unit.unitType === 'trebuchet') trebuchets += 1;
    else if (unit.unitType === 'bombard-cannon') bombardCannons += 1;
    else if (unit.unitType === 'petard') petards += 1;
  }
  const defences = new Map<string, number>();
  let targetHasBuilding = false;
  for (const id of activeWorld.query('building')) {
    const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
    if (!building) continue;
    if (building.owner === owner && building.buildingType === 'siege-workshop') {
      for (const ram of RAM_LINE) ramsQueued += countQueuedUnits(id, ram);
    }
    if (building.owner !== targetOwner) continue;
    targetHasBuilding = true;
    if (!DEFENCES.has(building.buildingType)) continue;
    if (accessor.get(constructionStatesCodec).get(id)?.isComplete === false) continue;
    defences.set(building.buildingType, Math.min(DEFENCE_SEARCH_LIMIT, (defences.get(building.buildingType) ?? 0) + 1));
  }

  const researched = accessor.get(researchedTechnologiesCodec).get(owner);
  const has = (tech: string): boolean => researched?.has(tech as never) ?? false;
  const civilization = accessor.get(playerCivilizationsCodec).get(owner);
  const gothic = civImperialPopulationBonus(civilization, 'imperial-age') > 0;
  const limit = accessor.get(matchSettingsCodec).popCap ?? POP_HARD_CAP;
  // The attack phase's own test (`shouldPush`), on an attack group that is not empty.
  const marching = ownedMilitaryUnitIdsOnMap(owner).size;
  const attacking = !deps.attacksDisabled && marching > 0
    && (marching >= attackGroupSize(currentAge) || (targetOwner !== null && !ownerHasUnitOnMap(targetOwner)));

  const wanted = ramWanted({
    age: currentAge,
    militaryPopulation,
    targetMilitaryPopulation,
    targetDefences: [...defences.values()].reduce((sum, count) => sum + count, 0),
    targetHasBuilding,
    population: accessor.get(populationCodec).get(owner)?.current ?? 0,
    siegePopulation: siegePopulation(limit, gothic),
    maxCivilianPopulation: maxCivilianPopulation(limit, gothic),
    imperialArmyTech: imperialArmyTech(researched, ELITE_UNIQUE_UPGRADES),
    attacking,
    rams: ramsStanding + ramsQueued,
    ramsStanding,
    trebuchets,
    bombardCannons,
    petards,
    siegeRamPending: has('siege-ram-upgrade')
      || (accessor.get(inFlightTechByOwnerCodec).get(owner)?.has('siege-ram-upgrade') ?? false)
      || pendingResearchKeys.has(`${owner}:siege-ram-upgrade`),
  });
  return wanted ? tier as RamLineUnit : null;
}
