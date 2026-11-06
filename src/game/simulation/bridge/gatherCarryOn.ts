// What a gatherer does when the node it works runs out (spec §6.4, "Carrying
// on when a resource runs out"; work 131).
//
// Definitive Edition's villager looks for more of the SAME kind close by and
// works it — berries to berries, one gold pile to the next, a sheep to the
// next sheep, a carcass to the next carcass or deer — and otherwise stands
// idle, which is the player's cue to give it new work (to build farms once the
// berries are gone). Hunters gather the animal they killed, and never take on
// a live boar by themselves (DE Update 108769 hotfix 109739: "After depleting
// a Boar, Hunters will no longer automatically hunt another live Boar";
// Update 111772: no attack on "nearby violent huntable animals upon depleting
// the one they are currently working on").
//
// Until work 131 a human villager with a gather order was handed whatever of
// its stockpile kind ranked best anywhere in its home range, after every
// delivery as well as after every depletion: on 2026-10-14 seven foragers
// whose berries ran out walked 10-20 cells to fish distant ponds while the
// idle count stayed 0.
//
// The carry-on is the unit's rule, so it applies to every owner's villagers;
// what becomes of a villager it leaves idle is its owner's business. The
// computer re-tasks its own at once (`assignIdleGatherer`); the human
// player's stand until the player tasks them. Fishing Ships keep their own
// rule (work 131 excludes them).

import type { Position } from 'civ-engine';

import type {
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
  ResourceKind,
  UnitComponent,
} from '../types';
import { canGatherResource, resourceKindToEconomyResource } from '../prototypeEconomyRules';
import { canGathererHarvest } from '../gatherDomain';
import { isShoreFish } from '../shoreFishing';
import { setResourceOccupation } from '../resourceWorkerCounts';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
import { isInsideDefenceReach } from './enemyDefenceRange';
import type { GameWorld } from './pureHelpers';
import type { GatherAssignmentDeps } from './villagerGatherAssignment';

/** How far from the node that ran out a gatherer looks for the next one, in
 *  cells, centre to centre. DE states no number: its villagers see 4 tiles
 *  (the DE data) and its hunters take "the next deer in their LOS" (AoE2 DE
 *  forum, 2020). This game lays a starting patch out on rings round the Town
 *  Center, looser than DE's clumps: at 4 one shipped base patch (Arabia, owner
 *  1's berries) is two groups at tick 0, at 5 every shipped base patch of
 *  berries, gold, stone and sheep is one — so 5 is what lets a villager finish
 *  its own patch, which is what a DE player sees. A reversible default. */
export const CARRY_ON_RADIUS = 5;

/** The bounded reachability probe, as the unreachable-target reroute has it:
 *  candidates nearest first, at most this many path searches. */
const MAX_CARRY_ON_PROBES = 16;

/**
 * The kinds a gatherer carries on to from a node of `type`. DE's villager
 * keeps its trade: a forager stays a forager, a shepherd a shepherd (sheep are
 * the only herdable here) and a hunter a hunter — a boar's carcass or a deer,
 * never a live boar, because a live boar is not harvestable until killed. A
 * Farm has its reseed instead (§6.4 "Farm reseed"); an expired Farm leaves its
 * farmer idle, as DE's does.
 */
export function carryOnKinds(type: ResourceKind): readonly ResourceKind[] {
  switch (type) {
    case 'tree':
    case 'berry-bush':
    case 'gold-mine':
    case 'stone-mine':
    case 'fish':
    case 'sheep':
      return [type];
    case 'boar':
    case 'deer':
      return ['boar', 'deer'];
    default:
      return [];
  }
}

/** The node a gatherer carries on from. Its id is never a candidate. */
export interface CarryOnFrom {
  readonly id: number;
  readonly resourceType: ResourceKind;
  readonly position: Position;
}

/** Whether the human player re-tasks this gatherer — the human's villagers,
 *  unless an AI drives the human slot. Everyone else's are the computer's. */
export function isPlayerTaskedVillager(owner: number, unitType: string, isAiControlled: boolean): boolean {
  return owner === HUMAN_PLAYER_ID && !isAiControlled && unitType === 'villager';
}

/**
 * The node the villager carries on to from `from`: the same kind, within
 * CARRY_ON_RADIUS of it, harvestable, workable from the villager's domain, its
 * owner's to take (never another player's sheep), clear of enemy arrows (§6.4)
 * and reachable. Ranked own before neutral, then nearest the villager — beside
 * the node it finished, that is the next one in the patch; walking home with a
 * load, the one nearest the drop-off. Null when there is none.
 *
 * How many already work a node does not rank it for the human player's
 * villager (work 145): DE names a worker limit only for the Farm, so the
 * shepherds of a sheep that runs out all go on to the next sheep, as DE's do.
 * Until work 145 a node with 4 gatherers (2 on the walk's reroutes) ranked
 * after an emptier one, and six shepherds split 4 and 2. The computer's
 * villager keeps that rank (`spreadCap`): it is the computer spreading its
 * own villagers, and dropping it moved two self-play gates (plan 145). A Farm
 * with a villager on it, or on its way to it, is never a candidate;
 * `freeFarm` asks for a free Farm near a taken one.
 */
