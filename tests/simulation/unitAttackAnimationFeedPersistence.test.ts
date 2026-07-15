import type { VisibilityMap } from "civ-engine";
import { describe, expect, it } from "vitest";

import { createBridgeState } from "../../src/game/simulation/bridge/bridgeState";
import type { GameWorld } from "../../src/game/simulation/bridge/pureHelpers";
import {
  getUnitAttackFeedEntries,
  hydrateUnitAttacks,
  indexVisibleUnitAttackAnimations,
  initializeUnitAttackFeed,
  markUnitAttackMovementStarted,
  pruneUnitAttackFeed,
  visibleUnitAttacks,
} from "../../src/game/simulation/bridge/unitAttackAnimationFeed";
import { suppressHiddenUnitAttacks } from "../../src/game/simulation/bridge/unitAttackVisibilitySuppression";

interface RawAttackRecord {
  attackerId: number;
  attackerGeneration: number;
  tick: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  witnessedBy: number[];
  suppressedFor?: number[];
  label?: string;
}

describe("unit attack animation feed persistence and projection", () => {
  it("tail-bounds imported records and canonicalizes witness suppression", () => {
    const raw = new Array<unknown>(1_025);
    Object.defineProperty(raw, 0, {
      get() {
        throw new Error("hydrate scanned outside the bounded tail");
      },
    });
    raw[1_024] = {
      attackerId: 7,
      attackerGeneration: 2,
      tick: 100,
      sourceX: 12,
      sourceY: 8,
      targetX: 13,
      targetY: 8,
      witnessedBy: [1, 1, 2, 99],
      suppressedFor: [1, 1, 2, 99],
      extra: { retainedPayload: "must be stripped" },
    };

    const [attack] = hydrateUnitAttacks(raw, 100, new Set([1, 2]));

    expect(attack).toEqual({
      attackerId: 7,
      attackerGeneration: 2,
      tick: 100,
      sourceX: 12,
      sourceY: 8,
      targetX: 13,
      targetY: 8,
      witnessedBy: [1, 2],
      suppressedFor: [1, 2],
    });
    expect(Object.keys(attack!)).toEqual([
      "attackerId",
      "attackerGeneration",
      "tick",
      "sourceX",
      "sourceY",
      "targetX",
      "targetY",
      "witnessedBy",
      "suppressedFor",
    ]);
  });

  it("rejects unsafe, out-of-range, expired, and oversized imported fields", () => {
    const valid = {
      attackerId: 7,
      attackerGeneration: 2,
      tick: 100,
      sourceX: 12,
      sourceY: 8,
      targetX: 13,
      targetY: 8,
      witnessedBy: [1],
    };
    const attacks = hydrateUnitAttacks([
      { ...valid, attackerId: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, attackerGeneration: -1 },
      { ...valid, tick: 89 },
      { ...valid, tick: 101 },
      { ...valid, cancelTick: 99 },
      { ...valid, cancelTick: 101 },
      { ...valid, sourceX: Number.NaN },
      { ...valid, sourceY: 64 },
      { ...valid, targetX: -1 },
      { ...valid, targetY: Number.POSITIVE_INFINITY },
      { ...valid, witnessedBy: Array.from({ length: 100 }, () => 1) },
      valid,
    ], 100, new Set([1]));

    expect(attacks).toEqual([valid]);
  });

  it("hydrates a movement cancellation only on its observable tick", () => {
    expect(hydrateUnitAttacks([{
      attackerId: 7,
      attackerGeneration: 2,
      tick: 99,
      cancelTick: 100,
      sourceX: 12,
      sourceY: 8,
      targetX: 13,
      targetY: 8,
      witnessedBy: [1],
    }], 100, new Set([1]))[0]?.cancelTick).toBe(100);
  });

  it("surfaces only fresh, witnessed, unsuppressed attacks", () => {
    const currentTick = 100;
    const records: RawAttackRecord[] = [
      {
        attackerId: 7,
        attackerGeneration: 2,
        tick: currentTick,
        sourceX: 12,
        sourceY: 8,
        targetX: 13,
        targetY: 8,
        witnessedBy: [1, 2],
        label: "visible",
      },
      {
        attackerId: 8,
        attackerGeneration: 0,
        tick: currentTick,
        sourceX: 29,
        sourceY: 20,
        targetX: 30,
        targetY: 20,
        witnessedBy: [2],
        label: "fogged",
      },
      {
        attackerId: 9,
        attackerGeneration: 4,
        tick: currentTick,
        sourceX: 12,
        sourceY: 8,
        targetX: 13,
        targetY: 8,
        witnessedBy: [1],
        suppressedFor: [1],
        label: "suppressed",
      },
      {
        attackerId: 10,
        attackerGeneration: 4,
        tick: 89,
        sourceX: 12,
        sourceY: 8,
        targetX: 13,
        targetY: 8,
        witnessedBy: [1],
        label: "expired",
      },
    ];

    expect(visibleUnitAttacks(records, currentTick, 1).map((record) => record.label)).toEqual([
      "visible",
    ]);
    expect(visibleUnitAttacks(records, currentTick, 2).map((record) => record.label)).toEqual([
      "visible",
      "fogged",
    ]);
  });

  it("persists suppression when an attacker leaves one witness's view", () => {
    const feed = createBridgeState().unitAttackFeed;
    initializeUnitAttackFeed(feed, [{
      attackerId: 7,
      attackerGeneration: 2,
      tick: 100,
      sourceX: 12,
      sourceY: 8,
      targetX: 13,
      targetY: 8,
      witnessedBy: [1, 2],
    }], 100);
    const world = {
      getEntityRef: (id: number) => id === 7 ? { id: 7, generation: 2 } : undefined,
      getComponent: (id: number, component: string) => {
        if (id !== 7) return undefined;
        if (component === "unit") return { owner: 2, unitType: "villager" };
        if (component === "position") return { x: 12, y: 8 };
        if (component === "renderable") return { footprintWidth: 1, footprintHeight: 1 };
        return undefined;
      },
    } as unknown as GameWorld;
    const visibility = { isVisible: () => false } as unknown as VisibilityMap;

    expect(suppressHiddenUnitAttacks(feed, world, visibility)).toBe(true);
    expect(getUnitAttackFeedEntries(feed)[0]?.suppressedFor).toEqual([1]);
    expect(feed.persistenceDirty).toBe(true);
    expect(indexVisibleUnitAttackAnimations(getUnitAttackFeedEntries(feed), 100, 1).size).toBe(0);
    expect(indexVisibleUnitAttackAnimations(getUnitAttackFeedEntries(feed), 100, 2).size).toBe(1);

    feed.persistenceDirty = false;
    expect(suppressHiddenUnitAttacks(feed, world, visibility)).toBe(false);
    expect(feed.persistenceDirty).toBe(false);
  });

  it("physically prunes expired records during a quiet tick", () => {
    const feed = createBridgeState().unitAttackFeed;
    initializeUnitAttackFeed(feed, [
      {
        attackerId: 7,
        attackerGeneration: 2,
        tick: 89,
        sourceX: 12,
        sourceY: 8,
        targetX: 13,
        targetY: 8,
        witnessedBy: [1],
      },
      {
        attackerId: 8,
        attackerGeneration: 0,
        tick: 90,
        sourceX: 12,
        sourceY: 8,
        targetX: 13,
        targetY: 8,
        witnessedBy: [1],
      },
    ], 99);

    expect(pruneUnitAttackFeed(feed, 100)).toBe(true);
    expect(getUnitAttackFeedEntries(feed).map((attack) => attack.attackerId)).toEqual([8]);
    expect(pruneUnitAttackFeed(feed, 100)).toBe(false);
  });

  it("persists the first movement cancellation for one presentation tick", () => {
    const feed = createBridgeState().unitAttackFeed;
    initializeUnitAttackFeed(feed, [{
      attackerId: 7,
      attackerGeneration: 2,
      tick: 100,
      sourceX: 12,
      sourceY: 8,
      targetX: 13,
      targetY: 8,
      witnessedBy: [1],
    }], 100);

    expect(markUnitAttackMovementStarted(feed, 7, 2, 101)).toBe(true);
    expect(markUnitAttackMovementStarted(feed, 7, 2, 102)).toBe(false);
    expect(getUnitAttackFeedEntries(feed)[0]).toMatchObject({ cancelTick: 101 });
    expect(pruneUnitAttackFeed(feed, 101)).toBe(false);
    expect(pruneUnitAttackFeed(feed, 102)).toBe(true);
    expect(getUnitAttackFeedEntries(feed)).toEqual([]);
  });
});
