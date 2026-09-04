// The maps a player can actually choose, in the order the setup screen lists
// them (spec §5.4's roster plus the standard map).
//
// It lives in the simulation layer rather than in the setup screen because it
// is game content, and because a gate that means "every map that ships" has to
// read the same list the player picks from. `dropOffAnchorReach.test.ts` does:
// three of these maps shipped with their whole woodline beyond the AI's
// drop-off anchor radius, so its lumber camp went up beside the Town Centre
// with no tree within fifteen cells, and a hand-typed list in the test would
// have let the next such map through.

export interface PlayableMap {
  readonly seed: string;
  readonly label: string;
}

export const PLAYABLE_MAPS: readonly PlayableMap[] = [
  { seed: 'aoe2-prototype', label: 'Standard' },
  { seed: 'arabia', label: 'Arabia' },
  { seed: 'arena', label: 'Arena' },
  { seed: 'black-forest', label: 'Black Forest' },
  { seed: 'coastal', label: 'Coastal' },
  { seed: 'fortress', label: 'Fortress' },
  { seed: 'gold-rush', label: 'Gold Rush' },
  { seed: 'islands', label: 'Islands' },
  { seed: 'nomad', label: 'Nomad' },
];