export function findCarryOnTarget(
  deps: GatherAssignmentDeps,
  world: GameWorld,
  villagerId: number,
  owner: number,
  from: CarryOnFrom,
  gatherTargetCounts: ReadonlyMap<number, number>,
  spreadCap: number | null = null,
  freeFarm = false,
): number | null {
  const kinds: readonly ResourceKind[] = freeFarm ? ['farm'] : carryOnKinds(from.resourceType);
  const unit = world.getComponent<UnitComponent>(villagerId, 'unit');
  const at = world.getComponent<Position>(villagerId, 'position');
  if (kinds.length === 0 || !unit || !at) return null;
  const defences = deps.enemyStaticDefences(world, owner);
  const reach = CARRY_ON_RADIUS * CARRY_ON_RADIUS;
  const candidates: Array<{ id: number; tier: number; saturated: number; distance: number }> = [];
  for (const id of world.query('position', 'resource')) {
    if (id === from.id) continue;
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    const position = world.getComponent<Position>(id, 'position');
    if (!resource || !position || !kinds.includes(resource.resourceType)) continue;
    const dx = position.x - from.position.x;
    const dy = position.y - from.position.y;
    if (dx * dx + dy * dy > reach) continue;
    if (resource.owner !== null && resource.owner !== owner) continue;
    if (!deps.isHarvestableResource(id, resource)) continue;
    if (!canGathererHarvest(unit.unitType, resource.resourceType, {
      onShore: resource.resourceType === 'fish' && isShoreFish(position, deps.isLandCell),
    })) continue;
    const isOwnedStructure = world.getComponent<BuildingComponent>(id, 'building') !== undefined;
    if (!canGatherResource(owner, isOwnedStructure, resource.baseOwner)) continue;
    if (defences.length > 0 && isInsideDefenceReach(position, defences)) continue;
    if (resource.resourceType === 'farm' && (gatherTargetCounts.get(id) ?? 0) > 0) continue;
    candidates.push({
      id,
      tier: resource.owner === owner ? 0 : resource.baseOwner === owner ? 1 : 2,
      saturated: spreadCap !== null && (gatherTargetCounts.get(id) ?? 0) >= spreadCap ? 1 : 0,
      distance: (position.x - at.x) ** 2 + (position.y - at.y) ** 2,
    });
  }
  candidates.sort((left, right) => (
    left.tier - right.tier
    || left.saturated - right.saturated
    || left.distance - right.distance
    || left.id - right.id
  ));
  for (const candidate of candidates.slice(0, MAX_CARRY_ON_PROBES)) {
    if (deps.findResourceApproachPlan(villagerId, candidate.id, world) !== null) return candidate.id;
  }
  return null;
}

/** Points the gatherer at `targetId`, keeping whatever it carries: DE's
 *  forager does not walk a part load home when a bush runs out. A carrier
 *  already walking home keeps walking, and comes back to the new node. */
export function carryOnTo(
  deps: GatherAssignmentDeps,
  world: GameWorld,
  villagerId: number,
  owner: number,
  gatherer: GathererComponent,
  targetId: number,
  gatherTargetCounts: Map<number, number>,
): void {
  const resource = world.getComponent<ResourceComponent>(targetId, 'resource');
  const position = world.getComponent<Position>(targetId, 'position');
  const kind = resource ? resourceKindToEconomyResource(resource.resourceType) : null;
  gatherTargetCounts.set(targetId, (gatherTargetCounts.get(targetId) ?? 0) + 1);
  if (kind !== null) {
    gatherer.desiredResource = kind;
    setResourceOccupation(world, villagerId, kind);
  }
  gatherer.targetResourceId = targetId;
  gatherer.gatherProgressTicks = 0;
  if (gatherer.task !== 'to-dropoff') {
    gatherer.task = 'to-resource';
    // A hint only: the deposit leg re-resolves the drop-off when it loads.
    if (kind !== null && position) {
      gatherer.dropOffBuildingId = deps.findNearestDropOffBuilding(world, owner, kind, position);
    }
  }
}

/**
 * For the human player's villager whose node stands but cannot be worked —
 * unreachable, walked at too long, or a Farm another villager works: carries
 * it on from that node (never back to it) and returns true, or returns false
 * having found nothing and changed nothing. From a Farm it takes a free Farm
 * close by. The automatic reroutes that serve the computer's villagers take
 * any node of the stockpile kind, of any kind on failure; the player's
 * villager keeps its trade and its patch.
 */
