// Where the enemy's arrows land, for everything that sends a villager
// somewhere on its own.
//
// The 2026-09-02 register entry: thirty of the AI's villagers were shot under
// the other player's Town Centre in the last quarter of a 45,000-tick match,
// twenty-nine of them walking to a resource the assignment had just handed
// them. Neither the gather assignment, nor the drop-off choice, nor the hunt
// phase read the enemy's buildings; the enemy Town Centre's reach was simply
// more map. A human never sends a villager under an enemy Town Centre, and now
// neither does the game: a node inside an ENEMY static defence's reach — Town
// Centre, Watch Tower, Bombard Tower, Castle — plus one cell of margin is off
// limits to automatic assignment (§6.4). "Enemy" is by team, so an ally's
// Castle is just a building; a foundation under construction does not shoot
// and does not count.
//
// The reach is the building's EFFECTIVE range, techs included, computed by the
// same function the tower combat system fires with, so the rule can never
// disagree with the arrows.

import type { Position } from 'civ-engine';
import type {
  AgeType,
  BuildingComponent,
  BuildingType,
  ResearchableTechnologyType,
} from '../types';
import { isEnemyOwner } from '../alliances';
import { buildingArrowRangeBonus } from '../buildingArrowTechEffects';
import { koreanTowerRangeBonus } from '../civBonusEffects';
import { EMPTY_TECH_SET } from '../economyTechEffects';
import { towerRangeBonus } from '../towerTechEffects';
import { uniqueBuildingBonus } from '../uniqueTechnologies';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  buildingCombatStatesCodec,
  constructionStatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import { buildingFootprint, distanceFromBuildingFootprint, type GameWorld } from './pureHelpers';

/** One cell beyond the arrows' reach: a villager works from the cell BESIDE
 *  its node, and the node's own cell being safe says nothing about that one. */
export const ENEMY_DEFENCE_MARGIN = 1;

export interface StaticDefenceView {
  owner: number;
  buildingType: BuildingType;
  anchor: Position;
  /** The building's effective attack range right now — base plus every
   *  technology and civilization bonus its owner holds. */
  attackRange: number;
  isComplete: boolean;
}

/** A building's arrow range with its owner's bonuses — the tower combat
 *  system's own arithmetic, shared so the keep-out rule and the arrows agree. */
export function effectiveStaticDefenceRange(
  buildingType: BuildingType,
  baseRange: number,
  ownerTechs: ReadonlySet<ResearchableTechnologyType>,
  civilization: string | undefined,
  age: AgeType,
): number {
  // Blacksmith arrow techs (Fletching / Bodkin / Bracer) reach every arrow
  // building; Keep reaches Watch Towers only; Yeomen and Crenellations are the
  // unique technologies that touch defensive buildings; Koreans' towers gain
  // one in the Castle Age and two in the Imperial.
  const towerTechs = buildingType === 'watch-tower' ? ownerTechs : EMPTY_TECH_SET;
  return baseRange
    + buildingArrowRangeBonus(ownerTechs)
    + towerRangeBonus(towerTechs)
    + uniqueBuildingBonus(ownerTechs, buildingType).attackRange
    + koreanTowerRangeBonus(civilization, buildingType, age);
}

/** Every building that shoots, whoever owns it, with its effective range. A
 *  foundation carries no combat state until it completes, but the completion
 *  flag is read as well so the answer never depends on that detail. */
export function collectStaticDefences(
  activeWorld: GameWorld,
  accessor: BridgeStateAccessor,
): StaticDefenceView[] {
  const defences: StaticDefenceView[] = [];
  const combatStates = accessor.get(buildingCombatStatesCodec);
  if (combatStates.size === 0) return defences;
  const constructions = accessor.get(constructionStatesCodec);
  const researched = accessor.get(researchedTechnologiesCodec);
  const civilizations = accessor.get(playerCivilizationsCodec);
  const ages = accessor.get(playerAgesCodec);
  for (const [id, combat] of combatStates) {
    const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
    const anchor = activeWorld.getComponent<Position>(id, 'position');
    if (!building || !anchor) continue;
    const construction = constructions.get(id);
    defences.push({
      owner: building.owner,
      buildingType: building.buildingType,
      anchor,
      attackRange: effectiveStaticDefenceRange(
        building.buildingType,
        combat.attackRange,
        researched.get(building.owner) ?? EMPTY_TECH_SET,
        civilizations.get(building.owner),
        ages.get(building.owner) ?? 'dark-age',
      ),
      isComplete: construction ? construction.isComplete : true,
    });
  }
  return defences;
}

