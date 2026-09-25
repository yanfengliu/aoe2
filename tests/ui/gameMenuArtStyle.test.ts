// @vitest-environment jsdom

// The game menu's art-style row (spec §14.5): it shows the style the canvas is
// actually drawn in, and switches it.
import { describe, expect, it, vi } from 'vitest';

import { createGameMenu } from '../../src/ui/hud/gameMenu';
import { HUD_TEMPLATE_HTML } from '../../src/ui/hud/hudTemplate';

function mount(): HTMLElement {
  const root = document.createElement('div');

  root.innerHTML = HUD_TEMPLATE_HTML;
  document.body.append(root);

  return root;
}

function row(root: HTMLElement) {
  return {
    button: root.querySelector<HTMLButtonElement>('[data-hud="menu-art-style-cycle"]')!,
    state: root.querySelector<HTMLElement>('[data-hud="menu-art-style"]')!,
  };
}

describe('game-menu art style row', () => {
  it('renders the live style on mount rather than the markup default', () => {
    // The template ships a label, but the style in force comes from a
    // persisted preference. Without this the row says "Moebius" over a
    // Natural canvas until the player happens to click it.
    const root = mount();

    createGameMenu(root, { artStyleLabel: () => 'Natural' });

    const { button, state } = row(root);
    expect(state.textContent).toBe('Natural');
    expect(button.getAttribute('aria-label')).toBe('Art style: Natural');
  });

  it('leaves the markup default alone when no style source is wired', () => {
    // Tests and headless mounts omit the deps; the row must stay inert rather
    // than blanking itself.
    const root = mount();

    createGameMenu(root, {});

    expect(row(root).state.textContent).toBe('Natural');
  });

  it('cycles on click and republishes the new label to both surfaces', () => {
    const root = mount();
    const cycleArtStyle = vi.fn(() => 'Natural');

    createGameMenu(root, { artStyleLabel: () => 'Moebius', cycleArtStyle });

    const { button, state } = row(root);
    button.click();

    expect(cycleArtStyle).toHaveBeenCalledTimes(1);
    expect(state.textContent).toBe('Natural');
    // The accessible name has to move with the visible state, or a screen
    // reader keeps announcing the style the player just left.
    expect(button.getAttribute('aria-label')).toBe('Art style: Natural');
  });

  it('holds the displayed style when the cycle reports nothing', () => {
    // Painting an empty label would be worse than leaving the previous one up.
    const root = mount();

    createGameMenu(root, {
      artStyleLabel: () => 'Moebius',
      cycleArtStyle: () => undefined as unknown as string,
    });

    row(root).button.click();

    expect(row(root).state.textContent).toBe('Moebius');
  });

  it('stops cycling after destroy', () => {
    const root = mount();
    const cycleArtStyle = vi.fn(() => 'Natural');

    const menu = createGameMenu(root, { artStyleLabel: () => 'Moebius', cycleArtStyle });

    menu.destroy();
    row(root).button.click();

    expect(cycleArtStyle).not.toHaveBeenCalled();
  });
});
