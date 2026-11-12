// No caption or settings state can resize the in-match menu (work 148, spec §14.1).
//
// A label is text that grows a layout, and two of work 148's landings went red
// on Linux for a text that fitted on Windows by a line. So the menu's size is
// arithmetic (one fixed width, every height set in pixels) and a caption or a
// settings state too long for its row is cut with an ellipsis and takes no room.
// These cases print and assert the room the REAL texts have left in their rows,
// step both settings rows through every real state with real clicks to show
// that neither the row nor the panel changes shape, and then write texts four
// times as long as the longest real ones and require that nothing moved.
//
// The captions and the long texts are held at each of the three window sizes.
// The states are stepped at ONE (1280x720), in a case of their own, and that
// case then proves why one is enough: it makes the window each of the other
// two sizes and requires the panel, both settings rows, their name boxes and
// their state boxes to be the widths they were, so a state has the same room
// at every size. Until v0.3.283 the states were stepped at all three, nine
// real clicks a size, each redrawing the world behind the menu: at 1920x1080
// that case took 14.9 s of its 30 s on one of CI's slower runners (run
// 43147872356, browser shard 2/4; 12.5 s the run before), and CI fails a test
// past two thirds of its limit.
//
// Bound: three window sizes, the debug overlay's seven modes and the art
// style's two (tests/ui/gameMenuIcons.test.ts holds that list against the
// renderer's). The long texts are written into the page, since no real control
// produces one. This suite's Chromium hides scrollbars: a player's Chromium
// draws a 10px bar that takes 10px from the rows of a panel that scrolls
// (measured with the bars shown, plan 148), which leaves the tightest real
// state 28% of its width where these cases print 38%. The menu's other cases
// are de-game-menu.spec.ts and de-game-menu-load-form.spec.ts.
import { expect, test } from '@playwright/test';

import {
  ART_STYLE_LABELS,
  MENU_ACTIONS,
  MENU_SETTINGS,
  MENU_SIZES,
  clickName,
  expectSameBox,
  openMenu,
  readMenu,
  rowOf,
  wheelToRow,
} from './helpers/gameMenu';
import { DEBUG_OVERLAY_CYCLE } from '../../src/ui/hud/debugOverlay';

/** A real text keeps at least this share of its own width free in its row. On
 *  Linux CI the same text has drawn up to 2% wider than on Windows. */
const TEXT_ROOM_SHARE = 0.25;

/** The size the settings rows' states are stepped at: the middle one, where
 *  nothing scrolls. The stepping case holds the other two sizes to its widths. */
const STATES_SIZE = MENU_SIZES[1];

