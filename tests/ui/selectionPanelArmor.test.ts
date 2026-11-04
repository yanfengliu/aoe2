import { describe, expect, it } from 'vitest';

import { renderSelectionDetails } from '../../src/ui/hud/selectionPanel/render';
import type { SelectionState } from '../../src/game/simulation/types';

function selection(overrides: Partial<SelectionState>): SelectionState {
  return {
    selectedEntityId: 1,
    selectedEntityIds: [1],
    selectedCount: 1,
    selectedKind: 'unit',
    selectedEntityType: 'villager',
    owner: 1,
    health: null,
    attack: null,
    armor: null,
    pierceArmor: null,
    faction: null,
    civ: null,
    inventory: null,
    activity: null,
    activityBreakdown: null,
    x: null,
    y: null,
    tileX: null,
    tileY: null,
    tileEntityIndex: null,
    tileEntityCount: 0,
    resourceAmount: null,
    resourceMaxAmount: null,
    actionOptions: [],
    stanceOptions: [],
    formationOptions: [],
    formation: null,
    stance: null,
    buildOptions: [],
    marketOptions: [],
    trainOptions: [],
    visibleResearchOptions: [],
    researchOptions: [],
    unavailableCommands: [],
    commandCosts: [],
    queue: [],
    placementMode: null,
    ...overrides,
  };
}

// Spec §11.8 — the selection panel shows melee and pierce armor separately so
// the asymmetric armor split (e.g. Loom's +1 melee / +2 pierce) is visible.
describe('selection panel — melee/pierce armor rows', () => {
  it('renders separate "Melee armor" and "Pierce armor" rows with their values', () => {
    const html = renderSelectionDetails(selection({ armor: 1, pierceArmor: 2 }));
    // The melee row keeps the `armor` data key (back-compat) but a clearer label.
    expect(html).toContain('data-selection-detail="armor"');
    expect(html).toContain('Melee armor');
    expect(html).toContain('data-selection-detail-value="armor">1<');
    // The new pierce row.
    expect(html).toContain('data-selection-detail="pierce-armor"');
    expect(html).toContain('Pierce armor');
    expect(html).toContain('data-selection-detail-value="pierce-armor">2<');
  });

  it('says on hover that each row is the total armor, base plus upgrades (work 140)', () => {
    // The rows showed only the armor-upgrade bonus until work 140, and their
    // hover text said so; a Town Center's 3 is its own armor, not a bonus.
    const html = renderSelectionDetails(selection({ armor: 3, pierceArmor: 5 }));
    for (const key of ['armor', 'pierce-armor']) {
      const row = new RegExp(`data-selection-detail="${key}" data-tooltip="([^"]*)"`).exec(html);
      expect(row?.[1], key).toContain('base plus upgrades');
      expect(row?.[1], key).not.toContain('armor-upgrade bonus');
    }
  });

  it('omits the pierce-armor row when pierceArmor is null (e.g. multi-select)', () => {
    expect(renderSelectionDetails(selection({ armor: null, pierceArmor: null }))).not.toContain(
      'pierce-armor',
    );
  });
});
