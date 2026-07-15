import { describe, expect, it, vi } from "vitest";

import type { BuildingComponent } from "../../src/game/simulation/types";
import { createSimulationBridge } from "../../src/game/simulation/createSimulationBridge";
import type { BridgeStateAccessor } from "../../src/game/simulation/bridge/bridgeStateAccessor";
import { finalizeBuildingConstruction } from "../../src/game/simulation/bridge/finalizeBuildingConstruction";
import {
  createPlayerCommandVisibilityRevision,
  runBuildingDestructionVisibilityMutation,
} from "../../src/game/simulation/bridge/playerCommandVisibilityRevision";
import type { GameWorld } from "../../src/game/simulation/bridge/pureHelpers";
import {
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  garrisonedByBuildingCodec,
  populationCodec,
  researchedTechnologiesCodec,
} from "../../src/game/simulation/bridge/bridgeStateSerialize";
import type {
  BuildingCombatState,
  CombatState,
} from "../../src/game/simulation/bridge/systems/systemTypes";
import { registerTowerCombatSystem } from "../../src/game/simulation/bridge/systems/towerCombatSystem";
import { createReplayWorldOnly } from "../../src/game/simulation/replay/createReplayWorldOnly";
import { getReplayWorldContext } from "../../src/game/simulation/replay/replayWorldContext";

function stateAccessor(
  states: ReadonlyMap<string, unknown>,
): BridgeStateAccessor {
  return {
    get: (codec: { slot: string }) => states.get(codec.slot),
    mutate: (codec: { slot: string }, mutate: (value: unknown) => void) => {
      mutate(states.get(codec.slot));
    },
    markDirty: vi.fn(),
  } as unknown as BridgeStateAccessor;
}

