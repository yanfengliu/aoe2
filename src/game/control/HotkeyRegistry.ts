// Spec 2 (annotation-ui v0.1.5) AO-3: HotkeyRegistry primitive.
// Single keydown listener with chord-matching + text-input-focus
// suppression. Per ADR 8 the annotation flow uses Alt+M / Alt+L; per
// the design's hotkey contract, hotkeys are ignored when a text input
// (input / textarea / contenteditable) has focus to avoid hijacking
// future chat / form input.

export interface HotkeySpec {
  /** Single character keys are matched case-insensitively against
   *  KeyboardEvent.key (lowercased). Special keys ('Escape', 'Enter',
   *  'ArrowUp', etc.) are matched verbatim. */
  readonly key: string;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
}

export interface HotkeyRegistry {
  /** Register a handler for a chord. Returns an unregister function. */
  register(spec: HotkeySpec, handler: () => void): () => void;
  /** Unbind the keydown listener; subsequent registers throw. */
  dispose(): void;
}

export interface HotkeyRegistryOptions {
  /** Defaults to globalThis.document. Tests pass a stub or a fresh JSDOM
   *  document. If null/undefined and no document is available, returns a
   *  no-op registry. */
  readonly target?: Document | null;
}

interface Registration {
  readonly spec: HotkeySpec;
  readonly handler: () => void;
}

const isTextInputElement = (el: EventTarget | null): boolean => {
  if (!(el instanceof Element)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    if (el instanceof HTMLInputElement) {
      return el.type.toLowerCase() !== 'range';
    }
    return true;
  }
  if (tag === 'TEXTAREA') return true;
  // Check the contentEditable attribute directly. el.isContentEditable is
  // a derived getter that real browsers compute based on the attribute +
  // ancestors; jsdom's implementation can lag, so prefer the attribute
  // value (which both browsers and jsdom expose consistently).
  if (el instanceof HTMLElement) {
    const ce = el.contentEditable;
    if (ce === 'true' || ce === 'plaintext-only') return true;
    // Per HTML spec: an explicit contenteditable="false" makes the element
    // non-editable regardless of ancestors. Honor that by returning false
    // BEFORE walking up — otherwise a `<button contenteditable="false">`
    // nested inside `<div contenteditable="true">` would incorrectly
    // suppress the hotkey (impl-1 review M5).
    if (ce === 'false') return false;
    // Check ancestors so a focused span inside contenteditable=true is suppressed.
    let parent: Element | null = el.parentElement;
    while (parent) {
      if (parent instanceof HTMLElement) {
        const pce = parent.contentEditable;
        if (pce === 'true' || pce === 'plaintext-only') return true;
        if (pce === 'false') return false;
      }
      parent = parent.parentElement;
    }
  }
  return false;
};

const matches = (spec: HotkeySpec, event: KeyboardEvent): boolean => {
  // Single-char keys: case-insensitive. Otherwise: exact (e.g., 'Escape').
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const specKey = spec.key.length === 1 ? spec.key.toLowerCase() : spec.key;
  if (eventKey !== specKey) return false;
  if ((spec.alt ?? false) !== event.altKey) return false;
  if ((spec.ctrl ?? false) !== event.ctrlKey) return false;
  if ((spec.shift ?? false) !== event.shiftKey) return false;
  if ((spec.meta ?? false) !== event.metaKey) return false;
  return true;
};

export function createHotkeyRegistry(options: HotkeyRegistryOptions = {}): HotkeyRegistry {
  const target =
    options.target === undefined
      ? typeof document !== 'undefined' ? document : null
      : options.target;

  if (target === null) {
    // Server / Node tests without a document — no-op registry that still
    // accepts register calls but never fires handlers.
    return {
      register: () => () => {},
      dispose: () => {},
    };
  }

  const registrations = new Set<Registration>();
  let disposed = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disposed) return;
    if (isTextInputElement(event.target)) return;
    for (const reg of registrations) {
      if (matches(reg.spec, event)) {
        event.preventDefault();
        reg.handler();
        return;
      }
    }
  };

  target.addEventListener('keydown', onKeyDown as EventListener);

  return {
    register(spec, handler) {
      if (disposed) {
        throw new Error('HotkeyRegistry: cannot register after dispose');
      }
      const reg: Registration = { spec, handler };
      registrations.add(reg);
      return () => {
        registrations.delete(reg);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      registrations.clear();
      target.removeEventListener('keydown', onKeyDown as EventListener);
    },
  };
}
