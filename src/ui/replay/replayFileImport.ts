// Slice 4 (replay-load-and-e2e v0.1.11): wires a HUD-side file picker
// that loads an exported SessionBundle JSON file and enters replay
// mode. The picker uses a hidden <input type="file"> that the helper
// programmatically clicks; on `change`, the file is read via the Blob
// `file.text()` Promise API, parsed via `parseSessionBundleFile`, and
// either entered into replay or surfaced as a toast error.
//
// The helper mounts its own hidden input into the supplied host so the
// HUD doesn't have to allocate DOM for it. Click semantics follow the
// existing save/load file-trigger pattern (programmatic click on the
// hidden input is allowed because the user-gesture chain — the visible
// button click — is preserved).

import type { ReplayBundle, ReplayController } from '../../game/replay/ReplayController';
import { parseSessionBundleFile } from '../../game/replay/parseSessionBundleFile';

export interface ReplayFileImportConfig {
  readonly host: HTMLElement;
  readonly replayController: Pick<ReplayController, 'enterReplay'>;
  readonly toast: { showToast(text: string): void };
}

export interface ReplayFileImportHandle {
  promptForFile(): void;
  dispose(): void;
}

export function createReplayFileImport(config: ReplayFileImportConfig): ReplayFileImportHandle {
  const { host, replayController, toast } = config;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  input.dataset.testid = 'replay-file-import-input';
  host.appendChild(input);

  const handleChange = async (): Promise<void> => {
    const file = input.files?.[0];
    // Reset the input so selecting the same file twice still fires
    // change (browsers de-dupe identical selections).
    input.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      toast.showToast(`Could not read file: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    const result = parseSessionBundleFile(text);
    if (!result.ok) {
      toast.showToast(`Invalid bundle file: ${result.reason}`);
      return;
    }
    try {
      // RecordingService writes `SessionBundle<Record<string, never>>`
      // and exported JSON files share that runtime shape. Cast through
      // `unknown` to bridge the two generic instantiations — same
      // rationale as `loadCurrentSession.ts`.
      replayController.enterReplay(result.bundle as unknown as ReplayBundle);
    } catch (err) {
      toast.showToast(`Replay failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  input.addEventListener('change', handleChange);

  return {
    promptForFile(): void {
      input.click();
    },
    dispose(): void {
      input.removeEventListener('change', handleChange);
      try { host.removeChild(input); } catch { /* best-effort */ }
    },
  };
}
