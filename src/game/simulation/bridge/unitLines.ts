// Which units are the same UNIT LINE at different tiers.
//
// A producer offers `latestResearchedInChain` — one unit per line, the best
// tier the owner has actually researched. The AI's `pickUnitMix` names the TOP
// of each line, so an owner that has not researched the top upgrade was offered
// a unit whose name never matched, the production loop's membership test failed
// for every entry, and the AI trained NOTHING from ANY building for the rest of
// the match. Measured on `fortress` at 60,000 ticks: both owners in the
// Imperial age, five military buildings each, all idle in 100% of samples,
// armies of 2 and 0, while the barracks offered pikemen it could afford twice
// over and holding 1,231 wood and 595 food.
//
// Derived from `UNIT_LINE_UPGRADES` rather than restated, because a second copy
// of the tiers is a copy that can drift from the one the upgrades actually use:
// the Siege Ram's line gained a middle tier (Battering -> Capped -> Siege) in
// that table, and a hand-written line list here would have kept the old pair.
import { UNIT_LINE_UPGRADES } from './unitLineUpgrades';
import type { UnitType } from '../unitTypes';

/** Union-find over the table's `from -> to` edges: one class per unit line. */
function buildLineRoots(): Map<UnitType, UnitType> {
  const parent = new Map<UnitType, UnitType>();
  const find = (unit: UnitType): UnitType => {
    const seen = parent.get(unit);
    if (seen === undefined || seen === unit) {
      parent.set(unit, unit);
      return unit;
    }
    const root = find(seen);
    parent.set(unit, root);
    return root;
  };
  const union = (a: UnitType, b: UnitType): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };
  for (const upgrade of Object.values(UNIT_LINE_UPGRADES)) {
    if (!upgrade) continue;
    for (const from of upgrade.from) union(from, upgrade.to);
  }
  const roots = new Map<UnitType, UnitType>();
  for (const unit of parent.keys()) roots.set(unit, find(unit));
  return roots;
}

const LINE_ROOTS = buildLineRoots();

/**
 * The line `unit` belongs to. A unit with no upgrade of its own — a Petard, a
 * Trebuchet — is its own line, so unrelated units never resolve to each other.
 */
export function unitLineOf(unit: UnitType): UnitType {
  return LINE_ROOTS.get(unit) ?? unit;
}

/**
 * The offered unit that is the same line as `wanted`, or undefined when the
 * producer offers nothing from that line at all.
 *
 * `wanted` itself wins when it is on offer, so an owner holding every upgrade
 * behaves exactly as before. Otherwise this is the tier it has: asking for a
 * Halberdier at a barracks offering `[long-swordsman, pikeman]` trains the
 * PIKEMAN, which is what an AoE2 player does while the upgrade is unresearched,
 * rather than training nothing.
 *
 * A producer offers at most one unit per line, so the match is unambiguous.
 */
export function trainableInSameLine<T extends UnitType>(
  wanted: UnitType,
  offers: readonly T[],
): T | undefined {
  const line = unitLineOf(wanted);
  return offers.find((offer) => offer === wanted)
    ?? offers.find((offer) => unitLineOf(offer) === line);
}
