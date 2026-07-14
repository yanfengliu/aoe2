import { describe, expect, it, vi } from "vitest";
import type { VisibilityMap } from "civ-engine";

import { createSimulationBridge } from "../../src/game/simulation/createSimulationBridge";
import type { ProjectedEntityView } from "../../src/game/simulation/types";
import * as visibilityModule from "../../src/game/simulation/bridge/visibility";
import { createBridgeState } from "../../src/game/simulation/bridge/bridgeState";
import type { BridgeStateAccessor } from "../../src/game/simulation/bridge/bridgeStateAccessor";
import type { GameWorld } from "../../src/game/simulation/bridge/pureHelpers";
import { TIER_3_SLOTS } from "../../src/game/simulation/bridge/bridgeStateSerialize";
import {
  createUnitAttackRecorder,
  getUnitAttackFeedEntries,
  hydrateUnitAttacks,
  initializeUnitAttackFeed,
  markUnitAttackMovementStarted,
  pruneUnitAttackFeed,
} from "../../src/game/simulation/bridge/unitAttackAnimationFeed";

type Bridge = ReturnType<typeof createSimulationBridge>;

interface AttackAnimationView {
  tick: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

type EntityWithAttackAnimation = ProjectedEntityView & {
  attackAnimation?: AttackAnimationView;
};

interface RawAttackRecord extends AttackAnimationView {
  attackerId: number;
  attackerGeneration: number;
  witnessedBy: number[];
  label?: string;
}

type AttackVisibilityModule = typeof visibilityModule & {
  ATTACK_FEED_TICKS?: number;
  visibleUnitAttacks?: (
    attacks: readonly RawAttackRecord[],
    currentTick: number,
    playerId: number,
  ) => RawAttackRecord[];
};

const attackVisibility = visibilityModule as AttackVisibilityModule;

function boarEntity(bridge: Bridge): EntityWithAttackAnimation | undefined {
  return bridge
    .getRenderState()
    .entities.find(
      (entity) => entity.kind === "resource" && entity.entityType === "boar",
    ) as EntityWithAttackAnimation | undefined;
}

function attackingVillagers(bridge: Bridge): EntityWithAttackAnimation[] {
  return bridge
    .getRenderState()
    .entities.filter(
      (entity) =>
        entity.kind === "unit" &&
        entity.owner === 1 &&
        entity.entityType === "villager" &&
        (entity as EntityWithAttackAnimation).attackAnimation !== undefined,
    ) as EntityWithAttackAnimation[];
}

function issueGroupBoarAttack(bridge: Bridge): EntityWithAttackAnimation {
  const boar = boarEntity(bridge);
  expect(boar).toBeDefined();
  expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
  expect(bridge.getSelectionState().selectedCount).toBe(6);
  expect(bridge.issueContextCommandAtEntity(boar!.id)).toBe(true);
  return boar!;
}

describe("unit attack animation feed - pure witness and age filtering", () => {
  it("tail-bounds imported records before validation and returns canonical bounded values", () => {
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

  it("surfaces only fresh attacks witnessed by the viewing player", () => {
    expect(attackVisibility.ATTACK_FEED_TICKS).toBeTypeOf("number");
    expect(attackVisibility.ATTACK_FEED_TICKS).toBeGreaterThan(0);
    expect(attackVisibility.visibleUnitAttacks).toBeTypeOf("function");
    if (
      attackVisibility.ATTACK_FEED_TICKS === undefined ||
      attackVisibility.visibleUnitAttacks === undefined
    ) {
      return;
    }

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
        tick: currentTick - attackVisibility.ATTACK_FEED_TICKS - 1,
        sourceX: 12,
        sourceY: 8,
        targetX: 13,
        targetY: 8,
        witnessedBy: [1],
        label: "expired",
      },
    ];

    expect(
      attackVisibility
        .visibleUnitAttacks(records, currentTick, 1)
        .map((record) => record.label),
    ).toEqual(["visible"]);
    expect(
      attackVisibility
        .visibleUnitAttacks(records, currentTick, 2)
        .map((record) => record.label),
    ).toEqual(["visible", "fogged"]);
  });

  it("physically prunes expired records during a quiet tick", () => {
    const feed = createBridgeState().unitAttackFeed;
    const attacks: RawAttackRecord[] = [
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
    ];

    initializeUnitAttackFeed(feed, attacks, 99);
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

  it("synchronizes visibility before capturing non-owner witnesses", () => {
    let visibilityIsCurrent = false;
    const ensureVisibilityCurrent = vi.fn(() => {
      visibilityIsCurrent = true;
    });
    const state = createBridgeState();
    const components = new Map<string, unknown>([
      ["1:unit", { owner: 1, unitType: "villager" }],
      ["1:position", { x: 3, y: 4 }],
      ["1:renderable", { footprintWidth: 1, footprintHeight: 1 }],
      ["2:position", { x: 4, y: 4 }],
      ["2:renderable", { footprintWidth: 1, footprintHeight: 1 }],
    ]);
    const world = {
      tick: 20,
      getEntityRef: (id: number) =>
        id === 1 ? { id: 1, generation: 3 } : { id, generation: 0 },
      getComponent: (id: number, component: string) =>
        components.get(`${id}:${component}`),
    } as unknown as GameWorld;
    const accessor = {
      get: () => new Map([
        [1, { current: 1, cap: 5, rawSupply: 5 }],
        [2, { current: 1, cap: 5, rawSupply: 5 }],
      ]),
    } as unknown as BridgeStateAccessor;
    const visibility = {
      isVisible: (owner: number) => owner === 2 && visibilityIsCurrent,
    } as unknown as VisibilityMap;

    createUnitAttackRecorder({
      world,
      state,
      accessor,
      visibility,
      ensureVisibilityCurrent,
    })(1, 2);

    expect(ensureVisibilityCurrent).toHaveBeenCalledOnce();
    expect(getUnitAttackFeedEntries(state.unitAttackFeed)[0]?.witnessedBy).toEqual([1, 2]);
  });

  it("batches same-tick visibility refresh and keys many attackers without feed scans", () => {
    const state = createBridgeState();
    const ensureVisibilityCurrent = vi.fn();
    const world = {
      tick: 20,
      getEntityRef: (id: number) => ({ id, generation: 0 }),
      getComponent: (id: number, component: string) => {
        if (component === "unit" && id !== 10_000) {
          return { owner: 1, unitType: "villager" };
        }
        if (component === "position") {
          return id === 10_000 ? { x: 4, y: 4 } : { x: 3, y: 4 };
        }
        if (component === "renderable") {
          return { footprintWidth: 1, footprintHeight: 1 };
        }
        return undefined;
      },
    } as unknown as GameWorld;
    const accessor = {
      get: () => new Map([[1, { current: 100, cap: 200, rawSupply: 200 }]]),
    } as unknown as BridgeStateAccessor;
    const visibility = {
      isVisible: () => false,
    } as unknown as VisibilityMap;
    const record = createUnitAttackRecorder({
      world,
      state,
      accessor,
      visibility,
      ensureVisibilityCurrent,
    });

    for (let attackerId = 1; attackerId <= 100; attackerId += 1) {
      record(attackerId, 10_000);
    }

    expect(ensureVisibilityCurrent).toHaveBeenCalledOnce();
    expect(state.unitAttackFeed.byAttacker.size).toBe(100);
    record(1, 10_000);
    expect(ensureVisibilityCurrent).toHaveBeenCalledOnce();
    expect(state.unitAttackFeed.byAttacker.size).toBe(100);

    (world as unknown as { tick: number }).tick = 21;
    record(101, 10_000);
    expect(ensureVisibilityCurrent).toHaveBeenCalledTimes(2);
    expect(state.unitAttackFeed.byAttacker.size).toBe(101);
    expect(getUnitAttackFeedEntries(state.unitAttackFeed)).toHaveLength(101);
  });
});

describe("unit attack animation feed - live grouped boar hunt", () => {
  it("projects one independent same-tick event for every villager that lands damage", () => {
    const bridge = createSimulationBridge("boar-hunt-fixture");
    const boar = issueGroupBoarAttack(bridge);

    bridge.step(100);

    const renderState = bridge.getRenderState();
    const damagedBoar = boarEntity(bridge);
    expect(damagedBoar?.currentHp).toBe(69);

    const hits = attackingVillagers(bridge).filter(
      (entity) => entity.attackAnimation?.tick === renderState.tick,
    );
    expect(hits).toHaveLength(2);
    expect(
      new Set(
        hits.map(
          (entity) =>
            `${entity.id}:${entity.generation}:${entity.attackAnimation!.tick}`,
        ),
      ).size,
    ).toBe(2);

    for (const attacker of hits) {
      const attack = attacker.attackAnimation!;
      expect(attack).toEqual({
        tick: renderState.tick,
        sourceX: attacker.x,
        sourceY: attacker.y,
        targetX: boar.x,
        targetY: boar.y,
      });

      // The renderer can face the attacker from its displayed root toward the
      // captured target point; no simulation direction vector is duplicated.
      const deltaX = attack.targetX - attacker.x;
      const deltaY = attack.targetY - attacker.y;
      expect(Math.hypot(deltaX, deltaY)).toBeGreaterThan(0);
      expect(Number.isFinite(deltaX / Math.hypot(deltaX, deltaY))).toBe(true);
      expect(Number.isFinite(deltaY / Math.hypot(deltaX, deltaY))).toBe(true);
    }
  });

  it("records the final lethal hit even though the target command clears that tick", () => {
    const bridge = createSimulationBridge("boar-hunt-fixture");
    const boar = issueGroupBoarAttack(bridge);

    let lethalTick: number | null = null;
    for (let step = 0; step < 400 && lethalTick === null; step += 1) {
      bridge.step(100);
      if ((boarEntity(bridge)?.currentHp ?? 0) <= 0) {
        lethalTick = bridge.getRenderState().tick;
      }
    }

    expect(lethalTick, "boar never died").not.toBeNull();
    const lethalHits = attackingVillagers(bridge).filter(
      (entity) => entity.attackAnimation?.tick === lethalTick,
    );
    expect(lethalHits.length).toBeGreaterThanOrEqual(1);
    for (const attacker of lethalHits) {
      expect(attacker.attackAnimation).toEqual({
        tick: lethalTick,
        sourceX: attacker.x,
        sourceY: attacker.y,
        targetX: boar.x,
        targetY: boar.y,
      });
    }
  });

  it("ages completed attack events out of the projected entity view", () => {
    const bridge = createSimulationBridge("boar-hunt-fixture");
    issueGroupBoarAttack(bridge);

    for (let step = 0; step < 400; step += 1) {
      bridge.step(100);
      if ((boarEntity(bridge)?.currentHp ?? 0) <= 0) break;
    }
    expect(attackingVillagers(bridge).length).toBeGreaterThan(0);
    expect(attackVisibility.ATTACK_FEED_TICKS).toBeTypeOf("number");
    if (attackVisibility.ATTACK_FEED_TICKS === undefined) return;

    for (let step = 0; step <= attackVisibility.ATTACK_FEED_TICKS; step += 1) {
      bridge.step(100);
    }
    expect(attackingVillagers(bridge)).toHaveLength(0);
  });

  it("drops in-flight attack animation events across save/load", () => {
    const bridge = createSimulationBridge("boar-hunt-fixture");
    issueGroupBoarAttack(bridge);
    bridge.step(100);
    expect(attackingVillagers(bridge)).toHaveLength(2);

    const savedGame = JSON.parse(
      JSON.stringify(bridge.saveGame()),
    ) as ReturnType<Bridge["saveGame"]>;
    expect(
      (savedGame.worldSnapshot as { state?: Record<string, unknown> }).state?.[
        TIER_3_SLOTS.replayUnitAttacks
      ],
    ).toBeUndefined();
    const loaded = createSimulationBridge("ignored-outer-seed", { savedGame });

    expect(attackingVillagers(loaded)).toHaveLength(0);
  });
});