/** The defences `owner` must keep out of: complete, and held by a player it is
 *  at war with. An owner with no team recorded is at war with everyone else. */
export function enemyStaticDefencesOf(
  defences: readonly StaticDefenceView[],
  owner: number,
  teams: ReadonlyMap<number, number>,
): StaticDefenceView[] {
  return defences.filter((defence) => (
    defence.isComplete && isEnemyOwner(teams, owner, defence.owner)
  ));
}

/** Whether a cell is within any of these defences' reach plus the margin,
 *  measured from the nearest cell of the building's footprint. */
export function isInsideDefenceReach(
  node: Position,
  defences: readonly StaticDefenceView[],
): boolean {
  for (const defence of defences) {
    const distance = distanceFromBuildingFootprint(
      defence.anchor,
      buildingFootprint(defence.buildingType),
      node,
    );
    if (distance <= defence.attackRange + ENEMY_DEFENCE_MARGIN) return true;
  }
  return false;
}

/** Manhattan gap between two axis-aligned boxes: zero where they overlap or
 *  touch on an axis, otherwise the shortfall on each axis, summed. Equal to
 *  the smallest distance between any cell of one and any cell of the other,
 *  which is why the footprint check below needs no per-cell scan. */
function footprintGap(
  a: Position,
  aSize: { width: number; height: number },
  b: Position,
  bSize: { width: number; height: number },
): number {
  const dx = Math.max(0, a.x - (b.x + bSize.width - 1), b.x - (a.x + aSize.width - 1));
  const dy = Math.max(0, a.y - (b.y + bSize.height - 1), b.y - (a.y + aSize.height - 1));
  return dx + dy;
}

/** The footprint variant, for a drop-off building: inside when ANY of its
 *  cells is, because a carrier walks to whichever side is nearest. Measured
 *  box-to-box rather than cell-by-cell — the same answer, but O(defences)
 *  instead of O(defences x width x height), and this runs on the drop-off
 *  choice, which is a hot path. */
export function isFootprintInsideDefenceReach(
  anchor: Position,
  footprint: { width: number; height: number },
  defences: readonly StaticDefenceView[],
): boolean {
  for (const defence of defences) {
    const gap = footprintGap(
      anchor,
      footprint,
      defence.anchor,
      buildingFootprint(defence.buildingType),
    );
    if (gap <= defence.attackRange + ENEMY_DEFENCE_MARGIN) return true;
  }
  return false;
}

/** The pure question the rule asks: is this node inside the reach of a
 *  complete building that belongs to somebody `owner` is at war with? */
export function isNodeInsideEnemyDefenceRange(
  node: Position,
  defences: readonly StaticDefenceView[],
  owner: number,
  teams: ReadonlyMap<number, number>,
): boolean {
  return isInsideDefenceReach(node, enemyStaticDefencesOf(defences, owner, teams));
}

export type EnemyStaticDefenceLookup = (
  activeWorld: GameWorld,
  owner: number,
) => readonly StaticDefenceView[];

/** The per-tick memo the hot paths read from. Collecting the defences walks
 *  only the buildings that shoot — a handful — and the answer is cached per
 *  tick and per owner, so an assignment pass over eighty villagers pays for
 *  it once. */
export function createEnemyDefenceLookup(accessor: BridgeStateAccessor): EnemyStaticDefenceLookup {
  let cachedTick = -1;
  let cachedWorld: GameWorld | null = null;
  let all: StaticDefenceView[] = [];
  const byOwner = new Map<number, StaticDefenceView[]>();
  return (activeWorld, owner) => {
    // Keyed on the WORLD as well as the tick: a cache that trusted the tick
    // alone would hand a second world its neighbour's buildings whenever the
    // two happened to stand at the same tick.
    if (activeWorld.tick !== cachedTick || activeWorld !== cachedWorld) {
      cachedTick = activeWorld.tick;
      cachedWorld = activeWorld;
      all = collectStaticDefences(activeWorld, accessor);
      byOwner.clear();
    }
    let mine = byOwner.get(owner);
    if (mine === undefined) {
      mine = enemyStaticDefencesOf(all, owner, accessor.get(playerTeamsCodec));
      byOwner.set(owner, mine);
    }
    return mine;
  };
}
