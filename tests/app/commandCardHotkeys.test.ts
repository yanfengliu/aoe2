// @vitest-environment jsdom
// Work 142 review round 3: the key handler's card is the SELECTION's, and the
// panel it presses is redrawn for that selection first. The HUD redraws the
// panel a frame after a click, so without the redraw a key pressed in between
// searched the old card's buttons and was lost (H then Q trained nothing).
// A Fishing Ship's palette is not a villager's card: its A keeps attack-move
// until work 142 M2b gives its card DE's keys. The browser contract is
// `tests/browser/de-command-card-keys.spec.ts`; this pins the frame between.

import { describe, expect, it, vi } from 'vitest';

import { registerCommandCardHotkeys } from '../../src/app/bootstrap/commandCardHotkeys';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Selection = { selectedEntityIds: number[]; selectedEntityType: string | null; buildOptions: string[] };

function harness(initial: Selection) {
  let selection = initial;
  const handlers = new Map<string, () => void>();
  const hudRoot = document.createElement('div');
  hudRoot.innerHTML = '<div class="hud-panel hud-panel--selection"></div>';
  document.body.appendChild(hudRoot);
  const panel = hudRoot.querySelector('.hud-panel--selection')!;
  const view = { armAttackMove: vi.fn(), armPatrol: vi.fn(), armAttackGround: vi.fn() };
  const trained = vi.fn();
  // What the HUD would draw for the selection, but only when asked to.
  const draw = (): void => {
    panel.innerHTML = selection.selectedEntityType === 'town-center'
      ? '<button data-command="train-villager">Train Villager</button>'
      : '<button data-build-page="economic" aria-pressed="true">Eco</button>';
    panel.querySelector('[data-command="train-villager"]')?.addEventListener('click', trained);
  };
  draw();
  const syncSelectionPanel = vi.fn(draw);
  registerCommandCardHotkeys({
    hotkeyRegistry: { register: (spec, handler) => { handlers.set(spec.key, handler); } },
    view,
    bridgeRef: () => ({ getSelectionState: () => selection }) as unknown as SimulationBridge,
    hudRoot,
    syncSelectionPanel,
  });
  return {
    press: (key: string) => handlers.get(key)!(),
    select: (next: Selection) => { selection = next; },
    view,
    trained,
  };
}

describe('command-card keys read the card of the selection (work 142)', () => {
  it('trains a Villager on Q right after the Town Center is selected, before the HUD redraws', () => {
    const app = harness({ selectedEntityIds: [5], selectedEntityType: 'villager', buildOptions: ['house'] });
    app.select({ selectedEntityIds: [9], selectedEntityType: 'town-center', buildOptions: [] });
    app.press('q');
    expect(app.trained).toHaveBeenCalledTimes(1);
  });

  it('keeps attack-move on A for a Fishing Ship, whose palette is not a villager\'s card', () => {
    const app = harness({ selectedEntityIds: [7], selectedEntityType: 'fishing-ship', buildOptions: ['fish-trap'] });
    app.press('a');
    expect(app.view.armAttackMove).toHaveBeenCalledTimes(1);
  });
});
