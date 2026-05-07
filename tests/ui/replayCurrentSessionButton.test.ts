// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createReplayCurrentSessionButton } from '../../src/ui/hud/replayCurrentSessionButton';

describe('createReplayCurrentSessionButton', () => {
  let button: HTMLButtonElement;
  let onClick: ReturnType<typeof vi.fn>;
  let available: boolean;
  let replayMode: boolean;

  beforeEach(() => {
    button = document.createElement('button');
    document.body.appendChild(button);
    onClick = vi.fn();
    available = true;
    replayMode = false;
  });

  const makeHandle = () =>
    createReplayCurrentSessionButton({
      button,
      onClick,
      isAvailable: () => available,
      isReplayMode: () => replayMode,
      autoRefresh: false,
    });

  it('button is enabled when live session is available and not in replay mode', () => {
    const handle = makeHandle();
    expect(button.disabled).toBe(false);
    handle.destroy();
  });

  it('button is disabled when isAvailable() returns false', () => {
    available = false;
    const handle = makeHandle();
    expect(button.disabled).toBe(true);
    handle.destroy();
  });

  it('button is disabled when isReplayMode() returns true', () => {
    replayMode = true;
    const handle = makeHandle();
    expect(button.disabled).toBe(true);
    handle.destroy();
  });

  it('refresh() re-evaluates both conditions', () => {
    const handle = makeHandle();
    expect(button.disabled).toBe(false);
    available = false;
    handle.refresh();
    expect(button.disabled).toBe(true);
    available = true;
    replayMode = true;
    handle.refresh();
    expect(button.disabled).toBe(true);
    replayMode = false;
    handle.refresh();
    expect(button.disabled).toBe(false);
    handle.destroy();
  });

  it('click invokes onClick when enabled', () => {
    const handle = makeHandle();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    handle.destroy();
  });

  it('click re-evaluates disabled state (closes the staleness window between polls)', () => {
    const handle = makeHandle();
    expect(button.disabled).toBe(false);
    // Stale state: the button reports enabled because the last refresh saw
    // available=true, but availability has since flipped. A click should
    // re-check before invoking onClick.
    available = false;
    button.click();
    expect(button.disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('subscribeToModeChange fires refresh immediately on listener invocation', () => {
    let captured: (() => void) | null = null;
    const subscribeToModeChange = vi.fn((listener: () => void) => {
      captured = listener;
      return () => {
        captured = null;
      };
    });
    const handle = createReplayCurrentSessionButton({
      button,
      onClick,
      isAvailable: () => available,
      isReplayMode: () => replayMode,
      autoRefresh: false,
      subscribeToModeChange,
    });
    expect(button.disabled).toBe(false);
    expect(subscribeToModeChange).toHaveBeenCalledTimes(1);
    expect(captured).not.toBeNull();
    replayMode = true;
    captured!();
    expect(button.disabled).toBe(true);
    replayMode = false;
    captured!();
    expect(button.disabled).toBe(false);
    handle.destroy();
    expect(captured).toBeNull();
  });

  it('destroy() removes the click listener and stops polling', () => {
    const handle = makeHandle();
    handle.destroy();
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