test.describe('the in-match menu holds its shape whatever its rows say', () => {
  for (const size of MENU_SIZES) {
    test(`at ${size.width}x${size.height} no caption or settings state can resize the menu`, async ({ page }) => {
      await openMenu(page, size);
      const before = await readMenu(page);

      // The real captions, each on one line with room to spare in its row.
      let tightest = { name: '', textWidth: 0, room: Number.POSITIVE_INFINITY };
      for (const action of MENU_ACTIONS) {
        const label = rowOf(before, action.hook).label!;
        const room = label.clientWidth - label.textWidth;
        expect(label.lines, `"${action.caption}" is one line`).toBe(1);
        expect(label.scrollWidth, `"${action.caption}" is not cut`).toBeLessThanOrEqual(label.clientWidth);
        expect(room, `"${action.caption}" (${label.textWidth.toFixed(1)}px) keeps a quarter of its width free`)
          .toBeGreaterThanOrEqual(label.textWidth * TEXT_ROOM_SHARE);
        if (room / label.textWidth < tightest.room / (tightest.textWidth || 1)) {
          tightest = { name: action.caption, textWidth: label.textWidth, room };
        }
      }
      console.log(`[menu-room] ${size.width}x${size.height} the tightest caption, "${tightest.name}": ${tightest.textWidth.toFixed(1)}px `
        + `of text with ${tightest.room.toFixed(1)}px (${Math.round((tightest.room / tightest.textWidth) * 100)}%) to spare in its row`);

      // The menu the long texts are measured against, its last settings row in
      // view (at 800x600 that takes a turn of the wheel). The real states of
      // the two settings rows are stepped in the case after these.
      await wheelToRow(page, MENU_SETTINGS.at(-1)!.hook);
      const settled = await readMenu(page);

      // Texts four times as long as the longest real ones: a caption on every
      // action and a state on every settings row, whose names stay the real
      // ones here (long names come after). Nothing may move.
      const longestCaption = MENU_ACTIONS.map((action) => action.caption).reduce((a, b) => (b.length > a.length ? b : a));
      const longestState = [...DEBUG_OVERLAY_CYCLE, ...ART_STYLE_LABELS].reduce((a, b) => (b.length > a.length ? b : a));
      const stressCaption = `${longestCaption} `.repeat(4).trim();
      const stressState = Array.from({ length: 4 }, () => longestState).join('-');
      await page.evaluate(({ caption, state }) => {
        for (const label of document.querySelectorAll('.hud-game-menu__actions .hud-menu-item__label')) {
          label.textContent = caption;
        }
        for (const element of document.querySelectorAll('.hud-game-menu__section .hud-menu-item__state')) {
          element.textContent = state;
        }
      }, { caption: stressCaption, state: stressState });
      const stressed = await readMenu(page);

      expectSameBox(stressed.panel, settled.panel, 'the panel under the long texts');
      expect(stressed.panelScrollHeight, 'the list is no taller').toBe(settled.panelScrollHeight);
      expect(stressed.panelScrollWidth, 'nothing runs sideways in the panel').toBeLessThanOrEqual(stressed.panelClientWidth);
      expect(stressed.documentScrollWidth, 'nothing runs sideways in the window').toBeLessThanOrEqual(size.width);
      for (const row of stressed.rows) {
        expectSameBox(row.box, rowOf(settled, row.hook).box, `${row.hook} under the long texts`);
      }
      for (const action of MENU_ACTIONS) {
        const label = rowOf(stressed, action.hook).label!;
        expect(label.lines, `${action.hook}: the long caption is one line`).toBe(1);
        expect(label.scrollWidth, `${action.hook}: the long caption is cut`).toBeGreaterThan(label.clientWidth);
        expect(label.overflow, `${action.hook}: cut with an ellipsis`).toBe('ellipsis');
        expect(label.box.right, `${action.hook}: the caption's box ends inside its row`).toBeLessThanOrEqual(rowOf(stressed, action.hook).box.right);
      }
      for (const setting of MENU_SETTINGS) {
        const row = rowOf(stressed, setting.hook);
        // The state is what gives way: the setting's name stays whole.
        expect(row.label!.scrollWidth, `${setting.hook}: the name stays whole`).toBeLessThanOrEqual(row.label!.clientWidth);
        expect(row.state!.lines, `${setting.hook}: the long state is one line`).toBe(1);
        expect(row.state!.scrollWidth, `${setting.hook}: the long state is cut`).toBeGreaterThan(row.state!.clientWidth);
        expect(row.state!.overflow, `${setting.hook}: cut with an ellipsis`).toBe('ellipsis');
        expect(row.state!.box.right, `${setting.hook}: the state's box ends inside its row`).toBeLessThanOrEqual(row.box.right);
        expect(row.label!.box.right, `${setting.hook}: the name still comes before the state`).toBeLessThanOrEqual(row.state!.box.left);
      }
      const stressedRow = rowOf(stressed, MENU_ACTIONS[0].hook);
      console.log(`[menu-room] ${size.width}x${size.height} a caption of ${stressCaption.length} characters and a state of `
        + `${stressState.length}: the caption is cut to ${stressedRow.label!.clientWidth}px on ${stressedRow.label!.lines} line, the `
        + `state to ${rowOf(stressed, MENU_SETTINGS[0].hook).state!.clientWidth}px, and the panel is ${stressed.panel.width.toFixed(1)}x`
        + `${stressed.panel.height.toFixed(1)}px as before`);

      // A setting's NAME longer than its row, first beside the long state and
      // then beside its real one (review round 7: the texts above leave the
      // names as they are, so a name that stopped being clipped went unseen).
      // The name is the one cut now, the state keeps a floor of a few letters
      // (2.5em of the row's 14px, 35px), and nothing moves.
      const stressName = `${MENU_SETTINGS[0].label} `.repeat(8).trim();
      for (const realStates of [false, true]) {
        await page.evaluate(({ name, states }) => {
          document.querySelectorAll('.hud-game-menu__section .hud-menu-item').forEach((row, index) => {
            row.querySelector('.hud-menu-item__label')!.textContent = name;
            if (states) row.querySelector('.hud-menu-item__state')!.textContent = states[index]!;
          });
        }, { name: stressName, states: realStates ? MENU_SETTINGS.map((setting) => setting.state) : null });
        const named = await readMenu(page);
        const what = realStates ? 'a long name beside its real state' : 'a long name beside a long state';
        expectSameBox(named.panel, settled.panel, `the panel under ${what}`);
        expect(named.panelScrollHeight, `${what}: the list is no taller`).toBe(settled.panelScrollHeight);
        expect(named.panelScrollWidth, `${what}: nothing runs sideways in the panel`).toBeLessThanOrEqual(named.panelClientWidth);
        expect(named.documentScrollWidth, `${what}: nothing runs sideways in the window`).toBeLessThanOrEqual(size.width);
        for (const row of named.rows) {
          expectSameBox(row.box, rowOf(settled, row.hook).box, `${row.hook} under ${what}`);
        }
        for (const setting of MENU_SETTINGS) {
          const row = rowOf(named, setting.hook);
          expect(row.label!.lines, `${setting.hook}, ${what}: the name is one line`).toBe(1);
          expect(row.label!.scrollWidth, `${setting.hook}, ${what}: the name is cut`).toBeGreaterThan(row.label!.clientWidth);
          expect(row.label!.overflow, `${setting.hook}, ${what}: cut with an ellipsis`).toBe('ellipsis');
          expect(row.label!.box.right, `${setting.hook}, ${what}: the name ends before the state starts`).toBeLessThanOrEqual(row.state!.box.left);
          expect(row.state!.lines, `${setting.hook}, ${what}: the state is one line`).toBe(1);
          expect(row.state!.clientWidth, `${setting.hook}, ${what}: the state keeps its floor`).toBeGreaterThanOrEqual(35);
          expect(row.state!.box.right, `${setting.hook}, ${what}: the state ends inside its row`).toBeLessThanOrEqual(row.box.right);
        }
        if (realStates) {
          // "off" fits the floor whole; a longer real state shares the cut.
          const debugRow = rowOf(named, MENU_SETTINGS[0].hook);
          expect(debugRow.state!.scrollWidth, '"off" is whole beside a long name').toBeLessThanOrEqual(debugRow.state!.clientWidth);
          console.log(`[menu-room] ${size.width}x${size.height} a setting's name of ${stressName.length} characters: cut to `
            + `${debugRow.label!.clientWidth}px on ${debugRow.label!.lines} line, its state keeping ${debugRow.state!.clientWidth}px`);
        }
      }
    });
  }

  // Every real state of both settings rows, stepped by real clicks on the
  // row's name: the state fits with room to spare, the name stays whole, and
  // neither the row nor the panel changes shape as the state does. Stepped at
  // one size; the last block holds the reason one size is enough.
  test(`every real state of both settings rows fits its row, at ${STATES_SIZE.width}x${STATES_SIZE.height} and so at every size`, async ({ page }) => {
    const size = STATES_SIZE;
    await openMenu(page, size);
    await wheelToRow(page, MENU_SETTINGS.at(-1)!.hook);
    const settled = await readMenu(page);
    let tightestState = { name: '', textWidth: 0, room: Number.POSITIVE_INFINITY };
    const stepThrough = async (setting: (typeof MENU_SETTINGS)[number], states: readonly string[]): Promise<void> => {
      for (let step = 0; step < states.length; step += 1) {
        const state = states[(step + 1) % states.length]!;
        await clickName(page, setting.hook);
        await expect(page.locator(`[data-hud="${setting.stateHook}"]`)).toHaveText(state);
        const now = await readMenu(page);
        const row = rowOf(now, setting.hook);
        const room = row.state!.clientWidth - row.state!.textWidth;
        expect(row.text).toBe(`${setting.label} ${state}`);
        expect(row.label!.scrollWidth, `"${setting.label}" stays whole beside "${state}"`).toBeLessThanOrEqual(row.label!.clientWidth);
        expect(row.state!.lines, `"${state}" is one line`).toBe(1);
        expect(row.state!.scrollWidth, `"${state}" is not cut`).toBeLessThanOrEqual(row.state!.clientWidth);
        expect(room, `"${state}" (${row.state!.textWidth.toFixed(1)}px) keeps a quarter of its width free`)
          .toBeGreaterThanOrEqual(row.state!.textWidth * TEXT_ROOM_SHARE);
        expectSameBox(now.panel, settled.panel, `the panel with "${state}"`);
        for (const other of now.rows) {
          expectSameBox(other.box, rowOf(settled, other.hook).box, `${other.hook} with "${state}"`);
        }
        if (room / row.state!.textWidth < tightestState.room / (tightestState.textWidth || 1)) {
          tightestState = { name: `${setting.label}: ${state}`, textWidth: row.state!.textWidth, room };
        }
      }
    };
    await stepThrough(MENU_SETTINGS[0], DEBUG_OVERLAY_CYCLE);
    await stepThrough(MENU_SETTINGS[1], ART_STYLE_LABELS);
    console.log(`[menu-room] ${size.width}x${size.height} the tightest state, "${tightestState.name}": ${tightestState.textWidth.toFixed(1)}px `
      + `of text with ${tightestState.room.toFixed(1)}px (${Math.round((tightestState.room / tightestState.textWidth) * 100)}%) to spare in its row`);

    // Why one size is enough. A state's room is its box's width less its
    // text's, and the text is the same text in the same font at every size. So
    // the window is made each of the other sizes, and the panel, both settings
    // rows, their name boxes and their state boxes must be the widths they are
    // here: then every state has at 800x600 and at 1920x1080 the room it was
    // just measured with.
    const widths = (menu: Awaited<ReturnType<typeof readMenu>>): Record<string, number> => {
      const read: Record<string, number> = { 'the panel': menu.panel.width };
      for (const setting of MENU_SETTINGS) {
        const row = rowOf(menu, setting.hook);
        read[`${setting.hook}'s row`] = row.box.width;
        read[`${setting.hook}'s name box`] = row.label!.clientWidth;
        read[`${setting.hook}'s state box`] = row.state!.clientWidth;
      }
      return read;
    };
    const here = widths(await readMenu(page));
    expect(here['the panel'], 'the panel has a width').toBeGreaterThan(0);
    const others = MENU_SIZES.filter((other) => other.width !== size.width || other.height !== size.height);
    expect(others, 'the other two sizes').toHaveLength(MENU_SIZES.length - 1);
    for (const other of others) {
      await page.setViewportSize(other);
      const there = widths(await readMenu(page));
      for (const [what, width] of Object.entries(here)) {
        expect(Math.abs(there[what]! - width), `${what} is ${there[what]!}px at ${other.width}x${other.height} and ${width}px at ${size.width}x${size.height}`)
          .toBeLessThanOrEqual(0.01);
      }
    }
    console.log(`[menu-room] the panel (${here['the panel']!.toFixed(1)}px), both settings rows (${here[`${MENU_SETTINGS[0].hook}'s row`]!.toFixed(1)}px) and `
      + `their state boxes (${here[`${MENU_SETTINGS[0].hook}'s state box`]!}px, ${here[`${MENU_SETTINGS[1].hook}'s state box`]!}px) are the same width at `
      + `${MENU_SIZES.map((each) => `${each.width}x${each.height}`).join(', ')}`);
  });
});
