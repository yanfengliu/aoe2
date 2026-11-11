// The sentences that answer a refused placement and a cancelled building site,
// and the kind each one is (work 148 M3, spec §14.2).
//
// Two readers. The playtest agent and the tests read the reason whole: what
// blocks, at which cell, the nearest open ground. The player reads one short
// sentence, which the HUD chooses by the reason's KIND (placementRefusalCopy.ts),
// because Definitive Edition answers a red ghost with no sentence at all.
//
// The toast feed is a queue of strings that several producers fill (the click
// path, the builders' cancellation), so the kind is read back from the sentence
// here, beside the code that writes it: each reason is built from the same
// fragments its recogniser looks for, and nothing else in src/ may write one
// (tests/architecture/placementRefusalProducers.test.ts). A new refusal is a new
// kind in this file, and the HUD's table does not compile without its sentence.

export const PLACEMENT_REFUSAL_KINDS = [
  'unexplored',
  'unreachable',
  'needs-shore',
  'needs-water',
  'obstructed',
  'site-cancelled',
] as const;

export type PlacementRefusalKind = (typeof PLACEMENT_REFUSAL_KINDS)[number];

interface Cell {
  x: number;
  y: number;
}

/** The footprint a placement asked for: its building, its size and its anchor. */
export interface RefusedSite extends Cell {
  buildingType: string;
  width: number;
  height: number;
}

const LEAD = 'Placement blocked for ';
const CANCEL_LEAD = 'Your ';

// What marks each kind, once, for the sentence and for its recogniser.
const MARK = {
  unexplored: ': none of that ground has been explored. ',
  unreachable: 'ground is clear, but no builder can walk to a cell beside it',
  'needs-shore': ' must stand on land and touch water you have explored.',
  'needs-water': ' must stand on open water.',
  obstructed: ': blocked by ',
  'site-cancelled': ' was cancelled: its builders found ',
} as const satisfies Record<PlacementRefusalKind, string>;

const size = (site: RefusedSite): string => `${site.buildingType} (${site.width}x${site.height})`;
const at = (cell: Cell): string => `(${cell.x},${cell.y})`;
const where = (site: RefusedSite): string => `${size(site)} at ${at(site)}`;
const seen = (anchor: Cell | undefined): string => (
  anchor ? ` Nearest open ground you can see: ${at(anchor)}.` : ''
);

export const placementRefusalReason = {
  /** None of the footprint is explored ground (spec §12.1, hotfix 45185). */
  unexplored(site: RefusedSite, anchor?: Cell): string {
    return `${LEAD}${where(site)}${MARK.unexplored}`
      + 'A building may stand partly on unexplored ground, but at least one of its cells '
      + `must be ground you have explored.${seen(anchor)}`;
  },

  /** The ground is clear and no builder can walk to it. `unexploredCells` is
   *  how many of the footprint's cells the player has not explored, absent when
   *  the report was not taken through a player's view. */
  unreachable(site: RefusedSite, unexploredCells: number | undefined, anchor?: Cell): string {
    return `${LEAD}${where(site)}: `
      + (unexploredCells === undefined
        ? `the ${MARK.unreachable}.`
        : `the ${unexploredCells > 0 ? 'explored ' : ''}${MARK.unreachable} over ground you have explored.`)
      + (anchor ? ` Nearest open ground a builder can reach: ${at(anchor)}.` : '');
  },

  /** Nothing stands in the way: the building's own ground rule refused it. */
  'needs-shore'(site: RefusedSite, anchor?: Cell): string {
    return `${LEAD}${where(site)}: a ${site.buildingType}${MARK['needs-shore']}${seen(anchor)}`;
  },

  'needs-water'(site: RefusedSite, anchor?: Cell): string {
    return `${LEAD}${where(site)}: a ${site.buildingType}${MARK['needs-water']}${seen(anchor)}`;
  },

  /** Something stands on the footprint. `cause` names it with its cell, and
   *  `counts` is the clause about how many cells are blocked, or empty. */
  obstructed(site: RefusedSite, cause: string, counts: string, anchor?: Cell): string {
    return `${LEAD}${size(site)}${MARK.obstructed}${cause}${counts}.${seen(anchor)}`;
  },

  /** A foundation its builders could not start (spec §12.1): what they found,
   *  and the price that came back. */
  'site-cancelled'(
    site: { buildingType: string } & Cell,
    found: { text: string; foggedAtPlacing: boolean },
    cost: string,
  ): string {
    return `${CANCEL_LEAD}${site.buildingType} at ${at(site)}${MARK['site-cancelled']}`
      + `${found.text}. Its cost (${cost}) was refunded.`
      + (found.foggedAtPlacing ? ' Place it where the ground you have explored is clear.' : '');
  },
} as const satisfies Record<PlacementRefusalKind, (...args: never[]) => string>;

export interface RecognisedPlacementRefusal {
  kind: PlacementRefusalKind;
  /** The building the sentence is about, as the simulation's id. */
  buildingType: string;
}

// The sentence's own shape up to its mark, so a mark inside a quoted cause
// (a blocker's name) cannot be taken for the sentence's kind.
const ID = '([a-z][a-z0-9-]*)';
const SIZE = ' \\(\\d+x\\d+\\)';
const AT = ' at \\(-?\\d+,-?\\d+\\)';
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RECOGNISERS: Record<PlacementRefusalKind, RegExp> = {
  unexplored: new RegExp(`^${literal(LEAD)}${ID}${SIZE}${AT}${literal(MARK.unexplored)}`),
  unreachable: new RegExp(`^${literal(LEAD)}${ID}${SIZE}${AT}: the (?:explored )?${literal(MARK.unreachable)}`),
  'needs-shore': new RegExp(`^${literal(LEAD)}${ID}${SIZE}${AT}: a \\1${literal(MARK['needs-shore'])}`),
  'needs-water': new RegExp(`^${literal(LEAD)}${ID}${SIZE}${AT}: a \\1${literal(MARK['needs-water'])}`),
  obstructed: new RegExp(`^${literal(LEAD)}${ID}${SIZE}${literal(MARK.obstructed)}`),
  'site-cancelled': new RegExp(`^${literal(CANCEL_LEAD)}${ID}${AT}${literal(MARK['site-cancelled'])}`),
};

/** Which kind of placement refusal `reason` is, or null for any other sentence. */
export function placementRefusalKind(reason: string): RecognisedPlacementRefusal | null {
  for (const kind of PLACEMENT_REFUSAL_KINDS) {
    const match = RECOGNISERS[kind].exec(reason);
    if (match) return { kind, buildingType: match[1]! };
  }
  return null;
}

/** Whether `reason` opens as a refused placement does, whatever its kind: the
 *  HUD's net under a sentence the recognisers do not know. */
export function opensAsPlacementRefusal(reason: string): boolean {
  return reason.startsWith(LEAD);
}
