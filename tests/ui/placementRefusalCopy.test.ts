// @vitest-environment jsdom

// What the player reads when a placement is refused (work 148 M3a, spec §14.2).
//
// The defect, as a player met it: a House clicked onto the Town Center raised
// "Placement blocked for house (2x2): blocked by a town-center (building) at
// (9,9); 4 of the 4 footprint cells are blocked. Nearest open ground you can
// see: (7,6).", and over unexplored ground a sentence 1,262px wide in a 1,280px
// window. Definitive Edition answers a red ghost with no sentence at all, and
// a site its builders find blocked with string 3094. The long reason stays in
// the queue for the playtest agent and the tests; the toast shows one short
// sentence chosen by the reason's kind.
//
// Bound: the sentences are this file's table; that every producer's sentence
// reaches a kind is tests/simulation/placementRefusalKinds.test.ts, and that
// the page draws the toast so is tests/browser/de-placement-refusal.spec.ts.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  PLACEMENT_REFUSAL_KINDS,
  placementRefusalReason as reason,
  type PlacementRefusalKind,
} from '../../src/game/simulation/handlers/building/placementRefusal';
import { playerFacingRejection } from '../../src/ui/hud/placementRefusalCopy';
import { createToastController, showCommandRejections } from '../../src/ui/hud/toast';

const HOUSE = { buildingType: 'house', width: 2, height: 2, x: 5, y: 0 };
const DOCK = { buildingType: 'dock', width: 3, height: 3, x: 22, y: 12 };
const TRAP = { buildingType: 'fish-trap', width: 1, height: 1, x: 9, y: 9 };
const NEAR = { x: 7, y: 6 };

// One long reason of each kind, and the sentence the player reads for it.
const READS: Record<PlacementRefusalKind, [string, string]> = {
  obstructed: [
    reason.obstructed(HOUSE, 'a town-center (building) at (9,9)', '; 4 of the 4 footprint cells are blocked', NEAR),
    'Building site obstructed.',
  ],
  unexplored: [reason.unexplored(HOUSE, NEAR), "You can't build on unexplored ground."],
  unreachable: [reason.unreachable(HOUSE, 0, NEAR), "Your builders can't reach that site."],
  'needs-shore': [reason['needs-shore'](DOCK, NEAR), 'A Dock must be built on the shore.'],
  'needs-water': [reason['needs-water'](TRAP, NEAR), 'A Fish Trap must be built on water.'],
  'site-cancelled': [
    reason['site-cancelled'](HOUSE, { text: 'water at (24,13), hidden under the fog of war when it was placed', foggedAtPlacing: true }, '25 wood'),
    'Building site obstructed. Building canceled.',
  ],
};

describe('what a refused placement says to the player (work 148 M3a)', () => {
  it.each(PLACEMENT_REFUSAL_KINDS)('a "%s" refusal reads as its one short sentence', (kind) => {
    const [long, short] = READS[kind];
    expect(playerFacingRejection(long)).toBe(short);
  });

  it('no sentence quotes a cell, a footprint or an internal id, and each is short', () => {
    for (const kind of PLACEMENT_REFUSAL_KINDS) {
      const said = playerFacingRejection(READS[kind][0]);
      expect(said, kind).not.toMatch(/\d/);
      expect(said, kind).not.toMatch(/[()]/);
      expect(said, kind).not.toMatch(/[a-z]-[a-z]/);
      expect(said.length, kind).toBeLessThanOrEqual(48);
      expect(said, kind).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('a refusal no producer makes still reads short, as an obstructed site', () => {
    expect(playerFacingRejection('Placement blocked for house (2x2) at (5,0): the stars are wrong tonight.'))
      .toBe('Building site obstructed.');
  });

  it('any other refusal is shown as it is', () => {
    for (const other of [
      'Not enough wood.',
      'Select a villager first.',
      'Cannot build here.',
      'Placement blocked.',
      'Cannot research Feudal Age here. Needs 2 completed Dark Age buildings (Lumber Camp, Mining Camp, Mill, Dock or Barracks). You have 0.',
    ]) {
      expect(playerFacingRejection(other)).toBe(other);
    }
  });

  it('the toast of a click refused on a live bridge is the short sentence, and the queue held the long one', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const villager = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'villager')!;
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    const container = document.createElement('div');
    const { showToast } = createToastController(container);
    const seen: string[] = [];
    const queue = {
      consumeCommandRejection: (): string | null => {
        const next = bridge.consumeCommandRejection();
        if (next !== null) seen.push(next);
        return next;
      },
    };

    // The Town Center, then unexplored ground, then a price it cannot pay.
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(9, 9)).toBe(false);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(40, 20)).toBe(false);
    showCommandRejections(queue, showToast);

    const toasts = [...container.querySelectorAll('[data-hud="toast"]')].map((t) => t.textContent);
    expect(toasts).toEqual(['Building site obstructed.', "You can't build on unexplored ground."]);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toContain('blocked by a town-center (building) at (9,9)');
    expect(seen[1]).toContain('none of that ground has been explored');
    expect(bridge.consumeCommandRejection(), 'the queue was not drained').toBeNull();
  });
});
