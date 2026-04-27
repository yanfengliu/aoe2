// Exhaustive UnitType lookup extracted from GameScene.ts. The
// `satisfies Record<UnitType, true>` clause on `ALL_UNIT_TYPES` is the
// load-bearing piece — adding a new unit to `UnitType` in
// `src/game/simulation/types.ts` forces a TypeScript error here if the
// lookup isn't updated. Iter-3 V3-3 introduced this guard after the
// FU2-era unit-type drift; iter-5 V5-3 moved it out of GameScene to
// keep the scene file under the 1,000-LOC strict ceiling.

import type { SelectionState, UnitType } from '../../../game/simulation/types';

export const ALL_UNIT_TYPES = {
  villager: true,
  scout: true,
  militia: true,
  spearman: true,
  archer: true,
  skirmisher: true,
  knight: true,
  crossbowman: true,
  pikeman: true,
  'light-cavalry': true,
  camel: true,
  'cavalry-archer': true,
  monk: true,
  mangonel: true,
  scorpion: true,
  'battering-ram': true,
  longbowman: true,
  arbalest: true,
  halberdier: true,
  hussar: true,
  'heavy-cavalry-archer': true,
  cavalier: true,
  champion: true,
  'elite-longbowman': true,
  onager: true,
  'heavy-scorpion': true,
  'siege-ram': true,
  'bombard-cannon': true,
  trebuchet: true,
  'man-at-arms': true,
  'long-swordsman': true,
  'two-handed-swordsman': true,
  paladin: true,
  'heavy-camel': true,
} as const satisfies Record<UnitType, true>;

export function isUnitType(
  entityType: SelectionState['selectedEntityType'],
): entityType is UnitType {
  return entityType !== null && entityType in ALL_UNIT_TYPES;
}
