// When the computer starts a House (work 141): ahead of need, by how much free
// population it has left, as Definitive Edition's own AI does.
//
// Before this the AI wanted a House only once its population had REACHED the
// cap, so every House was an emergency: measured on the boot map at the
// lobby's defaults (6b5e9871), owner 2 sat housed 68 s at 5:58 with the human
// idle, and both seats of an all-AI match sat housed 67-71 s around 9:20-10:16,
// their Town Centers idle behind a unit they could not house.
//
// DE's rules (resources/_common/ai/Promisory/buildings.per, the 2026-10-06
// install). Each allows only so many Houses placed and unfinished:
// - Dark Age: free population under 3, none pending (1584-1596);
// - Feudal Age: under 6, or under 8 once a Blacksmith is placed, none
//   pending. That is DE's rule for a Feudal-war strategy (1646-1659, which
//   counts only a standing Blacksmith, where this counts a placed one), the
//   rule at every level (spec §13.2). DE's "usual" strategy, the only one its
//   Standard keeps (init.per 9577-9590), jumps past it (1636-1645) to under 4
//   (1584-1596, which runs in every age from the Feudal research on), or under
//   6 once a Blacksmith is placed (1623-1634). That forced strategy is one of
//   the Standard handicaps spec §13.1 does not adopt (owner decision,
//   2026-11-04), and this AI opens militarily, which is what the Feudal-war
//   rule is written for. M1 shipped it as an interim; it is the rule (work 141
//   M2c). Counting a standing Blacksmith only was measured to move the
//   coverage lab's census (review round 0), so the placed one stays;
// - Castle Age: under 10, 16 from 42 population, 20 from 64, two pending
//   (1767-1779);
// - Imperial Age: under 20, three pending (1789-1801).
// No House is wanted once the cap has reached the hard population limit.
// Not modelled, each a refinement on top of these: the 4 while the Feudal
// research runs and the Castle rule from the Castle research (DE ages its
// rules from the click, `sn-current-age >= dfeudal` and `fcastlea`); the 15 s
// jump before the Castle rule (1758-1766); no House while spare wood is under
// a House's price (1484-1493); the time-boxed delays (1517-1583); the Dark
// Age's under 5 with a Dock or Port, or a drush strategy and a Barracks
// (1598-1609, plan 106's card); the fast-Imperial jump (1780-1788); the
// Imperial 30 while 300 of a resource is spare or civilians are at their
// maximum (1789-1801); and the second Town Center rule.

import type { AgeType } from './types';

export interface HousingState {
  age: AgeType;
  popCurrent: number;
  popCap: number;
  /** The owner's hard population limit: the match setting, plus the Goths'
   *  ten in the Imperial Age. Above it a House buys nothing. */
  hardCap: number;
  /** Houses the owner has placed and not finished. */
  housesPending: number;
  /** Any Blacksmith placed, foundation or standing, which raises the Feudal
   *  threshold from 6 to 8 (interim: see the header). */
  ownsBlacksmith: boolean;
}

/** DE's Castle Age headroom grows with the population it has to feed. */
function castleHeadroom(popCurrent: number): number {
  if (popCurrent >= 64) return 20;
  if (popCurrent >= 42) return 16;
  return 10;
}

export function houseWanted(state: HousingState): boolean {
  if (state.popCap >= state.hardCap) return false;
  const headroom = state.popCap - state.popCurrent;
  switch (state.age) {
    case 'dark-age':
      return state.housesPending === 0 && headroom < 3;
    case 'feudal-age':
      return state.housesPending === 0 && headroom < (state.ownsBlacksmith ? 8 : 6);
    case 'castle-age':
      return state.housesPending < 2 && headroom < castleHeadroom(state.popCurrent);
    case 'imperial-age':
      return state.housesPending < 3 && headroom < 20;
  }
}