export function carryOnFromUnworkable(
  deps: GatherAssignmentDeps,
  world: GameWorld,
  villagerId: number,
  owner: number,
  gatherer: GathererComponent,
  fromId: number,
  gatherTargetCounts: Map<number, number>,
): boolean {
  const resource = world.getComponent<ResourceComponent>(fromId, 'resource');
  const position = world.getComponent<Position>(fromId, 'position');
  if (!resource || !position) return false;
  const from = { id: fromId, resourceType: resource.resourceType, position };
  const next = findCarryOnTarget(deps, world, villagerId, owner, from, gatherTargetCounts, null, resource.resourceType === 'farm');
  if (next === null) return false;
  carryOnTo(deps, world, villagerId, owner, gatherer, next, gatherTargetCounts);
  return true;
}

/** The order is over: what it carries goes home, then it stands — and, the
 *  flag down, nothing re-tasks a human player's villager until the player does. */
export function endGatherOrder(gatherer: GathererComponent): void {
  gatherer.hasExplicitGatherOrder = false;
  gatherer.targetResourceId = null;
  gatherer.gatherProgressTicks = 0;
  gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
}

/**
 * The node `ended` has run out. Every gatherer working it, walking to it or
 * carrying a load home from it carries on from it, or its order ends. Called
 * at the swing that empties the node, before the node is destroyed, so a
 * villager away at the drop-off is carried on too — from the node's own
 * position, which is gone by the time it comes back.
 *
 * Two kinds of gatherer keep the rule they had: a Fishing Ship (work 131 does
 * not cover them) and a villager with a shift-queued chain, whose next order
 * is the player's (v0.3.141): its explicit flag drops so the chain fires.
 */
export function carryOnFromEndedNode(params: {
  deps: GatherAssignmentDeps;
  world: GameWorld;
  ended: CarryOnFrom;
  gatherTargetCounts: Map<number, number>;
  hasQueuedEntityOrders: (unitId: number) => boolean;
  /** The computer's villagers rank a node with this many gatherers after an
   *  emptier one; the human player's rank by distance alone (work 145). */
  computerSpreadCap: number;
  isAiControlled: (owner: number) => boolean;
}): void {
  const { deps, world, ended, gatherTargetCounts, hasQueuedEntityOrders } = params;
  for (const id of world.query('unit', 'gatherer')) {
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!gatherer || !unit || gatherer.targetResourceId !== ended.id) continue;
    gatherTargetCounts.set(ended.id, Math.max(0, (gatherTargetCounts.get(ended.id) ?? 1) - 1));
    const queued = hasQueuedEntityOrders(id);
    if (unit.unitType !== 'villager' || queued) {
      if (queued) gatherer.hasExplicitGatherOrder = false;
      gatherer.targetResourceId = null;
      gatherer.gatherProgressTicks = 0;
      if (gatherer.task !== 'to-dropoff') gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
      continue;
    }
    const spreadCap = isPlayerTaskedVillager(unit.owner, unit.unitType, params.isAiControlled(unit.owner))
      ? null
      : params.computerSpreadCap;
    const next = findCarryOnTarget(deps, world, id, unit.owner, ended, gatherTargetCounts, spreadCap);
    if (next === null) endGatherOrder(gatherer);
    else carryOnTo(deps, world, id, unit.owner, gatherer, next, gatherTargetCounts);
  }
}

/**
 * The human player's villager between trips: back to the node it was ordered
 * onto, or carried on to, while that node can still be worked; carried on
 * from it when it stands but can no longer be worked; and otherwise its order
 * is over and it stands idle. DE's villager goes back to the node it was
 * working after a delivery — until work 131 this one was re-ranked against
 * every node of its kind in reach after every load.
 */
export function resumePlayerGatherOrder(
  deps: GatherAssignmentDeps,
  world: GameWorld,
  villagerId: number,
  owner: number,
  gatherer: GathererComponent,
  gatherTargetCounts: Map<number, number>,
): void {
  const targetId = gatherer.targetResourceId;
  const resource = targetId === null ? undefined : world.getComponent<ResourceComponent>(targetId, 'resource');
  const position = targetId === null ? undefined : world.getComponent<Position>(targetId, 'position');
  if (targetId !== null && resource && position) {
    if (deps.isHarvestableResource(targetId, resource)) {
      gatherer.task = 'to-resource';
      gatherer.gatherProgressTicks = 0;
      return;
    }
    const from = { id: targetId, resourceType: resource.resourceType, position };
    const next = findCarryOnTarget(deps, world, villagerId, owner, from, gatherTargetCounts);
    if (next !== null) {
      carryOnTo(deps, world, villagerId, owner, gatherer, next, gatherTargetCounts);
      return;
    }
  }
  endGatherOrder(gatherer);
}

/** Whether a villager other than `villagerId` is working Farm `farmId` now.
 *  DE: "Only one Villager may work a Farm at a time" (string 26149). */
export function farmWorkedByAnother(world: GameWorld, farmId: number, villagerId: number): boolean {
  for (const id of world.query('gatherer')) {
    if (id === villagerId) continue;
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    if (gatherer?.task === 'gathering' && gatherer.targetResourceId === farmId) return true;
  }
  return false;
}
