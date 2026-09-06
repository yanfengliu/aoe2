// GATE — "an unavailable command names what is missing" (2026-09-06).
//
// The defect it was written for, measured by PLAYING the game on
// `aoe2-prototype`: the Town Center's "Research Feudal Age" sat disabled
// while its own tooltip read "Research Feudal Age. Cost: 500 food; takes
// 130s." and the player held 1,295 food. A disabled control can never be
// clicked, so the rejection toast that carries the real reason never
// fires — the reason was unreachable from inside the game. A play session
// spent 38 minutes in the Dark Age over it.
//
// What this holds is the CLASS, not that one button: every command the
// command card draws unusable must carry a sentence naming the missing
// thing. Reintroducing the defect means dropping the reason (or letting it
// degrade to a bare refusal), and each `toContain` below is what goes red.
//
// BOUND — what this test does NOT prove.
//   * It reads the BRIDGE's `selectionState.unavailableCommands`, not the
//     DOM. That the panel puts each reason on the matching control, and
//     that a DISABLED button still surfaces one on hover, is
//     `tests/browser/command-refusal-reason.spec.ts`; neither test covers
//     the other's half.
//   * Four of the five command kinds, at tick 0 of three shipped
//     scenarios plus two short drains: research blocked by a BUILDING
//     prerequisite and by a TECHNOLOGY prerequisite, research / train /
//     build blocked by a PRICE, and a market trade blocked by a price.
//     `action`, `stance` and `formation` are never drawn unusable today,
//     so nothing here covers them.
//   * Only the human player's own commands — the panel draws buttons for
//     nobody else — and only a SELECTED entity, because that is the only
//     card there is. Nothing here reads another player's options.
//   * The reasons name RESOURCES and BUILDINGS, never a shortfall figure
//     — see commandAvailability.ts on why the number is deliberately
//     absent — so a test asserting "short by 205 food" would be asserting
//     something this design does not promise.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { SelectionState } from '../../src/game/simulation/types';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
} from './createSimulationBridge.helpers';

function reasonFor(state: SelectionState, command: string): string | undefined {
  return state.unavailableCommands.find(
    (entry) => `${entry.kind}-${entry.id}` === command,
  )?.reason;
}

