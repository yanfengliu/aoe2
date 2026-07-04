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
  // Bloodlines (Stable, FEUDAL — technologies.csv:78): +20 HP to every MOUNTED
  // unit (cavalry + cavalry archers; scope+gate conformance-fixed v0.1.67).
  // Imperative HP bump like Loom/Sanctity — combatStateFactory for new units +
  // applyTechnology loop (bloodlinesEffect) for existing ones. Spec §11.9.
  | 'bloodlines'
  // Sappers (Blacksmith / AoE2 University, Imperial): +15 attack vs BUILDINGS to
  // every INFANTRY unit. DERIVED (pure) at the unit->building damage site — no
  // per-unit state, no applyTechnology loop (buildingArrowTechEffects pattern).
  // Spec §10.7.2.
  | 'sappers'
  // Husbandry (Stable, Castle): +10% movement speed for MOUNTED units (cavalry
  // + cavalry archers). DERIVED (pure movementTechEffects) inside the single
  // step executor moveUnitOneSubgridStep via the per-unit carry accumulator
  // (moveCarryHundredths — additive save field, engaged only at percent ≠ 100).
  // Spec §12.5.
  | 'husbandry'
  // Squires (Barracks, Castle): +10% movement speed for INFANTRY. Same DERIVED
  // movement-speed seam as Husbandry (movementSpeedPercent + the carry). Spec
  // §12.5.
  | 'squires'
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
  | 'faith'
  // Herbal Medicine (Monastery, Castle): garrisoned units of the owner heal 4× faster. DERIVED multiplier on the garrison-heal rate (monasteryTechEffects) at the garrisonHealSystem site; no per-unit state. Spec §10.9.
  | 'herbal-medicine'
  // Heresy (Monastery, Castle): a unit whose owner has Heresy DIES instead of converting. DERIVED at the conversion flip site (applyMonkConvert) — destroyUnitEntity instead of flipConvertedUnit. Spec §10.9.
  | 'heresy'
  // LoS techs (visionTechEffects): Town Watch (TC, Feudal, +4 building LoS), Town Patrol (TC, Castle, req Town Watch, +4 more), Tracking (Barracks, Feudal, +2 infantry LoS). Imperative visionSource.radius bump to existing entities + derived at creation for future ones.
  | 'town-watch'
  | 'town-patrol'
  | 'tracking'
  // Conscription (Castle, Imperial): units trained at Barracks/Archery Range/Stable/Castle are created 25% faster. DERIVED train-time multiplier (productionTechEffects) at the trainingMarketOps enqueue.
  | 'conscription';
