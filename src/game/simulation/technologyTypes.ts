// The researchable-technology union, extracted from types.ts so that adding a
// tech does not push types.ts over its 500-LOC budget. Re-exported from
// types.ts, so existing `import { ResearchableTechnologyType } from './types'`
// sites are unaffected.

export type ResearchableTechnologyType =
  | 'feudal-age'
  | 'castle-age'
  | 'imperial-age'
  | 'fletching'
  | 'crossbowman-upgrade'
  | 'pikeman-upgrade'
  | 'light-cavalry-upgrade'
  | 'arbalest-upgrade'
  | 'halberdier-upgrade'
  | 'hussar-upgrade'
  | 'heavy-cavalry-archer-upgrade'
  | 'cavalier-upgrade'
  | 'champion-upgrade'
  | 'elite-longbowman-upgrade'
  | 'onager-upgrade'
  | 'heavy-scorpion-upgrade'
  | 'siege-ram-upgrade'
  // Siege Engineers (Siege Workshop, Imperial): +1 attack range to every SIEGE
  // unit. DERIVED at createCombatState for new units + imperative per-unit loop
  // in applyTechnology for existing ones (Fletching pattern). Spec §10.7.1.
  | 'siege-engineers'
  // Sappers (Blacksmith / AoE2 University, Imperial): +15 attack vs BUILDINGS to
  // every INFANTRY unit. DERIVED (pure) at the unit->building damage site — no
  // per-unit state, no applyTechnology loop (buildingArrowTechEffects pattern).
  // Spec §10.7.2.
  | 'sappers'
  | 'bracer'
  | 'blast-furnace'
  | 'plate-mail-armor'
  | 'plate-barding'
  // FU1: Blacksmith tiers — Feudal (forging/scale/padded), Castle (iron-casting/chain/leather/bodkin), Imperial (ring/chemistry).
  | 'forging'
  | 'scale-mail-armor'
  | 'scale-barding-armor'
  | 'padded-archer-armor'
  | 'iron-casting'
  | 'chain-mail-armor'
  | 'chain-barding-armor'
  | 'leather-archer-armor'
  | 'bodkin-arrow'
  | 'ring-archer-armor'
  | 'chemistry'
  // FU2: Militia-line intermediates + Paladin + Heavy Camel Imperial upgrades (each mutates the predecessor unit in place via upgradeOwnedUnits + rewriteQueuedPredecessorUnits).
  | 'man-at-arms-upgrade'
  | 'long-swordsman-upgrade'
  | 'two-handed-swordsman-upgrade'
  | 'paladin-upgrade'
  | 'heavy-camel-upgrade'
  // DERIVED economy techs (recomputed from the researched-tech set at use time — economyTechEffects, no per-entity state): gather-rate (Lumber/Mining Camp), carry-capacity (Town Center), farm-food (Mill — Horse Collar/Heavy Plow/Crop Rotation → 250/375/550, spec §6.5/§6.6).
  | 'double-bit-axe'
  | 'bow-saw'
  | 'two-man-saw'
  | 'gold-mining'
  | 'gold-shaft-mining'
  | 'stone-mining'
  | 'stone-shaft-mining'
  | 'wheelbarrow'
  | 'hand-cart'
  | 'horse-collar'
  | 'heavy-plow'
  | 'crop-rotation'
  // Loom (Town Center, Dark, 50 gold): +15 villager HP + +1 armor, imperative to existing + future villagers — spec §11.8.
  | 'loom'
  // DERIVED defensive tower-upgrade techs (Watch Tower): Guard Tower (Castle, +2 attack) → Keep (Imperial, +2 attack + +1 range). Recomputed from the researched set at the tower fire site (towerTechEffects); no per-building state. HP scaling deferred. Spec §10.8.
  | 'guard-tower'
  | 'keep'
  // Monastery monk techs — Block Printing (Castle, +2 convert range, DERIVED), Sanctity (Castle, +15 monk HP, imperative like Loom), Faith (Imperial, halves incoming conversion progress on the owner's units, DERIVED at the convert site). Spec §10.9.
  | 'block-printing'
  | 'sanctity'
  | 'faith';
