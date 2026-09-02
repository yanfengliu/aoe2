// AI hunt phase: when villagers have nothing left to gather, send a PARTY at
// the nearest live boar.
//
// Measured 2026-08-24: a 36000-tick match froze with 83 idle villagers across
// both players, no trees, gold or stone anywhere on the map, and four boar
// standing five cells from the town centres. The kind-fallback that re-tasks a
// villager whose resource ran out already exists and finds nothing, because a
// LIVE boar is not an auto-gatherable resource — it has to be killed first, and
// a lone villager sent at one DIES (the boar keeps its food and the villager
// leaves the roster). AoE2 answers this with a party of four to eight; so does
// this.
//
// Scope is deliberately the IDLE case. Villagers with something to gather are
// left alone, so the early economy is untouched; luring boar as an opening (the
// other half of what AoE2 does with them) is a separate decision.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import { canGathererHarvest } from '../../gatherDomain';
import { canGatherResource } from '../../prototypeEconomyRules';
import { isShoreFish } from '../../shoreFishing';
import { playerTeamsCodec, wildlifeStatesCodec } from '../bridgeStateSerialize';
import {
  collectStaticDefences,
  enemyStaticDefencesOf,
  isInsideDefenceReach,
} from '../enemyDefenceRange';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

/** How many villagers go, and the fewest that make it worth starting. A boar
 *  fights back hard enough to kill one villager, so a party under three is a
 *  donation. */
export const HUNT_PARTY_SIZE = 4;
export const MIN_HUNT_PARTY = 3;
/** How far from its Town Center the AI will chase one. Beyond this the walk
 *  costs more than the carcass is worth. */
export const HUNT_RADIUS = 20;

export function runHuntPhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const { accessor, pushUnitContextAtEntityIntention } = deps;
  const { activeWorld, owner, ownerTownCenterPosition } = ctx;
  if (!ownerTownCenterPosition) return;

  // Only villagers with nothing to do: if there is anything left to gather the
  // ordinary assignment has them, and taking one off a berry bush to fight a
  // boar would be a downgrade.
  const idleVillagers: Array<{ id: number; position: Position }> = [];
  for (const id of activeWorld.query('position', 'unit')) {
    const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.owner !== owner || unit.unitType !== 'villager') continue;
    const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
    if (!gatherer || gatherer.task !== 'idle') continue;
    const position = activeWorld.getComponent<Position>(id, 'position');
    if (!position) continue;
    idleVillagers.push({ id, position });
  }
  if (idleVillagers.length < MIN_HUNT_PARTY) return;

  const wildlife = accessor.get(wildlifeStatesCodec);

  // Hunt only when there is genuinely nothing else — no tree, no berry, no
  // mine, no farm, no carcass left that ordinary assignment could take. A
  // villager is idle for all sorts of ordinary reasons (it was trained this
  // tick, its bush just ran out), and hunting on THAT signal drags new
  // villagers across the map instead of letting them work: measured on the
  // 40000-tick trajectory, it left both players stuck in Feudal at t=40000
  // hoarding 15k food, where the same seed had reached Imperial before. The
  // freeze this phase exists for is the state where the map is stripped.
  for (const id of activeWorld.query('position', 'resource')) {
    const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
    if (!resource || resource.amount <= 0) continue;
    // A LIVE animal is not gatherable — it is what we are here to kill.
    if (wildlife.get(id)?.isAlive) continue;
    // The same two filters the assignment itself applies, or the gate would
    // count things these villagers can never take: FISH need a fishing ship
    // (the stripped map in the measured freeze still had fourteen of them), and
    // a farm belongs to whoever built it.
    const resourcePosition = activeWorld.getComponent<Position>(id, 'position');
    if (!resourcePosition) continue;
    if (!canGathererHarvest('villager', resource.resourceType, {
      onShore: resource.resourceType === 'fish'
        && isShoreFish(resourcePosition, deps.isLandCell),
    })) continue;
    const isOwnedStructure =
      activeWorld.getComponent<BuildingComponent>(id, 'building') !== undefined;
    if (!canGatherResource(owner, isOwnedStructure, resource.baseOwner)) continue;
    return;
  }

  // The nearest boar, but never one under the enemy's arrows while another
  // stands clear of them (§6.4): fourteen villagers on the boot map walked to
  // one boar beside the enemy Town Centre. Only when every boar in reach is
  // under a defence is the nearest of them hunted anyway — the exception the
  // rule grants a kind with nothing else left.
  const enemyDefences = enemyStaticDefencesOf(
    collectStaticDefences(activeWorld, accessor),
    owner,
    accessor.get(playerTeamsCodec),
  );
  let boarId: number | null = null;
  let boarPosition: Position | null = null;
  let boarDistance = Number.POSITIVE_INFINITY;
  let safeBoarId: number | null = null;
  let safeBoarPosition: Position | null = null;
  let safeBoarDistance = Number.POSITIVE_INFINITY;
  for (const id of activeWorld.query('position', 'resource')) {
    const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
    if (!resource || resource.resourceType !== 'boar' || resource.amount <= 0) continue;
    if (!wildlife.get(id)?.isAlive) continue;
    const position = activeWorld.getComponent<Position>(id, 'position');
    if (!position) continue;
    const distance =
      Math.abs(position.x - ownerTownCenterPosition.x)
      + Math.abs(position.y - ownerTownCenterPosition.y);
    if (distance > HUNT_RADIUS) continue;
    if (distance < boarDistance) {
      boarId = id;
      boarPosition = position;
      boarDistance = distance;
    }
    if (distance < safeBoarDistance && !isInsideDefenceReach(position, enemyDefences)) {
      safeBoarId = id;
      safeBoarPosition = position;
      safeBoarDistance = distance;
    }
  }
  if (safeBoarId !== null && safeBoarPosition !== null) {
    boarId = safeBoarId;
    boarPosition = safeBoarPosition;
  }
  if (boarId === null || boarPosition === null) return;

  // The nearest idle villagers go, so the party arrives together rather than
  // trickling in one at a time and being killed one at a time.
  const target = boarPosition;
  const party = [...idleVillagers]
    .sort((a, b) => (
      Math.abs(a.position.x - target.x) + Math.abs(a.position.y - target.y)
      - (Math.abs(b.position.x - target.x) + Math.abs(b.position.y - target.y))
    ))
    .slice(0, HUNT_PARTY_SIZE);

  for (const villager of party) {
    // The same channel a player's right-click uses, so the order is recorded,
    // validated and replayed identically.
    pushUnitContextAtEntityIntention(villager.id, boarId, false);
  }
}
