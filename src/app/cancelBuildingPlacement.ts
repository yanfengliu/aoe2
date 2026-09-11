// Disarming a building placement without disturbing who is selected.
//
// `beginBuildingPlacement` arms the bridge's pending placement; until v0.3.223
// the ONLY things that disarmed it were spending it (a confirmed placement), a
// world command (right-click), or a change of selection. There was no cancel,
// so Escape opened the game menu with the placement still armed, the ghost
// went on drawing at the pointer, and every subsequent left click on the world
// was eaten as a placement attempt — the player's way out was to open the menu
// and close it again (play-test 2026-09-11, `17-escape-during-placement.png`).
//
// The bridge has no `cancelBuildingPlacement` and this repository's UI lane may
// not add one, so the cancel is expressed through the selection API that
// already clears it: re-selecting the CURRENT refs. `selectByRefs` clears the
// pending placement on every path (`selectionInputOps.ts`), and handing back
// the refs the selection already holds makes the round trip an identity for
// everything else — the same villagers stay selected, with the same build
// palette, which is what DE does when you press Escape mid-placement.
//
// Returns whether anything was actually disarmed, so a caller choosing between
// several meanings for one key can tell whether this one applied.

import type { EntityRef } from 'civ-engine';

export interface PlacementCancelBridge {
  getSelectionState(): { placementMode: string | null };
  getSelectedEntityRefs(): readonly EntityRef[];
  select(refs: readonly EntityRef[]): void;
}

export function isBuildingPlacementArmed(bridge: PlacementCancelBridge): boolean {
  return bridge.getSelectionState().placementMode !== null;
}

export function cancelBuildingPlacement(bridge: PlacementCancelBridge): boolean {
  if (!isBuildingPlacementArmed(bridge)) {
    return false;
  }
  // Snapshot BEFORE the round trip: `select` replaces the selection, so the
  // getter has to be read first or it reads back what we just wrote.
  const refs = bridge.getSelectedEntityRefs();
  bridge.select(refs);
  return true;
}
