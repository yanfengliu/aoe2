// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { createTooltipController } from '../../src/ui/hud/tooltips';

// A tooltip follows the copy of the host it is showing (work 132). The top
// bar's Wonder/Relic chip states the years and the time left in its tooltip,
// and both change every second while the pointer rests on the chip: a tooltip
// that kept the first reading would disagree with the time beside it.
//
// BOUND: the controller on a bare DOM. That the chip's tooltip carries the
// years is `tests/ui/countdownChip.test.ts` and the real page's hover is
// `tests/browser/victory-countdown-chip.spec.ts`. A mutation record reaches the
// observer as a microtask, so each case waits one.

function scene() {
  const root = document.createElement('div');
  const host = document.createElement('div');
  const other = document.createElement('div');
  const tooltip = document.createElement('div');
  host.dataset.tooltip = 'Wonder victory in 198 years (16:30 of game time).';
  other.dataset.tooltip = 'Time elapsed.';
  root.append(host, other, tooltip);
  document.body.append(root);
  return { root, host, other, tooltip, handle: createTooltipController(root, tooltip) };
}

const settle = (): Promise<void> => Promise.resolve();

describe('a tooltip showing copy that then changes', () => {
  it('shows the new copy while the pointer rests on its host', async () => {
    const { host, tooltip, handle } = scene();
    host.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(tooltip.textContent).toBe('Wonder victory in 198 years (16:30 of game time).');
    host.dataset.tooltip = 'Wonder victory in 197 years (16:25 of game time).';
    await settle();
    expect(tooltip.textContent).toBe('Wonder victory in 197 years (16:25 of game time).');
    expect(tooltip.dataset.hudTooltipActive).toBe('true');
    handle.destroy();
  });

  it('hides it when the copy becomes empty', async () => {
    const { host, tooltip, handle } = scene();
    host.dispatchEvent(new Event('pointerover', { bubbles: true }));
    host.dataset.tooltip = '';
    await settle();
    expect(tooltip.textContent).toBe('');
    expect(tooltip.dataset.hudTooltipActive).toBe('false');
    handle.destroy();
  });

  it('leaves the tooltip alone when the copy of a host it is not showing changes', async () => {
    const { host, other, tooltip, handle } = scene();
    host.dispatchEvent(new Event('pointerover', { bubbles: true }));
    other.dataset.tooltip = 'Something else entirely.';
    await settle();
    expect(tooltip.textContent).toBe('Wonder victory in 198 years (16:30 of game time).');
    handle.destroy();
  });

  it('does not show it again when the copy is rewritten with the same text', async () => {
    // The HUD rewrites a resource chip's copy every frame with the text it had.
    const { host, tooltip, handle } = scene();
    const measure = vi.spyOn(host, 'getBoundingClientRect');
    host.dispatchEvent(new Event('pointerover', { bubbles: true }));
    const placed = measure.mock.calls.length;
    expect(placed).toBeGreaterThan(0);
    for (let frame = 0; frame < 5; frame += 1) {
      host.dataset.tooltip = 'Wonder victory in 198 years (16:30 of game time).';
      await settle();
    }
    expect(measure.mock.calls.length, 'placed again for a copy that did not change').toBe(placed);
    expect(tooltip.textContent).toBe('Wonder victory in 198 years (16:30 of game time).');
    handle.destroy();
  });

  it('shows nothing when no host owns the tooltip', async () => {
    const { host, tooltip, handle } = scene();
    host.dataset.tooltip = 'Wonder victory in 150 years (12:30 of game time).';
    await settle();
    expect(tooltip.textContent).toBe('');
    host.dispatchEvent(new Event('pointerover', { bubbles: true }));
    host.dispatchEvent(new Event('pointerout', { bubbles: true }));
    host.dataset.tooltip = 'Wonder victory in 149 years (12:25 of game time).';
    await settle();
    expect(tooltip.textContent, 'a host the pointer has left does not get its tooltip back').toBe('');
    handle.destroy();
  });

});
