// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { createTooltipController } from '../../src/ui/hud/tooltips';

describe('HUD tooltip keyboard focus', () => {
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
