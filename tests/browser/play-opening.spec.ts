// A repeatable, headless PLAY TEST of the opening a player actually plays on
// the boot scenario: through the lobby, with the real mouse on the canvas and
// the real buttons in the HUD, in a RUNNING match — never `advanceTicks`.
//
// Why (2026-09-02): the owner's acceptance test is "does it feel like AoE2 DE
// when playing". A manual session in the in-app Browser pane cannot run while
// the pane is hidden — the simulation is rAF-driven and gets no frames there
// (clock frozen at 00:00, accepted orders never executed) — but Playwright's
// headless page is visible to itself, so real pointer events and real frames
// work. This is also the only coverage of the INTERACTIVE render states
// (selection, placement ghost, foundation, panels): every other visual check
// is a boot-state screenshot.
//
// Screenshots land in tmp/play/ (gitignored task-run evidence):
//   01-select.png  02-gather.png  03-placement-ghost.png  04-foundation.png
//   05-tc.png  06-house-done.png
//
// FINDINGS (2026-09-02) — what does NOT match DE, measured by this test and
// by a headless companion probe of the same order on the same map.
//
// F1-F4 are FIXED (2026-09-02, same day) and this file now ASSERTS them, so
// each is a gate rather than a note:
//   F1 Outpost cost. Was 25 wood + 10 stone in the BUILD card and in
//      structures.csv row 52, against DE's 25 wood + 5 stone (aoe2techtree
//      data.json, building 598 — the source the CSVs name). The CSV row was
//      wrong; EXPECTED_BUILD_PANEL below now pins DE's price.
//   F2 A villager 1-2 tiles from a House site took ~22 s of GAME time to
//      START building, because the approach search returned the first
//      candidate cell the footprint enumeration named rather than the nearest
//      reachable one, and walked around to the far edge. Approaches now sort
//      nearest-first (`approachOrdering.ts`); step 7 asserts the walk.
//   F3 The whole Dark Age ran at about half DE's pace — House 120 ticks
//      against DE's 250, Mill and camps 180 against 350, Barracks 240 against
//      500, Town Center 300 against 1500 — because BUILDING_BUILD_TIME_TICKS
//      was hand-maintained. Every row now comes from structures.csv, gated by
//      `tests/content/structureCostsAndBuildTimes.test.ts`, and AoE2's
//      multi-builder curve (3 x base / (builders + 2)) is implemented; step 7
//      asserts the House's build time.
//   F4 structures.csv row 6 priced a House at 30 wood while the game charged
//      25 and DE charges 25. The CSV row was the wrong one and is fixed.
//
// STILL OPEN, both UI:
//   F5 UI, viewport-scoped (01-select.png, 04-foundation.png): at this
//      suite's 800x600 the command deck wraps and the BUILD group lands at
//      y 675-743, below the panel's 588 px bottom edge (max-height 208px,
//      overflow-y hidden) — invisible, and a wheel cannot reach it; the HP
//      row sits at y 556 outside its 104 px summary box. The cards are only
//      reachable here because locator.click() scrolls hidden overflow. At
//      1280x720 and 1920x1080 everything is in view. DE never clips the
//      command card.
//   F6 UI (03-placement-ghost.png): a clicked command card keeps keyboard
//      focus (document.activeElement stays BUTTON[data-command=build-house])
//      and the tooltip re-shows for the focused card when the pointer leaves
//      it, so "Place a House foundation…" stays over the panel while the
//      pointer is on the map — still active after a 12-step sweep across the
//      canvas. DE hides a tooltip when the cursor leaves the button. (The
//      2026-09-01 lessons-evidence note says a card click does NOT keep
//      focus; measured otherwise here.)
// Matches DE, measured: villager 50 food, Loom 50 gold, Town Center 2400 HP
// and 0/15 garrison, House 25 wood and +5 pop, Palisade Wall 2 / Gate 30
// wood, first sheep drop-off of 10 food after ~31 s of game time (~20.5 s
// real at Normal), and the builder's card reads "Building House" at once.
//
// Runtime: a real match for ~1 minute at the lobby's default speed (Normal,
// 1.5x). The suite has no "slow" project or tag, so this test carries its
// own timeout and the @slow tag — `--grep-invert @slow` skips it.

