import type { AoeVoxelGameView } from '../AoeVoxelGameView';
import type { EngineHaltDetails } from '../../game/simulation/types';
import { createEngineHaltNotice, type EngineHaltNotice } from '../../ui/hud/engineHaltNotice';

// Puts a stopped match in front of the player. Two things can stop one, and
// before this both were silent:
//
//  1. A throw inside the view's animation-frame callback. `AoeVoxelGameView`
//     now catches it, stops stepping, and reports it here (`onFrameHalt`).
//  2. The engine reporting a tick failure. The bridge has always caught that
//     and parked it on `HudState.engineHalted`, but nothing in the UI read the
//     field — the HUD kept drawing a live-looking match over a dead world.
//
// The engine-side half is polled rather than pushed because the only cheap
// push seam is inside the bridge, which this lane does not own, and because
// `getHudState()` is not cheap enough to call an extra time per frame (it
// projects the whole render state). A halt is permanent, so a poll that is
// slower than the eye is enough — the player learns within half a second.
const ENGINE_HALT_POLL_MS = 500;

export interface EngineHaltSurfaceOptions {
  readonly hudRoot: HTMLElement | null;
  readonly view: Pick<AoeVoxelGameView, 'onFrameHalt'>;
  readonly getEngineHalted: () => EngineHaltDetails | null;
  /** Overridable so tests do not reload the page under themselves. */
  readonly onReload?: () => void;
  readonly pollIntervalMs?: number;
}

export interface EngineHaltSurface {
  readonly notice: EngineHaltNotice;
  dispose(): void;
}

function describeEngineHalt(halt: EngineHaltDetails): string {
  const where = halt.systemName ? `system ${halt.systemName}` : `phase ${halt.phase}`;
  return `${where} (${halt.code})`;
}

export function mountEngineHaltSurface(options: EngineHaltSurfaceOptions): EngineHaltSurface {
  const notice = createEngineHaltNotice(
    options.hudRoot,
    options.onReload ?? (() => { window.location.reload(); }),
  );

  const unsubscribe = options.view.onFrameHalt((halt) => {
    notice.show({ source: 'frame', message: halt.message });
  });

  const poll = (): void => {
    if (notice.isShown()) return;
    let halted: EngineHaltDetails | null = null;
    try {
      halted = options.getEngineHalted();
    } catch (error) {
      // Reading the halt must never become a second way to break the page.
      console.error('[aoe2] could not read the engine halt state', error);
      return;
    }
    if (!halted) return;
    notice.show({
      source: 'engine',
      message: halted.message,
      tick: halted.tick,
      detail: describeEngineHalt(halted),
    });
  };

  const timer = window.setInterval(poll, options.pollIntervalMs ?? ENGINE_HALT_POLL_MS);

  return {
    notice,
    dispose(): void {
      window.clearInterval(timer);
      unsubscribe();
      notice.destroy();
    },
  };
}
