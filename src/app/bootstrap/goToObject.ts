// Where DE's "go to" keys put the camera (work 142): Space (Go to Selected
// Object), H (Go to Town Center), '.' and ',' (the idle cycles). The camera
// centres on the object itself: a unit's or a resource's cell, a building's
// whole footprint (its origin cell is a corner, which a 4x4 Town Center
// would leave a cell and a half off the middle of the screen).

import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';

export interface CentringViewLike {
  centerCameraOnWorldPosition(x: number, y: number): void;
}

export function objectCentre(bridge: SimulationBridge, id: number): { x: number; y: number } | null {
  const economy = bridge.getEconomyState();
  const unit = economy.units.find((candidate) => candidate.id === id);
  if (unit) return { x: unit.x + 0.5, y: unit.y + 0.5 };
  const building = economy.buildings.find((candidate) => candidate.id === id);
  if (building) return { x: building.x + building.footprintWidth / 2, y: building.y + building.footprintHeight / 2 };
  const resource = economy.resources.find((candidate) => candidate.id === id);
  return resource ? { x: resource.x + 0.5, y: resource.y + 0.5 } : null;
}

/** Centres the camera on the entity; false when no such entity stands. */
export function centreOnObject(bridge: SimulationBridge, view: CentringViewLike, id: number | null): boolean {
  const centre = id === null ? null : objectCentre(bridge, id);
  if (!centre) return false;
  view.centerCameraOnWorldPosition(centre.x, centre.y);
  return true;
}