import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import * as play from './helpers/playOpening';

const HUMAN = 1;

// The BUILD panel a Dark Age Britons villager shows, as read from the cards
// in panel order. Palisade Wall (2 wood/tile) and Palisade Gate (30 wood)
// are DE's Dark Age options too.
const EXPECTED_BUILD_PANEL: play.BuildCard[] = [
  { name: 'House', cost: { wood: 25 } },
  { name: 'Mill', cost: { wood: 100 } },
  { name: 'Lumber Camp', cost: { wood: 100 } },
  { name: 'Mining Camp', cost: { wood: 100 } },
  { name: 'Barracks', cost: { wood: 175 } },
  { name: 'Palisade Wall', cost: { wood: 2 } },
  { name: 'Palisade Gate', cost: { wood: 30 } },
  { name: 'Farm', cost: { wood: 60 } },
  { name: 'Dock', cost: { wood: 150 } },
  { name: 'Outpost', cost: { wood: 25, stone: 5 } },
];

test('the opening plays like AoE2 DE through the lobby, the mouse, and the HUD', {
  tag: '@slow',
}, async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const startedAt = Date.now();
  const annotate = (description: string): void => {
    testInfo.annotations.push({ type: 'play', description });
  };
  const errors = play.collectPageErrors(page);
  // Simulation ticks (10 per game second) at each landmark, so the timings
  // the annotations report are GAME time and comparable with DE's tables.
  const ticks: Record<string, number> = {};
  const currentTick = (): Promise<number> =>
    page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);

  // ---- 1. Boot into the match through the lobby -------------------------
  await test.step('1. Start Match from the lobby boots aoe2-prototype, Britons vs 1 AI', async () => {
    const url = new URL(await play.startMatchFromLobby(page));
    expect(url.searchParams.get('seed')).toBe('aoe2-prototype');
    expect(url.searchParams.get('civ')).toBe('Britons');
    expect(url.searchParams.get('players')).toBeNull();
    const snapshot = await game.getSnapshot(page);
    const townCenters = snapshot.economyState.buildings.filter(
      (building) => building.buildingType === 'town-center',
    );
    expect(townCenters.map((building) => building.owner).sort()).toEqual([1, 2]);
    const hud = await play.readHud(page);
    expect(hud).toMatchObject({ food: 200, wood: 200, gold: 100, stone: 200, pop: '4/5' });
    annotate(`boot: ${url.search} in ${Date.now() - startedAt} ms; hud ${JSON.stringify(hud)}`);
  });

  // ---- 2. The clock runs -----------------------------------------------
  await test.step('2. the HUD clock leaves 00:00 within seconds of real time', async () => {
    const tickBefore = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
    await expect(page.locator('[data-hud="time"]')).not.toHaveText('00:00', { timeout: 10_000 });
    const tickAfter = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
    expect(tickAfter).toBeGreaterThan(tickBefore);
    annotate(`clock: tick ${tickBefore} -> ${tickAfter}, HUD ${(await play.readHud(page)).time}`);
  });

  // ---- 3. Click a villager ---------------------------------------------
  await test.step('3. a left click on a villager selects it and shows its card and BUILD panel', async () => {
    const villager = await play.findMouseReachableEntity(page, {
      kind: 'unit', entityType: 'villager', owner: HUMAN, idleOnly: true,
    });
    expect(villager, 'no idle villager is on the canvas where the mouse can reach it').not.toBeNull();
    await play.clickAt(page, villager!.screen);

    await expect.poll(() => play.selectedEntityId(page)).toBe(villager!.id);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    const panel = await play.readSelectionPanel(page);
    expect(panel.name).toBe('Villager');
    expect(panel.activity).toBe('Idle');
    expect(panel.health).toBe('25 / 25');
    expect(await play.readBuildPanel(page)).toEqual(EXPECTED_BUILD_PANEL);
    annotate(`select: villager #${villager!.id} at cell (${villager!.cellX}, ${villager!.cellY}) `
      + `screen (${Math.round(villager!.screen.x)}, ${Math.round(villager!.screen.y)}); `
      + `shot ${await play.screenshot(page, '01-select.png')}`);
  });

  // ---- 4. Right-click a sheep ------------------------------------------
  await test.step('4. a right click on a sheep sets the villager gathering food and FOOD rises', async () => {
    const idleBefore = (await play.readHud(page)).idleVillagers;
    const sheep = await play.findMouseReachableEntity(page, {
      kind: 'resource', entityType: 'sheep', owner: HUMAN,
    });
    expect(sheep, 'no owned sheep is on the canvas where the mouse can reach it').not.toBeNull();
    await play.clickAt(page, sheep!.screen, 'right');

    await expect(page.locator('[data-selection-activity]')).toHaveText('Gathering food');
    await expect(page.locator('[data-hud="idle-villager-bell"] [data-idle-count]'))
      .toHaveText(String(idleBefore - 1));

    const gatherStartedAt = Date.now();
    await expect.poll(async () => (await play.readHud(page)).food, {
      message: 'FOOD never rose above 200 — the villager was ordered to a sheep and nothing landed',
      timeout: 60_000,
    }).toBeGreaterThan(200);
    const food = (await play.readHud(page)).food;
    annotate(`gather: sheep #${sheep!.id} at (${sheep!.cellX}, ${sheep!.cellY}); idle ${idleBefore} -> `
      + `${idleBefore - 1}; FOOD 200 -> ${food} after ${Date.now() - gatherStartedAt} ms real time; `
      + `shot ${await play.screenshot(page, '02-gather.png')}`);
  });

  // ---- 5. Idle villager -> House placement -----------------------------
  let houseAnchor: { x: number; y: number } = { x: -1, y: -1 };
  let houseWatch: play.ConstructionWatch | null = null;
  await test.step('5. the idle bell, Build House, a hovered ghost, and a click that lays a foundation', async () => {
    const gatherer = await play.selectedEntityId(page);
    await page.getByRole('button', { name: 'Select next idle villager' }).click();
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    const builder = await play.selectedEntityId(page);
    expect(builder).not.toBeNull();
    expect(builder, 'the bell re-selected the villager that is already gathering').not.toBe(gatherer);

    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    houseAnchor = await game.findValidPlacementNearTownCenter(page, 'house');
    await game.moveMouseToCell(page, houseAnchor.x, houseAnchor.y);
    await expect.poll(() => page.evaluate(() => window.__AOE2_TEST__!.getPlacementPreviewState()))
      .toMatchObject({
        active: true, buildingType: 'house', cellX: houseAnchor.x, cellY: houseAnchor.y,
        width: 2, height: 2, isValid: true,
      });
    // The ghost is read from the renderer's own state, not counted in pixels.
    expect(await page.evaluate(() => window.__AOE2_TEST__!.getPlacementPreviewVisualState()))
      .toMatchObject({ active: true, isValid: true, cellOutlineCount: 4, blockedMarkerCount: 0 });
    const ghostShot = await play.screenshot(page, '03-placement-ghost.png');

    const woodBefore = (await play.readHud(page)).wood;
    expect(woodBefore).toBe(200);
    await play.clickAt(page, await game.getScreenPointForCell(page, houseAnchor.x, houseAnchor.y));
    await expect(page.locator('[data-hud="wood"]')).toHaveText('175');
    ticks.housePlaced = await currentTick();
    houseWatch = play.watchConstruction(page, { type: 'house', x: houseAnchor.x, y: houseAnchor.y });
    await expect(page.locator('[data-placement-mode]')).toHaveCount(0);

    const foundation = await page.evaluate((anchor) => {
      const api = window.__AOE2_TEST__!;
      const building = api.getEconomyState().buildings.find((candidate) =>
        candidate.owner === 1 && candidate.buildingType === 'house'
        && candidate.x === anchor.x && candidate.y === anchor.y);
      const visual = api.getBuildingVisualStates().find((candidate) =>
        candidate.owner === 1 && candidate.buildingType === 'house'
        && candidate.cellX === anchor.x && candidate.cellY === anchor.y);
      return building && visual ? { building, visual } : null;
    }, houseAnchor);
    expect(foundation, 'the click spent 25 wood but no House exists at the anchor').not.toBeNull();
    expect(foundation!.building.isComplete).toBe(false);
    expect(foundation!.visual).toMatchObject({ hasFoundationSlab: true, hasCompletionAccent: false });

    // The builder walks first, then builds — poll for the verb the player sees.
    await expect(page.locator('[data-selection-activity]')).toHaveText('Building House', { timeout: 20_000 });
    ticks.houseBuilding = await currentTick();
    annotate(`house: anchor (${houseAnchor.x}, ${houseAnchor.y}); WOOD ${woodBefore} -> 175; `
      + `builder #${builder}; totalBuildTicks ${foundation!.building.totalBuildTicks}; `
      + `placed tick ${ticks.housePlaced}, "Building House" shown tick ${ticks.houseBuilding}; `
      + `ghost shot ${ghostShot}; foundation shot ${await play.screenshot(page, '04-foundation.png')}`);
  });

  // ---- 6. The Town Center ----------------------------------------------
  await test.step('6. a click on the Town Center shows its card; Train Villager and Loom spend', async () => {
    const townCenter = await play.findMouseReachableEntity(page, {
      kind: 'building', entityType: 'town-center', owner: HUMAN,
    });
    expect(townCenter, 'the Town Center footprint centre is not on the canvas').not.toBeNull();
    await play.clickAt(page, townCenter!.screen);
    await expect.poll(() => play.selectedEntityId(page)).toBe(townCenter!.id);
    // The bridge selects on the click; the panel re-renders on the next
    // frame — wait for the DOM the player reads, not the state behind it.
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');

    const panel = await play.readSelectionPanel(page);
    expect(panel.name).toBe('Town Center');
    expect(panel.health).toBe('2400 / 2400');
    expect(panel.inventory).toBe('0 / 15 garrisoned');
    expect(panel.commands['action-ring-town-bell']).toContain('Ring Town Bell');
    expect(panel.commands['train-villager']).toContain('Train Villager');
    expect(panel.commands['research-feudal-age']).toContain('Research Feudal Age');
    expect(panel.commands['research-loom']).toContain('Research Loom');

    // FOOD is being gathered concurrently: the 50 spent may land beside one
    // 10-food drop-off, so the drop is asserted as a window, never exactly.
    const foodBefore = (await play.readHud(page)).food;
    await page.locator('[data-command="train-villager"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Training: Villager');
    await expect.poll(async () => foodBefore - (await play.readHud(page)).food)
      .toBeGreaterThanOrEqual(40);
    const foodDrop = foodBefore - (await play.readHud(page)).food;
    expect(foodDrop).toBeLessThanOrEqual(50);
    ticks.villagerQueued = await currentTick();

    // How busy is the panel's DOM while a queue runs? A button that is
    // replaced every frame is one a click has to catch mid-flight.
    const panelMutations = await page.evaluate(() => new Promise<number>((resolve) => {
      const panel = document.querySelector('[data-hud="selection-panel"]')!;
      let count = 0;
      const observer = new MutationObserver((records) => { count += records.length; });
      observer.observe(panel, { childList: true, subtree: true, characterData: true });
      setTimeout(() => { observer.disconnect(); resolve(count); }, 1000);
    }));

    const goldBefore = (await play.readHud(page)).gold;
    expect(goldBefore).toBe(100);
    await page.locator('[data-command="research-loom"]').click();
    await expect(page.locator('[data-hud="gold"]')).toHaveText('50');
    ticks.loomQueued = await currentTick();
    annotate(`tc: #${townCenter!.id}; FOOD ${foodBefore} -> ${foodBefore - foodDrop} (train, tick `
      + `${ticks.villagerQueued}); GOLD 100 -> 50 (Loom, tick ${ticks.loomQueued}); panel DOM `
      + `mutations in 1 s while training: ${panelMutations}; shot ${await play.screenshot(page, '05-tc.png')}`);
  });

  // ---- 7. The house completes and the villager spawns -------------------
  await test.step('7. the House completes and the queued villager spawns: pop 4/5 -> 5/10', async () => {
    const waitStartedAt = Date.now();
    const readProgress = () => page.evaluate((anchor) => {
      const api = window.__AOE2_TEST__!;
      const economy = api.getEconomyState();
      const house = economy.buildings.find((building) =>
        building.owner === 1 && building.buildingType === 'house'
        && building.x === anchor.x && building.y === anchor.y);
      return {
        tick: api.getHudState().tick,
        houseComplete: house?.isComplete === true,
        buildProgressTicks: house?.buildProgressTicks ?? 0,
        villagers: economy.units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager').length,
      };
    }, houseAnchor);
    await expect.poll(async () => {
      const progress = await readProgress();
      if (progress.villagers === 4 && ticks.villagerSpawned === undefined) ticks.villagerSpawned = progress.tick;
      return progress.houseComplete && progress.villagers === 4;
    }, { timeout: 120_000, intervals: [250] }).toBe(true);
    await expect(page.locator('[data-hud="pop"]')).toHaveText('5/10');
    const outcome = await readProgress();
    expect(outcome.houseComplete).toBe(true);
    expect(outcome.villagers).toBe(4);
    // The watcher ran since the foundation click, so its ticks separate the
    // builder's walk from the construction itself (finding F2 vs F3 above).
    const watched = await houseWatch!.stop();
    const started = watched.startedTick ?? ticks.housePlaced;
    const completed = watched.completedTick ?? outcome.tick;
    annotate(`done: pop 5/10 after ${Date.now() - waitStartedAt} ms of waiting; house placed tick `
      + `${ticks.housePlaced}, first progress tick ${watched.startedTick}, complete tick ${watched.completedTick} `
      + `(walk ${(started - ticks.housePlaced) / 10} s + build ${(completed - started) / 10} s game time, `
      + `${watched.samples} samples); villager queued tick ${ticks.villagerQueued} -> spawned tick `
      + `${ticks.villagerSpawned} (${(ticks.villagerSpawned - ticks.villagerQueued) / 10} s game time); `
      + `HUD ${(await play.readHud(page)).time}; shot ${await play.screenshot(page, '06-house-done.png')}`);

    // F2 and F3 as GATES. Measured here after the fixes: walk 2.5 s (it was
    // 22.0 s when the builder rounded the House to its far edge), build 24.8 s
    // against DE's 25.0 (structures.csv House build_time 25; it was 11.9 s).
    // The walk bound is generous — this is a real match with real traffic —
    // but a lap of the building cannot fit inside it. The build bound is
    // tight, because one villager on a House is exactly the CSV number.
    const walkSeconds = (started - ticks.housePlaced) / 10;
    const buildSeconds = (completed - started) / 10;
    expect(walkSeconds, `builder took ${walkSeconds} s to reach a House site two tiles away (F2)`)
      .toBeLessThan(8);
    expect(buildSeconds, `House built in ${buildSeconds} s; DE is 25 s (F3)`)
      .toBeGreaterThan(23);
    expect(buildSeconds).toBeLessThan(28);
  });

  // ---- 8. Nothing threw --------------------------------------------------
  await test.step('8. no page errors and no console errors across the whole run', async () => {
    expect(errors.pageErrors, `page threw: ${errors.pageErrors.join(' | ')}`).toEqual([]);
    expect(errors.consoleErrors, `console.error: ${errors.consoleErrors.join(' | ')}`).toEqual([]);
    annotate(`total runtime ${Date.now() - startedAt} ms`);
  });
});
