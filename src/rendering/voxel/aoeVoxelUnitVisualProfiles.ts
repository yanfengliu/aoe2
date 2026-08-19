import type { UnitType } from '../../game/simulation/types';
import { unitRole, type UnitRole } from '../roles/unitRole';

export type UnitWeapon =
  | 'tool'
  | 'sword'
  | 'greatsword'
  | 'polearm'
  | 'halberd'
  | 'bow'
  | 'longbow'
  | 'crossbow'
  | 'javelin'
  | 'mounted-sword'
  | 'lance'
  | 'mounted-polearm'
  | 'mounted-bow'
  | 'stone-thrower'
  | 'bolt-thrower'
  | 'ram'
  | 'cannon'
  | 'trebuchet'
  | 'staff'
  // M5 naval: a net is the Fishing Ship's working prop, not a weapon.
  | 'net';

export type UnitArmor = 'cloth' | 'leather' | 'mail' | 'plate' | 'timber';
export type UnitHeadgear =
  | 'hair'
  | 'hood'
  | 'headband'
  | 'leather-cap'
  | 'nasal-helmet'
  | 'kettle-helmet'
  | 'sallet'
  | 'crested-helmet'
  | 'cowl'
  | 'none';
export type UnitShield = 'none' | 'round' | 'kite' | 'heater' | 'pavise';
export type UnitMount = 'none' | 'horse' | 'camel';

/**
 * Render-only art direction for one concrete UnitType. Combat classification
 * remains authoritative elsewhere; these values only choose bounded geometry.
 */
export interface UnitVisualProfile {
  readonly role: UnitRole;
  readonly weapon: UnitWeapon;
  readonly armor: UnitArmor;
  readonly headgear: UnitHeadgear;
  readonly shield: UnitShield;
  readonly mount: UnitMount;
  readonly tier: 0 | 1 | 2 | 3;
  readonly signature: string;
}

