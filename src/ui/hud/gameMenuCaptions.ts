// The words the in-match menu shows (work 148; owner decision, 2026-11-11:
// the menu takes Definitive Edition's labels, replacing the icon-only menu of
// v0.3.8). DE's own menu is a dialog titled "Main Menu" holding a column of
// text buttons (`widgetui/dialogingamemenu.json` in its install; the captions
// are strings 9272-9283 and 9445 of its English string table). A caption here
// is DE's string where DE's menu has the action, and this game's own name
// where it has none.
//
// Typed by glyph kind, so a menu glyph added without a caption (an action) or
// a name (a setting) does not compile.

import type { GameMenuIconKind } from './icons/menuGlyphs';

export interface GameMenuCaption {
  /** The text on the button. */
  readonly caption: string;
  /** The id of Definitive Edition's English string this caption is, or null
   *  where DE's menu has no such action and the caption is this game's own. */
  readonly deString: number | null;
}

/** The settings rows: a setting's name, shown before its state. */
export type GameMenuSettingKind = 'debug' | 'artStyle';

/** The actions: one row each, a glyph and a caption. */
export type GameMenuActionKind = Exclude<GameMenuIconKind, GameMenuSettingKind>;

/** DE's dialog title (9446). */
export const GAME_MENU_TITLE: GameMenuCaption = { caption: 'Main Menu', deString: 9446 };

export const GAME_MENU_CAPTIONS: Record<GameMenuActionKind, GameMenuCaption> = {
  resume: { caption: 'Return to Game', deString: 9445 },
  save: { caption: 'Save Game', deString: 9272 },
  load: { caption: 'Load Game', deString: 9276 },
  // DE opens its technology tree from the bar's civilization icon, not from
  // this menu (its string 19282 is the hotkey's name, "Display Technology Tree").
  techTree: { caption: 'Technology Tree', deString: null },
  // DE has no civilization compendium in a match.
  civilizations: { caption: 'Civilizations', deString: null },
  // DE keeps recorded games on its title screen (9223, "Saved && Recorded Games").
  replay: { caption: 'Watch a Replay…', deString: null },
  restart: { caption: 'Restart', deString: 9279 },
  // "Quit Current Game" (9273), not "Quit to Main Menu" (9283): the dialog
  // itself is titled "Main Menu", and quitting here returns to the match
  // setup screen.
  quit: { caption: 'Quit Current Game', deString: 9273 },
};

// DE names every one of its 108 options rows (`widgetui/screenoptions.json`);
// these two settings are this game's own, so their names are too.
export const GAME_MENU_SETTING_NAMES: Record<GameMenuSettingKind, string> = {
  debug: 'Debug overlay',
  artStyle: 'Art style',
};
