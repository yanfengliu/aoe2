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

  // The control-group double-tap times its window between two presses' own
  // `timeStamp`s (selectionRecallHotkeys.ts), so the handler must get the
  // keydown itself; without it the only clock left is one read in the handler,
  // which a busy page stretches.
  it('hands the handler the keydown that fired it', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: '1' }, handler);
    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    document.dispatchEvent(event);
    expect(handler).toHaveBeenCalledWith(event);
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

  // Work 142 review round 3: the grid keys are plain letters, and a focused
  // dropdown (the annotation form's Category) jumps to an option on a letter.
  it('suppressed when focus is on a select, so its letters still pick options', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: 'e' }, handler);
    const select = document.createElement('select');
    document.body.appendChild(select);
    dispatch(document, { key: 'e', target: select });
    expect(handler).not.toHaveBeenCalled();
    select.remove();
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

// Work 142 M2b-2b: DE's keys name physical keys (VK_ADD is the numpad's +,
// which a browser reports as the same `key` as Shift+=), and a boot-time key
// that means something else in one mode passes the key on to that mode's own.
describe('HotkeyRegistry physical keys and passing a key on', () => {
  it('matches a spec with a code on the physical key alone', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ code: 'NumpadAdd' }, handler);
    dispatch(document, { key: '+', code: 'Equal' });
    expect(handler).not.toHaveBeenCalled();
    dispatch(document, { key: '+', code: 'NumpadAdd' });
    expect(handler).toHaveBeenCalledTimes(1);
    registry.dispose();
  });

  it('a handler that returns false passes the key to the next registration and leaves its default', () => {
    const registry = createHotkeyRegistry();
    const declines = vi.fn(() => false as const);
    registry.register({ key: 'Home' }, declines);
    const first = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    document.dispatchEvent(first);
    expect(declines).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented, 'a declined key kept the browser from it').toBe(false);
    const takes = vi.fn();
    registry.register({ key: 'Home' }, takes);
    const second = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    document.dispatchEvent(second);
    expect(takes).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(true);
    registry.dispose();
  });
});

// Review round 7: the annotation form's Save and Cancel buttons are not text
// fields, but a key pressed on them is the form's (the coordinator's answer of
// 2026-11-05): Space presses the focused button, Ctrl+= zooms the page.
describe('HotkeyRegistry inside a form', () => {
  it('gives a key pressed on a control inside a form to the form, and one outside to the game', () => {
    const handler = vi.fn();
    const registry = createHotkeyRegistry();
    registry.register({ key: ' ' }, handler);
    const form = document.createElement('form');
    const inside = document.createElement('button');
    form.append(inside);
    const outside = document.createElement('button');
    document.body.append(form, outside);
    const onInside = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    inside.dispatchEvent(onInside);
    expect(handler).not.toHaveBeenCalled();
    expect(onInside.defaultPrevented).toBe(false);
    outside.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    // A hidden form keeps focus on the button that closed it; the key is the game's.
    (form as HTMLFormElement & { checkVisibility: () => boolean }).checkVisibility = () => false;
    inside.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(2);
    // Review round 8: an input of the hidden form, a radio that submitted it
    // with Enter, kept focus too, and a text field's rule must not take it back.
    const radio = document.createElement('input');
    radio.type = 'radio';
    const text = document.createElement('textarea');
    form.append(radio, text);
    radio.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    text.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(4);
    form.remove();
    outside.remove();
    registry.dispose();
  });
});
