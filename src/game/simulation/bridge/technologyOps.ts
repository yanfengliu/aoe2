// Technology application pipeline. Each research completion fans out to
// side-map mutations (age flips, combat-state bumps, queued-unit rewrites,
// owned-unit replacements) — factored out of `createSimulationBridge.ts` so
// the switch-per-tech lives next to its two helpers (`upgradeOwnedUnits` +
// `rewriteQueuedPredecessorUnits`) in one module.
//
// Same flat dep-bag pattern as the other `bridge/` extractions: the factory
// closes over every side map and collaborator; ownership still lives in
// createWorld so save/load serialization, production-queue bookkeeping, and
// the other ~80 touches of these maps in the bridge keep using the same
// references.

import { applyUniqueTechnologyToOwnedUnits } from './uniqueTechEffect';
import { ATHEISM_COUNTDOWN_EXTENSION_TICKS } from '../uniqueTechnologies';
import { relicCountdownsCodec, wonderCountdownsCodec } from './bridgeStateSerialize';
import { createTechnologyUnitSweeps } from './technologyUnitSweeps';
import { applyBuildingHpTechnology } from './buildingHpTechEffect';
import { UNIT_LINE_UPGRADES } from './unitLineUpgrades';
import type {
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
  UnitType,
} from '../types';
import type { GameWorld } from './pureHelpers';
import { applyLoomToOwnedVillagers } from './loomEffect';
import { applySanctityToOwnedMonks } from './sanctityEffect';
import { applyBloodlinesToOwnedCavalry } from './bloodlinesEffect';
import {
  applyBuildingVisionDelta,
  applyInfantryVisionDelta,
  applyOutpostVisionDelta,
} from './losTechEffect';
import {
  OUTPOST_VISION_PER_AGE,
  TOWN_WATCH_BUILDING_VISION_BONUS,
  TOWN_PATROL_BUILDING_VISION_BONUS,
  TRACKING_INFANTRY_VISION_BONUS,
} from '../visionTechEffects';
import {
  combatStatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerResourcesCodec,
  populationCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import { civAgeAdvanceGrant } from '../civBonusEffects';
import { applyAgeScaledHpSweep } from './ageScaledHpSweep';
import { ownerHardPopCap } from './ownerPopCap';
import { deriveCap } from './bridgeConstants';
import {
  isArcherLineUnit,
  isCavalryArcherUnit,
  isCavalryUnit,
  isGunpowderUnit,
  isInfantryUnit,
  isMeleeUnit,
  isSiegeUnit,
  unitAttackDamage,
  unitAttackRange,
} from '../prototypeUnitRules';

interface CombatStateLike {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
  armor: number;
  pierceArmorBonus: number;
}

export interface TechnologyDeps {
  world: GameWorld;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — playerAges write via accessor.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  createCombatState: (owner: number, unitType: UnitType) => CombatStateLike;
  // Tells the bridge that an in-place mutation just changed a projector-
  // relevant component (renderable, unit, building, resource owner/type).
  // Required because civ-engine 0.5.0+ no longer auto-detects in-place
  // component mutations, so the RenderAdapter would otherwise keep the
  // pre-upgrade projection forever.
  markOutOfBandRenderChange: () => void;
}

export interface TechnologyOps {
  // Apply every side effect of `technologyType` for `owner`. Called from the
  // research-completion system once the research-ticks countdown hits zero.
  applyTechnology(owner: number, technologyType: ResearchableTechnologyType): void;
  // Mutate every owned `from`-type unit to `to`, preserving HP ratio and
  // cooldown progress. Used by the predecessor-line Imperial upgrades and
  // by Champion's multi-tier walk.
  upgradeOwnedUnits(owner: number, from: UnitType, to: UnitType): void;
  // Rewrite every still-pending training-queue entry on owned buildings
  // whose stored unitType matches the predecessor to the upgraded type.
  // Progress ticks and costs are preserved — only the type mutates — so a
  // half-trained predecessor finishes as the upgraded unit, matching the
  // "old line no longer trainable" invariant.
  rewriteQueuedPredecessorUnits(
    owner: number,
    from: TrainableUnitType,
    to: TrainableUnitType,
  ): void;
}

export function createTechnologyOps(deps: TechnologyDeps): TechnologyOps {
  const { world, accessor, createCombatState, markOutOfBandRenderChange } = deps;

  // The owner-wide unit sweeps (line upgrades, armour bonuses, queue
  // rewrites) live in technologyUnitSweeps so this file stays a switch of
  // DECISIONS rather than a file of loops.
  const {
    upgradeOwnedUnits,
    applyArmorTechToOwnedUnits,
    applyCareeningToOwnedShips,
    rewriteQueuedPredecessorUnits,
  } = createTechnologyUnitSweeps({
    world,
    accessor,
    createCombatState,
    markOutOfBandRenderChange,
  });

  function applyTechnology(owner: number, technologyType: ResearchableTechnologyType): void {
    // Idempotency guard (iter-2 H2-1): two producer buildings can race-queue
    // the same tech and reach this completion path twice. Many cases below use
    // += increments (forging, the armor tiers, Loom, …), so a second call would
    // silently double the bonus. Skip if already applied for this owner.
    const ownerSet = accessor.get(researchedTechnologiesCodec).get(owner);
    if (ownerSet?.has(technologyType)) {
      return;
    }
    if (ownerSet) {
      ownerSet.add(technologyType);
      accessor.markDirty(researchedTechnologiesCodec);
    }

    // Unit-line upgrades are a table (unitLineUpgrades.ts), not control flow.
    const lineUpgrade = UNIT_LINE_UPGRADES[technologyType];
    for (const from of lineUpgrade?.from ?? []) {
      upgradeOwnedUnits(owner, from, lineUpgrade!.to);
      rewriteQueuedPredecessorUnits(owner, from, lineUpgrade!.to);
    }

    // Ethiopians: "+100 gold and +100 food when advancing to the next age" —
    // paid the moment the advance completes, into the same stockpile the
    // advance was paid from.
    const grantAgeAdvanceBonus = (): void => {
      const grant = civAgeAdvanceGrant(accessor.get(playerCivilizationsCodec).get(owner));
      if (!grant) return;
      const stockpile = accessor.get(playerResourcesCodec).get(owner);
      if (!stockpile) return;
      stockpile.food += grant.food ?? 0;
      stockpile.wood += grant.wood ?? 0;
      stockpile.gold += grant.gold ?? 0;
      stockpile.stone += grant.stone ?? 0;
      accessor.markDirty(playerResourcesCodec);
    };

    switch (technologyType) {
      case 'feudal-age':
        accessor.mutate(playerAgesCodec, (m) => m.set(owner, 'feudal-age'));
        grantAgeAdvanceBonus();
        applyAgeScaledHpSweep(world, accessor, owner, 'dark-age', 'feudal-age');
        // structures.csv "Outpost": +2 line of sight per age, for the posts
        // already standing. One built afterwards derives the same total.
        applyOutpostVisionDelta(world, owner, OUTPOST_VISION_PER_AGE);
        markOutOfBandRenderChange();
        break;
      case 'castle-age':
        accessor.mutate(playerAgesCodec, (m) => m.set(owner, 'castle-age'));
        grantAgeAdvanceBonus();
        applyAgeScaledHpSweep(world, accessor, owner, 'feudal-age', 'castle-age');
        applyOutpostVisionDelta(world, owner, OUTPOST_VISION_PER_AGE);
        markOutOfBandRenderChange();
        break;
      case 'imperial-age':
        // Slice 7A: flip the player to Imperial Age. Individual unit-line
        // upgrade callbacks (Arbalest / Halberdier / Hussar / etc.) land in
        // Slices 7B–7D; 7A only wires the age flip so the gate tests pass.
        accessor.mutate(playerAgesCodec, (m) => m.set(owner, 'imperial-age'));
        grantAgeAdvanceBonus();
        applyAgeScaledHpSweep(world, accessor, owner, 'castle-age', 'imperial-age');
        {
          // Goths: the hard population limit itself moves on Imperial, with
          // no supply change to trigger a re-derive — so re-derive here.
          const populationState = accessor.get(populationCodec).get(owner);
          if (populationState) {
            populationState.cap = deriveCap(
              populationState.rawSupply,
              ownerHardPopCap(accessor, owner),
            );
            accessor.markDirty(populationCodec);
          }
        }
        applyOutpostVisionDelta(world, owner, OUTPOST_VISION_PER_AGE);
        markOutOfBandRenderChange();
        break;
      case 'fletching':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isArcherLineUnit(unit.unitType)) {
            continue;
          }

          combat.attackDamage = unitAttackDamage(unit.unitType) + 1;
          combat.attackRange = unitAttackRange(unit.unitType) + 1;
        }
        break;
      // M5 naval, Dock: the ship upgrade lines. Cannon Galleon has no
      // predecessor to convert — its technology only UNLOCKS training.
      case 'cannon-galleon-unlock':
        break;
      // Slice 7B: Archery Range Imperial upgrades. Each mutates the
      // predecessor line in place and rewrites any queued predecessor
      // training entries so the research swap is effectively instant.
      // Slice 7B: Barracks Imperial upgrades. Halberdier replaces Pikeman;
      // FU2 reinstated the intermediate Man-at-Arms / Long Swordsman /
      // Two-Handed tiers between Militia and Champion.
      // FU2 Feudal Barracks: Militia → Man-at-Arms.
      // FU2 Castle Barracks: Man-at-Arms → Long Swordsman.
      // FU2 Imperial Barracks: Long Swordsman → Two-Handed Swordsman.
      // Slice 7C: Stable Imperial upgrades. Hussar replaces Light Cavalry
      // (the scout-line tail) and Cavalier replaces Knight. FU2 extends
      // the Knight line to Paladin and the Camel line to Heavy Camel.
      // Slice 7C: Castle Imperial upgrade. Britons-gated Elite Longbowman
      // replaces the Longbowman. The research option is civ-filtered in
      // getResearchOptions so this branch only fires for Britons owners.
      // Slice 7D: Siege Workshop Imperial upgrades. Each mutates the
      // predecessor siege line in place and rewrites any queued predecessor
      // training entries so the research swap is effectively instant.
      // Siege Engineers: +1 attack range to every owned SIEGE unit. New siege
      // units get it via createCombatState (Fletching pattern). The already-
      // researched guard at the top of applyTechnology keeps this single-
      // applied so the += 1 never double-stacks.
      case 'siege-engineers':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isSiegeUnit(unit.unitType)) {
            continue;
          }

          combat.attackRange += 1;
        }
        break;
      // Slice 7E Blacksmith Imperial tier. Each tech re-applies its bonus to
      // every owned unit; new units get it via createCombatState (Fletching
      // pattern). Bonuses are cumulative across techs.
      case 'bracer':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isArcherLineUnit(unit.unitType)) {
            continue;
          }

          combat.attackDamage += 1;
          combat.attackRange += 1;
        }
        break;
      case 'blast-furnace':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isMeleeUnit(unit.unitType)) {
            continue;
          }

          combat.attackDamage += 2;
        }
        break;
      case 'plate-mail-armor':
        applyArmorTechToOwnedUnits(owner, 'plate-mail-armor', isInfantryUnit);
        break;
      case 'plate-barding':
        applyArmorTechToOwnedUnits(owner, 'plate-barding', isCavalryUnit);
        break;
      // FU1: Feudal Blacksmith tier.
      case 'forging':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isMeleeUnit(unit.unitType)) {
            continue;
          }

          combat.attackDamage += 1;
        }
        break;
      case 'scale-mail-armor':
        applyArmorTechToOwnedUnits(owner, 'scale-mail-armor', isInfantryUnit);
        break;
      case 'scale-barding-armor':
        applyArmorTechToOwnedUnits(owner, 'scale-barding-armor', isCavalryUnit);
        break;
      case 'padded-archer-armor':
        applyArmorTechToOwnedUnits(owner, 'padded-archer-armor', isArcherLineUnit);
        break;
      // FU1: Castle Blacksmith tier. Stacks on Feudal tier.
      case 'iron-casting':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isMeleeUnit(unit.unitType)) {
            continue;
          }

          combat.attackDamage += 1;
        }
        break;
      case 'chain-mail-armor':
        applyArmorTechToOwnedUnits(owner, 'chain-mail-armor', isInfantryUnit);
        break;
      case 'chain-barding-armor':
        applyArmorTechToOwnedUnits(owner, 'chain-barding-armor', isCavalryUnit);
        break;
      case 'leather-archer-armor':
        applyArmorTechToOwnedUnits(owner, 'leather-archer-armor', isArcherLineUnit);
        break;
      case 'bodkin-arrow':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isArcherLineUnit(unit.unitType)) {
            continue;
          }

          combat.attackDamage += 1;
          combat.attackRange += 1;
        }
        break;
      // FU1: Imperial Blacksmith tier additions.
      case 'ring-archer-armor':
        applyArmorTechToOwnedUnits(owner, 'ring-archer-armor', isArcherLineUnit);
        break;
      // Parthian Tactics' armor half. Its ATTACK half is derived at the damage
      // site (parthianTechEffects) rather than stored here, because the bonus
      // depends on the target's armor class.
      case 'careening':
        applyCareeningToOwnedShips(owner);
        break;
      case 'parthian-tactics':
        applyArmorTechToOwnedUnits(owner, 'parthian-tactics', isCavalryArcherUnit);
        break;
      case 'chemistry':
        // Chemistry grants +1 attack to archer-line units AND to
        // gunpowder units (Bombard Cannon in v1). Gating of Bombard
        // Cannon training at the Siege Workshop happens in the train
        // options (`canTrainAt` / `getTrainOptions`) — Chemistry is
        // required before the unit can be queued.
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner) {
            continue;
          }
          if (isArcherLineUnit(unit.unitType) || isGunpowderUnit(unit.unitType)) {
            combat.attackDamage += 1;
          }
        }
        break;
      case 'loom':
        // Loom: flat +15 HP (current + max) + +1 armor to every owned villager
        // (new villagers get it via createCombatState). See loomEffect.ts for
        // why this is flat (not ratio) and how the race guard above keeps it
        // single-applied.
        applyLoomToOwnedVillagers(world, accessor, owner);
        markOutOfBandRenderChange();
        break;
      case 'sanctity':
        // Sanctity: flat +15 HP (current + max) to every owned monk (new monks
        // get it via createCombatState). Mirrors Loom for villagers.
        applySanctityToOwnedMonks(world, accessor, owner);
        markOutOfBandRenderChange();
        break;
      case 'bloodlines':
        // Bloodlines: flat +20 HP (current + max) to every owned MOUNTED unit
        // (cavalry + cavalry archers, csv:78; new ones get it via
        // createCombatState). Mirrors Loom/Sanctity.
        applyBloodlinesToOwnedCavalry(world, accessor, owner);
        markOutOfBandRenderChange();
        break;
      // Civilization unique technologies: the units already on the field are
      // bumped here, everything trained after derives it in createCombatState.
      // A technology with no unit effect (Anarchy, Perfusion, and the building
      // ones) falls through this harmlessly and is read where it is used.
      case 'garland-wars':
      case 'yeomen':
      case 'logistica':
      case 'furor-celtica':
      case 'rocketry':
      case 'bearded-axe':
      case 'anarchy':
      case 'perfusion':
      case 'kataparuto':
      case 'shinkichon':
      case 'drill':
      case 'mahouts':
      case 'zealotry':
      case 'supremacy':
      case 'crenellations':
      case 'artillery':
        applyUniqueTechnologyToOwnedUnits(world, accessor, owner, technologyType);
        markOutOfBandRenderChange();
        break;
      // Guard Tower and Keep already raised a Watch Tower's ATTACK and RANGE at
      // the fire site; structures.csv also gives each tier more hit points
      // (1020 -> 1500 -> 2250), and Fortified Wall takes a Stone Wall from
      // 1800 to 3000 — all of which is this seam.
      case 'atheism':
        // +100 years to every Wonder/Relic countdown IN FLIGHT; countdowns
        // that start later read the any-owner-has-atheism rule at creation.
        // The Spies discount rides the researched set through spiesRules.
        accessor.mutate(wonderCountdownsCodec, (m) => {
          for (const entry of m.values()) {
            entry.remainingTicks += ATHEISM_COUNTDOWN_EXTENSION_TICKS;
            entry.totalTicks += ATHEISM_COUNTDOWN_EXTENSION_TICKS;
          }
        });
        accessor.mutate(relicCountdownsCodec, (m) => {
          for (const entry of m.values()) {
            entry.remainingTicks += ATHEISM_COUNTDOWN_EXTENSION_TICKS;
            entry.totalTicks += ATHEISM_COUNTDOWN_EXTENSION_TICKS;
          }
        });
        break;
      case 'masonry':
      case 'architecture':
      case 'fortified-wall':
      case 'guard-tower':
      case 'keep':
      case 'hoardings':
        // Hoardings takes a Castle from 4800 to 5808, which technologies.csv
        // spells out as "+21% HP (HP*1.21 - 5808 HP)".
        //
        // Buildings already standing get the bump here; everything built after
        // this derives it at creation (entityCreateOps).
        applyBuildingHpTechnology(world, accessor, owner, technologyType);
        markOutOfBandRenderChange();
        break;
      case 'treadmill-crane':
      case 'heated-shot':
      case 'bombard-tower-unlock':
        // All three are DERIVED at the point of use — the build loop reads
        // buildRateMultiplier, tower fire reads heatedShotMultiplier, and the
        // Bombard Tower unlock is read by the villager build menu — so
        // researching them writes nothing.
        break;
      case 'town-watch':
        // Town Watch / Town Patrol: +4 LoS to every owned building; new ones
        // derive it at finalizeBuildingConstruction. Fog re-stamps next tick.
        applyBuildingVisionDelta(world, owner, TOWN_WATCH_BUILDING_VISION_BONUS);
        markOutOfBandRenderChange();
        break;
      case 'town-patrol':
        applyBuildingVisionDelta(world, owner, TOWN_PATROL_BUILDING_VISION_BONUS);
        markOutOfBandRenderChange();
        break;
      case 'tracking':
        // Tracking: +2 LoS to every owned infantry unit; new ones derive it at
        // productionQueueSystem's train site.
        applyInfantryVisionDelta(world, owner, TRACKING_INFANTRY_VISION_BONUS);
        markOutOfBandRenderChange();
        break;
    }
    // Phase 2D: tech branches mutate combat in place, so mark the slot dirty
    // once so bridgeSnapshot captures them (unlock-only techs pay one extra
    // serialize). The `get` populates the cache first, so markDirty is valid
    // even when neither the tech nor the rest of this tick touched combat — a
    // unit-less owner researching a non-combat tech would otherwise crash the
    // flush ("marked dirty but no native value is cached").
    accessor.get(combatStatesCodec);
    accessor.markDirty(combatStatesCodec);
  }

  return {
    applyTechnology,
    upgradeOwnedUnits,
    rewriteQueuedPredecessorUnits,
  };
}
