// @vitest-environment jsdom

// A tooltip never covers the minimap, and a command-bar tooltip floats above
// the BAR rather than above its card. The build palette sits beside the
// minimap in the bottom bar, so the shared tooltip centred above a right-hand
// build card ran over the minimap's frame; and above a first-row card it
// covered the group heading — including the "Placing: …" status the click had
// just revealed (defect register, 2026-09-02). The positioner anchors a
// bar tooltip above the bar's top edge, then slides it left of the minimap
// frame, or above the frame when there is no room beside it. The browser
// suite hovers every card at three viewports; this pins the arithmetic.

import { describe, expect, it, vi } from 'vitest';

import { createTooltipController } from '../../src/ui/hud/tooltips';

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

interface Fixture {
  card: HTMLButtonElement;
  minimapCard: HTMLButtonElement;
  tooltip: HTMLDivElement;
  handle: { destroy(): void };
}

// The 1280x720 bottom bar the defect was measured at: the command bar spans
// x 12..1012 from y 500, the minimap frame sits beside it from x 1022.
const COMMAND_BAR = rect(12, 500, 1000, 208);

function mountBottomBar(
  cardRect: DOMRect,
  minimapRect: DOMRect,
  tooltipRect: DOMRect,
  viewport: { width: number; height: number },
  barRect: DOMRect = COMMAND_BAR,
): Fixture {
  const root = document.createElement('div');
  const bottom = document.createElement('div');
  const selection = document.createElement('div');
  const card = document.createElement('button');
  const map = document.createElement('div');
  const minimapCard = document.createElement('button');
  const tooltip = document.createElement('div');
  bottom.className = 'hud-bottom';
  selection.className = 'hud-panel hud-panel--selection';
  card.className = 'hud-command-button hud-build-card';
  card.dataset.tooltip = 'Place a Mill foundation (cost: 100 wood).';
  map.className = 'hud-panel hud-panel--map';
  minimapCard.dataset.tooltip = 'The minimap.';
  selection.append(card);
  map.append(minimapCard);
  bottom.append(selection, map);
  root.append(bottom, tooltip);
  document.body.append(root);

  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(cardRect);
  vi.spyOn(selection, 'getBoundingClientRect').mockReturnValue(barRect);
  vi.spyOn(minimapCard, 'getBoundingClientRect').mockReturnValue(
    rect(minimapRect.left + 12, minimapRect.top + 12, 40, 20),
  );
  vi.spyOn(map, 'getBoundingClientRect').mockReturnValue(minimapRect);
  vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue(tooltipRect);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewport.width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewport.height });

  return { card, minimapCard, tooltip, handle: createTooltipController(root, tooltip) };
}

describe('HUD tooltip keeps clear of the minimap', () => {
  it('floats a command-bar tooltip above the bar, not above the card', () => {
    // A first-row card at y 560: centred above the CARD the tooltip would sit
    // at 486 and cover the heading row above the palette. It goes above the
    // bar's top edge instead: 500 - 66 - 8.
    const { card, tooltip, handle } = mountBottomBar(
      rect(400, 560, 106, 68),
      rect(1024, 512, 244, 196),
      rect(0, 0, 260, 66),
      { width: 1280, height: 720 },
    );

    card.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(tooltip.style.left).toBe('323px');
    expect(tooltip.style.top).toBe('426px');
    handle.destroy();
  });

  it('slides a build-card tooltip left of the minimap frame instead of over it', () => {
    // The Mill card is the right-hand card of the palette and the minimap
    // frame starts 64px to its right. The bar here is SHORTER than the frame
    // (a selection with few commands), so "above the bar" is still level with
    // the frame's top and a 260px tooltip centred on the card would end 119px
    // inside it. It is pushed to 1024 - 260 - 8.
    const { card, tooltip, handle } = mountBottomBar(
      rect(960, 560, 106, 68),
      rect(1024, 512, 244, 196),
      rect(0, 0, 260, 66),
      { width: 1280, height: 720 },
      rect(12, 560, 1000, 148),
    );

    card.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(tooltip.style.left).toBe('756px');
    expect(tooltip.style.top).toBe('486px');
    handle.destroy();
  });

  it('goes above the minimap when there is no room beside it', () => {
    // A narrow window where the minimap frame spans the width above the bar:
    // nothing fits to its left, so the tooltip clears the frame's top edge.
    const { card, tooltip, handle } = mountBottomBar(
      rect(200, 480, 100, 40),
      rect(8, 300, 374, 160),
      rect(0, 0, 260, 50),
      { width: 390, height: 560 },
      rect(8, 470, 374, 90),
    );

    card.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(tooltip.style.left).toBe('120px');
    expect(tooltip.style.top).toBe('242px');
    handle.destroy();
  });

  it('leaves a game-menu tooltip alone, because the modal covers the minimap', () => {
    // The browser suite's 390x560 case: the menu branch puts the tooltip
    // BELOW the modal (no room above or beside it), where the minimap frame
    // is — behind the backdrop. Dodging that frame moved the tooltip up onto
    // the modal, the one place the menu branch had kept it out of.
    const root = document.createElement('div');
    const menu = document.createElement('div');
    const panel = document.createElement('div');
    const button = document.createElement('button');
    const map = document.createElement('div');
    const tooltip = document.createElement('div');
    menu.className = 'hud-game-menu';
    panel.className = 'hud-game-menu__panel';
    button.className = 'hud-menu-item';
    button.dataset.tooltip = 'Resume the match.';
    map.className = 'hud-panel hud-panel--map';
    panel.append(button);
    menu.append(panel);
    root.append(map, menu, tooltip);
    document.body.append(root);
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(78, 300, 71, 66));
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(55, 8, 280, 460));
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue(rect(8, 382, 374, 170));
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 260, 52));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 560 });
    const handle = createTooltipController(root, tooltip);

    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Centred under the modal: 55 + 140 - 130, and 468 + 8.
    expect(tooltip.style.left).toBe('65px');
    expect(tooltip.style.top).toBe('476px');
    handle.destroy();
  });

  it('leaves a tooltip anchored inside the minimap frame where it is', () => {
    const { minimapCard, tooltip, handle } = mountBottomBar(
      rect(960, 560, 106, 68),
      rect(1024, 512, 244, 196),
      rect(0, 0, 120, 30),
      { width: 1280, height: 720 },
    );

    minimapCard.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Centred above its own control: 1036 + 20 - 60, and 524 - 30 - 8.
    expect(tooltip.style.left).toBe('996px');
    expect(tooltip.style.top).toBe('486px');
    handle.destroy();
  });
});
