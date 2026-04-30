// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createAnnotationForm } from '../../src/ui/annotation/AnnotationForm';

const mountedHost = (): HTMLElement => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
};

describe('AnnotationForm', () => {
  it('mount creates form DOM with required fields', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    expect(host.querySelector('[data-testid="annotation-form"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="annotation-form-text"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="annotation-form-category"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="annotation-form-save"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="annotation-form-cancel"]')).not.toBeNull();
    form.dispose();
  });

  it('mount is idempotent', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    form.mount(host);
    expect(host.querySelectorAll('[data-testid="annotation-form"]').length).toBe(1);
    form.dispose();
  });

  it('open shows the form and clears previous fields', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    form.open();
    expect(form.isOpen()).toBe(true);
    const textArea = host.querySelector<HTMLTextAreaElement>('[data-testid="annotation-form-text"]')!;
    textArea.value = 'leaked from prior session';
    form.close();
    expect(form.isOpen()).toBe(false);
    form.open();
    expect(textArea.value).toBe('');
    form.dispose();
  });

  it('close hides the form', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    form.open();
    form.close();
    expect(form.isOpen()).toBe(false);
    const formEl = host.querySelector<HTMLDivElement>('[data-testid="annotation-form"]')!;
    expect(formEl.classList.contains('annotation-form--hidden')).toBe(true);
    form.dispose();
  });

  it('submit fires onSubmit with all form fields', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    const handler = vi.fn();
    form.onSubmit(handler);
    form.open();
    const textArea = host.querySelector<HTMLTextAreaElement>('[data-testid="annotation-form-text"]')!;
    textArea.value = 'pathfinding stuck';
    const bug = host.querySelector<HTMLInputElement>('[data-testid="annotation-form-severity-bug"]')!;
    bug.checked = true;
    const category = host.querySelector<HTMLSelectElement>('[data-testid="annotation-form-category"]')!;
    category.value = 'pathfinding';
    const screenshot = host.querySelector<HTMLInputElement>('[data-testid="annotation-form-screenshot"]')!;
    screenshot.checked = true;
    const save = host.querySelector<HTMLButtonElement>('[data-testid="annotation-form-save"]')!;
    // Simulate form submission (button click on submit button triggers form submit)
    const formEl = save.closest('form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      text: 'pathfinding stuck',
      severity: 'bug',
      category: 'pathfinding',
      captureScreenshot: true,
    });
    form.dispose();
  });

  it('submit with empty text is suppressed (required validation)', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    const handler = vi.fn();
    form.onSubmit(handler);
    form.open();
    const formEl = host.querySelector<HTMLFormElement>('form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(handler).not.toHaveBeenCalled();
    form.dispose();
  });

  it('cancel fires onCancel', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    const handler = vi.fn();
    form.onCancel(handler);
    form.open();
    const cancelBtn = host.querySelector<HTMLButtonElement>('[data-testid="annotation-form-cancel"]')!;
    cancelBtn.click();
    expect(handler).toHaveBeenCalledTimes(1);
    form.dispose();
  });

  it('showError displays error message; clear on next open', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    form.open();
    form.showError('recorder rejected the marker');
    const errEl = host.querySelector<HTMLDivElement>('[data-testid="annotation-form-error"]')!;
    expect(errEl.hidden).toBe(false);
    expect(errEl.textContent).toBe('recorder rejected the marker');
    form.close();
    form.open();
    expect(errEl.hidden).toBe(true);
    form.dispose();
  });

  it('dispose tears down DOM and listeners', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    const handler = vi.fn();
    form.onSubmit(handler);
    form.dispose();
    expect(host.querySelector('[data-testid="annotation-form"]')).toBeNull();
  });

  it('multiple submit listeners all fire', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    const a = vi.fn();
    const b = vi.fn();
    form.onSubmit(a);
    form.onSubmit(b);
    form.open();
    const textArea = host.querySelector<HTMLTextAreaElement>('[data-testid="annotation-form-text"]')!;
    textArea.value = 'x';
    const formEl = host.querySelector<HTMLFormElement>('form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    form.dispose();
  });

  it('unsubscribe stops calling the handler', () => {
    const host = mountedHost();
    const form = createAnnotationForm();
    form.mount(host);
    const handler = vi.fn();
    const unsub = form.onSubmit(handler);
    unsub();
    form.open();
    const textArea = host.querySelector<HTMLTextAreaElement>('[data-testid="annotation-form-text"]')!;
    textArea.value = 'x';
    const formEl = host.querySelector<HTMLFormElement>('form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(handler).not.toHaveBeenCalled();
    form.dispose();
  });
});
