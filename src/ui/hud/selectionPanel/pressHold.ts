// A press of the main mouse button inside the selection panel, from the press
// to its release (work 146 M2).
//
// WHY. The panel draws itself again whenever the selection's state changes,
// and a building's queue moves on every tick, so it redrew 15 times a second
// while a Town Center trained (measured on v0.3.272, a lobby-default match at
// 1280x720). A press and a release on two drawings of one button are no click,
// so a click held for 60 ms on Train Villager queued nothing, and a quick one
// (press and release in one frame) did: a player's click on the card was lost
// while it trained, and a click on the group panel's icons would be lost while
// its units fought. The panel holds such a redraw while a press lasts
// (`selectionPanel.ts`); a change of what is selected is drawn at once.
//
// The release is read on the document, in the capture phase, so it is seen
// before the click it makes and wherever the pointer is let go; a move with the
// button up, and the window losing focus, release a press whose release the
// page never saw.

export interface PanelPress {
  /** True from a main-button press inside the panel until its release. */
  readonly held: boolean;
  dispose(): void;
}

export function trackPanelPress(panel: HTMLElement): PanelPress {
  const doc = panel.ownerDocument;
  const view = doc.defaultView;
  let held = false;
  const press = (event: MouseEvent): void => {
    if (event.button === 0) held = true;
  };
  const release = (): void => {
    held = false;
  };
  const move = (event: MouseEvent): void => {
    if ((event.buttons & 1) === 0) held = false;
  };
  panel.addEventListener('pointerdown', press);
  doc.addEventListener('pointerup', release, true);
  doc.addEventListener('pointercancel', release, true);
  doc.addEventListener('pointermove', move, true);
  view?.addEventListener('blur', release);
  return {
    get held() {
      return held;
    },
    dispose() {
      panel.removeEventListener('pointerdown', press);
      doc.removeEventListener('pointerup', release, true);
      doc.removeEventListener('pointercancel', release, true);
      doc.removeEventListener('pointermove', move, true);
      view?.removeEventListener('blur', release);
    },
  };
}