describe("visibility mutation batching", () => {
  it("keeps one visibility snapshot for a tower combat pass and refreshes once after kills", () => {
    const buildingCombatStates = new Map([
      [
        1,
        { attackDamage: 5, attackRange: 7, reloadTicks: 12, cooldownTicks: 0 },
      ],
      [
        2,
        { attackDamage: 5, attackRange: 7, reloadTicks: 12, cooldownTicks: 0 },
      ],
    ]);
    const combatStates = new Map([
      [
        101,
        {
          currentHp: 5,
          maxHp: 5,
          attackDamage: 1,
          attackRange: 1,
          reloadTicks: 1,
          cooldownTicks: 0,
          armor: 0,
          pierceArmorBonus: 0,
        },
      ],
      [
        102,
        {
          currentHp: 5,
          maxHp: 5,
          attackDamage: 1,
          attackRange: 1,
          reloadTicks: 1,
          cooldownTicks: 0,
          armor: 0,
          pierceArmorBonus: 0,
        },
      ],
    ]);
    const states = new Map<string, unknown>([
      [buildingCombatStatesCodec.slot, buildingCombatStates],
      [combatStatesCodec.slot, combatStates],
      [constructionStatesCodec.slot, new Map()],
      [garrisonedByBuildingCodec.slot, new Map()],
      [researchedTechnologiesCodec.slot, new Map()],
    ]);
    const components = new Map<string, unknown>([
      ["1:position", { x: 2, y: 2 }],
      ["1:building", { owner: 1, buildingType: "watch-tower" }],
      ["2:position", { x: 10, y: 2 }],
      ["2:building", { owner: 2, buildingType: "watch-tower" }],
      ["101:unit", { owner: 2, unitType: "villager" }],
      ["102:unit", { owner: 1, unitType: "villager" }],
    ]);
    let execute: ((activeWorld: GameWorld) => void) | undefined;
    const world = {
      registerSystem: (system: {
        execute: (activeWorld: GameWorld) => void;
      }) => {
        execute = system.execute;
      },
      query: () => [1, 2],
      getComponent: (id: number, component: string) =>
        components.get(`${id}:${component}`),
    } as unknown as GameWorld;
    let frozenVisibilityShowsPlayerOneTarget = true;
    let playerTwoSpotterAlive = true;
    const destroyed: number[] = [];
    const refreshVisibilityAfterCombat = vi.fn(() => {
      frozenVisibilityShowsPlayerOneTarget = playerTwoSpotterAlive;
    });
    const deps = {
      world,
      accessor: stateAccessor(states),
      findPreferredVisibleEnemyUnitInRangeOfBuilding: (owner: number) => {
        if (owner === 1) return 101;
        return frozenVisibilityShowsPlayerOneTarget ? 102 : null;
      },
      destroyUnitEntity: (id: number) => {
        destroyed.push(id);
        combatStates.delete(id);
        if (id === 101) playerTwoSpotterAlive = false;
      },
      markOutOfBandRenderChange: vi.fn(),
      ensurePlayerScoreCounters: () => ({ unitsKilled: 0 }),
      refreshVisibilityAfterCombat,
    } as Parameters<typeof registerTowerCombatSystem>[0] & {
      refreshVisibilityAfterCombat: () => void;
    };

    registerTowerCombatSystem(deps);
    expect(execute).toBeTypeOf("function");
    execute!(world);

    expect(destroyed).toEqual([101, 102]);
    expect(refreshVisibilityAfterCombat).toHaveBeenCalledOnce();
    expect(frozenVisibilityShowsPlayerOneTarget).toBe(false);
  });

  it("keeps tower targeting on the pass-start snapshot, then publishes final LOS", () => {
    const base = createSimulationBridge("castle-garrison-fixture");
    const castle = base
      .getEconomyState()
      .buildings.find(
        (building) =>
          building.owner === 1 && building.buildingType === "castle",
      );
    const townCenter = base
      .getEconomyState()
      .buildings.find(
        (building) =>
          building.owner === 2 && building.buildingType === "town-center",
      );
    expect(castle).toBeDefined();
    expect(townCenter).toBeDefined();
    expect(castle!.id).toBeLessThan(townCenter!.id);

    const seeded = createReplayWorldOnly(
      structuredClone(base.world.serialize()),
    );
    const { target, spotter } = seeded.runMaintenance(() => {
      seeded.setPosition(castle!.id, { x: 31, y: 16 });
      seeded.setPosition(townCenter!.id, { x: 20, y: 20 });
      const createUnit = (
        owner: number,
        position: { x: number; y: number },
        radius: number,
        tint: number,
      ): number => {
        const id = seeded.createEntity();
        seeded.setPosition(id, position);
        seeded.addComponent(id, "unit", { owner, unitType: "spearman" });
        seeded.addComponent(id, "renderable", {
          kind: "unit",
          layer: "unit",
          tint,
          size: 0.45,
          footprintWidth: 1,
          footprintHeight: 1,
          visualVariant: "default",
        });
        seeded.addComponent(id, "visionSource", { playerId: owner, radius });
        return id;
      };
      return {
        target: createUnit(1, { x: 29, y: 20 }, 4, 0x111111),
        spotter: createUnit(2, { x: 28, y: 20 }, 1, 0x222222),
      };
    });
    const combatStates = structuredClone(
      seeded.getState(combatStatesCodec.slot) ?? [],
    ) as Array<[number, CombatState]>;
    const combatState = (currentHp: number): CombatState => ({
      currentHp,
      maxHp: 45,
      armor: 0,
      attackDamage: 3,
      attackRange: 1,
      reloadTicks: 10,
      cooldownTicks: 0,
      pierceArmorBonus: 0,
    });
    combatStates.push([target, combatState(45)], [spotter, combatState(1)]);
    seeded.setState(
      combatStatesCodec.slot,
      combatStates as unknown as Parameters<typeof seeded.setState>[1],
    );
    const buildingCombatStates = structuredClone(
      seeded.getState(buildingCombatStatesCodec.slot) ?? [],
    ) as Array<[number, BuildingCombatState]>;
    for (const [id, state] of buildingCombatStates) {
      if (id === castle!.id || id === townCenter!.id) state.cooldownTicks = 2;
    }
    seeded.setState(
      buildingCombatStatesCodec.slot,
      buildingCombatStates as unknown as Parameters<typeof seeded.setState>[1],
    );

    seeded.step();
    const snapshot = structuredClone(seeded.serialize());
    const snapshotState = (
      snapshot as unknown as { state: Record<string, unknown> }
    ).state;
    const readyBuildings = snapshotState[
      buildingCombatStatesCodec.slot
    ] as Array<[number, BuildingCombatState]>;
    for (const [id, state] of readyBuildings) {
      if (id === castle!.id || id === townCenter!.id) state.cooldownTicks = 0;
    }
    const world = createReplayWorldOnly(snapshot);
    expect(getReplayWorldContext(world)?.visibility.isVisible(2, 29, 20)).toBe(
      true,
    );

    world.step();

    expect(world.getEntityRef(spotter)).toBeNull();
    expect(getReplayWorldContext(world)?.visibility.isVisible(2, 29, 20)).toBe(
      false,
    );
    const finalCombatStates = world.getState(combatStatesCodec.slot) as Array<
      [number, CombatState]
    >;
    expect(finalCombatStates.find(([id]) => id === target)?.[1].currentHp).toBe(
      40,
    );
    const finalBuildingStates = world.getState(
      buildingCombatStatesCodec.slot,
    ) as Array<[number, BuildingCombatState]>;
    expect(
      finalBuildingStates.find(([id]) => id === townCenter!.id)?.[1]
        .cooldownTicks,
    ).toBe(12);
  });

  it("invalidates only when one of the bounded entities actually changes vision", () => {
    const positions = new Map<number, { x: number; y: number }>([
      [1, { x: 3, y: 4 }],
      [2, { x: 3, y: 4 }],
      [3, { x: 5, y: 4 }],
      [4, { x: 6, y: 4 }],
    ]);
    const sources = new Map<number, { playerId: number; radius: number }>([
      [3, { playerId: 1, radius: 4 }],
      [4, { playerId: 1, radius: 4 }],
    ]);
    const world = {
      getComponent: (id: number, component: string) => {
        if (component === "position") return positions.get(id);
        if (component === "visionSource") return sources.get(id);
        return undefined;
      },
    } as unknown as GameWorld;
    const revision = createPlayerCommandVisibilityRevision(world);
    const accessor = stateAccessor(
      new Map([
        [garrisonedByBuildingCodec.slot, new Map([[1, [2]]])],
      ]),
    );

    runBuildingDestructionVisibilityMutation(revision, accessor, 1, () => {
      positions.delete(1);
      positions.delete(2);
    });
    expect(revision.current()).toBe(0);

    runBuildingDestructionVisibilityMutation(revision, accessor, 3, () => {
      sources.delete(3);
      positions.delete(3);
    });
    expect(revision.current()).toBe(1);

    expect(() =>
      revision.runEntitiesMutation([4], () => {
        sources.delete(4);
        throw new Error("partial mutation");
      }),
    ).toThrow("partial mutation");
    expect(revision.current()).toBe(2);
  });

  it("reports whether construction actually added a visibility source", () => {
    const complete = (
      id: number,
      buildingType: BuildingComponent["buildingType"],
      hasExplicitVision = false,
    ) => {
      const constructionStates = new Map([
        [
          id,
          {
            isComplete: false,
            buildProgressTicks: 1,
            totalBuildTicks: 2,
            populationProvided: 0,
            width: 1,
            height: 1,
          },
        ],
      ]);
      const states = new Map<string, unknown>([
        [constructionStatesCodec.slot, constructionStates],
        [buildingHealthStatesCodec.slot, new Map()],
        [buildingCombatStatesCodec.slot, new Map()],
        [populationCodec.slot, new Map()],
        [researchedTechnologiesCodec.slot, new Map()],
      ]);
      const components = new Map<string, unknown>();
      if (hasExplicitVision) {
        components.set(`${id}:visionSource`, { playerId: 1, radius: 2 });
      }
      const world = {
        getComponent: (entityId: number, component: string) =>
          components.get(`${entityId}:${component}`),
        addComponent: (entityId: number, component: string, value: unknown) => {
          components.set(`${entityId}:${component}`, value);
        },
      } as unknown as GameWorld;
      const onComplete = vi.fn();

      finalizeBuildingConstruction({
        world,
        accessor: stateAccessor(states),
        buildingId: id,
        building: { owner: 1, buildingType },
        onComplete,
        markRender: vi.fn(),
      });

      return onComplete.mock.calls[0]?.[3];
    };

    expect(complete(10, "house")).toBe(false);
    expect(complete(11, "watch-tower")).toBe(true);
    expect(complete(12, "watch-tower", true)).toBe(false);
  });
});
