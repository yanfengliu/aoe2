import type { Position } from 'civ-engine';
import type { ScenarioSpawnSpec } from '../prototypeScenario';

// Shared fixture position constants. Originally inlined at the top of
// prototypeScenario.ts; the fixtures that use them are spread across
// several categories (feudal prereqs, feudal stables, selection tests,
// etc.) so pulling them into one module keeps the single source of truth
// without making a single fixture file own them.

export const FIXTURE_NEARBY_VILLAGER_POSITION: Position = { x: 6, y: 10 };
export const FIXTURE_PRIMARY_BUILDING_POSITION: Position = { x: 13, y: 8 };
export const FIXTURE_SECONDARY_BUILDING_POSITION: Position = { x: 17, y: 8 };
export const FIXTURE_STACK_POSITION: Position = { x: 13, y: 12 };
export const FIXTURE_VILLAGER_CLUSTER: Position[] = [
  { x: 5, y: 10 },
  { x: 6, y: 10 },
  { x: 7, y: 10 },
];
export const FIXTURE_MIXED_SELECTION_HOUSE_POSITION: Position = { x: 12, y: 12 };
export const FIXTURE_MIXED_SELECTION_UNITS: Array<{
  kind: 'villager' | 'militia' | 'scout';
  x: number;
  y: number;
}> = [
  { kind: 'villager', x: 5, y: 10 },
  { kind: 'militia', x: 6, y: 10 },
  { kind: 'scout', x: 7, y: 10 },
];

export { createGrassFixtureTerrain } from './createGrassFixtureTerrain';

// Spawn-literal helpers (2026-07-17). The fixture tier used to hand-write
// every spawn as a full object literal — ~900 of them, ~45% of the tier's
// LOC — and the copies encoded two invariants only by repetition: an owned
// spawn's baseOwner always equals its owner (845/845 literals), and a
// vision source always belongs to the owner (697/697). These helpers make
// both structural. The conversion was proven behavior-preserving by
// canonical-JSON-diffing createPrototypeScenario() for every dispatch-table
// seed before and after; tests/simulation/fixtureSpawnHelpers.test.ts pins
// the helper contract itself.

type SpawnKind = ScenarioSpawnSpec['kind'];

// Everything a spawn literal may carry beyond the identity fields the
// helpers own. `vision` narrows to the radius alone — the playerId half is
// derived from the owner, which is the invariant the helper exists to keep.
type OwnedSpawnExtras =
  Omit<ScenarioSpawnSpec, 'kind' | 'x' | 'y' | 'owner' | 'baseOwner' | 'vision'>
  & { vision?: number };

// Gaia spawns never carry vision (they see nothing), but a resource seeded
// inside a player's base area may carry that player as `baseOwner` while
// staying unowned — the AI economy fixtures use this attribution.
type GaiaSpawnExtras =
  Omit<ScenarioSpawnSpec, 'kind' | 'x' | 'y' | 'owner' | 'baseOwner' | 'vision'>
  & { baseOwner?: number };

/** A player-owned spawn: baseOwner mirrors owner, vision (if any) is the owner's. */
export function ownedSpawn(
  kind: SpawnKind,
  owner: number,
  x: number,
  y: number,
  extras: OwnedSpawnExtras = {},
): ScenarioSpawnSpec {
  const { vision, ...rest } = extras;
  return {
    kind,
    x,
    y,
    owner,
    baseOwner: owner,
    // Conditional spread, not `vision: maybeUndefined` — the produced object
    // must have exactly the keys the hand-written literal had, so absent
    // stays absent (toStrictEqual and the snapshot diff both see key sets).
    ...(vision === undefined ? {} : { vision: { playerId: owner, radius: vision } }),
    ...rest,
  };
}

/** An unowned (gaia) spawn; extras.baseOwner may attribute it to a base area. */
export function gaiaSpawn(
  kind: SpawnKind,
  x: number,
  y: number,
  extras: GaiaSpawnExtras = {},
): ScenarioSpawnSpec {
  return { kind, x, y, owner: null, baseOwner: null, ...extras };
}
