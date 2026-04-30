// Spec 2 (annotation-ui v0.1.5) AO-9: modal annotation form. Per
// DESIGN §6: text (textarea, required), severity (info/warning/bug/blocker),
// category (pathfinding/combat/economy/ai/ui/perf/general), captureScreenshot
// checkbox, save / cancel buttons. The form is mounted into the HUD root
// as a child element; visibility is toggled via CSS class.

import {
  type AoeCategory,
  type AoeSeverity,
  DEFAULT_CATEGORY,
  DEFAULT_SEVERITY,
} from '../../game/annotations/markerSchema';

export interface AnnotationFormSubmission {
  readonly text: string;
  readonly severity: AoeSeverity;
  readonly category: AoeCategory;
  readonly captureScreenshot: boolean;
}

export interface AnnotationFormView {
  /** Mount the form DOM into `host` (idempotent). */
  mount(host: HTMLElement): void;
  /** Show the form (optionally with focused-default fields). */
  open(): void;
  /** Hide the form and clear input fields. */
  close(): void;
  /** True when the form is currently visible. */
  isOpen(): boolean;
  /** Tear down event listeners and remove the form DOM. */
  dispose(): void;
  /** Subscribe to submit events. Returns unsubscribe. */
  onSubmit(handler: (input: AnnotationFormSubmission) => void): () => void;
  /** Subscribe to cancel events. Returns unsubscribe. */
  onCancel(handler: () => void): () => void;
  /** Surface a transient error message inside the form (e.g., the
   *  recorder rejected the marker). The form stays open. */
  showError(message: string): void;
}

const SEVERITIES: readonly AoeSeverity[] = ['info', 'warning', 'bug', 'blocker'];
const CATEGORIES: readonly AoeCategory[] = [
  'pathfinding',
  'combat',
  'economy',
  'ai',
  'ui',
  'perf',
  'general',
];

