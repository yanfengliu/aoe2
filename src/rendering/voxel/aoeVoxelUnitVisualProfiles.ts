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
  // M4 unique units: gunpowder, on foot (Janissary) and mounted
  // (Conquistador). Both draw a barrel rather than a bow.
  | 'hand-cannon'
  | 'mounted-gun'
  // M5 naval: a net is the Fishing Ship's working prop, not a weapon.
  | 'net'
  // Nor is a boarding ramp: the Transport Ship carries a company and fights
  // nothing, so the prop that says what it is for is the way on and off it.
  | 'boarding-ramp'
  | 'ship-bow'
  | 'ship-fire'
  | 'ship-powder'
  | 'ship-cannon';

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
// M4: the War Elephant needs a mount that is not horse-shaped at all —
// heavier body, columnar legs, trunk and tusks (see mountBody).
export type UnitMount = 'none' | 'horse' | 'camel' | 'elephant';

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
  /**
   * True for the Elite tier of a line. DERIVED from the unit type rather than
   * authored, because an authored flag is one a new elite unit can be shipped
   * without — and an elite that looks exactly like its base tier is the defect
   * `unitTierVisualDistinction` exists to stop.
   */
  readonly elite: boolean;
}

/** A profile as AUTHORED — everything but the fields derived at lookup. */
export type AuthoredUnitVisualProfile = Omit<UnitVisualProfile, 'elite'>;