describe('an unavailable command names what is missing', () => {
  it('says which BUILDINGS the age-up wants, with the food already in hand', () => {
    // The reported defect's exact shape: the food is there (700 against a
    // 500 cost) and one qualifying Dark Age building is not.
    const bridge = createSimulationBridge('feudal-missing-prereq-fixture');
    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);

    const state = bridge.getSelectionState();
    // The button is drawn and refuses — the state the player was looking at.
    expect(state.visibleResearchOptions).toContain('feudal-age');
    expect(state.researchOptions).not.toContain('feudal-age');
    expect(bridge.getHudState().playerResources.food).toBeGreaterThan(500);

    const reason = reasonFor(state, 'research-feudal-age');
    expect(reason).toBeDefined();
    // It NAMES the rule, the count, and every building that would satisfy
    // it — not merely "unavailable".
    expect(reason).toContain('2 completed Dark Age buildings');
    expect(reason).toContain('Barracks');
    expect(reason).toContain('Dock');
    expect(reason).toContain('Lumber Camp');
    expect(reason).toContain('Mill');
    expect(reason).toContain('Mining Camp');
    // And it says how far along the player already is.
    expect(reason).toContain('You have 1.');
    // The one thing it must NOT blame is the resource the player has
    // plenty of — that is the misdirection the defect consisted of.
    expect(reason).not.toContain('food');
  });

  it('keeps naming the PREREQUISITE even once the price is also unmet', () => {
    // Ordering is the contract: a rule outranks a price, exactly as the
    // queue.research validator checks options before affordability. Drain
    // the food below the age-up cost and the answer must not change to
    // "not enough food", which would send the player to gather instead of
    // to build.
    const bridge = createSimulationBridge('feudal-missing-prereq-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);

    // 700 food, 50 a villager: queue until the stockpile cannot pay for
    // one. The charge lands at the start of the next step.
    for (let index = 0; index < 20; index += 1) {
      bridge.queueTrainUnit('villager');
      bridge.step(100);
      if (bridge.getHudState().playerResources.food < 50) break;
    }
    expect(bridge.getHudState().playerResources.food).toBeLessThan(50);

    const state = bridge.getSelectionState();
    expect(reasonFor(state, 'research-feudal-age')).toContain('Dark Age buildings');
    // ...and the command that IS only a price says so, by resource name.
    expect(reasonFor(state, 'train-villager')).toBe('Not enough food.');
  });

  it('names every resource a BUILD card is short of', () => {
    // A base whose wood, gold and stone are all gone (the 2026-08-24 late
    // -game freeze fixture) — so a villager's palette is a row of cards
    // that all refuse, and a Castle refuses on two counts at once.
    const bridge = createSimulationBridge('exhausted-resources-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);

    const state = bridge.getSelectionState();
    expect(state.buildOptions).toContain('house');
    expect(reasonFor(state, 'build-house')).toBe('Not enough wood.');
    // A Town Center is short on BOTH halves of its price, and the answer
    // names both rather than stopping at the first.
    expect(state.buildOptions).toContain('town-center');
    expect(reasonFor(state, 'build-town-center')).toBe('Not enough wood and stone.');
    // Nothing is affordable here, so every drawn card carries a reason.
    for (const buildingType of state.buildOptions) {
      expect(reasonFor(state, `build-${buildingType}`)).toContain('Not enough');
    }
  });

  it('names the resource a RESEARCH is short of, and the rule when it is a rule', () => {
    const bridge = createSimulationBridge('exhausted-resources-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);

    const state = bridge.getSelectionState();
    // Wheelbarrow is offered (Castle Age, no building prerequisite) and
    // costs wood this base does not have.
    expect(state.researchOptions).toContain('wheelbarrow');
    expect(reasonFor(state, 'research-wheelbarrow')).toBe('Not enough wood.');
    // The next age is a RULE, and is answered as one even here.
    expect(state.visibleResearchOptions).toContain('imperial-age');
    const imperial = reasonFor(state, 'research-imperial-age');
    expect(imperial).toContain('2 completed Castle Age buildings');
    expect(imperial).toContain('Castle');
    // §7.2's alternative route is named too, so a player with a Castle
    // nearly finished is not sent off to build something else.
    expect(imperial).toContain('one completed Castle');

    // And the one technology-on-technology gate the card ever draws as a
    // locked button NAMES the research it waits on. It read "needs a later
    // age or an earlier upgrade" until this was written, which is the bare
    // -refusal shape the whole change exists to remove.
    expect(state.visibleResearchOptions).toContain('town-patrol');
    expect(state.researchOptions).not.toContain('town-patrol');
    expect(reasonFor(state, 'research-town-patrol')).toBe(
      'Needs Town Watch researched here first.',
    );
  });

  it('says nothing about a command that works, or about another player', () => {
    const bridge = createSimulationBridge('feudal-missing-prereq-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    // Loom is researchable and affordable at this Town Center.
    expect(bridge.getSelectionState().researchOptions).toContain('loom');
    expect(reasonFor(bridge.getSelectionState(), 'research-loom')).toBeUndefined();

    // And a selection whose every command works produces no reasons at
    // all — the list must not fill with noise a player would learn to
    // ignore. This villager can afford its whole palette (375 wood
    // against a 175-wood Barracks, its dearest card).
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const villager = bridge.getSelectionState();
    expect(villager.buildOptions.length).toBeGreaterThan(0);
    expect(villager.unavailableCommands).toEqual([]);
  });

  it('names the gold a market trade needs, and quotes the price', () => {
    // Trading drains the gold it costs, so the Market is the one kind that
    // needs a drain to reach its refusal.
    const bridge = createSimulationBridge('building-showcase-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);
    expect(bridge.getSelectionState().marketOptions).toContain('buy-food');

    for (let index = 0; index < 30; index += 1) {
      if (reasonFor(bridge.getSelectionState(), 'market-buy-food') !== undefined) break;
      bridge.issueMarketAction('buy-food');
      bridge.step(100);
    }

    const reason = reasonFor(bridge.getSelectionState(), 'market-buy-food');
    expect(reason).toBeDefined();
    expect(reason).toContain('Not enough gold');
    // The price is the thing the player cannot see anywhere else — the
    // rate moves with every trade — so the refusal quotes it.
    expect(reason).toMatch(/this trade costs \d+/);
  });
});
