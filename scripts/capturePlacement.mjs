// The placement ghost, for scripts/captureMapScreenshot.mjs (moved out of it by
// work 148 M3 when PLACE_CLICK took that file past its line cap).
//
// PLACE="house@31,12" shows the placement GHOST there: the human's first
// villager is selected, placement mode is entered for that building (what its
// build card does) and the pointer moves onto the cell, so the frame shows the
// ghost a player would see, green or red. The ghost follows the pointer, not
// world state, so this is the only way a capture reaches it. A cell under the
// HUD (the command bar the selection opens, drawn a frame later) is refused;
// the verdict and the footprint's screen rectangle are printed, to read a
// pixel diff against.
//
// PLACE_CLICK=1 then clicks the cell with the real mouse, so a refused site's
// toast is in the frame; the toast's words and its rectangle are printed. It
// refuses a click the game accepts (a foundation, not a refusal, would be in
// the frame) and a click that raises no toast.
export async function placeGhost(page, place, click) {
  if (!place) {
    if (click) throw new Error('PLACE_CLICK=1 needs PLACE="<building>@x,y" to click');
    return;
  }
  const match = /^([a-z-]+)@(\d+),(\d+)$/.exec(place);
  if (!match) throw new Error(`PLACE must look like house@31,12 (a building type, then its anchor cell); got "${place}"`);
  const [, buildingType, placeX, placeY] = match;
  const began = await page.evaluate((type) => {
    const api = window.__AOE2_TEST__;
    const villager = api.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'villager');
    if (!villager || !api.selectEntityAtCell(villager.x, villager.y)) return 'no villager of the human to select';
    return api.beginBuildingPlacement(type) ? 'ok' : `placement mode for ${type} was refused`;
  }, buildingType);
  if (began !== 'ok') throw new Error(`PLACE ${place} failed: ${began}`);
  await page.waitForTimeout(500);
  const placed = await page.evaluate(([x, y]) => {
    const point = window.__AOE2_TEST__.worldToScreen(x, y);
    return document.elementFromPoint(point.x, point.y) instanceof HTMLCanvasElement
      ? { point }
      : { error: `(${x},${y}) is under the HUD or off the canvas; FOCUS the camera on it` };
  }, [Number(placeX), Number(placeY)]);
  if (placed.error) throw new Error(`PLACE ${place} failed: ${placed.error}`);
  await page.mouse.move(placed.point.x, placed.point.y);
  await page.waitForTimeout(250);
  const ghost = await page.evaluate(([x, y]) => {
    const api = window.__AOE2_TEST__;
    const state = api.getPlacementPreviewState();
    if (!state) return null;
    const corners = [[0, 0], [state.width, 0], [0, state.height], [state.width, state.height]]
      .map(([dx, dy]) => api.worldToScreen(x + dx - 0.5, y + dy - 0.5));
    const xs = corners.map((c) => Math.round(c.x));
    const ys = corners.map((c) => Math.round(c.y));
    return { ...state, rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  }, [Number(placeX), Number(placeY)]);
  if (!ghost || ghost.cellX !== Number(placeX) || ghost.cellY !== Number(placeY)) {
    throw new Error(`PLACE ${place}: the ghost is not on that cell (${JSON.stringify(ghost)})`);
  }
  console.log(`ghost ${buildingType} at (${placeX},${placeY}): ${ghost.isValid ? 'valid (green)' : 'invalid (red)'}; `
    + `footprint on screen x ${ghost.rect[0]}..${ghost.rect[2]}, y ${ghost.rect[1]}..${ghost.rect[3]} (a red marker rises above it)`);
  if (!click) return;
  if (ghost.isValid) throw new Error(`PLACE_CLICK: ${place} can be placed, so a click would found it and raise no refusal`);
  await page.mouse.click(placed.point.x, placed.point.y);
  const toast = page.locator('[data-hud="toast"]:not([data-hud-toast-kind])').first();
  await toast.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
    throw new Error(`PLACE_CLICK: the click on ${place} raised no toast`);
  });
  const box = await toast.boundingBox();
  console.log(`refusal toast "${await toast.textContent()}": on screen x ${Math.round(box.x)}..${Math.round(box.x + box.width)}, `
    + `y ${Math.round(box.y)}..${Math.round(box.y + box.height)}`);
}
