// Original procedural glyphs for the icon-only in-game menu actions. These
// intentionally live apart from glyphs.ts so both icon modules stay below the
// repository's 500-LOC cap. The native button owns the accessible name and
// tooltip; every SVG is decorative and uses the existing currentColor palette.

export const GAME_MENU_ICON_KINDS = [
  'resume',
  'save',
  'load',
  'replay',
  'restart',
  'quit',
  'debug',
] as const;

export type GameMenuIconKind = (typeof GAME_MENU_ICON_KINDS)[number];

const GAME_MENU_ICON_BODY: Record<GameMenuIconKind, string> = {
  resume: `
    <circle cx="12" cy="12" r="8.25" />
    <path d="M10 8.2 16 12l-6 3.8z" fill="currentColor" stroke="none" />`,
  save: `
    <path d="M5 3.75h11l3 3v13.5H5z" />
    <path d="M8 3.75v6h8v-5M8 20.25v-7h8v7" />
    <circle cx="14.25" cy="6.7" r="0.75" fill="currentColor" stroke="none" />`,
  load: `
    <path d="M3.5 7.25h6l1.8-2h9.2v12.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
    <path d="M3.5 9.25h17M12 9.25v6.5m0 0-2.7-2.7m2.7 2.7 2.7-2.7" />`,
  replay: `
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M7 5v14M17 5v14M3.5 8.5H7m-3.5 7H7m10-7h3.5m-3.5 7h3.5" />
    <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />`,
  restart: `
    <path d="M18.6 8.1A7.5 7.5 0 1 0 19.2 15" />
    <path d="M18.6 3.8v4.3h-4.3" />
    <path d="M12 8.5v4l2.8 1.7" />`,
  quit: `
    <path d="M4.5 3.75h9.25v16.5H4.5zM8 20.25V6.5l5.75-2.75" />
    <path d="M11 12h9.5m0 0-3-3m3 3-3 3" />`,
  debug: `
    <rect x="3.5" y="4.5" width="17" height="13" rx="1.5" />
    <path d="M8 20.25h8M12 17.5v2.75M12 8v5m-2.5-2.5h5" />
    <circle cx="12" cy="10.5" r="4" />`,
};

export function gameMenuGlyph(kind: GameMenuIconKind): string {
  return `<svg
    class="hud-menu-item__glyph"
    data-menu-icon="${kind}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >${GAME_MENU_ICON_BODY[kind]}</svg>`;
}
