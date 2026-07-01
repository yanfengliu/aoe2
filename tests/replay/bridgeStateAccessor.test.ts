import { describe, expect, it } from 'vitest';
import { World } from 'civ-engine';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  combatStatesCodec,
  marketExchangeRatesCodec,
  researchedTechnologiesCodec,
  TIER_1_CODECS,
  SLOT_CODECS_BY_KEY,
  TIER_3_SLOTS,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';

function makeWorld(): GameWorld {
  return new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 20,
    gridHeight: 20,
    tps: 10,
    seed: 'accessor-test',
  });
}

describe('BridgeStateAccessor', () => {
  describe('codec table', () => {
    it('registers exactly 35 Tier-1 codecs (DESIGN §3 inventory)', () => {
      expect(TIER_1_CODECS.length).toBe(35);
    });

    it('every codec slot is unique', () => {
      const slots = TIER_1_CODECS.map((c) => c.slot);
      expect(new Set(slots).size).toBe(slots.length);
    });

    it('every codec slot is keyed under "aoe2." namespace', () => {
      for (const codec of TIER_1_CODECS) {
        expect(codec.slot.startsWith('aoe2.')).toBe(true);
      }
    });

    it('SLOT_CODECS_BY_KEY indexes every codec', () => {
      expect(SLOT_CODECS_BY_KEY.size).toBe(TIER_1_CODECS.length);
      for (const codec of TIER_1_CODECS) {
        expect(SLOT_CODECS_BY_KEY.get(codec.slot)).toBe(codec);
      }
    });

    it('Tier-3 slot keys are namespaced and distinct from Tier-1', () => {
      expect(TIER_3_SLOTS.visibility).toBe('aoe2.visibility');
      expect(TIER_3_SLOTS.matchState).toBe('aoe2.matchState');
      expect(TIER_3_SLOTS.bridgeMeta).toBe('aoe2.bridgeMeta');
      // No collision with Tier-1.
      for (const tier3 of Object.values(TIER_3_SLOTS)) {
        expect(SLOT_CODECS_BY_KEY.has(tier3)).toBe(false);
      }
    });
  });

  describe('codec round-trip', () => {
    it('flatMap codec round-trips an empty Map', () => {
      const original = new Map<number, { currentHp: number; maxHp: number; armor: number; attackDamage: number; attackRange: number; reloadTicks: number; cooldownTicks: number; pierceArmorBonus: number }>();
      const json = combatStatesCodec.serialize(original);
      const restored = combatStatesCodec.deserialize(json);
      expect(restored).toEqual(original);
    });

    it('flatMap codec round-trips populated Map via JSON', () => {
      const original = new Map([
        [
          1,
          { currentHp: 50, maxHp: 60, armor: 1, attackDamage: 5, attackRange: 1, reloadTicks: 10, cooldownTicks: 0, pierceArmorBonus: 0 },
        ],
        [
          2,
          { currentHp: 30, maxHp: 60, armor: 0, attackDamage: 3, attackRange: 4, reloadTicks: 12, cooldownTicks: 5, pierceArmorBonus: 0 },
        ],
      ]);
      const json = combatStatesCodec.serialize(original);
      // Forces JSON-string round-trip for type-safety.
      const stringified = JSON.parse(JSON.stringify(json));
      const restored = combatStatesCodec.deserialize(stringified);
      expect(restored).toEqual(original);
    });

    it('mapOfMap codec round-trips Map<K, Map<K2, V>> via JSON', async () => {
      // Use lastSeenStaticCodec — the only nested-Map slot. This is the
      // most non-trivial codec and most likely to mask a typo in the
      // helper, so an explicit JSON-string round-trip closes the
      // coverage gap on the helper factory.
      const { lastSeenStaticCodec } = await import(
        '../../src/game/simulation/bridge/bridgeStateSerialize'
      );
      const entry = (lastSeenTick: number, owner: number | null) => ({
        kind: 'building' as const,
        entityType: 'town-center' as const,
        position: { x: 8, y: 8 },
        footprintWidth: 4,
        footprintHeight: 4,
        tint: 0xff0000,
        owner,
        size: 4,
        visualVariant: 'default' as const,
        lastSeenTick,
      });
      const original = new Map([
        [
          1,
          new Map([
            [101, entry(50, 1)],
            [102, entry(200, 1)],
          ]),
        ],
        [2, new Map([[201, entry(0, null)]])],
      ]);
      const json = lastSeenStaticCodec.serialize(original);
      const stringified = JSON.parse(JSON.stringify(json));
      const restored = lastSeenStaticCodec.deserialize(stringified);
      expect(restored.get(1)?.get(101)?.lastSeenTick).toBe(50);
      expect(restored.get(1)?.get(102)?.lastSeenTick).toBe(200);
      expect(restored.get(2)?.get(201)?.owner).toBe(null);
      expect(restored.size).toBe(2);
      expect(restored.get(1)?.size).toBe(2);
      expect(restored.get(2)?.size).toBe(1);
    });

    it('mapOfSet codec round-trips Map<K, Set<V>>', () => {
      const original = new Map<number, Set<'feudal-age' | 'castle-age'>>([
        [1, new Set(['feudal-age'])],
        [2, new Set(['feudal-age', 'castle-age'])],
      ]);
      const json = researchedTechnologiesCodec.serialize(original);
      const restored = researchedTechnologiesCodec.deserialize(json);
      expect(restored.get(1)).toEqual(new Set(['feudal-age']));
      expect(restored.get(2)).toEqual(new Set(['feudal-age', 'castle-age']));
    });

    it('plain-object codec deserialize undefined returns default initial rates', () => {
      const restored = marketExchangeRatesCodec.deserialize(undefined);
      // Default rates from createInitialMarketRates (MARKET_BASE_RATE=100).
      expect(restored.food).toBe(100);
      expect(restored.wood).toBe(100);
      expect(restored.stone).toBe(100);
    });

    it('flatMap codec deserialize undefined returns empty Map', () => {
      const restored = combatStatesCodec.deserialize(undefined);
      expect(restored.size).toBe(0);
    });
  });

  describe('lazy world binding', () => {
    it('throws an explicit error when used before world is bound', () => {
      const accessor = new BridgeStateAccessor(() => undefined);
      expect(() => accessor.get(combatStatesCodec)).toThrow(
        /BridgeStateAccessor used before world bound/,
      );
    });

    it('returns cached value after first read (cache-coherence invariant)', () => {
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      const first = accessor.get(combatStatesCodec);
      const second = accessor.get(combatStatesCodec);
      expect(first).toBe(second);
    });
  });

  describe('mutate helper', () => {
    it('marks dirty after mutation', () => {
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      expect(accessor.dirtySize).toBe(0);
      accessor.mutate(combatStatesCodec, (m) =>
        m.set(1, { currentHp: 100, maxHp: 100, armor: 0, attackDamage: 0, attackRange: 0, reloadTicks: 0, cooldownTicks: 0, pierceArmorBonus: 0 }),
      );
      expect(accessor.dirtySize).toBe(1);
    });

    it('flush re-serializes dirty slots back to world.state', () => {
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      accessor.mutate(combatStatesCodec, (m) =>
        m.set(7, { currentHp: 25, maxHp: 60, armor: 1, attackDamage: 2, attackRange: 1, reloadTicks: 8, cooldownTicks: 0, pierceArmorBonus: 0 }),
      );
      accessor.flush();
      // After flush, dirty set is empty; world.state has the serialized form.
      expect(accessor.dirtySize).toBe(0);
      const serialized = world.getState(combatStatesCodec.slot) as Array<[number, unknown]>;
      expect(serialized).toBeDefined();
      // Hydrate via codec to verify round-trip.
      const restored = combatStatesCodec.deserialize(
        JSON.parse(JSON.stringify(serialized)) as Array<[number, { currentHp: number; maxHp: number; armor: number; attackDamage: number; attackRange: number; reloadTicks: number; cooldownTicks: number; pierceArmorBonus: number }]>,
      );
      expect(restored.get(7)?.currentHp).toBe(25);
    });

    it('flush is a no-op when nothing is dirty', () => {
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      accessor.get(combatStatesCodec); // read populates cache, doesn't mark dirty
      const before = world.getState(combatStatesCodec.slot);
      accessor.flush();
      expect(world.getState(combatStatesCodec.slot)).toBe(before);
    });
  });

  describe('alias decoupling on both boundaries', () => {
    it('mutating a value-object after flush does NOT mutate world.state', () => {
      // Without the structuredClone in flush(), codec.serialize's
      // Array.from(map) tuples share value-references with the cached Map,
      // world.setState stores that array, and subsequent property
      // mutations on the cached Map's values would propagate to
      // world.state without dirty-tracking.
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      accessor.mutate(combatStatesCodec, (m) =>
        m.set(1, {
          currentHp: 100,
          maxHp: 100,
          armor: 0,
          attackDamage: 5,
          attackRange: 1,
          reloadTicks: 10,
          cooldownTicks: 0,
          pierceArmorBonus: 0,
        }),
      );
      accessor.flush();
      const beforeMutation = structuredClone(
        world.getState(combatStatesCodec.slot),
      );

      // Mutate a property on the cached Map's value-object WITHOUT
      // calling markDirty. Without the flush-side structuredClone, this
      // property mutation would propagate to world.state immediately,
      // bypassing dirty-tracking.
      const cached = accessor.get(combatStatesCodec).get(1)!;
      cached.currentHp = 50;

      expect(world.getState(combatStatesCodec.slot)).toEqual(beforeMutation);
    });

    it('mutating a value-object after reset()+get does NOT mutate world.state', () => {
      // The flush-side clone alone is insufficient: post-reset, the next
      // get() reads world.state and shallow-deserializes via
      // codec.deserialize, so cached value-references would alias
      // world.state UNLESS deserialize input is also decoupled.
      // structuredClone at the read boundary closes that gap.
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      accessor.mutate(combatStatesCodec, (m) =>
        m.set(7, {
          currentHp: 80,
          maxHp: 100,
          armor: 1,
          attackDamage: 5,
          attackRange: 1,
          reloadTicks: 10,
          cooldownTicks: 0,
          pierceArmorBonus: 0,
        }),
      );
      accessor.flush();
      // Simulate post-applySnapshot transition: reset clears the cache.
      accessor.reset();
      const beforeMutation = structuredClone(
        world.getState(combatStatesCodec.slot),
      );

      // First get() after reset re-reads world.state. Without the read-
      // side clone, the cached Map's value would alias the world.state
      // tuple's value, so this property mutation would propagate.
      const restored = accessor.get(combatStatesCodec).get(7)!;
      restored.currentHp = 1;

      expect(world.getState(combatStatesCodec.slot)).toEqual(beforeMutation);
    });

    it('flush throws when a dirty slot has no codec in the registry', () => {
      // Silent `continue` would lose the write and clear the dirty flag.
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      accessor.markDirty('aoe2.unknownSlot');
      expect(() => accessor.flush()).toThrow(/aoe2\.unknownSlot/);
    });

    it('flush pre-pass: throwing on an unknown slot does NOT strand later valid writes', () => {
      // Without pre-validation, an unknown slot would throw mid-loop after
      // possibly skipping valid writes (insertion-order iteration), AND
      // leave _dirty un-cleared so subsequent flush() calls re-throw on
      // the same slot — wedging every legitimate later mutation behind
      // the loud error. Pre-pass validation guarantees the throw fires
      // BEFORE any setState; the dirty set stays intact so callers can
      // recover by deleting the bad slot and retrying.
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      // Mark a valid slot dirty FIRST (so it would be flushed first under
      // insertion-order iteration), then a bad slot.
      accessor.mutate(combatStatesCodec, (m) =>
        m.set(99, {
          currentHp: 10,
          maxHp: 10,
          armor: 0,
          attackDamage: 0,
          attackRange: 0,
          reloadTicks: 0,
          cooldownTicks: 0,
          pierceArmorBonus: 0,
        }),
      );
      accessor.markDirty('aoe2.unknownSlot');

      // First flush throws on unknown.
      expect(() => accessor.flush()).toThrow(/aoe2\.unknownSlot/);
      // World.state should NOT have a partial flush of combatStates.
      expect(world.getState(combatStatesCodec.slot)).toBeUndefined();
      // dirty set still has both slots (pre-pass aborts before clearing).
      expect(accessor.dirtySize).toBe(2);
    });
  });

  describe('reset', () => {
    it('clears cache and dirty set so next read re-materializes', () => {
      const world = makeWorld();
      const accessor = new BridgeStateAccessor(() => world);
      accessor.mutate(combatStatesCodec, (m) =>
        m.set(1, { currentHp: 1, maxHp: 1, armor: 0, attackDamage: 0, attackRange: 0, reloadTicks: 0, cooldownTicks: 0, pierceArmorBonus: 0 }),
      );
      expect(accessor.cacheSize).toBeGreaterThan(0);
      accessor.reset();
      expect(accessor.cacheSize).toBe(0);
      expect(accessor.dirtySize).toBe(0);
    });
  });
});