const UNIT_VISUAL_PROFILES = {
  villager: { role: 'villager', weapon: 'tool', armor: 'cloth', headgear: 'hair', shield: 'none', mount: 'none', tier: 0, signature: 'apron' },
  militia: { role: 'infantry', weapon: 'sword', armor: 'leather', headgear: 'leather-cap', shield: 'round', mount: 'none', tier: 0, signature: 'hide-vest' },
  // No helmet and no shield: the Eagle line is light infantry that trades
  // armour for the speed nothing else on foot has. The feathered headdress
  // is its signature, and the Elite tier is plated and crested.
  'eagle-warrior': { role: 'infantry', weapon: 'sword', armor: 'cloth', headgear: 'headband', shield: 'none', mount: 'none', tier: 1, signature: 'feather-headdress' },
  'elite-eagle-warrior': { role: 'infantry', weapon: 'sword', armor: 'leather', headgear: 'headband', shield: 'none', mount: 'none', tier: 2, signature: 'feather-headdress' },
  // Plate and a sallet, unlike the Janissary's cloth and hood — the same
  // weapon on a very different soldier.
  'hand-cannoneer': { role: 'archer', weapon: 'hand-cannon', armor: 'plate', headgear: 'sallet', shield: 'none', mount: 'none', tier: 2, signature: 'powder-bandolier' },
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
  'elite-skirmisher': { role: 'archer', weapon: 'javelin', armor: 'mail', headgear: 'hood', shield: 'round', mount: 'none', tier: 1, signature: 'javelin-bundle' },
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
  onager: { role: 'siege', weapon: 'stone-thrower', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'stone-payload' },
  'siege-onager': { role: 'siege', weapon: 'stone-thrower', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'stone-payload' },
  scorpion: { role: 'siege', weapon: 'bolt-thrower', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'bow-cable' },
  'heavy-scorpion': { role: 'siege', weapon: 'bolt-thrower', armor: 'plate', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'reinforced-prod' },
  'battering-ram': { role: 'siege', weapon: 'ram', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'hide-roof' },
  'siege-ram': { role: 'siege', weapon: 'ram', armor: 'plate', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'iron-roof' },
  'capped-ram': { role: 'siege', weapon: 'ram', armor: 'mail', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'iron-roof' },
  'bombard-cannon': { role: 'siege', weapon: 'cannon', armor: 'plate', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'powder-chest' },
  trebuchet: { role: 'siege', weapon: 'trebuchet', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'stone-sling' },
  // A keg of powder carried by a man: infantry-sized, siege-roled, and its
  // signature is the barrel itself.
  petard: { role: 'infantry', weapon: 'tool', armor: 'cloth', headgear: 'leather-cap', shield: 'none', mount: 'none', tier: 1, signature: 'powder-keg' },
  // A loaded cart: wheeled timber mass with the goods lashed on top.
  'trade-cart': { role: 'siege', weapon: 'tool', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 0, signature: 'rope-bundle' },
  // A merchant hull: the fishing ship's shape with a cargo net for a prop.
  'trade-cog': { role: 'ship', weapon: 'net', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 0, signature: 'fishing-net' },
  // A monk in the saddle: staff and cross over a light mount.
  missionary: { role: 'cavalry', weapon: 'staff', armor: 'cloth', headgear: 'cowl', shield: 'none', mount: 'horse', tier: 0, signature: 'golden-cross' },
  monk: { role: 'monk', weapon: 'staff', armor: 'cloth', headgear: 'cowl', shield: 'none', mount: 'none', tier: 0, signature: 'golden-cross' },
  'fishing-ship': { role: 'ship', weapon: 'net', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 0, signature: 'fishing-net' },
  'transport-ship': { role: 'ship', weapon: 'boarding-ramp', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 0, signature: 'fishing-net' },
  'galley': { role: 'ship', weapon: 'ship-bow', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'ship-bow' },
  'war-galley': { role: 'ship', weapon: 'ship-bow', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'ship-bow' },
  'galleon': { role: 'ship', weapon: 'ship-bow', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 3, signature: 'ship-bow' },
  'fire-ship': { role: 'ship', weapon: 'ship-fire', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'ship-fire' },
  'fast-fire-ship': { role: 'ship', weapon: 'ship-fire', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'ship-fire' },
  'demolition-ship': { role: 'ship', weapon: 'ship-powder', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'ship-powder' },
  'heavy-demolition-ship': { role: 'ship', weapon: 'ship-powder', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'ship-powder' },
  'cannon-galleon': { role: 'ship', weapon: 'ship-cannon', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'ship-cannon' },
  'elite-cannon-galleon': { role: 'ship', weapon: 'ship-cannon', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'ship-cannon' },
  'jaguar-warrior': { role: 'infantry', weapon: 'sword', armor: 'leather', headgear: 'headband', shield: 'none', mount: 'none', tier: 2, signature: 'jaguar-pelt' },
  'cataphract': { role: 'cavalry', weapon: 'mounted-sword', armor: 'plate', headgear: 'crested-helmet', shield: 'round', mount: 'horse', tier: 3, signature: 'lamellar-skirt' },
  'woad-raider': { role: 'infantry', weapon: 'sword', armor: 'cloth', headgear: 'hair', shield: 'none', mount: 'none', tier: 1, signature: 'woad-paint' },
  'chu-ko-nu': { role: 'archer', weapon: 'crossbow', armor: 'leather', headgear: 'hood', shield: 'none', mount: 'none', tier: 2, signature: 'bolt-magazine' },
  'throwing-axeman': { role: 'archer', weapon: 'javelin', armor: 'mail', headgear: 'nasal-helmet', shield: 'round', mount: 'none', tier: 2, signature: 'axe-bundle' },
  'huskarl': { role: 'infantry', weapon: 'sword', armor: 'leather', headgear: 'nasal-helmet', shield: 'round', mount: 'none', tier: 2, signature: 'shield-boss' },
  'tarkan': { role: 'cavalry', weapon: 'mounted-sword', armor: 'mail', headgear: 'headband', shield: 'none', mount: 'horse', tier: 2, signature: 'raider-torch' },
  'samurai': { role: 'infantry', weapon: 'sword', armor: 'plate', headgear: 'kettle-helmet', shield: 'none', mount: 'none', tier: 3, signature: 'sashimono-banner' },
  'war-wagon': { role: 'cavalry-archer', weapon: 'mounted-bow', armor: 'timber', headgear: 'leather-cap', shield: 'none', mount: 'horse', tier: 2, signature: 'wagon-plating' },
  'plumed-archer': { role: 'archer', weapon: 'bow', armor: 'cloth', headgear: 'headband', shield: 'none', mount: 'none', tier: 2, signature: 'feather-plume' },
  'mangudai': { role: 'cavalry-archer', weapon: 'mounted-bow', armor: 'leather', headgear: 'headband', shield: 'none', mount: 'horse', tier: 3, signature: 'horsehair-tassel' },
  'war-elephant': { role: 'cavalry', weapon: 'lance', armor: 'mail', headgear: 'headband', shield: 'none', mount: 'elephant', tier: 2, signature: 'howdah' },
  'mameluke': { role: 'cavalry', weapon: 'mounted-sword', armor: 'leather', headgear: 'headband', shield: 'none', mount: 'camel', tier: 3, signature: 'thrown-scimitar' },
  'conquistador': { role: 'cavalry-archer', weapon: 'mounted-gun', armor: 'plate', headgear: 'sallet', shield: 'none', mount: 'horse', tier: 3, signature: 'powder-flask' },
  'teutonic-knight': { role: 'infantry', weapon: 'sword', armor: 'plate', headgear: 'kettle-helmet', shield: 'heater', mount: 'none', tier: 3, signature: 'teuton-cross' },
  'janissary': { role: 'archer', weapon: 'hand-cannon', armor: 'cloth', headgear: 'hood', shield: 'none', mount: 'none', tier: 3, signature: 'powder-horn' },
  'berserk': { role: 'infantry', weapon: 'greatsword', armor: 'leather', headgear: 'hair', shield: 'none', mount: 'none', tier: 2, signature: 'wolf-pelt' },
  'turtle-ship': { role: 'ship', weapon: 'ship-cannon', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'turtle-shell' },
  'longboat': { role: 'ship', weapon: 'ship-bow', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 1, signature: 'dragon-prow' },
  'elite-jaguar-warrior': { role: 'infantry', weapon: 'sword', armor: 'plate', headgear: 'headband', shield: 'none', mount: 'none', tier: 3, signature: 'jaguar-pelt' },
  'elite-cataphract': { role: 'cavalry', weapon: 'mounted-sword', armor: 'plate', headgear: 'crested-helmet', shield: 'round', mount: 'horse', tier: 3, signature: 'lamellar-skirt' },
  'elite-woad-raider': { role: 'infantry', weapon: 'sword', armor: 'plate', headgear: 'hair', shield: 'none', mount: 'none', tier: 3, signature: 'woad-paint' },
  'elite-chu-ko-nu': { role: 'archer', weapon: 'crossbow', armor: 'plate', headgear: 'hood', shield: 'none', mount: 'none', tier: 3, signature: 'bolt-magazine' },
  'elite-throwing-axeman': { role: 'archer', weapon: 'javelin', armor: 'mail', headgear: 'nasal-helmet', shield: 'round', mount: 'none', tier: 3, signature: 'axe-bundle' },
  'elite-huskarl': { role: 'infantry', weapon: 'sword', armor: 'plate', headgear: 'nasal-helmet', shield: 'round', mount: 'none', tier: 3, signature: 'shield-boss' },
  'elite-tarkan': { role: 'cavalry', weapon: 'mounted-sword', armor: 'mail', headgear: 'headband', shield: 'none', mount: 'horse', tier: 3, signature: 'raider-torch' },
  'elite-samurai': { role: 'infantry', weapon: 'sword', armor: 'plate', headgear: 'kettle-helmet', shield: 'none', mount: 'none', tier: 3, signature: 'sashimono-banner' },
  'elite-war-wagon': { role: 'cavalry-archer', weapon: 'mounted-bow', armor: 'timber', headgear: 'leather-cap', shield: 'none', mount: 'horse', tier: 3, signature: 'wagon-plating' },
  'elite-plumed-archer': { role: 'archer', weapon: 'bow', armor: 'plate', headgear: 'headband', shield: 'none', mount: 'none', tier: 3, signature: 'feather-plume' },
  'elite-mangudai': { role: 'cavalry-archer', weapon: 'mounted-bow', armor: 'plate', headgear: 'headband', shield: 'none', mount: 'horse', tier: 3, signature: 'horsehair-tassel' },
  'elite-war-elephant': { role: 'cavalry', weapon: 'lance', armor: 'mail', headgear: 'headband', shield: 'none', mount: 'elephant', tier: 3, signature: 'howdah' },
  'elite-mameluke': { role: 'cavalry', weapon: 'mounted-sword', armor: 'plate', headgear: 'headband', shield: 'none', mount: 'camel', tier: 3, signature: 'thrown-scimitar' },
  'elite-conquistador': { role: 'cavalry-archer', weapon: 'mounted-gun', armor: 'plate', headgear: 'sallet', shield: 'none', mount: 'horse', tier: 3, signature: 'powder-flask' },
  'elite-teutonic-knight': { role: 'infantry', weapon: 'sword', armor: 'plate', headgear: 'kettle-helmet', shield: 'heater', mount: 'none', tier: 3, signature: 'teuton-cross' },
  'elite-janissary': { role: 'archer', weapon: 'hand-cannon', armor: 'plate', headgear: 'hood', shield: 'none', mount: 'none', tier: 3, signature: 'powder-horn' },
  'elite-berserk': { role: 'infantry', weapon: 'greatsword', armor: 'plate', headgear: 'hair', shield: 'none', mount: 'none', tier: 3, signature: 'wolf-pelt' },
  'elite-turtle-ship': { role: 'ship', weapon: 'ship-cannon', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'turtle-shell' },
  'elite-longboat': { role: 'ship', weapon: 'ship-bow', armor: 'timber', headgear: 'none', shield: 'none', mount: 'none', tier: 2, signature: 'dragon-prow' },
} as const satisfies Record<UnitType, AuthoredUnitVisualProfile>;

export function unitVisualProfile(unitType: UnitType): UnitVisualProfile | undefined {
  const profile = (UNIT_VISUAL_PROFILES as Partial<Record<string, AuthoredUnitVisualProfile>>)[unitType];
  if (!profile) return undefined;
  const canonicalRole = unitRole(unitType);
  if (profile.role !== canonicalRole) {
    throw new Error(`Unit visual profile role drifted for ${unitType}: ${profile.role} != ${canonicalRole}`);
  }
  return { ...profile, elite: unitType.startsWith('elite-') };
}
