// App-side audio mount (v0.3.109): builds the controller over the live
// bridge, defers AudioContext creation to the first user gesture (the
// browser autoplay rule — a context made earlier starts suspended and the
// first cue plays late or never), polls once per animation frame, and mounts
// the speaker toggle beside the idle-villager bell. One call from createApp.

import type { SimulationBridge } from '../game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../game/simulation/prototypeScenario';
import { createGameAudioController } from './gameAudioController';
import { playProceduralCue } from './proceduralVoices';
import { startAmbience, type AmbienceHandle } from './proceduralAmbience';
import { unitRole } from '../rendering/roles/unitRole';
import type { UnitType } from '../game/simulation/types';
import { IDLE_BELL_BAR_GAP_PX } from '../ui/hud/idleVillagerBell';

export interface MountedGameAudio {
  getLastHomeAttackPosition(): { x: number; y: number } | null;
  dispose(): void;
}

// The speaker toggle stacks this far above the idle-villager bell's top edge.
const BELL_GAP_PX = 10;
// Where it sits until the bell exists to stack on (the bell's own fallback is
// 190px, so this is where both sat when they were fixed viewport offsets).
const FALLBACK_BOTTOM = '244px';

// A GETTER, not the bridge: createApp swaps the bridge on save-load, and a
// captured reference would leave the horn listening to the dead world.
export function mountGameAudio(bridgeRef: () => SimulationBridge, hudRoot: HTMLElement): MountedGameAudio {
  let context: AudioContext | null = null;
  let ambience: AmbienceHandle | null = null;
  function ensureContext(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!context) {
      context = new AudioContext();
      // The ambience bed starts with the context (i.e. on the first user
      // gesture) and honours the same mute switch as the cues.
      ambience = startAmbience(context);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- pre-existing; see defect register 2026-08-31
      ambience.setMuted(controllerMutedRef());
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }
  // ensureContext runs before the controller exists on the first gesture
  // path, so the mute read is indirected through a ref set below.
  let controllerMutedRef: () => boolean = () => false;
  // The first pointer or key gesture unlocks audio for the whole session.
  const unlock = (): void => {
    ensureContext();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const controller = createGameAudioController({
    humanPlayerId: HUMAN_PLAYER_ID,
    getTick: () => bridgeRef().getHudState().tick,
    getCurrentAge: () => bridgeRef().getHudState().currentAge,
    getMatchOutcome: () => {
      const outcome = bridgeRef().getMatchState().outcome;
      return outcome === 'victory' || outcome === 'defeat' ? outcome : null;
    },
    // v0.3.217: the feed now carries WHO was hit, so the warning rule reads it
    // directly. It used to be inferred by comparing the swing's target cell
    // against every own building and villager within one cell — which could
    // never match a 4x4 building, because a building's target cell is its
    // visual centre and its render entity's is its origin, 1.5 cells apart.
    getRecentAttacks: () => bridgeRef().getRecentUnitAttacks(),
    getResearchedCount: () => {
      const rows = bridgeRef().world.getState('aoe2.researchedTechnologies') as
        | ReadonlyArray<[number, string[]]>
        | undefined;
      return new Map(rows ?? []).get(HUMAN_PLAYER_ID)?.length ?? 0;
    },
    getTownBellRings: () => bridgeRef().getTownBellRings(),
    getOrderAcks: () => bridgeRef().getOrderAcks(),
    getPrimarySelection: () => {
      const selection = bridgeRef().getSelectionState();
      const id = selection.selectedEntityId;
      if (id === null || selection.selectedKind !== 'unit') return null;
      const role = unitRole(selection.selectedEntityType as UnitType);
      return role ? { id, role } : null;
    },
    getCountdownActive: () => {
      const match = bridgeRef().getMatchState();
      return match.wonderCountdownTicks !== null || match.relicCountdownTicks !== null;
    },
    playCue: (cue) => {
      const audio = ensureContext();
      if (audio) playProceduralCue(audio, cue);
    },
    storage: window.localStorage,
  });

  // Speaker toggle, styled like the idle-villager bell and stacked ABOVE it:
  // its `bottom` is measured every frame from the bottom bar plus the bell's
  // height (the bell follows the bar the same way — idleVillagerBell.ts),
  // because a fixed viewport offset collided with the bell once the bell
  // moved with the bar.
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.hud = 'audio-mute';
  button.setAttribute('aria-label', 'Toggle sound');
  button.style.cssText = [
    'position:absolute', 'left:12px', `bottom:${FALLBACK_BOTTOM}`, 'z-index:6',
    'pointer-events:auto',
    'min-width:44px', 'min-height:44px', 'padding:4px 10px',
    'border-radius:10px', 'border:1px solid rgba(255,255,255,0.18)',
    'background:rgba(16,24,22,0.82)', 'color:#e8e4d8',
    'font:600 13px/1.2 system-ui,sans-serif', 'cursor:pointer',
  ].join(';');
  function refreshButton(): void {
    const muted = controller.isMuted();
    button.title = muted ? 'Sound off — click to unmute' : 'Sound on — click to mute';
    // Original inline-SVG speaker; a slash marks the muted state.
    button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">'
      + '<path d="M2 6h3l4-3v10l-4-3H2z" fill="#d8c9a0"/>'
      + (muted
        ? '<path d="M11 4l3 8" stroke="#c96a5a" stroke-width="1.6"/>'
        : '<path d="M11 5c1.5 1.5 1.5 4.5 0 6" stroke="#d8c9a0" stroke-width="1.4" fill="none"/>')
      + '</svg>';
  }
  refreshButton();
  controllerMutedRef = () => controller.isMuted();
  button.addEventListener('click', () => {
    controller.setMuted(!controller.isMuted());
    ambience?.setMuted(controller.isMuted());
    refreshButton();
  });
  hudRoot.appendChild(button);

  let bell: HTMLElement | null = null;
  let bar: HTMLElement | null = null;
  let lastBottom = FALLBACK_BOTTOM;
  function stackAboveBell(): void {
    // The bell mounts after the audio does, so both are looked up lazily —
    // and again if the HUD was rebuilt under a cached, now-detached one.
    if (!bell?.isConnected) bell = hudRoot.querySelector<HTMLElement>('[data-hud="idle-villager-bell"]');
    if (!bar?.isConnected) bar = hudRoot.querySelector<HTMLElement>('.hud-bottom');
    if (!bell || !bar) return;
    // Measured from the BAR exactly as the bell measures itself, plus the
    // bell's height: reading the bell's position instead would lag it by a
    // frame on every bar change, because this loop registered first.
    const clearance = hudRoot.getBoundingClientRect().bottom - bar.getBoundingClientRect().top
      + bell.getBoundingClientRect().height;
    const bottom = `${Math.round(clearance) + IDLE_BELL_BAR_GAP_PX + BELL_GAP_PX}px`;
    if (bottom !== lastBottom) {
      lastBottom = bottom;
      button.style.bottom = bottom;
    }
  }

  let rafHandle: number | null = null;
  function loop(): void {
    stackAboveBell();
    controller.poll();
    ambience?.tick(performance.now());
    rafHandle = requestAnimationFrame(loop);
  }
  rafHandle = requestAnimationFrame(loop);

  return {
    getLastHomeAttackPosition: () => controller.getLastHomeAttackPosition(),
    dispose(): void {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      button.remove();
      ambience?.dispose();
      void context?.close();
    },
  };
}
