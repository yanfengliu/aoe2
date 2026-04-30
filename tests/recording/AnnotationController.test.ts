// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EntityRef, World } from 'civ-engine';

import { createAnnotationController } from '../../src/game/recording/AnnotationController';
import type { AnnotationFormView, AnnotationFormSubmission } from '../../src/ui/annotation/AnnotationForm';

interface MockRefs {
  entities?: readonly EntityRef[];
  tickRange?: { from: number; to: number };
}

const stubForm = (): AnnotationFormView & {
  emitSubmit: (input: AnnotationFormSubmission) => void;
  emitCancel: () => void;
} => {
  const submitListeners = new Set<(input: AnnotationFormSubmission) => void>();
  const cancelListeners = new Set<() => void>();
  let visible = false;
  return {
    mount: vi.fn(),
    open: vi.fn(() => { visible = true; }),
    close: vi.fn(() => { visible = false; }),
    isOpen: () => visible,
    dispose: vi.fn(),
    onSubmit(handler) {
      submitListeners.add(handler);
      return () => submitListeners.delete(handler);
    },
    onCancel(handler) {
      cancelListeners.add(handler);
      return () => cancelListeners.delete(handler);
    },
    showError: vi.fn(),
    emitSubmit(input) {
      for (const l of submitListeners) l(input);
    },
    emitCancel() {
      for (const l of cancelListeners) l();
    },
  };
};

describe('AnnotationController', () => {
  let recording: {
    isRecording: ReturnType<typeof vi.fn>;
    addMarker: ReturnType<typeof vi.fn>;
    attachScreenshot: ReturnType<typeof vi.fn>;
  };
  let pauseControl: { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; isPaused: () => boolean };
  let toast: { showToast: ReturnType<typeof vi.fn> };
  let world: World;
  let selectedRefs: EntityRef[];
  let canvas: HTMLCanvasElement | null;

  beforeEach(() => {
    recording = {
      isRecording: vi.fn(() => true),
      addMarker: vi.fn(() => 'marker-id-stub'),
      attachScreenshot: vi.fn(() => 'attachment-id-stub'),
    };
    pauseControl = { pause: vi.fn(), resume: vi.fn(), isPaused: () => false };
    toast = { showToast: vi.fn() };
    world = { tick: 42 } as unknown as World;
    selectedRefs = [];
    canvas = document.createElement('canvas');
    canvas.toDataURL = vi.fn(() => 'data:image/png;base64,iVBORw0KGgo=');
  });

  it('onHotkey: pauses + opens form when recording is active', () => {
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => selectedRefs },
      canvasRef: () => canvas,
      toast,
    });
    controller.onHotkey();
    expect(pauseControl.pause).toHaveBeenCalledTimes(1);
    expect(form.open).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('onHotkey: no-op + toast when recording is not ready', () => {
    recording.isRecording = vi.fn(() => false);
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => selectedRefs },
      canvasRef: () => canvas,
      toast,
    });
    controller.onHotkey();
    expect(pauseControl.pause).not.toHaveBeenCalled();
    expect(form.open).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('recording not ready');
    controller.dispose();
  });

  it('submit with non-empty selection: marker has entities refs', () => {
    selectedRefs = [{ id: 1, generation: 0 }, { id: 2, generation: 5 }];
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => selectedRefs },
      canvasRef: () => canvas,
      toast,
    });
    controller.onHotkey();
    form.emitSubmit({ text: 'unit stuck', severity: 'bug', category: 'pathfinding', captureScreenshot: false });
    expect(recording.addMarker).toHaveBeenCalledTimes(1);
    const callArgs = recording.addMarker.mock.calls[0][0];
    expect(callArgs.kind).toBe('annotation');
    expect(callArgs.text).toBe('unit stuck');
    expect(callArgs.refs.entities).toEqual(selectedRefs);
    expect(callArgs.data).toEqual({ author: 'human', severity: 'bug', category: 'pathfinding' });
    expect(pauseControl.resume).toHaveBeenCalledTimes(1);
    expect(form.close).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('submit with empty selection: marker has tickRange-fallback', () => {
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => [] },
      canvasRef: () => canvas,
      toast,
    });
    controller.onHotkey();
    form.emitSubmit({ text: 'general issue', severity: 'info', category: 'general', captureScreenshot: false });
    const callArgs = recording.addMarker.mock.calls[0][0];
    expect(callArgs.refs.entities).toBeUndefined();
    expect(callArgs.refs.tickRange).toEqual({ from: 42, to: 42 });
    controller.dispose();
  });

  it('submit with screenshot: attaches PNG bytes + populates marker.attachments', () => {
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => [] },
      canvasRef: () => canvas,
      toast,
    });
    controller.onHotkey();
    form.emitSubmit({ text: 'screenshot test', severity: 'info', category: 'general', captureScreenshot: true });
    expect(recording.attachScreenshot).toHaveBeenCalledTimes(1);
    expect(recording.addMarker).toHaveBeenCalledTimes(1);
    const callArgs = recording.addMarker.mock.calls[0][0];
    expect(callArgs.attachments).toEqual(['attachment-id-stub']);
    controller.dispose();
  });

  it('submit with screenshot but no canvas: no attachment + soft toast', () => {
    canvas = null;
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => [] },
      canvasRef: () => null,
      toast,
    });
    controller.onHotkey();
    form.emitSubmit({ text: 'no canvas', severity: 'info', category: 'general', captureScreenshot: true });
    expect(recording.attachScreenshot).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('screenshot capture unavailable (no canvas)');
    expect(recording.addMarker).toHaveBeenCalledTimes(1);
    expect(recording.addMarker.mock.calls[0][0].attachments).toBeUndefined();
    controller.dispose();
  });

  it('submit with addMarker rejection: keeps form open + showError, no resume', () => {
    recording.addMarker = vi.fn(() => { throw new Error('recorder_terminated'); });
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => [] },
      canvasRef: () => canvas,
      toast,
    });
    controller.onHotkey();
    form.emitSubmit({ text: 'fails', severity: 'info', category: 'general', captureScreenshot: false });
    expect(form.showError).toHaveBeenCalledWith('recorder rejected marker: recorder_terminated');
    expect(pauseControl.resume).not.toHaveBeenCalled();
    expect(form.close).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('cancel: resume + close (no addMarker)', () => {
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => [] },
      canvasRef: () => canvas,
      toast,
    });
    controller.onHotkey();
    form.emitCancel();
    expect(recording.addMarker).not.toHaveBeenCalled();
    expect(pauseControl.resume).toHaveBeenCalledTimes(1);
    expect(form.close).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('dispose unsubscribes form listeners', () => {
    const form = stubForm();
    const controller = createAnnotationController({
      recording: recording as never,
      pauseControl,
      form,
      worldRef: () => world,
      selection: { getSelectedEntityRefs: () => [] },
      canvasRef: () => canvas,
      toast,
    });
    controller.dispose();
    // After dispose, emit submit shouldn't reach addMarker
    form.emitSubmit({ text: 'late', severity: 'info', category: 'general', captureScreenshot: false });
    expect(recording.addMarker).not.toHaveBeenCalled();
  });
});
