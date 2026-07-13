// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { renderFatalStartupError } from '../../src/app/bootstrap/renderFatalStartupError';

describe('renderFatalStartupError', () => {
  it('replaces a partial app with an accessible, visible failure', () => {
    document.body.innerHTML = '<div id="app"><canvas></canvas></div>';

    renderFatalStartupError(new Error('WebGL unavailable'), document);

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('could not start');
    expect(alert?.textContent).toContain('WebGL unavailable');
    expect(document.querySelector('canvas')).toBeNull();
  });
});
