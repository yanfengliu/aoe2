// Where DE's "go to" keys put the camera (work 142): Space (Go to Selected
// Object), H (Go to Town Center), '.' and ',' (the idle cycles). The camera
// centres on the object itself: a unit's or a resource's cell, a building's
// whole footprint (its origin cell is a corner, which a 4x4 Town Center
// would leave a cell and a half off the middle of the screen).

import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../game/simulation/prototypeScenario';

export interface CentringViewLike {
  centerCameraOnWorldPosition(x: number, y: number): void;
}

/** Whether the player's sight covers a cell: its own vision, its allies', and
 *  with Spies everyone's (`humanSight.ts`; review round 8), as the frame and
 *  the click draw and take entities. */
function isSeenByPlayer(bridge: SimulationBridge, x: number, y: number): boolean {
  const sight = [HUMAN_PLAYER_ID, ...bridge.getSharedVisionOwners(HUMAN_PLAYER_ID)];
  return sight.some((owner) => bridge.isCellVisibleForOwner(owner, x, y));
}

/** The camera's target for an entity, or null. A selection outlives another
 *  player's unit walking into the fog (review round 7), so a unit or a
 *  resource that is not the player's (a wild animal moves) is a target only on
 *  a cell the player's sight covers. A building stands still and is drawn
 *  where it was last seen, so it always is. */
export function objectCentre(bridge: SimulationBridge, id: number): { x: number; y: number } | null {
  const economy = bridge.getEconomyState();
  const building = economy.buildings.find((candidate) => candidate.id === id);
  if (building) return { x: building.x + building.footprintWidth / 2, y: building.y + building.footprintHeight / 2 };
  const placed = economy.units.find((candidate) => candidate.id === id)
    ?? economy.resources.find((candidate) => candidate.id === id);
  if (!placed) return null;
  if (placed.owner !== HUMAN_PLAYER_ID && !isSeenByPlayer(bridge, placed.x, placed.y)) return null;
  return { x: placed.x + 0.5, y: placed.y + 0.5 };
}

/** Centres the camera on the entity; false when no such entity stands. */
export function centreOnObject(bridge: SimulationBridge, view: CentringViewLike, id: number | null): boolean {
  const centre = id === null ? null : objectCentre(bridge, id);
  if (!centre) return false;
  view.centerCameraOnWorldPosition(centre.x, centre.y);
  return true;
}
