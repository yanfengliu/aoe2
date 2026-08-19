import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The HUD palette is CSS, so this reads the token declarations straight out of
// the stylesheet rather than a duplicated table — a token changed in the sheet
// is a token this test sees.
const STYLES = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
const CHROME = readFileSync(join(process.cwd(), 'src/hudChrome.css'), 'utf8');
const COMMAND_PANEL = readFileSync(join(process.cwd(), 'src/hudCommandPanel.css'), 'utf8');
const ICONS = readFileSync(join(process.cwd(), 'src/hudIcons.css'), 'utf8');
const ALL_SHEETS = [STYLES, CHROME, COMMAND_PANEL, ICONS];

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(STYLES);
  if (!match) throw new Error(`Token --${name} is not declared in styles.css.`);
  return match[1]!.trim();
}

type Rgb = { r: number; g: number; b: number; a: number };

function parseColor(value: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, a: 1 };
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!rgba) throw new Error(`Cannot parse colour: ${value}`);
  const parts = rgba[1]!.split(',').map((p) => Number.parseFloat(p.trim()));
  return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
}

/** Composite a translucent colour over an opaque backdrop. */
function over(top: Rgb, backdrop: Rgb): Rgb {
  return {
    r: top.r * top.a + backdrop.r * (1 - top.a),
    g: top.g * top.a + backdrop.g * (1 - top.a),
    b: top.b * top.a + backdrop.b * (1 - top.a),
    a: 1,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

// Worst realistic backdrop: the panel is translucent, so bright sunlit grass
// shows through it. This is the case a dark-glass HUD actually fails on.
const BRIGHT_GRASS: Rgb = { r: 122, g: 168, b: 76, a: 1 };
const DARK_WORLD: Rgb = { r: 19, g: 34, b: 36, a: 1 };

function panelOver(backdrop: Rgb): Rgb {
  return over(parseColor(token('hud-surface')), backdrop);
}

describe('HUD palette', () => {
  it('declares every token the chassis and component sheets consume', () => {
    const used = new Set<string>();
    for (const sheet of [CHROME, COMMAND_PANEL, ICONS, STYLES]) {
      for (const match of sheet.matchAll(/var\(--(hud-[a-z0-9-]+)/g)) {
        used.add(match[1]!);
      }
    }
    const declared = new Set(
      [...STYLES.matchAll(/--(hud-[a-z0-9-]+):/g), ...CHROME.matchAll(/--(hud-[a-z0-9-]+):/g)]
        .map((match) => match[1]!),
    );
    const missing = [...used].filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('keeps primary HUD text readable over a panel on bright terrain', () => {
    const text = parseColor(token('hud-text'));
    expect(contrastRatio(over(text, panelOver(BRIGHT_GRASS)), panelOver(BRIGHT_GRASS)))
      .toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(over(text, panelOver(DARK_WORLD)), panelOver(DARK_WORLD)))
      .toBeGreaterThanOrEqual(4.5);
  });

  it('keeps muted labels above the large-text contrast floor on bright terrain', () => {
    // Labels are uppercase 10px 600-weight; hold them to 3:1, the floor that
    // stopped the first pass from shipping a 0.38-alpha label.
    const muted = parseColor(token('hud-text-muted'));
    const panel = panelOver(BRIGHT_GRASS);
    expect(contrastRatio(over(muted, panel), panel)).toBeGreaterThanOrEqual(3);
  });

  it('keeps every resource hue distinguishable from the others', () => {
    const hues = ['hud-food', 'hud-wood', 'hud-gold', 'hud-stone'].map((name) => ({
      name,
      color: parseColor(token(name)),
    }));
    for (const a of hues) {
      for (const b of hues) {
        if (a.name >= b.name) continue;
        const distance = Math.hypot(
          a.color.r - b.color.r,
          a.color.g - b.color.g,
          a.color.b - b.color.b,
        );
        expect(distance).toBeGreaterThan(40);
      }
    }
  });

  it('keeps resource glyphs readable against the panel they sit on', () => {
    const panel = panelOver(DARK_WORLD);
    for (const name of ['hud-food', 'hud-wood', 'hud-gold', 'hud-stone', 'hud-accent']) {
      const glyph = parseColor(token(name));
      expect(contrastRatio(glyph, panel)).toBeGreaterThanOrEqual(3);
    }
  });

  it('has retired the wood-and-stone palette from every HUD sheet', () => {
    // The old chrome's literals. A reintroduced one means a rule drifted back
    // off the token palette.
    for (const sheet of ALL_SHEETS) {
      expect(sheet).not.toMatch(/#f4ead1/i);
      expect(sheet).not.toMatch(/#c4ae7a/i);
      expect(sheet).not.toMatch(/rgba\(\s*221,\s*196,\s*145/);
    }
  });

  it('keeps a real focus outline, which the browser suite asserts', () => {
    // A box-shadow "ring" would pass a visual check and fail the computed
    // outlineWidth assertion in game-hud-and-camera-hud.spec.ts.
    expect(CHROME).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  });

  it('falls back to opaque panels when transparency is not wanted', () => {
    expect(CHROME).toMatch(/prefers-reduced-transparency/);
    expect(CHROME).toMatch(/backdrop-filter:\s*none/);
  });
});
