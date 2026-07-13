import type {
  HudState,
  RenderState,
  SelectionState,
  SimulationDebugSnapshot,
} from '../../game/simulation/types';

// Slice 11: debug-overlay modes cycle in order via F2. The 'off' mode
// hides the overlay element entirely; every other mode requests a
// snapshot and renders a matching summary.
export type DebugOverlayMode =
  | 'off'
  | 'selection-bounds'
  | 'pathing'
  | 'fog-state'
  | 'ai-state'
  | 'perf'
  // Slice 12 Task D: visualize the delta between coarse (integer cell)
  // simulation position and the interpolated render transform so the
  // "unit simulating at A, rendering at B" class of bugs becomes easy
  // to spot live.
  | 'coarse-vs-fine';

export const DEBUG_OVERLAY_CYCLE: DebugOverlayMode[] = [
  'off',
  'selection-bounds',
  'pathing',
  'fog-state',
  'ai-state',
  'perf',
  'coarse-vs-fine',
];

// Slice 11: debug-overlay host. Owns the F2 key listener, cycle pointer,
// and DOM text summary for each mode.
export interface DebugOverlayHandle {
  getMode(): DebugOverlayMode;
  cycleMode(): DebugOverlayMode;
  render(
    hudState: HudState,
    selectionState: SelectionState,
    renderState: RenderState | null,
    getSnapshot: () => SimulationDebugSnapshot,
  ): void;
  destroy(): void;
}

export function createDebugOverlayController(
  debugOverlay: HTMLElement | null,
): DebugOverlayHandle {
  let debugOverlayMode: DebugOverlayMode = 'off';

  function applyMode(): void {
    if (!debugOverlay) {
      return;
    }
    debugOverlay.dataset.hudDebugMode = debugOverlayMode;
  }

  function cycleMode(): DebugOverlayMode {
    const currentIndex = DEBUG_OVERLAY_CYCLE.indexOf(debugOverlayMode);
    const next = DEBUG_OVERLAY_CYCLE[(currentIndex + 1) % DEBUG_OVERLAY_CYCLE.length];
    debugOverlayMode = next;
    applyMode();
    return debugOverlayMode;
  }

  // Slice 11: F2 toggles the debug overlay through its cycle. The listener
  // attaches to window so it fires whether or not the canvas has focus.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'F2') {
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    // Iter-3 V3-23: ignore F2 when typing into a form control. Prevents
    // the overlay from toggling when the player is using the
    // save-load paste-blob textarea, the seed input, or any future
    // input fields.
    const target = event.target;
    if (
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
    cycleMode();
  };
  window.addEventListener('keydown', onKeyDown);

  // Slice 11: render a short text summary inside the debug overlay. The
  // off and selection-bounds modes leave the text empty; pathing /
  // fog-state modes show a single line with counts; ai-state and perf
  // modes show a small table.
  function render(
    hudState: HudState,
    selectionState: SelectionState,
    renderState: RenderState | null,
    getSnapshot: () => SimulationDebugSnapshot,
  ): void {
    if (!debugOverlay) {
      return;
    }

    if (debugOverlayMode === 'off') {
      debugOverlay.textContent = '';
      return;
    }

    if (debugOverlayMode === 'selection-bounds') {
      const count = selectionState.selectedEntityIds.length;
      debugOverlay.textContent = `Debug: selection-bounds (F2)\nSelected: ${count}`;
      return;
    }

    const snapshot = getSnapshot();

    if (debugOverlayMode === 'pathing') {
      debugOverlay.textContent =
        `Debug: pathing (F2)\n`
        + `Active commands: ${snapshot.unitPaths.length}`;
      return;
    }

    if (debugOverlayMode === 'fog-state') {
      const frame = renderState?.frame ?? null;
      const visible = frame?.visibleCells.length ?? 0;
      const explored = frame?.exploredCells.length ?? 0;
      const total = frame ? frame.mapWidth * frame.mapHeight : 0;
      const neverSeen = Math.max(0, total - explored);
      debugOverlay.textContent =
        `Debug: fog-state (F2)\n`
        + `Visible: ${visible}\n`
        + `Explored (not visible): ${Math.max(0, explored - visible)}\n`
        + `Never seen: ${neverSeen}`;
      return;
    }

    if (debugOverlayMode === 'ai-state') {
      const lines = ['Debug: ai-state (F2)'];
      for (const entry of snapshot.aiSummaries) {
        const targets = Object.entries(entry.villagerTargets)
          .map(([resource, count]) => `${resource}:${count}`)
          .join(' ');
        lines.push(
          `P${entry.owner} [${entry.difficulty}] ${entry.plan} attack=${entry.attackGroupSize} ${targets}`,
        );
      }
      debugOverlay.textContent = lines.join('\n');
      return;
    }

    if (debugOverlayMode === 'coarse-vs-fine') {
      // Slice 12 Task D: report how many coarse/fine transform pairs the
      // simulation exposes without introducing a second world renderer.
      debugOverlay.textContent =
        `Debug: coarse-vs-fine (F2)\n`
        + `Units tracked: ${snapshot.coarseVsFine?.length ?? 0}`;
      return;
    }

    // perf
    const tickMs = hudState.tickDurationMs.toFixed(2);
    debugOverlay.textContent =
      `Debug: perf (F2)\n`
      + `Tick: ${hudState.tick} (${tickMs}ms)\n`
      + `Entities: ${hudState.entityCount}\n`
      + `Visible entities: ${hudState.visibleEntities}`;
  }

  return {
    getMode: () => debugOverlayMode,
    cycleMode,
    render,
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
