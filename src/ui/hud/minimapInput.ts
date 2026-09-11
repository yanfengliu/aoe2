// The minimap's two mouse buttons.
//
// LEFT pans the camera — press, and keep panning while the button is held, so
// dragging across the minimap sweeps the view. That half has worked since M2.
//
// RIGHT issues the selection's context order at that point, which is what a DE
// player does every few seconds to send an army across the map without looking
// away from what they are doing. Until v0.3.223 the handler returned on
// `event.button !== 0` and the minimap had no `contextmenu` listener at all, so
// a right-click did nothing and — on a build where the canvas's own
// preventDefault does not reach here — could pop the browser's context menu
// over the map (play-test 2026-09-11).
//
// Split out of `createHudController.ts` because the controller was at 498 of
// this repository's 500-line ceiling; the minimap's input is a role of its own
// and it now owns both buttons.

import { getMinimapLayout, minimapToCell } from './minimap';
import type { RenderState } from '../../game/simulation/types';

export interface MinimapInputDeps {
  /** The live render state, or null before the first frame. */
  getRenderState(): RenderState | null;
  /** Left button: put this cell in the middle of the view. */
  centerCameraOnWorldPosition(cellX: number, cellY: number): void;
  /**
   * Right button: the selection's context order at this cell — the same
   * meaning a right-click on the world has (move / gather / attack), decided
   * by the simulation rather than here.
   */
  issueContextCommand(cellX: number, cellY: number): boolean;
}

export interface MinimapInputHandle {
  /** Drops every listener this mounted, including the window-level ones. */
  dispose(): void;
}

export function mountMinimapInput(
  minimap: HTMLCanvasElement,
  deps: MinimapInputDeps,
): MinimapInputHandle {
  let isDragActive = false;

  /**
   * The map cell under a client point, or null when the point is off the map
   * diamond (the minimap canvas's corners are off-map) or before the first
   * frame. Both buttons go through this, so neither can act on a cell the
   * other would have rejected.
   */
  const cellAt = (clientX: number, clientY: number): { cellX: number; cellY: number } | null => {
    const frame = deps.getRenderState()?.frame;
    if (!frame) {
      return null;
    }
    const layout = getMinimapLayout(minimap, frame);
    if (!layout) {
      return null;
    }
    const bounds = minimap.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }
    const canvasScaleX = minimap.width / bounds.width;
    const canvasScaleY = minimap.height / bounds.height;
    const localX = (clientX - bounds.left) * canvasScaleX;
    const localY = (clientY - bounds.top) * canvasScaleY;
    const { cellX, cellY } = minimapToCell(localX, localY, layout);
    if (cellX < 0 || cellX > frame.mapWidth || cellY < 0 || cellY > frame.mapHeight) {
      return null;
    }
    return { cellX, cellY };
  };

  const panTo = (clientX: number, clientY: number): void => {
    const cell = cellAt(clientX, clientY);
    if (!cell) {
      return;
    }
    // centerCameraOnWorldPosition takes CELL coordinates (it projects to iso
    // internally).
    deps.centerCameraOnWorldPosition(cell.cellX, cell.cellY);
  };

  const handleTrackedMouseMove = (event: MouseEvent): void => {
    if (!isDragActive) {
      return;
    }
    if ((event.buttons & 1) === 0) {
      isDragActive = false;
      return;
    }
    panTo(event.clientX, event.clientY);
  };

  const handleTrackedMouseEnd = (): void => {
    isDragActive = false;
  };

  // M2: named handler so its removal can be registered — an inline arrow could
  // never be removed, leaking a listener on the minimap element on destroy.
  const handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 2) {
      // The order goes out on PRESS, like the world's right-click, so a player
      // who flicks the mouse away before releasing still gets the order.
      const cell = cellAt(event.clientX, event.clientY);
      if (!cell) {
        return;
      }
      event.preventDefault();
      deps.issueContextCommand(Math.floor(cell.cellX), Math.floor(cell.cellY));
      return;
    }
    if (event.button !== 0) {
      return;
    }
    isDragActive = true;
    event.preventDefault();
    panTo(event.clientX, event.clientY);
  };

  // Without this the browser's own menu opens over the map on the very
  // right-click that just issued the order.
  const handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  minimap.addEventListener('mousedown', handleMouseDown);
  minimap.addEventListener('mousemove', handleTrackedMouseMove);
  minimap.addEventListener('contextmenu', handleContextMenu);
  window.addEventListener('mousemove', handleTrackedMouseMove);
  window.addEventListener('mouseup', handleTrackedMouseEnd);

  return {
    dispose: () => {
      minimap.removeEventListener('mousedown', handleMouseDown);
      minimap.removeEventListener('mousemove', handleTrackedMouseMove);
      minimap.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleTrackedMouseMove);
      window.removeEventListener('mouseup', handleTrackedMouseEnd);
    },
  };
}
