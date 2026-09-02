// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { createTooltipController } from '../../src/ui/hud/tooltips';

describe('HUD tooltip keyboard focus', () => {
  it('places an icon-menu tooltip beside the modal panel instead of over its title', () => {
    const root = document.createElement('div');
    const menu = document.createElement('div');
    const panel = document.createElement('div');
    const button = document.createElement('button');
    const tooltip = document.createElement('div');
    menu.className = 'hud-game-menu';
    panel.className = 'hud-game-menu__panel';
    button.className = 'hud-menu-item';
    button.dataset.tooltip = 'Resume the match.';
    panel.append(button);
    menu.append(panel);
    root.append(menu, tooltip);
    document.body.append(root);

    const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(483, 255, 71, 66));
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(460, 191, 280, 338));
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 260, 50));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });

    const handle = createTooltipController(root, tooltip);
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(tooltip.style.left).toBe('748px');
    expect(tooltip.style.top).toBe('263px');

    handle.destroy();
  });

  it('repositions the active menu tooltip when the viewport resizes', () => {
    const root = document.createElement('div');
    const menu = document.createElement('div');
    const panel = document.createElement('div');
    const button = document.createElement('button');
    const tooltip = document.createElement('div');
    menu.className = 'hud-game-menu';
    panel.className = 'hud-game-menu__panel';
    button.className = 'hud-menu-item';
    button.dataset.tooltip = 'Resume the match.';
    panel.append(button);
    menu.append(panel);
    root.append(menu, tooltip);
    document.body.append(root);

    const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
    let panelRect = rect(260, 131, 280, 338);
    let buttonRect = rect(283, 175, 71, 66);
    let tooltipRect = rect(0, 0, 260, 52);
    vi.spyOn(button, 'getBoundingClientRect').mockImplementation(() => buttonRect);
    vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => panelRect);
    vi.spyOn(tooltip, 'getBoundingClientRect').mockImplementation(() => tooltipRect);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    const handle = createTooltipController(root, tooltip);
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.style.top).toBe('71px');

    panelRect = rect(55, 111, 280, 338);
    buttonRect = rect(78, 155, 71, 66);
    tooltipRect = rect(0, 0, 260, 52);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 560 });
    window.dispatchEvent(new Event('resize'));

    expect(tooltip.style.left).toBe('65px');
    expect(tooltip.style.top).toBe('51px');

    handle.destroy();
  });

  it('shows the same delegated tooltip on focus and hides it on focus-out', () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    const tooltip = document.createElement('div');
    button.dataset.tooltip = 'Build a House for 25 wood.';
    tooltip.dataset.hudTooltipActive = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    root.append(button, tooltip);
    document.body.append(root);
    const handle = createTooltipController(root, tooltip);

    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    expect(tooltip.getAttribute('aria-hidden')).toBe('false');
    expect(tooltip.textContent).toBe('Build a House for 25 wood.');
    expect(tooltip.id).not.toBe('');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);

    button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');
    expect(tooltip.getAttribute('aria-hidden')).toBe('true');
    expect(tooltip.textContent).toBe('');
    expect(button.hasAttribute('aria-describedby')).toBe(false);

    handle.destroy();
  });

  // Play-test finding F6 (2026-09-02): clicking a build card focused it, the
  // focus owned the tooltip, and "Place a House foundation…" stayed over the
  // bar while the player was out on the map choosing the tile — still showing
  // after a twelve-step pointer sweep across the canvas. DE hides a tooltip
  // when the cursor leaves the button. The rule: a POINTER focus does not own a
  // tooltip; a KEYBOARD focus still does.
  it('drops the tooltip when the pointer leaves a card its own click focused', () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    const other = document.createElement('button');
    const tooltip = document.createElement('div');
    button.dataset.command = 'build-house';
    button.dataset.tooltip = 'Place a House foundation (cost: 25 wood).';
    other.dataset.command = 'build-mill';
    other.dataset.tooltip = 'Place a Mill foundation (cost: 100 wood).';
    root.append(button, other, tooltip);
    document.body.append(root);
    const handle = createTooltipController(root, tooltip);

    // Hover, then a real click: pointerdown, focus, click.
    button.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    button.focus();
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');

    // The pointer leaves for the map. The card keeps focus — a player may act
    // on it again from the keyboard — and the tooltip goes.
    button.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: root }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');
    expect(document.activeElement).toBe(button);

    // The panel re-renders and restores focus a frame later; still no tooltip.
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');

    // A keystroke alone does NOT bring it back — the player pressing a camera
    // key has not asked for a tooltip, and the panel re-renders under them.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');

    // Tab-ing to a DIFFERENT control does: focus reaching another button is
    // the keyboard taking tooltips back, and Tab-ing on shows the next one.
    button.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: other }));
    other.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    expect(tooltip.textContent).toBe('Place a Mill foundation (cost: 100 wood).');

    // …and Tab-ing back to the clicked card shows its tooltip again.
    other.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: button }));
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    expect(tooltip.textContent).toBe('Place a House foundation (cost: 25 wood).');

    handle.destroy();
  });

  // The panel re-renders after a click and restores focus to a NEW button
  // carrying the same `data-command`, so the suppression cannot be by element
  // identity: it was, for one revision, and the tooltip came straight back.
  it('keeps the tooltip away across the re-render the click itself causes', () => {
    const root = document.createElement('div');
    const tooltip = document.createElement('div');
    root.innerHTML = '<button data-command="build-house" data-tooltip="Place a House foundation.">House</button>';
    root.append(tooltip);
    document.body.append(root);
    const handle = createTooltipController(root, tooltip);

    const card = root.querySelector('button')!;
    card.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    card.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    card.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    card.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: root }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');

    // The panel replaces the card and re-focuses the replacement.
    card.remove();
    const replacement = document.createElement('button');
    replacement.dataset.command = 'build-house';
    replacement.dataset.tooltip = 'Place a House foundation.';
    root.prepend(replacement);
    replacement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');

    handle.destroy();
  });

  it('stays visible until both pointer hover and keyboard focus release it', () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    const tooltip = document.createElement('div');
    button.dataset.tooltip = 'Build a House for 25 wood.';
    root.append(button, tooltip);
    document.body.append(root);
    const handle = createTooltipController(root, tooltip);

    button.focus();
    button.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('pointerout', {
      bubbles: true,
      relatedTarget: root,
    }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');

    button.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    button.blur();
    expect(tooltip.dataset.hudTooltipActive).toBe('true');

    button.dispatchEvent(new MouseEvent('pointerout', {
      bubbles: true,
      relatedTarget: root,
    }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');

    handle.destroy();
  });

  it('clears a stale tooltip and description when its focused trigger is removed', async () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    const tooltip = document.createElement('div');
    button.dataset.tooltip = 'Build a House for 25 wood.';
    root.append(button, tooltip);
    document.body.append(root);
    const handle = createTooltipController(root, tooltip);

    button.focus();
    button.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);

    button.remove();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');
    expect(tooltip.textContent).toBe('');
    expect(button.hasAttribute('aria-describedby')).toBe(false);

    handle.destroy();
  });

  it('ignores unrelated HUD mutations when no tooltip owner disconnects', async () => {
    const root = document.createElement('div');
    const tooltip = document.createElement('div');
    tooltip.dataset.hudTooltipActive = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    root.append(tooltip);
    document.body.append(root);
    const handle = createTooltipController(root, tooltip);
    const tooltipMutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => tooltipMutations.push(...records));
    observer.observe(tooltip, { attributes: true, childList: true });

    root.append(document.createElement('span'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tooltipMutations).toEqual([]);

    observer.disconnect();
    handle.destroy();
  });
});
