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

import type {
  RenderableComponent,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import type { BuildingComponent } from '../types';
import type { GameWorld } from './pureHelpers';
import {
  combatStatesCodec,
  playerAgesCodec,
  productionQueuesCodec,
} from './bridgeStateSerialize';
import {
  isArcherLineUnit,
  isCavalryUnit,
  isGunpowderUnit,
  isInfantryUnit,
  isMeleeUnit,
  unitAttackDamage,
  unitAttackRange,
  unitSize,
  unitTint,
  unitVisionRadius,
} from '../prototypeUnitRules';

interface CombatStateLike {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
  armor: number;
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
  const { world, state, accessor, createCombatState, markOutOfBandRenderChange } = deps;
  const {
    researchedTechnologies,
  } = state;

  function upgradeOwnedUnits(owner: number, from: UnitType, to: UnitType): void {
    let didUpgrade = false;
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!unit || unit.owner !== owner || unit.unitType !== from) {
        continue;
      }

      const combat = accessor.get(combatStatesCodec).get(id);
      const hpRatio = combat && combat.maxHp > 0 ? combat.currentHp / combat.maxHp : 1;
      unit.unitType = to;

      const renderable = world.getComponent<RenderableComponent>(id, 'renderable');
      if (renderable) {
        renderable.tint = unitTint(to, owner);
        renderable.size = unitSize(to);
      }

      const vision = world.getComponent<VisionSourceComponent>(id, 'visionSource');
      if (vision) {
        vision.radius = unitVisionRadius(to);
      }

      const nextCombat = createCombatState(owner, to);
      if (combat) {
        nextCombat.cooldownTicks = combat.cooldownTicks;
      }
      nextCombat.currentHp = Math.max(
        1,
        Math.min(nextCombat.maxHp, Math.round(nextCombat.maxHp * hpRatio)),
      );
      accessor.mutate(combatStatesCodec, (m) => m.set(id, nextCombat));
      didUpgrade = true;
    }
    if (didUpgrade) {
      markOutOfBandRenderChange();
    }
  }

  function rewriteQueuedPredecessorUnits(
    owner: number,
    from: TrainableUnitType,
    to: TrainableUnitType,
  ): void {
    const productionQueues = accessor.get(productionQueuesCodec);
    let dirty = false;
    for (const [buildingId, queue] of productionQueues.entries()) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      if (!building || building.owner !== owner) {
        continue;
      }
      for (const entry of queue) {
        if (entry.kind === 'unit' && entry.unitType === from) {
          entry.unitType = to;
          entry.label = to;
          dirty = true;
        }
      }
    }
    if (dirty) {
      accessor.markDirty(productionQueuesCodec);
    }
  }

  function applyTechnology(owner: number, technologyType: ResearchableTechnologyType): void {
    // Idempotency guard (iter-2 H2-1): enqueueResearch only dedupes
    // within the same building's queue, so two producer buildings can
    // race-queue the same tech and reach this completion path twice.
    // Many cases below use += increments (forging, iron-casting,
    // blast-furnace, bracer, every armor tier, ...) so the second call
    // would silently double the bonus. Skip if the tech is already
    // applied for this owner.
    const ownerSet = researchedTechnologies.get(owner);
    if (ownerSet?.has(technologyType)) {
      return;
    }
    ownerSet?.add(technologyType);

    switch (technologyType) {
      case 'feudal-age':
        accessor.mutate(playerAgesCodec, (m) => m.set(owner, 'feudal-age'));
        break;
      case 'castle-age':
        accessor.mutate(playerAgesCodec, (m) => m.set(owner, 'castle-age'));
        break;
      case 'imperial-age':
        // Slice 7A: flip the player to Imperial Age. Individual unit-line
        // upgrade callbacks (Arbalest / Halberdier / Hussar / etc.) land in
        // Slices 7B–7D; 7A only wires the age flip so the gate tests pass.
        accessor.mutate(playerAgesCodec, (m) => m.set(owner, 'imperial-age'));
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
      case 'crossbowman-upgrade':
        upgradeOwnedUnits(owner, 'archer', 'crossbowman');
        rewriteQueuedPredecessorUnits(owner, 'archer', 'crossbowman');
        break;
      case 'pikeman-upgrade':
        upgradeOwnedUnits(owner, 'spearman', 'pikeman');
        rewriteQueuedPredecessorUnits(owner, 'spearman', 'pikeman');
        break;
      case 'light-cavalry-upgrade':
        upgradeOwnedUnits(owner, 'scout', 'light-cavalry');
        rewriteQueuedPredecessorUnits(owner, 'scout', 'light-cavalry');
        break;
      // Slice 7B: Archery Range Imperial upgrades. Each mutates the
      // predecessor line in place and rewrites any queued predecessor
      // training entries so the research swap is effectively instant.
      case 'arbalest-upgrade':
        upgradeOwnedUnits(owner, 'crossbowman', 'arbalest');
        rewriteQueuedPredecessorUnits(owner, 'crossbowman', 'arbalest');
        break;
      case 'heavy-cavalry-archer-upgrade':
        upgradeOwnedUnits(owner, 'cavalry-archer', 'heavy-cavalry-archer');
        rewriteQueuedPredecessorUnits(owner, 'cavalry-archer', 'heavy-cavalry-archer');
        break;
      // Slice 7B: Barracks Imperial upgrades. Halberdier replaces Pikeman;
      // FU2 reinstated the intermediate Man-at-Arms / Long Swordsman /
      // Two-Handed tiers between Militia and Champion.
      case 'halberdier-upgrade':
        upgradeOwnedUnits(owner, 'pikeman', 'halberdier');
        rewriteQueuedPredecessorUnits(owner, 'pikeman', 'halberdier');
        break;
      // FU2 Feudal Barracks: Militia → Man-at-Arms.
      case 'man-at-arms-upgrade':
        upgradeOwnedUnits(owner, 'militia', 'man-at-arms');
        rewriteQueuedPredecessorUnits(owner, 'militia', 'man-at-arms');
        break;
      // FU2 Castle Barracks: Man-at-Arms → Long Swordsman.
      case 'long-swordsman-upgrade':
        upgradeOwnedUnits(owner, 'man-at-arms', 'long-swordsman');
        rewriteQueuedPredecessorUnits(owner, 'man-at-arms', 'long-swordsman');
        break;
      // FU2 Imperial Barracks: Long Swordsman → Two-Handed Swordsman.
      case 'two-handed-swordsman-upgrade':
        upgradeOwnedUnits(owner, 'long-swordsman', 'two-handed-swordsman');
        rewriteQueuedPredecessorUnits(
          owner,
          'long-swordsman',
          'two-handed-swordsman',
        );
        break;
      case 'champion-upgrade':
        // FU2: the owner may hold any tier of the militia line when
        // Champion is researched — walk every predecessor tier so a
        // Militia / Man-at-Arms / Long Swordsman / Two-Handed
        // Swordsman all mutate to Champion. Backward-compat with the
        // Slice 7 "Militia → Champion direct upgrade" path: if the
        // owner skipped the intermediate tiers entirely, the Militia
        // still upgrades straight to Champion.
        upgradeOwnedUnits(owner, 'militia', 'champion');
        upgradeOwnedUnits(owner, 'man-at-arms', 'champion');
        upgradeOwnedUnits(owner, 'long-swordsman', 'champion');
        upgradeOwnedUnits(owner, 'two-handed-swordsman', 'champion');
        rewriteQueuedPredecessorUnits(owner, 'militia', 'champion');
        rewriteQueuedPredecessorUnits(owner, 'man-at-arms', 'champion');
        rewriteQueuedPredecessorUnits(owner, 'long-swordsman', 'champion');
        rewriteQueuedPredecessorUnits(owner, 'two-handed-swordsman', 'champion');
        break;
      // Slice 7C: Stable Imperial upgrades. Hussar replaces Light Cavalry
      // (the scout-line tail) and Cavalier replaces Knight. FU2 extends
      // the Knight line to Paladin and the Camel line to Heavy Camel.
      case 'hussar-upgrade':
        upgradeOwnedUnits(owner, 'light-cavalry', 'hussar');
        rewriteQueuedPredecessorUnits(owner, 'light-cavalry', 'hussar');
        break;
      case 'cavalier-upgrade':
        upgradeOwnedUnits(owner, 'knight', 'cavalier');
        rewriteQueuedPredecessorUnits(owner, 'knight', 'cavalier');
        break;
      case 'paladin-upgrade':
        upgradeOwnedUnits(owner, 'cavalier', 'paladin');
        rewriteQueuedPredecessorUnits(owner, 'cavalier', 'paladin');
        break;
      case 'heavy-camel-upgrade':
        upgradeOwnedUnits(owner, 'camel', 'heavy-camel');
        rewriteQueuedPredecessorUnits(owner, 'camel', 'heavy-camel');
        break;
      // Slice 7C: Castle Imperial upgrade. Britons-gated Elite Longbowman
      // replaces the Longbowman. The research option is civ-filtered in
      // getResearchOptions so this branch only fires for Britons owners.
      case 'elite-longbowman-upgrade':
        upgradeOwnedUnits(owner, 'longbowman', 'elite-longbowman');
        rewriteQueuedPredecessorUnits(owner, 'longbowman', 'elite-longbowman');
        break;
      // Slice 7D: Siege Workshop Imperial upgrades. Each mutates the
      // predecessor siege line in place and rewrites any queued predecessor
      // training entries so the research swap is effectively instant.
      case 'onager-upgrade':
        upgradeOwnedUnits(owner, 'mangonel', 'onager');
        rewriteQueuedPredecessorUnits(owner, 'mangonel', 'onager');
        break;
      case 'heavy-scorpion-upgrade':
        upgradeOwnedUnits(owner, 'scorpion', 'heavy-scorpion');
        rewriteQueuedPredecessorUnits(owner, 'scorpion', 'heavy-scorpion');
        break;
      case 'siege-ram-upgrade':
        upgradeOwnedUnits(owner, 'battering-ram', 'siege-ram');
        rewriteQueuedPredecessorUnits(owner, 'battering-ram', 'siege-ram');
        break;
      // Slice 7E Blacksmith Imperial tier. Each tech walks every owned unit
      // and re-applies its bonus so existing armies benefit immediately.
      // Newly trained units receive the same bonus via createCombatState
      // (mirrors the Fletching pattern). The bonuses are cumulative: a
      // Champion can receive Blast Furnace atk + Plate Mail armor on the
      // same tick if both are researched (in any order).
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
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isInfantryUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
        break;
      case 'plate-barding':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isCavalryUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
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
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isInfantryUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
        break;
      case 'scale-barding-armor':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isCavalryUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
        break;
      case 'padded-archer-armor':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isArcherLineUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
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
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isInfantryUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
        break;
      case 'chain-barding-armor':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isCavalryUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
        break;
      case 'leather-archer-armor':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isArcherLineUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
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
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = accessor.get(combatStatesCodec).get(id);
          if (!unit || !combat || unit.owner !== owner || !isArcherLineUnit(unit.unitType)) {
            continue;
          }

          combat.armor += 1;
        }
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
    }
    // Phase 2D: many tech branches mutate combat objects in place
    // (combat.attackDamage += 1, combat.armor += 1, etc.). The accessor's
    // dirty bit needs to fire so the bridgeSnapshotSystem captures the
    // changes at end of tick. Conservatively mark dirty once at end of
    // every applyTechnology call — the few tech branches that don't touch
    // combat (e.g. unlock-only techs) are still correct, just one
    // unnecessary serialize per such tech.
    accessor.markDirty(combatStatesCodec);
  }

  return {
    applyTechnology,
    upgradeOwnedUnits,
    rewriteQueuedPredecessorUnits,
  };
}
