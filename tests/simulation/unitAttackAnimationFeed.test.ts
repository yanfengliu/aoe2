import { describe, expect, it, vi } from "vitest";
import type { VisibilityMap } from "civ-engine";

import { createSimulationBridge } from "../../src/game/simulation/createSimulationBridge";
import type { ProjectedEntityView } from "../../src/game/simulation/types";
import * as visibilityModule from "../../src/game/simulation/bridge/visibility";
import { createBridgeState } from "../../src/game/simulation/bridge/bridgeState";
import type { BridgeStateAccessor } from "../../src/game/simulation/bridge/bridgeStateAccessor";
import type { GameWorld } from "../../src/game/simulation/bridge/pureHelpers";
import { TIER_3_SLOTS } from "../../src/game/simulation/bridge/bridgeStateSerialize";
import { createPlayerCommandVisibilityRevision } from "../../src/game/simulation/bridge/playerCommandVisibilityRevision";
import {
  createUnitAttackRecorder,
  getUnitAttackFeedEntries,
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

type AttackVisibilityModule = typeof visibilityModule & {
  ATTACK_FEED_TICKS?: number;
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

describe("unit attack animation feed - recorder visibility", () => {
  it("requires both footprints to be visible even for the attacker owner", () => {
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
    expect(getUnitAttackFeedEntries(state.unitAttackFeed)[0]?.witnessedBy).toEqual([2]);
  });

  it("does not publish a hidden target coordinate to the attacker owner", () => {
    const state = createBridgeState();
    const components = new Map<string, unknown>([
      ["1:unit", { owner: 1, unitType: "arbalest" }],
      ["1:position", { x: 3, y: 4 }],
      ["1:renderable", { footprintWidth: 1, footprintHeight: 1 }],
      ["2:position", { x: 8, y: 4 }],
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
      get: () => new Map([[1, { current: 1, cap: 5, rawSupply: 5 }]]),
    } as unknown as BridgeStateAccessor;
    const visibility = {
      isVisible: (owner: number, x: number) => owner === 1 && x === 3,
    } as unknown as VisibilityMap;

    createUnitAttackRecorder({
      world,
      state,
      accessor,
      visibility,
      ensureVisibilityCurrent: vi.fn(),
    })(1, 2);

    expect(getUnitAttackFeedEntries(state.unitAttackFeed)).toEqual([]);
  });

  it("refreshes visibility before each same-tick impact", () => {
    const state = createBridgeState();
    const components = new Map<string, unknown>([
      ["1:unit", { owner: 1, unitType: "arbalest" }],
      ["1:position", { x: 3, y: 4 }],
      ["1:renderable", { footprintWidth: 1, footprintHeight: 1 }],
      ["2:unit", { owner: 1, unitType: "arbalest" }],
      ["2:position", { x: 3, y: 5 }],
      ["2:renderable", { footprintWidth: 1, footprintHeight: 1 }],
      ["100:position", { x: 4, y: 4 }],
      ["100:renderable", { footprintWidth: 1, footprintHeight: 1 }],
      ["101:position", { x: 4, y: 5 }],
      ["101:renderable", { footprintWidth: 1, footprintHeight: 1 }],
    ]);
    const world = {
      tick: 20,
      getEntityRef: (id: number) => ({ id, generation: 0 }),
      getComponent: (id: number, component: string) =>
        components.get(`${id}:${component}`),
    } as unknown as GameWorld;
    const accessor = {
      get: () => new Map([[1, { current: 2, cap: 5, rawSupply: 5 }]]),
    } as unknown as BridgeStateAccessor;
    let sourceCoversTargets = true;
    let visibilityCoversTargets = false;
    let visibilitySourceRevision = 0;
    const visibility = {
      isVisible: (owner: number, x: number) => (
        owner === 1 && (x === 3 || (x === 4 && visibilityCoversTargets))
      ),
    } as unknown as VisibilityMap;
    const ensureVisibilityCurrent = vi.fn(() => {
      visibilityCoversTargets = sourceCoversTargets;
    });
    const record = createUnitAttackRecorder({
      world,
      state,
      accessor,
      visibility,
      ensureVisibilityCurrent,
      getVisibilitySourceRevision: () => visibilitySourceRevision,
    });

    record(1, 100);
    sourceCoversTargets = false;
    visibilitySourceRevision += 1;
    record(2, 101);

    expect(ensureVisibilityCurrent).toHaveBeenCalledTimes(2);
    expect(getUnitAttackFeedEntries(state.unitAttackFeed)).toHaveLength(1);
    expect(getUnitAttackFeedEntries(state.unitAttackFeed)[0]).toMatchObject({
      attackerId: 1,
      targetX: 4,
      targetY: 4,
      witnessedBy: [1],
    });
  });

  it("reuses one current snapshot across max-pop fine moves and impacts", () => {
    const state = createBridgeState();
    const ensureVisibilityCurrent = vi.fn();
    const fineXByAttacker = new Map<number, number>();
    const coarseXByAttacker = new Map<number, number>();
    const world = {
      tick: 20,
      getEntityRef: (id: number) => ({ id, generation: 0 }),
      getComponent: (id: number, component: string) => {
        if (component === "unit" && id !== 10_000) {
          return { owner: 1, unitType: "villager" };
        }
        if (component === "position") {
          return id === 10_000
            ? { x: 4, y: 4 }
            : { x: coarseXByAttacker.get(id) ?? 3, y: 4 };
        }
        if (component === "unitTransform" && id !== 10_000) {
          return {
            fineX: fineXByAttacker.get(id) ?? 12,
            fineY: 16,
            occupancySlotX: 0,
            occupancySlotY: 0,
          };
        }
        if (component === "visionSource" && id !== 10_000) {
          return { playerId: 1, radius: 4 };
        }
        if (component === "renderable") {
          return { footprintWidth: 1, footprintHeight: 1 };
        }
        return undefined;
      },
    } as unknown as GameWorld;
    const accessor = {
      get: () => new Map([[1, { current: 200, cap: 200, rawSupply: 200 }]]),
    } as unknown as BridgeStateAccessor;
    const visibility = {
      isVisible: () => true,
    } as unknown as VisibilityMap;
    const visibilityRevision = createPlayerCommandVisibilityRevision(world);
    const record = createUnitAttackRecorder({
      world,
      state,
      accessor,
      visibility,
      ensureVisibilityCurrent,
      getVisibilitySourceRevision: visibilityRevision.current,
    });

    for (let attackerId = 1; attackerId <= 200; attackerId += 1) {
      visibilityRevision.runEntityMutation(attackerId, () => {
        fineXByAttacker.set(attackerId, 13);
      });
      record(attackerId, 10_000);
    }

    expect(ensureVisibilityCurrent).toHaveBeenCalledTimes(1);
    expect(state.unitAttackFeed.byAttacker.size).toBe(200);
    record(1, 10_000);
    expect(ensureVisibilityCurrent).toHaveBeenCalledTimes(1);
    expect(state.unitAttackFeed.byAttacker.size).toBe(200);

    visibilityRevision.runEntityMutation(1, () => {
      coarseXByAttacker.set(1, 2);
    });
    record(1, 10_000);
    expect(ensureVisibilityCurrent).toHaveBeenCalledTimes(2);

    visibilityRevision.markMutation();
    record(2, 10_000);
    expect(ensureVisibilityCurrent).toHaveBeenCalledTimes(3);

    (world as unknown as { tick: number }).tick = 21;
    record(201, 10_000);
    expect(ensureVisibilityCurrent).toHaveBeenCalledTimes(4);
    expect(state.unitAttackFeed.byAttacker.size).toBe(201);
    expect(getUnitAttackFeedEntries(state.unitAttackFeed)).toHaveLength(201);
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
