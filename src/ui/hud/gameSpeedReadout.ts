// The top bar's game speed (work 149, spec §4.5): DE's game-time display shows
// the current speed in brackets with the clock, so the Time chip does too. It
// is written at boot, on every press of the numpad's speed keys, and when a
// replay starts or ends; a replay plays at its own pace, so it hides there.

import { formatGameSpeed } from '../../game/simulation/matchOptions';

export function showGameSpeed(root: ParentNode, multiplier: number, replaying: boolean): void {
  const readout = root.querySelector<HTMLElement>('[data-hud="speed"]');
  if (!readout) return;
  readout.textContent = formatGameSpeed(multiplier);
  readout.hidden = replaying;
}
