// @vitest-environment jsdom
// Work 142 review round 3: the key handler's card is the SELECTION's, and the
// panel it presses is redrawn for that selection first. The HUD redraws the
// panel a frame after a click, so without the redraw a key pressed in between
// searched the old card's buttons and was lost (H then Q trained nothing).
// A Fishing Ship's palette is not a villager's card. Until work 142 M2b-1 its
// A kept attack-move; DE's Fishing Ship is a civilian, whose card builds the
// Fish Trap on Q at once and has no attack-move, so this case now holds that.
// The browser contracts are `tests/browser/de-command-card-keys.spec.ts` and
// `de-military-card-keys.spec.ts`; this pins the frame between.

import { describe, expect, it, vi } from 'vitest';

import { registerCommandCardHotkeys } from '../../src/app/bootstrap/commandCardHotkeys';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Selection = {
  selectedEntityIds: number[];
  selectedEntityType: string | null;
  buildOptions: string[];
  stanceOptions?: string[];
  /** The primary's building, for a group of buildings with no shared type. */
  primaryBuilding?: string;
};

// The cards below that are buildings'; the handler finds the card's building
// by the primary selected entity, among the economy's buildings.
const BUILDING_CARDS: ReadonlySet<string> = new Set(['town-center', 'university']);
const cardOf = (selection: Selection): string => selection.primaryBuilding ?? selection.selectedEntityType ?? '';

// What the HUD would draw for each selection's card.
const CARDS: Readonly<Record<string, string>> = {
  'town-center': '<button data-command="train-villager">Train Villager</button>',
  'fishing-ship': '<button data-command="build-fish-trap">Fish Trap</button>',
  scout: '<button data-command="stance-aggressive">Aggressive</button><button data-command="stance-defensive">Defensive</button>',
  // Two tiers of one slot, the first locked (work 142 M2b-2).
  university: '<button data-command="research-chemistry" disabled>Chemistry</button>'
    + '<button data-command="research-bombard-tower-unlock">Bombard Tower</button>',
};

type Unit = { id: number; owner: number; unitType: string };

function harness(initial: Selection, units: Unit[] = []) {
  let selection = initial;
  const handlers = new Map<string, () => void>();
  const hudRoot = document.createElement('div');
  hudRoot.innerHTML = '<div class="hud-panel hud-panel--selection"></div>';
  document.body.appendChild(hudRoot);
  const panel = hudRoot.querySelector('.hud-panel--selection')!;
  const view = { armAttackMove: vi.fn(), armPatrol: vi.fn(), armAttackGround: vi.fn() };
  const pressed = vi.fn();
  // What the HUD would draw for the selection, but only when asked to.
  const draw = (): void => {
    panel.innerHTML = CARDS[cardOf(selection)]
      ?? '<button data-build-page="economic" aria-pressed="true">Eco</button>';
    panel.querySelectorAll<HTMLElement>('[data-command]').forEach((button) => {
      button.addEventListener('click', () => { pressed(button.dataset.command); });
    });
  };
  draw();
  const syncSelectionPanel = vi.fn(draw);
  registerCommandCardHotkeys({
    hotkeyRegistry: { register: (spec, handler) => { handlers.set(spec.key, handler); } },
    view,
    bridgeRef: () => ({
      getSelectionState: () => ({
        stanceOptions: [],
        selectedKind: BUILDING_CARDS.has(cardOf(selection)) ? 'building' : 'unit',
        selectedEntityId: selection.selectedEntityIds[0] ?? null,
        ...selection,
      }),
      getEconomyState: () => ({
        units,
        buildings: BUILDING_CARDS.has(cardOf(selection))
          ? [{ id: selection.selectedEntityIds[0], owner: 1, buildingType: cardOf(selection) }]
          : [],
      }),
    }) as unknown as SimulationBridge,
    hudRoot,
    syncSelectionPanel,
  });
  return {
    press: (key: string) => handlers.get(key)!(),
    select: (next: Selection) => { selection = next; },
    view,
    pressed,
  };
}

const VILLAGER: Selection = { selectedEntityIds: [5], selectedEntityType: 'villager', buildOptions: ['house'] };

describe('command-card keys read the card of the selection (work 142)', () => {
  it('trains a Villager on Q right after the Town Center is selected, before the HUD redraws', () => {
    const app = harness(VILLAGER);
    app.select({ selectedEntityIds: [9], selectedEntityType: 'town-center', buildOptions: [] });
    app.press('q');
    expect(app.pressed.mock.calls).toEqual([['train-villager']]);
  });

  it('builds a Fishing Ship\'s Fish Trap on Q at once, and arms nothing on its A', () => {
    const app = harness({ selectedEntityIds: [7], selectedEntityType: 'fishing-ship', buildOptions: ['fish-trap'] });
    app.press('a');
    app.press('q');
    expect(app.pressed.mock.calls).toEqual([['build-fish-trap']]);
    expect(app.view.armAttackMove).not.toHaveBeenCalled();
  });

  it('sets a Scout\'s stance on S right after the Scout is selected, before the HUD redraws', () => {
    const app = harness(VILLAGER);
    app.select({
      selectedEntityIds: [3],
      selectedEntityType: 'scout',
      buildOptions: [],
      stanceOptions: ['aggressive', 'defensive', 'stand-ground', 'no-attack'],
    });
    app.press('s');
    expect(app.pressed.mock.calls).toEqual([['stance-defensive']]);
    app.press('r');
    expect(app.view.armAttackMove).toHaveBeenCalledTimes(1);
  });

  // Work 142 M2b-2: DE's slot shows one tier of a line, the one the player can
  // take; this card can draw a locked tier beside it, and a key passes it over.
  it('presses the first button on a building\'s key that is not locked', () => {
    const app = harness({ selectedEntityIds: [11], selectedEntityType: 'university', buildOptions: [] });
    app.press('t');
    expect(app.pressed.mock.calls).toEqual([['research-bombard-tower-unlock']]);
  });

  // Review round 9 (Codex): a group of buildings of several types, every
  // military building on Ctrl+Shift+Space, has no shared type; its card is
  // the primary building's, and its keys press that card's buttons.
  it('presses the primary building\'s card for a group of buildings with no shared type', () => {
    const app = harness({ selectedEntityIds: [9, 11], selectedEntityType: null, buildOptions: [], primaryBuilding: 'town-center' });
    app.press('q');
    expect(app.pressed.mock.calls).toEqual([['train-villager']]);
  });

  // Review round 5 (Codex): a Mangonel converted while selected stays in the
  // selection, beside the player's Scout that keeps the military card; T is
  // Attack Ground only for a unit of the player's that may attack the ground.
  it('arms attack-ground on T for the player\'s Mangonel, and not for one an enemy converted', () => {
    const soldiers: Selection = {
      selectedEntityIds: [3, 4],
      selectedEntityType: null,
      buildOptions: [],
      stanceOptions: ['aggressive', 'defensive', 'stand-ground', 'no-attack'],
    };
    const converted = harness(soldiers, [
      { id: 3, owner: 1, unitType: 'scout' },
      { id: 4, owner: 2, unitType: 'mangonel' },
    ]);
    converted.press('t');
    expect(converted.view.armAttackGround).not.toHaveBeenCalled();
    const own = harness(soldiers, [
      { id: 3, owner: 1, unitType: 'scout' },
      { id: 4, owner: 1, unitType: 'mangonel' },
    ]);
    own.press('t');
    expect(own.view.armAttackGround).toHaveBeenCalledTimes(1);
  });
});
