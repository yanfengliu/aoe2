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
  const cap = Math.max(1, Math.floor(villagerCount * (isWonder ? 0.9 : 0.5)));
  return Math.min(Math.max(1, needed), cap);
}

export function runBuildCrewPhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const {
    accessor, currentEntityId, countOwnedUnits, pushUnitContextAtEntityIntention,
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

  // Longest remaining job first: with a limited pool, the Wonder outranks the
  // Mill, and reinforcing the site that is nearly done buys nothing.
  const sites: Array<{ id: number; total: number; isWonder: boolean; remaining: number }> = [];
  for (const [siteId, builders] of buildersBySite) {
    const construction = accessor.get(constructionStatesCodec).get(siteId);
    if (!construction || construction.isComplete) continue;
    const site = activeWorld.getComponent<BuildingComponent>(siteId, 'building');
    if (!site) continue;
    const remaining = construction.totalBuildTicks - construction.buildProgressTicks;
    if (remaining <= 0) continue;
    const isWonder = site.buildingType === 'wonder';
    if (builders >= targetCrewSize(construction.totalBuildTicks, villagerCount, isWonder)) continue;
    sites.push({ id: siteId, total: construction.totalBuildTicks, isWonder, remaining });
  }
  sites.sort((a, b) => b.remaining - a.remaining);

  for (const site of sites) {
    const wanted = targetCrewSize(site.total, villagerCount, site.isWonder);
    let onSite = buildersBySite.get(site.id) ?? 0;
    while (onSite < wanted) {
      const villagerId = findAvailableVillagerForBuild(owner);
      if (villagerId === null) return; // pool exhausted — later sites wait too
      const villagerPosition = activeWorld.getComponent<Position>(villagerId, 'position');
      if (!villagerPosition) return;
      pushUnitContextAtEntityIntention(villagerId, site.id, false);
      claimedVillagers.add(villagerId);
      onSite += 1;
    }
  }
}
