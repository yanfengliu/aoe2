// DOM writes the HUD makes every animation frame, made only when the value changes (work 130).
//
// WHY. The HUD's frame callback rewrote every resource count, worker count, label and tooltip on every frame, about
// 30 DOM mutations a frame with the match paused and nothing on screen changing, and a text or attribute write
// dirties style and layout even when the new value equals the old. So every frame paid a style recalculation and a
// layout, and the first rect read after the writes forced it synchronously: the audio loop's `stackAboveBell` was
// where that showed in a profile (3.5-6.2% of the main thread, docs/debugging/2026-10-15-frame-rate-through-a-
// match.md). Written only on change, a still HUD dirties nothing and the rect reads cost nothing.
// tests/browser/hud-frame-dom-writes.spec.ts counts the mutations and Chrome's own layouts on a paused match.

/** Sets an element's text when it differs; a text write replaces the text node even when it is the same. */
export function writeText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

/** Sets an attribute when it differs. */
export function writeAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/** Sets a `data-*` value when it differs. */
export function writeData(element: HTMLElement, key: string, value: string): void {
  if (element.dataset[key] !== value) element.dataset[key] = value;
}
