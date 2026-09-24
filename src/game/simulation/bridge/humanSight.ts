// A player's SIGHT: the owners whose vision it sees through — itself, plus
// every owner it shares vision with. Definitive Edition shares vision between
// allies from the first frame (Cartography is gone), and Spies adds every
// other player. What a player is SHOWN — which live entities are drawn, what
// fog memory records, what a click can pick, which swings and deaths animate —
// is decided by this set, never by the player's own vision alone.
//
// Register 2026-09-24: the frame's lit cells already took this union, but the
// filter that picks which live entities reach the renderer asked the human's
// own vision only, so an ally's ground was lit and its whole base missing.
// Every "can the human see this?" question goes through here so the two cannot
// disagree again; `tests/architecture/humanSightQueries.test.ts` refuses the
// human's id passed straight to a visibility query, and the behavioural gates
// it names hold the rest.
//
// The per-owner records stay per-owner: attack and death witness lists, and the
// VisibilityMap itself, are written for each owner separately, and most rules
// of play (a tower's target, a unit's automatic target, the AI's searches)
// still ask the acting owner's own vision. What DOES follow the sight, in world
// state: the human's fog memory (`aoe2.lastSeenStatic`, saved and replayed),
// the target a ground right-click picks, and whether a Monk's conversion
// progresses (a Monk may be sent at an enemy only an ally sees, so it must be
// able to finish). All of it reads teams and technologies from world state, so
// a replay re-simulates it exactly. A recording of a team game (or of one where
// player 1 had Spies) made before v0.3.230 was made under the old rules: its
// fog memory differs, and its right-clicks and conversions are re-decided, so
// it may not re-simulate to its recorded state at all.

import type { VisibilityMap } from 'civ-engine';

import { sharedVisionOwners } from '../alliances';
import type { ResearchableTechnologyType } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  playerResourcesCodec,
  playerTeamsCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import { isFootprintExplored, isFootprintVisible } from './pureHelpers';

const NO_TECHNOLOGIES: ReadonlySet<ResearchableTechnologyType> = new Set();

type SightQuery = Pick<VisibilityMap, 'isVisible' | 'isExplored'>;

/** The owners whose vision `playerId` also sees: its allies, or everyone with Spies. */
export function readSharedVisionOwners(accessor: BridgeStateAccessor, playerId: number): number[] {
  const researched = accessor.get(researchedTechnologiesCodec).get(playerId) ?? NO_TECHNOLOGIES;
  return sharedVisionOwners(
    accessor.get(playerTeamsCodec),
    playerId,
    // Allies share sight from the start of the match — DE removed
    // Cartography and made team vision the default (v0.3.140).
    true,
    accessor.get(playerResourcesCodec).keys(),
    researched.has('spies'),
  );
}

/** `playerId` first, then every owner it shares vision with. */
export function readSightOwners(accessor: BridgeStateAccessor, playerId: number): number[] {
  return [playerId, ...readSharedVisionOwners(accessor, playerId)];
}

export function isCellSeen(
  visibility: SightQuery,
  sight: readonly number[],
  x: number,
  y: number,
): boolean {
  for (const owner of sight) {
    if (visibility.isVisible(owner, x, y)) return true;
  }
  return false;
}

/** Any cell of the footprint is visible to any owner in the sight. */
export function isFootprintSeen(
  visibility: SightQuery,
  sight: readonly number[],
  anchorX: number,
  anchorY: number,
  footprintWidth: number,
  footprintHeight: number,
): boolean {
  for (const owner of sight) {
    if (isFootprintVisible(visibility, owner, anchorX, anchorY, footprintWidth, footprintHeight)) {
      return true;
    }
  }
  return false;
}

/** Any cell of the footprint has been explored by any owner in the sight. */
export function isFootprintKnown(
  visibility: SightQuery,
  sight: readonly number[],
  anchorX: number,
  anchorY: number,
  footprintWidth: number,
  footprintHeight: number,
): boolean {
  for (const owner of sight) {
    if (isFootprintExplored(visibility, owner, anchorX, anchorY, footprintWidth, footprintHeight)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether an event recorded with per-owner witnesses was seen through this
 * sight: some owner in it witnessed the event and has not since lost sight of
 * it (`suppressedFor`).
 */
export function isWitnessedBySight(
  witnessedBy: readonly number[],
  sight: readonly number[],
  suppressedFor?: readonly number[],
): boolean {
  for (const owner of sight) {
    if (witnessedBy.includes(owner) && !suppressedFor?.includes(owner)) return true;
  }
  return false;
}
