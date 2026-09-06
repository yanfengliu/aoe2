// AI construction crews (2026-09-02). The building phase puts ONE villager on
// each site it starts and never adds another; this phase reinforces the sites
// that are worth reinforcing, which is what a human — and DE's own AI — does.
//
// It stayed invisible until DE build times landed. A Wonder used to take 1200
// ticks, so a solo builder finished it inside any test budget; at the real
// 35,030 it is 58 minutes of game time, and the ai-wonder-fixture's 42 idle
// villagers stood and watched one of their own build it.
//
// The size of a crew follows from AoE2's own multi-builder curve: n builders
// work at (n + 2) / 3 of one villager's rate, so holding a site to about
// CREW_TARGET_TICKS of wall time needs n >= 3 * total / target - 2. A House
// (250 ticks) wants nobody extra, a Town Center (1500) wants six, a Wonder
// wants everyone who can be spared.

import type { Position } from 'civ-engine';

import type { BuildingComponent } from '../../types';
import { constructionStatesCodec } from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

/** How long a crewed building should take, in ticks (60 s at 10 TPS). */
export const CREW_TARGET_TICKS = 600;
/** The most of the workforce that may be building at once. A Wonder is a win
 *  condition rather than a building, so it may take nearly everyone. */
export const WORKFORCE_SHARE = 0.5;
export const WONDER_WORKFORCE_SHARE = 0.9;

/**
 * How many builders a site of this size deserves, given how many villagers the
 * owner has. A Wonder is a win condition rather than a building, so it may take
 * nearly the whole workforce; everything else leaves at least half on economy.
 */
export function targetCrewSize(
  totalBuildTicks: number,
  villagerCount: number,
  isWonder: boolean,
): number {
  const needed = Math.ceil((3 * totalBuildTicks) / CREW_TARGET_TICKS - 2);
  const cap = Math.max(
    1,
    Math.floor(villagerCount * (isWonder ? WONDER_WORKFORCE_SHARE : WORKFORCE_SHARE)),
  );
  return Math.min(Math.max(1, needed), cap);
}

export function runBuildCrewPhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const {
    accessor, currentEntityId, countOwnedUnits, pushUnitContextAtEntityIntention,
    findBuildingApproachPlan,
  } = deps;
  const {
    activeWorld, owner, unitCommands, claimedVillagers, findAvailableVillagerForBuild,
  } = ctx;

  const villagerCount = countOwnedUnits(owner, 'villager');
  if (villagerCount < 2) return;

  // Builders already on each of this owner's sites, from the live commands.
  const buildersBySite = new Map<number, number>();
  for (const [unitId, command] of unitCommands.entries()) {
    if (command.type !== 'build' || !command.buildingRef) continue;
    const siteId = currentEntityId(activeWorld, command.buildingRef);
    if (siteId === null) continue;
    const site = activeWorld.getComponent<BuildingComponent>(siteId, 'building');
    if (site?.owner !== owner) continue;
    buildersBySite.set(siteId, (buildersBySite.get(siteId) ?? 0) + 1);
    void unitId;
  }

  // A site with NO builder is invisible to the map above, because that map is
  // built from live build COMMANDS. `playerCommandsSystem` drops a build
  // command the first tick `findBuildingApproachPlan` comes back null, so one
  // such tick strands the foundation for good: nothing re-crews it, while
  // `findOwnedBuilding` still finds it, so `missing(type)` in the build order
  // reads false for the rest of the match and the AI never orders that
  // building again. Measured in the coverage lab (register entry 2026-09-06):
  // owner 2's Siege Workshop foundation froze at 125/400 on tick 13,750 and
  // stood there to the 45,000-tick horizon — no ram, no mangonel and neither
  // siege technology all match — while owner 1 held three farm plots at 0/150
  // that it counted among the farms it owned.
  const adopted = new Set<number>();
  for (const [siteId, construction] of accessor.get(constructionStatesCodec)) {
    if (construction.isComplete || buildersBySite.has(siteId)) continue;
    const site = activeWorld.getComponent<BuildingComponent>(siteId, 'building');
    if (site?.owner !== owner) continue;
    buildersBySite.set(siteId, 0);
    adopted.add(siteId);
  }

  // Longest remaining job first: with a limited pool, the Wonder outranks the
  // Mill, and reinforcing the site that is nearly done buys nothing.
  const sites: Array<{
    id: number; total: number; isWonder: boolean; remaining: number; adopted: boolean;
  }> = [];
  for (const [siteId, builders] of buildersBySite) {
    const construction = accessor.get(constructionStatesCodec).get(siteId);
    if (!construction || construction.isComplete) continue;
    const site = activeWorld.getComponent<BuildingComponent>(siteId, 'building');
    if (!site) continue;
    const remaining = construction.totalBuildTicks - construction.buildProgressTicks;
    if (remaining <= 0) continue;
    const isWonder = site.buildingType === 'wonder';
    if (builders >= targetCrewSize(construction.totalBuildTicks, villagerCount, isWonder)) continue;
    sites.push({
      id: siteId,
      total: construction.totalBuildTicks,
      isWonder,
      remaining,
      adopted: adopted.has(siteId),
    });
  }
  sites.sort((a, b) => b.remaining - a.remaining);

  // A WORKFORCE budget, not just a per-site one. `targetCrewSize` caps each
  // site at half the workforce (nine tenths for a Wonder), but applying that
  // per site with no running total lets two crewed sites exceed it together —
  // the "leaves at least half on economy" the cap is named for was never
  // enforced across sites. Counted over builders ALREADY out plus the ones
  // this pass adds, so a second Town Center cannot quietly take the other
  // half. Found by a critic, 2026-09-02: latent rather than observed, because
  // the boot map's AI never has two long sites at once.
  const wonderInProgress = sites.some((site) => site.isWonder);
  const workforceCap = Math.max(
    1,
    Math.floor(villagerCount * (wonderInProgress ? WONDER_WORKFORCE_SHARE : WORKFORCE_SHARE)),
  );
  let committed = [...buildersBySite.values()].reduce((sum, count) => sum + count, 0);

  for (const site of sites) {
    const wanted = targetCrewSize(site.total, villagerCount, site.isWonder);
    let onSite = buildersBySite.get(site.id) ?? 0;
    while (onSite < wanted && committed < workforceCap) {
      const villagerId = findAvailableVillagerForBuild(owner);
      if (villagerId === null) return; // pool exhausted — later sites wait too
      const villagerPosition = activeWorld.getComponent<Position>(villagerId, 'position');
      if (!villagerPosition) return;
      // An adopted site has no builder standing on it to prove it can be
      // reached, so ask the mover's own question before spending a villager:
      // a villager sent where it cannot walk has its command cleared next
      // tick and comes straight back here, which is a permanent bounce rather
      // than a build. A site that already HAS a builder is reachable by
      // demonstration and pays no path search — a Wonder crew is dozens of
      // villagers and one A* each would be the whole saving. One builder's
      // answer stands for the pool: they are nearly always in the same
      // connected component, and being wrong costs a skipped site this
      // decision tick rather than a wrong build.
      if (site.adopted && findBuildingApproachPlan(villagerId, site.id, 1, activeWorld) === null) {
        break;
      }
      pushUnitContextAtEntityIntention(villagerId, site.id, false);
      claimedVillagers.add(villagerId);
      onSite += 1;
      committed += 1;
    }
  }
}
