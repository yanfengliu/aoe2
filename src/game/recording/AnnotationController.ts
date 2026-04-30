// Spec 2 (annotation-ui v0.1.5) AO-10: AnnotationController orchestrates
// the human marker-emission gesture per DESIGN §6:
//
//   Player hits Alt+M
//     → reads bridge.getSelectedEntityRefs()
//     → builds MarkerRefs (entities or tickRange-fallback)
//     → pauseControl.pause()
//     → form.open(refs)
//     → on save:
//         capture screenshot if requested → attachScreenshot → attachmentId
//         recording.addMarker({ ... })
//         pauseControl.resume()
//         form.close()
//     → on cancel:
//         pauseControl.resume()
//         form.close()
//
// Hotkey suppression for text-input focus is handled by HotkeyRegistry,
// so onHotkey() runs only when the chord is actually delivered.

import type { EntityRef, World } from 'civ-engine';

import {
  type AoeMarkerData,
  selectionToRefs,
  captureScreenshot,
} from '../annotations';
import type { PauseControl } from '../control/PauseControl';
import type { RecordingService } from './RecordingService';
import type {
  AnnotationFormSubmission,
  AnnotationFormView,
} from '../../ui/annotation/AnnotationForm';

export interface AnnotationControllerConfig {
  readonly recording: RecordingService;
  readonly pauseControl: PauseControl;
  readonly form: AnnotationFormView;
  readonly worldRef: () => World;
  readonly selection: { getSelectedEntityRefs(): readonly EntityRef[] };
  /** Returns the canvas to capture for screenshot attachments. May
   *  return null if no canvas is mounted yet (then the screenshot
   *  checkbox is silently ignored and a toast is surfaced). */
  readonly canvasRef: () => HTMLCanvasElement | null;
  /** Toast surface for soft-failure messages (capture failed, recorder
   *  rejected the marker, etc.). */
  readonly toast: { showToast(text: string): void };
}

export interface AnnotationController {
  /** Hotkey handler (Alt+M). Reads selection, opens the form, pauses
   *  the game. No-op if recording is not started. */
  onHotkey(): void;
  /** Test/dispose hook. Unsubscribes from form events. */
  dispose(): void;
}

export function createAnnotationController(
  config: AnnotationControllerConfig,
): AnnotationController {
  const { recording, pauseControl, form, worldRef, selection, canvasRef, toast } = config;
  let formIsOpen = false;
  // FR-1 review fix (Codex MAJOR): refs are captured at hotkey time —
  // the selection at the moment Alt+M fires becomes the marker's anchored
  // entities. The user may click around in the form / minimap / etc.
  // without changing what the marker points to. Snapshot here, consume
  // in handleSubmit.
  let pendingRefs: { entities?: EntityRef[]; tickRange?: { from: number; to: number } } | null = null;

  const buildRefsFromSelection = (
    currentTick: number,
  ): { entities?: EntityRef[]; tickRange?: { from: number; to: number } } => {
    const refs = selection.getSelectedEntityRefs();
    const result = selectionToRefs(refs, currentTick);
    // civ-engine's MarkerRefs.entities is mutable EntityRef[]; our
    // SelectionAwareRefs.entities is readonly. Convert at the boundary
    // (the recorder defensively-clones the array anyway).
    return {
      ...(result.entities !== undefined ? { entities: result.entities.slice() } : {}),
      ...(result.tickRange !== undefined ? { tickRange: result.tickRange } : {}),
    };
  };

  const handleSubmit = (input: AnnotationFormSubmission): void => {
    if (!pendingRefs) {
      // Defensive: form fired submit without an Alt+M open. Shouldn't
      // happen given onHotkey gates, but guard against future regression.
      toast.showToast('annotation form: no pending refs (internal error)');
      return;
    }
    const refs = pendingRefs;

    let attachmentId: string | undefined;
    if (input.captureScreenshot) {
      const canvas = canvasRef();
      if (canvas !== null) {
        try {
          const bytes = captureScreenshot(canvas);
          attachmentId = recording.attachScreenshot(bytes);
        } catch (err) {
          toast.showToast(
            `screenshot capture failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          // Continue without attachment.
        }
      } else {
        toast.showToast('screenshot capture unavailable (no canvas)');
      }
    }

    const data: AoeMarkerData = {
      author: 'human',
      severity: input.severity,
      category: input.category,
    };

    try {
      recording.addMarker({
        kind: 'annotation',
        text: input.text,
        refs,
        data,
        ...(attachmentId !== undefined ? { attachments: [attachmentId] } : {}),
      });
    } catch (err) {
      // Recorder rejected — surface in the form (text preserved) and
      // do NOT resume the game. User cancels to escape.
      const message = err instanceof Error ? err.message : String(err);
      form.showError(`recorder rejected marker: ${message}`);
      return;
    }

    // Success path: resume + close + clear pending.
    pendingRefs = null;
    pauseControl.resume();
    form.close();
    formIsOpen = false;
  };

  const handleCancel = (): void => {
    pendingRefs = null;
    pauseControl.resume();
    form.close();
    formIsOpen = false;
  };

  const unsubmitSubscribe = form.onSubmit(handleSubmit);
  const unsubcancelSubscribe = form.onCancel(handleCancel);

  return {
    onHotkey(): void {
      if (!recording.isRecording()) {
        toast.showToast('recording not ready');
        return;
      }
      if (formIsOpen) {
        // Already open — re-fire focus instead of stacking.
        form.open();
        return;
      }
      // FR-1 fix: snapshot the selection NOW (at hotkey time), not at
      // submit. Stored in `pendingRefs` for handleSubmit to consume.
      pendingRefs = buildRefsFromSelection(worldRef().tick);
      pauseControl.pause();
      form.open();
      formIsOpen = true;
    },

    dispose(): void {
      unsubmitSubscribe();
      unsubcancelSubscribe();
    },
  };
}
