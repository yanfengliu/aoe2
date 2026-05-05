// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createHotkeyRegistry } from '../../src/game/control/HotkeyRegistry';

const dispatch = (
  doc: Document,
  init: KeyboardEventInit & { target?: EventTarget },
): void => {
  const event = new (doc.defaultView!.KeyboardEvent)('keydown', { bubbles: true, ...init });
  if (init.target) {
    init.target.dispatchEvent(event);
  } else {
    doc.dispatchEvent(event);
  }
};

describe('HotkeyRegistry', () => {
  it('fires the handler for a registered chord', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, handler);
    dispatch(document, { key: 'm', altKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    registry.dispose();
  });

  it('case-insensitive key matching for single chars', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'M', alt: true }, handler);
    dispatch(document, { key: 'm', altKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    registry.dispose();
  });

  it('chord with mismatched modifier does not fire', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, handler);
    dispatch(document, { key: 'm' }); // no alt
    dispatch(document, { key: 'm', ctrlKey: true }); // wrong modifier
    expect(handler).not.toHaveBeenCalled();
    registry.dispose();
  });

  it('suppressed when focus is on a text input', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, handler);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    dispatch(document, { key: 'm', altKey: true, target: input });
    expect(handler).not.toHaveBeenCalled();

    input.remove();
    registry.dispose();
  });

  it('does not suppress range inputs used as game controls', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'Escape' }, handler);

    const input = document.createElement('input');
    input.type = 'range';
    document.body.appendChild(input);
    input.focus();

    dispatch(document, { key: 'Escape', target: input });
    expect(handler).toHaveBeenCalledTimes(1);

    input.remove();
    registry.dispose();
  });

  it('suppresses hotkeys from checkbox and radio inputs in forms', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, handler);

    for (const type of ['checkbox', 'radio']) {
      const input = document.createElement('input');
      input.type = type;
      document.body.appendChild(input);
      input.focus();

      dispatch(document, { key: 'm', altKey: true, target: input });

      input.remove();
    }

    expect(handler).not.toHaveBeenCalled();
    registry.dispose();
  });

  it('prevents native key defaults when a registered hotkey fires', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: ' ' }, handler);

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);

    button.remove();
    registry.dispose();
  });

  it('suppressed when focus is on a textarea', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, handler);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    dispatch(document, { key: 'm', altKey: true, target: textarea });
    expect(handler).not.toHaveBeenCalled();
    textarea.remove();
    registry.dispose();
  });

  it('suppressed when focus is on a contenteditable element', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, handler);
    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    dispatch(document, { key: 'm', altKey: true, target: div });
    expect(handler).not.toHaveBeenCalled();
    div.remove();
    registry.dispose();
  });

  it('unregister stops calling the handler', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    const unsub = registry.register({ key: 'm', alt: true }, handler);
    unsub();
    dispatch(document, { key: 'm', altKey: true });
    expect(handler).not.toHaveBeenCalled();
    registry.dispose();
  });

  it('multiple specs coexist without firing each other', () => {
    const m = vi.fn();
    const l = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, m);
    registry.register({ key: 'l', alt: true }, l);
    dispatch(document, { key: 'm', altKey: true });
    expect(m).toHaveBeenCalledTimes(1);
    expect(l).not.toHaveBeenCalled();
    dispatch(document, { key: 'l', altKey: true });
    expect(l).toHaveBeenCalledTimes(1);
    registry.dispose();
  });

  it('dispose unregisters all and prevents further registers', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'm', alt: true }, handler);
    registry.dispose();
    dispatch(document, { key: 'm', altKey: true });
    expect(handler).not.toHaveBeenCalled();
    expect(() => registry.register({ key: 'l', alt: true }, vi.fn())).toThrow(
      /cannot register after dispose/,
    );
  });

  it('returns a no-op registry when target is explicitly null', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry({ target: null });
    const unsub = registry.register({ key: 'm', alt: true }, handler);
    // dispatch on document — should NOT fire because the registry is a stub
    dispatch(document, { key: 'm', altKey: true });
    expect(handler).not.toHaveBeenCalled();
    unsub();
    registry.dispose();
  });
});
