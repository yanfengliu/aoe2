// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { createTooltipController } from '../../src/ui/hud/tooltips';

// A tooltip stays on a control the panel redraws under a resting pointer (work
// 148 M1). The selection panel draws itself again on every tick a building
// trains, replacing each button and queue icon with a new element: a tooltip
// tied to the old element vanished at the first redraw, so a player hovering
// Train Villager, or the queue's icons, while a villager trained saw its tooltip
// for one frame in twenty (`tmp/probes/queue-tooltip-hover.mjs`, 1280x720). The
// control is found again by its key: a command's `data-command`, a queue icon's
// `data-selection-queue-item`.
//
// BOUND: the controller on a bare DOM; a mutation record reaches the observer as
// a microtask, so each case waits one. The real page's hover is
// `tests/browser/de-production-queue.spec.ts`.

function scene(markup: string) {
  const root = document.createElement('div');
  const panel = document.createElement('div');
  const tooltip = document.createElement('div');
  panel.innerHTML = markup;
  root.append(panel, tooltip);
  document.body.append(root);
  return { root, panel, tooltip, handle: createTooltipController(root, tooltip) };
}

const settle = (): Promise<void> => Promise.resolve();
const hover = (element: Element | null): void => {
  element!.dispatchEvent(new Event('pointerover', { bubbles: true }));
};

describe('a tooltip on a control the panel redraws', () => {
  it('stays on a command button drawn again with the same command', async () => {
    const button = '<button data-command="train-villager" data-tooltip="Queue a Villager.">Train Villager</button>';
    const { panel, tooltip, handle } = scene(button);
    hover(panel.querySelector('[data-command]'));
    expect(tooltip.textContent).toBe('Queue a Villager.');
    panel.innerHTML = button;
    await settle();
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    expect(tooltip.textContent).toBe('Queue a Villager.');
    handle.destroy();
  });

  it('follows a queue icon drawn again with new copy', async () => {
    const icon = (percent: number) => `<span data-selection-queue-item="0" data-tooltip="Creating Villager: ${percent}%"></span>`;
    const { panel, tooltip, handle } = scene(icon(10));
    hover(panel.querySelector('[data-selection-queue-item]'));
    panel.innerHTML = icon(11);
    await settle();
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    expect(tooltip.textContent).toBe('Creating Villager: 11%');
    handle.destroy();
  });

  it('lets go when the pointer moves off a control it followed into a redraw', async () => {
    // The browser still holds the replaced element as hovered, so leaving it
    // sends no pointerout the HUD hears; the next move lands on the map.
    const icon = '<span data-selection-queue-item="0" data-tooltip="Creating Villager: 10%"></span>';
    const { panel, tooltip, handle } = scene(icon);
    hover(panel.querySelector('[data-selection-queue-item]'));
    panel.innerHTML = icon;
    await settle();
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    const map = document.createElement('canvas');
    document.body.append(map);
    map.dispatchEvent(new Event('pointermove', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('false');
    // A move over the control itself keeps it.
    hover(panel.querySelector('[data-selection-queue-item]'));
    panel.querySelector('[data-selection-queue-item]')!.dispatchEvent(new Event('pointermove', { bubbles: true }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    handle.destroy();
  });

  it('lets go of a control the redraw moved out from under the pointer (review round 1)', async () => {
    // A group panel's icons close up when one leaves: the same unit's icon is
    // drawn again one place to the left, and the pointer rests over another.
    const icons = (first: number) => [first, first + 1]
      .map((id) => `<span data-selection-member="${id}" data-tooltip="Click to select only this Villager."></span>`).join('');
    const { panel, tooltip, handle } = scene(icons(11));
    const hovered = panel.querySelector('[data-selection-member="12"]')!;
    hovered.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, clientX: 40, clientY: 10 }));
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    const original = document.elementFromPoint;
    try {
      panel.innerHTML = icons(12);
      // What the pointer now rests on: unit 13's icon, which took 12's place.
      document.elementFromPoint = () => panel.querySelector('[data-selection-member="13"]');
      await settle();
      expect(tooltip.dataset.hudTooltipActive).toBe('false');

      // Drawn again in the same place, it keeps the tooltip.
      panel.querySelector('[data-selection-member="13"]')!
        .dispatchEvent(new MouseEvent('pointerover', { bubbles: true, clientX: 40, clientY: 10 }));
      panel.innerHTML = icons(12);
      document.elementFromPoint = () => panel.querySelector('[data-selection-member="13"]');
      await settle();
      expect(tooltip.dataset.hudTooltipActive).toBe('true');
    } finally {
      document.elementFromPoint = original;
    }
    handle.destroy();
  });

  it('hides when the redraw drops the control', async () => {
    const { panel, tooltip, handle } = scene('<span data-selection-queue-item="0" data-tooltip="Loom: in the queue"></span>');
    hover(panel.querySelector('[data-selection-queue-item]'));
    panel.innerHTML = '<span data-command="train-villager" data-tooltip="Queue a Villager."></span>';
    await settle();
    expect(tooltip.dataset.hudTooltipActive).toBe('false');
    handle.destroy();
  });

  it('does not move to another control of the same copy', async () => {
    // Two icons share their copy; the hovered one's key, not its text, finds it.
    const { panel, tooltip, handle } = scene('<span data-selection-queue-item="1" data-tooltip="Villager: in the queue"></span>');
    hover(panel.querySelector('[data-selection-queue-item]'));
    panel.innerHTML = '<span data-selection-queue-item="0" data-tooltip="Villager: in the queue"></span>';
    await settle();
    expect(tooltip.dataset.hudTooltipActive).toBe('false');
    handle.destroy();
  });
});
