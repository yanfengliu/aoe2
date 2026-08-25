// App-side audio mount (v0.3.109): builds the controller over the live
// bridge, defers AudioContext creation to the first user gesture (the
// browser autoplay rule — a context made earlier starts suspended and the
// first cue plays late or never), polls once per animation frame, and mounts
// the speaker toggle beside the idle-villager bell. One call from createApp.

import type { SimulationBridge } from '../game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../game/simulation/prototypeScenario';
import { createGameAudioController } from './gameAudioController';
import { playProceduralCue } from './proceduralVoices';

export interface MountedGameAudio {
  dispose(): void;
}

// A GETTER, not the bridge: createApp swaps the bridge on save-load, and a
// captured reference would leave the horn listening to the dead world.
export function mountGameAudio(bridgeRef: () => SimulationBridge, hudRoot: HTMLElement): MountedGameAudio {
  let context: AudioContext | null = null;
  function ensureContext(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  }
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
    getRecentAttacks: () => bridgeRef().getRecentUnitAttacks(),
    getOwnTownEntities: () =>
      bridgeRef().getRenderState().entities.filter(
        (entity) =>
          entity.owner === HUMAN_PLAYER_ID
          && !entity.isMemory
          && (entity.kind === 'building' || entity.entityType === 'villager'),
      ),
    getResearchedCount: () => {
      const rows = bridgeRef().world.getState('aoe2.researchedTechnologies') as
        | ReadonlyArray<[number, string[]]>
        | undefined;
      return new Map(rows ?? []).get(HUMAN_PLAYER_ID)?.length ?? 0;
    },
    getTownBellRings: () => bridgeRef().getTownBellRings(),
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

  // Speaker toggle, styled and placed like the idle-villager bell's sibling.
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.hud = 'audio-mute';
  button.setAttribute('aria-label', 'Toggle sound');
  button.style.cssText = [
    'position:absolute', 'left:12px', 'bottom:244px', 'z-index:6',
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
  button.addEventListener('click', () => {
    controller.setMuted(!controller.isMuted());
    refreshButton();
  });
  hudRoot.appendChild(button);

  let rafHandle: number | null = null;
  function loop(): void {
    controller.poll();
    rafHandle = requestAnimationFrame(loop);
  }
  rafHandle = requestAnimationFrame(loop);

  return {
    dispose(): void {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      button.remove();
      void context?.close();
    },
  };
}
