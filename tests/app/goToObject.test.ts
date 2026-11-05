// Where Space, H and the idle cycles put the camera (work 142), and what they
// must not reveal: a selection outlives an enemy walking into the fog, so the
// camera follows another player's unit or a resource (a wild animal moves)
// only while its cell is in the player's sight (review round 7). A building
// stands still and is drawn where it was last seen, so it is always reachable.

import { describe, expect, it, vi } from 'vitest';

import { centreOnObject } from '../../src/app/bootstrap/goToObject';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

function fakeBridge(visibleCells: ReadonlySet<string>): SimulationBridge {
  return {
    getEconomyState: () => ({
      units: [
        { id: 1, owner: 1, x: 3, y: 4 },
        { id: 2, owner: 2, x: 30, y: 40 },
      ],
      buildings: [{ id: 3, owner: 2, x: 50, y: 60, footprintWidth: 4, footprintHeight: 4 }],
      resources: [
        { id: 4, owner: null, x: 70, y: 80 },
        { id: 5, owner: 1, x: 90, y: 91 },
      ],
    }),
    isCellVisibleForOwner: (_owner: number, x: number, y: number) => visibleCells.has(`${x},${y}`),
  } as unknown as SimulationBridge;
}

describe('centreOnObject', () => {
  it("centres on the player's own unit and resource wherever they stand", () => {
    const view = { centerCameraOnWorldPosition: vi.fn() };
    expect(centreOnObject(fakeBridge(new Set()), view, 1)).toBe(true);
    expect(centreOnObject(fakeBridge(new Set()), view, 5)).toBe(true);
    expect(view.centerCameraOnWorldPosition.mock.calls).toEqual([[3.5, 4.5], [90.5, 91.5]]);
  });

  it("does not follow another player's unit or a wild resource into the fog", () => {
    const view = { centerCameraOnWorldPosition: vi.fn() };
    expect(centreOnObject(fakeBridge(new Set()), view, 2)).toBe(false);
    expect(centreOnObject(fakeBridge(new Set()), view, 4)).toBe(false);
    expect(view.centerCameraOnWorldPosition).not.toHaveBeenCalled();
    expect(centreOnObject(fakeBridge(new Set(['30,40', '70,80'])), view, 2)).toBe(true);
    expect(centreOnObject(fakeBridge(new Set(['30,40', '70,80'])), view, 4)).toBe(true);
    expect(view.centerCameraOnWorldPosition.mock.calls).toEqual([[30.5, 40.5], [70.5, 80.5]]);
  });

  it("centres another player's building on its footprint's middle, seen or remembered", () => {
    const view = { centerCameraOnWorldPosition: vi.fn() };
    expect(centreOnObject(fakeBridge(new Set()), view, 3)).toBe(true);
    expect(view.centerCameraOnWorldPosition).toHaveBeenCalledWith(52, 62);
  });
});