const UNIT_VISUAL_PROFILES = {
  villager: { role: 'villager', weapon: 'tool', armor: 'cloth', headgear: 'hair', shield: 'none', mount: 'none', tier: 0, signature: 'apron' },
  militia: { role: 'infantry', weapon: 'sword', armor: 'leather', headgear: 'leather-cap', shield: 'round', mount: 'none', tier: 0, signature: 'hide-vest' },
  'man-at-arms': { role: 'infantry', weapon: 'sword', armor: 'mail', headgear: 'nasal-helmet', shield: 'round', mount: 'none', tier: 1, signature: 'mail-collar' },
  'long-swordsman': { role: 'infantry', weapon: 'sword', armor: 'mail', headgear: 'kettle-helmet', shield: 'kite', mount: 'none', tier: 2, signature: 'mail-skirt' },
  'two-handed-swordsman': { role: 'infantry', weapon: 'greatsword', armor: 'plate', headgear: 'sallet', shield: 'none', mount: 'none', tier: 2, signature: 'shoulder-guard' },
  champion: { role: 'infantry', weapon: 'greatsword', armor: 'plate', headgear: 'crested-helmet', shield: 'none', mount: 'none', tier: 3, signature: 'gold-pauldrons' },
  spearman: { role: 'infantry', weapon: 'polearm', armor: 'leather', headgear: 'leather-cap', shield: 'round', mount: 'none', tier: 0, signature: 'hide-shoulder' },
  pikeman: { role: 'infantry', weapon: 'polearm', armor: 'mail', headgear: 'kettle-helmet', shield: 'none', mount: 'none', tier: 1, signature: 'pike-brace' },
  halberdier: { role: 'infantry', weapon: 'halberd', armor: 'plate', headgear: 'sallet', shield: 'none', mount: 'none', tier: 3, signature: 'halberd-tassel' },
  archer: { role: 'archer', weapon: 'bow', armor: 'cloth', headgear: 'hood', shield: 'none', mount: 'none', tier: 0, signature: 'short-quiver' },
  crossbowman: { role: 'archer', weapon: 'crossbow', armor: 'leather', headgear: 'leather-cap', shield: 'none', mount: 'none', tier: 1, signature: 'bolt-case' },
  arbalest: { role: 'archer', weapon: 'crossbow', armor: 'mail', headgear: 'kettle-helmet', shield: 'pavise', mount: 'none', tier: 2, signature: 'windlass' },
  skirmisher: { role: 'archer', weapon: 'javelin', armor: 'leather', headgear: 'headband', shield: 'round', mount: 'none', tier: 0, signature: 'javelin-bundle' },
  longbowman: { role: 'archer', weapon: 'longbow', armor: 'cloth', headgear: 'hood', shield: 'none', mount: 'none', tier: 1, signature: 'green-cloak' },
  'elite-longbowman': { role: 'archer', weapon: 'longbow', armor: 'mail', headgear: 'hood', shield: 'none', mount: 'none', tier: 3, signature: 'royal-bracer' },
  scout: { role: 'cavalry', weapon: 'mounted-sword', armor: 'leather', headgear: 'leather-cap', shield: 'none', mount: 'horse', tier: 0, signature: 'light-tack' },
  'light-cavalry': { role: 'cavalry', weapon: 'mounted-sword', armor: 'mail', headgear: 'nasal-helmet', shield: 'round', mount: 'horse', tier: 1, signature: 'neck-guard' },
  hussar: { role: 'cavalry', weapon: 'mounted-sword', armor: 'plate', headgear: 'crested-helmet', shield: 'round', mount: 'horse', tier: 3, signature: 'wing' },
  camel: { role: 'cavalry', weapon: 'mounted-sword', armor: 'leather', headgear: 'headband', shield: 'round', mount: 'camel', tier: 1, signature: 'camel-blanket' },
  'heavy-camel': { role: 'cavalry', weapon: 'mounted-polearm', armor: 'plate', headgear: 'sallet', shield: 'none', mount: 'camel', tier: 3, signature: 'armored-hump' },
  knight: { role: 'cavalry', weapon: 'lance', armor: 'mail', headgear: 'nasal-helmet', shield: 'kite', mount: 'horse', tier: 1, signature: 'mail-barding' },
  cavalier: { role: 'cavalry', weapon: 'lance', armor: 'plate', headgear: 'sallet', shield: 'heater', mount: 'horse', tier: 2, signature: 'plate-barding' },
  paladin: { role: 'cavalry', weapon: 'lance', armor: 'plate', headgear: 'crested-helmet', shield: 'heater', mount: 'horse', tier: 3, signature: 'horse-crest' },
  'cavalry-archer': { role: 'cavalry-archer', weapon: 'mounted-bow', armor: 'leather', headgear: 'leather-cap', shield: 'none', mount: 'horse', tier: 1, signature: 'saddle-quiver' },
  'heavy-cavalry-archer': { role: 'cavalry-archer', weapon: 'mounted-bow', armor: 'mail', headgear: 'kettle-helmet', shield: 'none', mount: 'horse', tier: 3, signature: 'scale-barding' },
  mangonel: { role: 'siege', weapon: 'stone-thrower', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'rope-bundle' },
  onager: { role: 'siege', weapon: 'stone-thrower', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'stone-payload' },
  scorpion: { role: 'siege', weapon: 'bolt-thrower', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'bow-cable' },
  'heavy-scorpion': { role: 'siege', weapon: 'bolt-thrower', armor: 'plate', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'reinforced-prod' },
  'battering-ram': { role: 'siege', weapon: 'ram', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'hide-roof' },
  'siege-ram': { role: 'siege', weapon: 'ram', armor: 'plate', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'iron-roof' },
  'bombard-cannon': { role: 'siege', weapon: 'cannon', armor: 'plate', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'powder-chest' },
  trebuchet: { role: 'siege', weapon: 'trebuchet', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'stone-sling' },
  monk: { role: 'monk', weapon: 'staff', armor: 'cloth', headgear: 'cowl', shield: 'none', mount: 'none', tier: 0, signature: 'golden-cross' },
  'fishing-ship': { role: 'ship', weapon: 'net', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 0, signature: 'fishing-net' },
} as const satisfies Record<UnitType, UnitVisualProfile>;

export function unitVisualProfile(unitType: UnitType): UnitVisualProfile | undefined {
  const profile = (UNIT_VISUAL_PROFILES as Partial<Record<string, UnitVisualProfile>>)[unitType];
  if (!profile) return undefined;
  const canonicalRole = unitRole(unitType);
  if (profile.role !== canonicalRole) {
    throw new Error(`Unit visual profile role drifted for ${unitType}: ${profile.role} != ${canonicalRole}`);
  }
  return profile;
}
