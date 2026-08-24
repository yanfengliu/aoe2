// Who counts as an enemy.
//
// §2.2 puts "optional AI allies" in scope, and until now every owner that was
// not you was an enemy — there was no notion of a team anywhere in the
// simulation. That is the difference between a free-for-all and a skirmish
// with sides, and it is also what Market trade and Cartography are FOR: both
// are technologies about allies, and neither can mean anything without them.
//
// A team is a number per owner. An owner with no team recorded is its own
// team, which makes the default a free-for-all and keeps every existing match
// behaving exactly as it did — the whole point of expressing it this way rather
// than as a list of alliances.

/** The team an owner plays for: its own number unless a scenario says otherwise. */
export function teamOf(teams: ReadonlyMap<number, number>, owner: number): number {
  return teams.get(owner) ?? owner;
}

/**
 * Whether these two owners are on the same side. An owner is always allied with
 * itself, so callers do not need a separate self check.
 */
export function areAllied(
  teams: ReadonlyMap<number, number>,
  a: number,
  b: number,
): boolean {
  if (a === b) return true;
  return teamOf(teams, a) === teamOf(teams, b);
}

/** Whether `other` is somebody `viewer` should be shooting at. */
export function isEnemyOwner(
  teams: ReadonlyMap<number, number>,
  viewer: number,
  other: number,
): boolean {
  return !areAllied(teams, viewer, other);
}

/**
 * Parse a team assignment written as one number per player, in owner order:
 * "1,1,2" puts owners 1 and 2 together against owner 3.
 *
 * Returns an empty map for anything unusable — a bad value should leave a
 * free-for-all rather than refuse to start a game — and ignores an assignment
 * that puts EVERY player on one team, which would be a match nobody can win.
 */
export function parseTeamAssignment(raw: string, playerCount: number): Map<number, number> {
  const teams = new Map<number, number>();
  const tokens = raw.split(',').map((token) => token.trim()).filter((token) => token !== '');
  if (tokens.length !== playerCount) return teams;
  const parsed = tokens.map((token) => Number(token));
  if (parsed.some((value) => !Number.isInteger(value) || value < 1)) return teams;
  if (new Set(parsed).size < 2) return teams;
  parsed.forEach((team, index) => teams.set(index + 1, team));
  return teams;
}
