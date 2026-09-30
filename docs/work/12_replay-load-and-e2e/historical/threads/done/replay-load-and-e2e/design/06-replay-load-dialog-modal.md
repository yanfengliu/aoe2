# Slice 5 — ReplayLoadDialog modal (v0.1.12)

## Goal

Unify the three replay-load entry points into one modal, with a clear default source and a single dismiss path. After this slice, the slice-2/3/4 standalone buttons can stay (for power users who already learned them) OR be folded into the dialog — final UX call deferred to slice-5 implementation review.

## User-visible changes

- A single "Replay…" button in the HUD opens `ReplayLoadDialog`.
- Dialog has three tabs: "Live session", "Prior session", "From file".
- Each tab is essentially the corresponding slice-2/3/4 surface, presented inside a modal.
- Default tab on open: "Live session" if `recording.bundle()` is non-null and has payloads; else "Prior session" if listPriorSessions returns ≥ 1; else "From file".
- Dismiss: Escape, click on backdrop, or explicit "Cancel" button.

## Surface changes

- New `src/ui/replay/ReplayLoadDialog.ts` exporting `createReplayLoadDialog({ replayController, recording, toast })`. Returns `{ open(): Promise<void>; close(): void; isOpen(): boolean; mount(host: HTMLElement): void; dispose(): void }`.
- HUD wiring: `createHudController` adds `replayDialog?: { open(): void }` callback for the HUD button to invoke.
- The dialog closes itself after a successful enterReplay. The TimelinePanel handles the rest of the replay UX (already wired in v0.1.7).

## Test contract

`tests/replay/ReplayLoadDialog.test.ts` (NEW, jsdom):
1. `open()` mounts the modal DOM with three tab buttons; default tab is determined by the order above.
2. Selecting "Prior session" tab calls `recording.listPriorSessions()` and renders rows; clicking a row's Replay button enters replay and closes the dialog.
3. Selecting "From file" shows the file picker UI.
4. Pressing Escape calls `close()` without entering replay.
5. After successful enterReplay, the dialog closes automatically.
6. While `replayController.mode === 'replay'`, attempting to `open()` is a no-op (defensive).

## Risks and mitigations

- **Focus trap:** the modal must trap keyboard focus so Tab cycles within the dialog. Implement using `dialog`'s native `<dialog>` element with `showModal()` (browser-supported in modern Chromium/Firefox/Safari) — this gives focus trap + backdrop + Escape dismissal for free.
- **Background polling continues while modal is open:** acceptable. The MarkerListPanel poll interval is 1s; modal interactions are user-driven and won't conflict.
- **Tabs duplicate slice-2/3/4 logic:** to avoid duplication, the dialog tabs delegate to the same helpers (`loadCurrentSessionAsReplay`, the prior-session loader, `parseSessionBundleFile` + the file-import flow). The dialog provides only the modal shell + tab switcher.

## Out of scope

- Drag-and-drop of bundle files onto the dialog. Native file picker is sufficient for v1.
- Mobile-friendly modal layout. Desktop-first; follow-up slice if user feedback requests it.