export function createAnnotationForm(): AnnotationFormView {
  let mounted: HTMLElement | null = null;
  let formEl: HTMLDivElement | null = null;
  let textArea: HTMLTextAreaElement | null = null;
  let severityRadios: HTMLInputElement[] = [];
  let categorySelect: HTMLSelectElement | null = null;
  let screenshotCheckbox: HTMLInputElement | null = null;
  let saveButton: HTMLButtonElement | null = null;
  let cancelButton: HTMLButtonElement | null = null;
  let errorEl: HTMLDivElement | null = null;
  let isVisible = false;

  const submitListeners = new Set<(input: AnnotationFormSubmission) => void>();
  const cancelListeners = new Set<() => void>();

  const cleanup: Array<() => void> = [];

  const buildDom = (): HTMLDivElement => {
    const root = document.createElement('div');
    root.className = 'annotation-form annotation-form--hidden';
    root.dataset.testid = 'annotation-form';
    root.innerHTML = `
      <form class="annotation-form__form">
        <h2 class="annotation-form__title">Add annotation</h2>
        <label class="annotation-form__label">
          Note
          <textarea data-testid="annotation-form-text" class="annotation-form__text" rows="4" required></textarea>
        </label>
        <fieldset class="annotation-form__severity">
          <legend>Severity</legend>
          ${SEVERITIES.map(
            (sev) => `
              <label>
                <input type="radio" name="annotation-severity" value="${sev}" ${sev === DEFAULT_SEVERITY ? 'checked' : ''} data-testid="annotation-form-severity-${sev}" />
                ${sev}
              </label>`,
          ).join('')}
        </fieldset>
        <label class="annotation-form__label">
          Category
          <select data-testid="annotation-form-category" class="annotation-form__category">
            ${CATEGORIES.map(
              (cat) => `<option value="${cat}" ${cat === DEFAULT_CATEGORY ? 'selected' : ''}>${cat}</option>`,
            ).join('')}
          </select>
        </label>
        <label class="annotation-form__screenshot">
          <input type="checkbox" data-testid="annotation-form-screenshot" />
          Capture screenshot
        </label>
        <div class="annotation-form__error" data-testid="annotation-form-error" hidden></div>
        <div class="annotation-form__buttons">
          <button type="submit" data-testid="annotation-form-save">Save</button>
          <button type="button" data-testid="annotation-form-cancel">Cancel</button>
        </div>
      </form>
    `;
    return root;
  };

  const wireListeners = (): void => {
    if (!formEl) return;
    textArea = formEl.querySelector<HTMLTextAreaElement>('[data-testid="annotation-form-text"]');
    severityRadios = Array.from(
      formEl.querySelectorAll<HTMLInputElement>('input[name="annotation-severity"]'),
    );
    categorySelect = formEl.querySelector<HTMLSelectElement>('[data-testid="annotation-form-category"]');
    screenshotCheckbox = formEl.querySelector<HTMLInputElement>(
      '[data-testid="annotation-form-screenshot"]',
    );
    saveButton = formEl.querySelector<HTMLButtonElement>('[data-testid="annotation-form-save"]');
    cancelButton = formEl.querySelector<HTMLButtonElement>(
      '[data-testid="annotation-form-cancel"]',
    );
    errorEl = formEl.querySelector<HTMLDivElement>('[data-testid="annotation-form-error"]');

    const formInner = formEl.querySelector<HTMLFormElement>('form');
    if (formInner) {
      const onSubmit = (e: Event): void => {
        e.preventDefault();
        const text = textArea?.value.trim() ?? '';
        if (text.length === 0) return; // required validation
        const severity = (severityRadios.find((r) => r.checked)?.value ?? DEFAULT_SEVERITY) as AoeSeverity;
        const category = (categorySelect?.value ?? DEFAULT_CATEGORY) as AoeCategory;
        const captureScreenshot = screenshotCheckbox?.checked ?? false;
        const input: AnnotationFormSubmission = { text, severity, category, captureScreenshot };
        for (const listener of submitListeners) {
          try { listener(input); } catch { /* listener errors swallowed */ }
        }
      };
      formInner.addEventListener('submit', onSubmit);
      cleanup.push(() => formInner.removeEventListener('submit', onSubmit));
    }

    if (cancelButton) {
      const onCancel = (): void => {
        for (const listener of cancelListeners) {
          try { listener(); } catch { /* listener errors swallowed */ }
        }
      };
      cancelButton.addEventListener('click', onCancel);
      cleanup.push(() => cancelButton!.removeEventListener('click', onCancel));
    }
  };

  return {
    mount(host: HTMLElement): void {
      if (mounted) return; // idempotent
      mounted = host;
      formEl = buildDom();
      host.appendChild(formEl);
      wireListeners();
    },

    open(): void {
      if (!formEl) return;
      formEl.classList.remove('annotation-form--hidden');
      isVisible = true;
      // Clear previous-session state.
      if (textArea) textArea.value = '';
      if (screenshotCheckbox) screenshotCheckbox.checked = false;
      const defaultSev = severityRadios.find((r) => r.value === DEFAULT_SEVERITY);
      if (defaultSev) defaultSev.checked = true;
      if (categorySelect) categorySelect.value = DEFAULT_CATEGORY;
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
      // Focus the text area for immediate typing.
      textArea?.focus();
    },

    close(): void {
      if (!formEl) return;
      formEl.classList.add('annotation-form--hidden');
      isVisible = false;
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
    },

    isOpen(): boolean {
      return isVisible;
    },

    dispose(): void {
      while (cleanup.length > 0) {
        const fn = cleanup.pop()!;
        try { fn(); } catch { /* best-effort */ }
      }
      submitListeners.clear();
      cancelListeners.clear();
      if (formEl && mounted) {
        try { mounted.removeChild(formEl); } catch { /* best-effort */ }
      }
      formEl = null;
      mounted = null;
    },

    onSubmit(handler): () => void {
      submitListeners.add(handler);
      return () => submitListeners.delete(handler);
    },

    onCancel(handler): () => void {
      cancelListeners.add(handler);
      return () => cancelListeners.delete(handler);
    },

    showError(message: string): void {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.hidden = false;
    },
  };
}
