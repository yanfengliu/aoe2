// Work 142 M2b-2: the buildings' DE keys (`src/ui/hud/buildingCardKeys.ts`
// cites each). Every unit and technology a building can offer has its DE key
// there, or is one of the few DE gives no key on that building, so a button
// added to a card later fails here until someone decides its key. The contract
// the table serves, a key pressing its button, is held by
// `tests/browser/de-building-card-keys.spec.ts`.

import { describe, expect, it } from 'vitest';

import { RESEARCHES_BY_BUILDING, TRAINABLE_UNITS_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';
import type { BuildingType } from '../../src/game/simulation/types';
import { UNIQUE_TECHNOLOGIES } from '../../src/game/simulation/uniqueTechnologies';
import { buildingCardKeyOf, hasBuildingCardKeys, inBuildingCardSlotOrder } from '../../src/ui/hud/buildingCardKeys';
import { GRID_KEYS, VILLAGER_BUILD_SLOTS } from '../../src/ui/hud/commandCardKeys';

// What DE's own card for that building has no key for (DE researches these at
// the University, CivTechTrees; hotkeys.json names no Fast Fire Ship tech).
const NO_DE_KEY: Readonly<Partial<Record<BuildingType, readonly string[]>>> = {
  dock: ['research-careening', 'research-dry-dock', 'research-shipwright', 'research-fast-fire-ship-upgrade'],
};

const BUILDING_TYPES = Object.keys(VILLAGER_BUILD_SLOTS) as BuildingType[];

describe('DE building card keys (work 142 M2b-2)', () => {
  it('gives every unit and technology a building offers a key of the grid, but the few DE gives none there', () => {
    const missing: string[] = [];
    for (const [table, kind] of [[TRAINABLE_UNITS_BY_BUILDING, 'train'], [RESEARCHES_BY_BUILDING, 'research']] as const) {
      for (const [building, options] of table) {
        for (const option of options) {
          const command = `${kind}-${option}`;
          const key = buildingCardKeyOf(building, command);
          const exempt = NO_DE_KEY[building]?.includes(command) ?? false;
          if (exempt) {
            expect(key, `${building} ${command} has no DE key there`).toBeNull();
          } else if (key === null) {
            missing.push(`${building} ${command}`);
          } else {
            expect((GRID_KEYS as readonly string[]).includes(key), `${building} ${command} -> ${key}`).toBe(true);
          }
        }
      }
    }
    expect(missing, 'buttons with no DE key decided').toEqual([]);
  });

  it('trades on the Market\'s keys: sell S D F, buy X C V', () => {
    const keys = ['sell-wood', 'sell-food', 'sell-stone', 'buy-wood', 'buy-food', 'buy-stone']
      .map((action) => buildingCardKeyOf('market', `market-${action}`));
    expect(keys).toEqual(['s', 'd', 'f', 'x', 'c', 'v']);
  });

  it('puts a unique technology on S or D as DE files it, and by its age only where DE no longer lists it', () => {
    const byKey = (key: string): string[] => UNIQUE_TECHNOLOGIES
      .filter((tech) => buildingCardKeyOf('castle', `research-${tech.id}`) === key).map((tech) => tech.id).sort();
    // CASTLE_UNIQUE_CASTLE_TECH: Carrack, Kasbah, Yeomen and Anarchy; Sultans
    // is not in DE's list, and this game researches it in the Castle Age.
    expect(byKey('s')).toEqual(['anarchy', 'carrack', 'kasbah', 'sultans', 'yeomen']);
    expect(byKey('d')).toHaveLength(UNIQUE_TECHNOLOGIES.length - 5);
    // Yeomen is an Imperial Age technology here (spec, uniqueTechnologies.ts)
    // and DE's Unique Castle Technology: the key follows DE.
    expect(UNIQUE_TECHNOLOGIES.find((tech) => tech.id === 'yeomen')?.age).toBe('imperial-age');
  });

  it('ungarrisons every building on G, and gives keys on buildings alone', () => {
    for (const building of BUILDING_TYPES) {
      expect(hasBuildingCardKeys(building), building).toBe(true);
      expect(buildingCardKeyOf(building, 'action-ungarrison'), building).toBe('g');
    }
    expect(hasBuildingCardKeys('villager')).toBe(false);
    expect(buildingCardKeyOf('villager', 'action-ungarrison')).toBeNull();
  });

  it('draws a building\'s lists in slot order, a line\'s tiers in their own order, and leaves a unit\'s alone', () => {
    const blacksmith = inBuildingCardSlotOrder({
      selectedKind: 'building',
      selectedEntityType: 'blacksmith',
      actionOptions: [],
      trainOptions: [],
      marketOptions: [],
      visibleResearchOptions: ['fletching', 'forging', 'bodkin-arrow', 'scale-mail-armor', 'iron-casting'],
    });
    expect(blacksmith.visibleResearchOptions).toEqual(['forging', 'iron-casting', 'scale-mail-armor', 'fletching', 'bodkin-arrow']);
    const townCenter = inBuildingCardSlotOrder({
      selectedKind: 'building',
      selectedEntityType: 'town-center',
      actionOptions: ['ungarrison', 'ring-town-bell', 'back-to-work'],
      trainOptions: ['villager'],
      marketOptions: [],
      visibleResearchOptions: ['wheelbarrow', 'town-watch', 'loom', 'feudal-age'],
    });
    // Go Back to Work F (slot 8), Ungarrison G (9), Town Bell B (14).
    expect(townCenter.actionOptions).toEqual(['back-to-work', 'ungarrison', 'ring-town-bell']);
    expect(townCenter.visibleResearchOptions).toEqual(['loom', 'wheelbarrow', 'town-watch', 'feudal-age']);
    const dock = inBuildingCardSlotOrder({
      selectedKind: 'building',
      selectedEntityType: 'dock',
      actionOptions: [],
      trainOptions: [],
      marketOptions: [],
      visibleResearchOptions: ['careening', 'war-galley-upgrade', 'fast-fire-ship-upgrade', 'heavy-demolition-ship-upgrade'],
    });
    // A button DE gives no key there keeps its place after the keyed ones.
    expect(dock.visibleResearchOptions).toEqual(['war-galley-upgrade', 'heavy-demolition-ship-upgrade', 'careening', 'fast-fire-ship-upgrade']);
    // Buttons that share a key come in DE's tier order, whatever order the
    // bridge lists them in: DE's T shows Chemistry before the Bombard Tower.
    const university = inBuildingCardSlotOrder({
      selectedKind: 'building',
      selectedEntityType: 'university',
      actionOptions: [],
      trainOptions: [],
      marketOptions: [],
      visibleResearchOptions: ['keep', 'bombard-tower-unlock', 'chemistry', 'guard-tower'],
    });
    expect(university.visibleResearchOptions).toEqual(['chemistry', 'bombard-tower-unlock', 'guard-tower', 'keep']);
    const unit = inBuildingCardSlotOrder({
      selectedKind: 'unit',
      selectedEntityType: 'villager',
      actionOptions: [],
      trainOptions: [],
      marketOptions: [],
      visibleResearchOptions: ['fletching', 'forging'],
    });
    expect(unit.visibleResearchOptions).toEqual(['fletching', 'forging']);
  });
});
