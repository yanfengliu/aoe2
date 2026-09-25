// @vitest-environment jsdom
//
// An alert toast carries the tick of the blow it announces (defect register
// 2026-09-24). The page draws the words up to a frame of ticks after that
// blow, so a check that stamps them with the tick the page is at reads two
// horns exactly 200 ticks apart as 199, and main's CI did. The attribute is
// what `tests/browser/attack-warning-sustained.spec.ts` measures the throttle
// on; this pins the toast's half of that contract without a browser.

import { describe, expect, it } from 'vitest';

import { createToastController } from '../../src/ui/hud/toast';

describe('an alert toast', () => {
  it('carries the tick of the blow it announces, and a plain toast carries none', () => {
    const container = document.createElement('div');
    const toasts = createToastController(container);
    toasts.showToast('You are under attack!', { kind: 'alert', hitTick: 204 });
    toasts.showToast('Not enough wood.');
    const [alert, plain] = [...container.children] as HTMLElement[];
    expect(alert!.dataset.hudToastKind).toBe('alert');
    expect(alert!.dataset.hudToastHitTick).toBe('204');
    expect(plain!.dataset.hudToastKind).toBeUndefined();
    expect(plain!.dataset.hudToastHitTick).toBeUndefined();
  });
});
