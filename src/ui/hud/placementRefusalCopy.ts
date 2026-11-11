// What the player reads when a placement is refused (work 148 M3, spec §14.2).
//
// Definitive Edition answers a click on a red ghost with no sentence: its
// string table has the prompt (3095 "Click where you want to build the
// building."), the price's refusals (3001-3004 "Not enough wood.") and, for a
// site its builders find blocked, 3094 "Building site obstructed. Building
// canceled."; the manual in its install says only that the building "is shown
// in flashing red if you cannot build in a particular location". This game is
// silent by the owner's decision, so one short sentence stands where DE's
// error sound does: 3094's words for a site with something in the way, and a
// sentence of that length for the three refusals a red ghost cannot explain
// by itself (unexplored ground, a site no builder can walk to, a building's
// own ground rule).
//
// The simulation's reason stays whole in the queue, for the playtest agent
// and the tests. Its KIND is read from it by the module that writes it
// (placementRefusal.ts), and this table is typed by kind, so a new kind does
// not compile without its sentence.

import {
  opensAsPlacementRefusal,
  placementRefusalKind,
  type PlacementRefusalKind,
} from '../../game/simulation/handlers/building/placementRefusal';
import { formatEntityName } from './displayNames/entityNames';

const OBSTRUCTED = 'Building site obstructed.';

const article = (name: string): string => (/^[aeiou]/i.test(name) ? 'An' : 'A');

/** One sentence per kind; `building` is the building's display name. */
export const PLACEMENT_REFUSAL_COPY: Record<PlacementRefusalKind, (building: string) => string> = {
  obstructed: () => OBSTRUCTED,
  unexplored: () => "You can't build on unexplored ground.",
  unreachable: () => "Your builders can't reach that site.",
  'needs-shore': (building) => `${article(building)} ${building} must be built on the shore.`,
  'needs-water': (building) => `${article(building)} ${building} must be built on water.`,
  // DE's string 3094, whole: the site was taken, and the price came back.
  'site-cancelled': () => `${OBSTRUCTED} Building canceled.`,
};

/** A refusal as the toast shows it: a placement's by its kind, any other as it is. */
export function playerFacingRejection(reason: string): string {
  const refusal = placementRefusalKind(reason);
  if (refusal) {
    const building = formatEntityName(refusal.buildingType as Parameters<typeof formatEntityName>[0]);
    return PLACEMENT_REFUSAL_COPY[refusal.kind](building);
  }
  // A placement refusal this table does not know still reads short: the long
  // sentence is the defect, and the class test fails before a player meets it.
  return opensAsPlacementRefusal(reason) ? OBSTRUCTED : reason;
}
