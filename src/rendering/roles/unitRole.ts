import type { UnitType } from '../../game/simulation/types';

export type UnitRole =
  | 'villager'
  | 'infantry'
  | 'archer'
  | 'cavalry'
  | 'cavalry-archer'
  | 'siege'
  | 'monk'
  | 'ship'; // M5 naval: hull + mast, sharing nothing with a land silhouette.

// Render-owned, exhaustive visual grouping used by voxel recipes and DOM
// glyphs. It deliberately stays independent from combat classifications.
const UNIT_ROLES = {
  villager: 'villager',
  militia: 'infantry',
  'man-at-arms': 'infantry',
  'long-swordsman': 'infantry',
  'two-handed-swordsman': 'infantry',
  champion: 'infantry',
  spearman: 'infantry',
  pikeman: 'infantry',
  halberdier: 'infantry',
  archer: 'archer',
  crossbowman: 'archer',
  arbalest: 'archer',
  skirmisher: 'archer',
  longbowman: 'archer',
  'elite-longbowman': 'archer',
  scout: 'cavalry',
  'light-cavalry': 'cavalry',
  hussar: 'cavalry',
  camel: 'cavalry',
  'heavy-camel': 'cavalry',
  knight: 'cavalry',
  cavalier: 'cavalry',
  paladin: 'cavalry',
  'cavalry-archer': 'cavalry-archer',
  'heavy-cavalry-archer': 'cavalry-archer',
  mangonel: 'siege',
  onager: 'siege',
  scorpion: 'siege',
  'heavy-scorpion': 'siege',
  'battering-ram': 'siege',
  'siege-ram': 'siege',
  'bombard-cannon': 'siege',
  trebuchet: 'siege',
  'fishing-ship': 'ship',
  monk: 'monk',
} as const satisfies Record<UnitType, UnitRole>;

export function unitRole(unitType: UnitType): UnitRole {
  return UNIT_ROLES[unitType];
}
