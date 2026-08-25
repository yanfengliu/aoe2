import { MAP_HEIGHT, MAP_WIDTH } from '../../src/game/simulation/mapGeneration/constants';
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
  playerCivilizationsCodec,
  playerTeamsCodec,
  garrisonedByBuildingCodec,
  populationCodec,
  projectilesCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
} from "../../src/game/simulation/bridge/bridgeStateSerialize";
import type {
  BuildingCombatState,
  CombatState,
} from "../../src/game/simulation/bridge/systems/systemTypes";
import { registerTowerCombatSystem } from "../../src/game/simulation/bridge/systems/towerCombatSystem";
import { registerProjectileSystem } from "../../src/game/simulation/bridge/systems/projectileSystem";
import { launchProjectile } from "../../src/game/simulation/bridge/projectileOps";
import { createEmptyProjectileSlot } from "../../src/game/simulation/bridge/projectileTypes";
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
  it("targets every tower in a pass from one frozen snapshot and kills nothing itself", () => {
    // Spec §10.4: a tower launches projectiles rather than dealing damage, so
    // the pass cannot mutate visibility partway through — tower 2 still sees
    // its target even though tower 1's shot is (later) fatal to the spotter.
    const buildingCombatStates = new Map([
      [1, { attackDamage: 5, attackRange: 7, reloadTicks: 12, cooldownTicks: 0 }],
      [2, { attackDamage: 5, attackRange: 7, reloadTicks: 12, cooldownTicks: 0 }],
    ]);
    const combatStates = new Map([
      [101, {
        currentHp: 5, maxHp: 5, attackDamage: 1, attackRange: 1,
        reloadTicks: 1, cooldownTicks: 0, armor: 0, pierceArmorBonus: 0,
      }],
      [102, {
        currentHp: 5, maxHp: 5, attackDamage: 1, attackRange: 1,
        reloadTicks: 1, cooldownTicks: 0, armor: 0, pierceArmorBonus: 0,
      }],
    ]);
    const projectiles = createEmptyProjectileSlot();
    const states = new Map<string, unknown>([
      [buildingCombatStatesCodec.slot, buildingCombatStates],
      [combatStatesCodec.slot, combatStates],
      [constructionStatesCodec.slot, new Map()],
      [garrisonedByBuildingCodec.slot, new Map()],
      [researchedTechnologiesCodec.slot, new Map()],
      [unitCommandsCodec.slot, new Map()],
      [projectilesCodec.slot, projectiles],
    ]);
    const components = new Map<string, unknown>([
      ["1:position", { x: 2, y: 2 }],
      ["1:building", { owner: 1, buildingType: "watch-tower" }],
      ["2:position", { x: 10, y: 2 }],
      ["2:building", { owner: 2, buildingType: "watch-tower" }],
      ["101:position", { x: 4, y: 2 }],
      ["101:unit", { owner: 2, unitType: "villager" }],
      ["102:position", { x: 8, y: 2 }],
      ["102:unit", { owner: 1, unitType: "villager" }],
    ]);
    let execute: ((activeWorld: GameWorld) => void) | undefined;
    const world = {
      registerSystem: (system: { execute: (activeWorld: GameWorld) => void }) => {
        execute = system.execute;
      },
      query: () => [1, 2],
      tick: 40,
      getComponent: (id: number, component: string) =>
        components.get(`${id}:${component}`),
      grid: { width: MAP_WIDTH, height: MAP_HEIGHT },
    } as unknown as GameWorld;
    // If the pass ever mutated visibility mid-flight, this would flip and
    // tower 2 would lose its target.
    let frozenVisibilityShowsPlayerOneTarget = true;
    const destroyed: number[] = [];
    const refreshVisibilityAfterCombat = vi.fn();
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
        frozenVisibilityShowsPlayerOneTarget = false;
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

    // Both towers fired, from the same snapshot, and neither killed anything
    // during the pass — the shots are still in the air.
    expect(destroyed).toEqual([]);
    expect(refreshVisibilityAfterCombat).not.toHaveBeenCalled();
    const targets = projectiles.inFlight.map((shot) => shot.targetId).sort();
    expect(targets).toEqual([101, 102]);
    for (const shot of projectiles.inFlight) {
      expect(shot.impactTick).toBeGreaterThan(world.tick);
      expect(shot.attackerUnitType).toBeNull();
    }
  });

  it("refreshes visibility exactly once when landing shots kill", () => {
    // The other half of the relocated contract: the single post-kill refresh
    // now belongs to the projectile pass, and fires once for the whole pass
    // however many shots land.
    const combatStates = new Map<number, CombatState>([
      [101, {
        currentHp: 4, maxHp: 4, attackDamage: 1, attackRange: 1,
        reloadTicks: 1, cooldownTicks: 0, armor: 0, pierceArmorBonus: 0,
      }],
      [102, {
        currentHp: 4, maxHp: 4, attackDamage: 1, attackRange: 1,
        reloadTicks: 1, cooldownTicks: 0, armor: 0, pierceArmorBonus: 0,
      }],
    ]);
    const projectiles = createEmptyProjectileSlot();
    for (const targetId of [101, 102]) {
      launchProjectile({
        slot: projectiles,
        tick: 0,
        attacker: {
          id: 1, owner: 1, unitType: null,
          position: { x: 0, y: 0 }, baseDamage: 50,
        },
        target: { id: targetId, kind: "unit", position: { x: 1, y: 0 } },
        leads: false,
        mapSize: { width: MAP_WIDTH, height: MAP_HEIGHT },
      });
    }
    const components = new Map<string, unknown>([
      ["101:position", { x: 1, y: 0 }],
      ["101:unit", { owner: 2, unitType: "villager" }],
      ["102:position", { x: 1, y: 0 }],
      ["102:unit", { owner: 2, unitType: "villager" }],
    ]);
    const states = new Map<string, unknown>([
      [combatStatesCodec.slot, combatStates],
      [projectilesCodec.slot, projectiles],
    ]);
    let execute: ((activeWorld: GameWorld) => void) | undefined;
    const world = {
      registerSystem: (system: { execute: (activeWorld: GameWorld) => void }) => {
        execute = system.execute;
      },
      query: () => [],
      tick: 99,
      getComponent: (id: number, component: string) =>
        components.get(`${id}:${component}`),
      grid: { width: MAP_WIDTH, height: MAP_HEIGHT },
    } as unknown as GameWorld;
    const destroyed: number[] = [];
    const refreshVisibilityAfterCombat = vi.fn();

    registerProjectileSystem({
      world,
      accessor: stateAccessor(states),
      damageBuilding: () => false,
      destroyUnitEntity: (id: number) => {
        destroyed.push(id);
        combatStates.delete(id);
      },
      ensurePlayerScoreCounters: () => ({ unitsKilled: 0 }),
      markOutOfBandRenderChange: vi.fn(),
      refreshVisibilityAfterCombat,
      isMatchRunning: () => true,
    });
    expect(execute).toBeTypeOf("function");
    execute!(world);

    expect(destroyed).toEqual([101, 102]);
    expect(refreshVisibilityAfterCombat).toHaveBeenCalledOnce();
    expect(projectiles.inFlight).toEqual([]);
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

    // Firing and dying are now separate ticks (spec §10.4): this step launches
    // the volley and starts the reload, but nothing has been hit yet.
    world.step();

    expect(world.getEntityRef(spotter)).not.toBeNull();
    const firedBuildingStates = world.getState(
      buildingCombatStatesCodec.slot,
    ) as Array<[number, BuildingCombatState]>;
    expect(
      firedBuildingStates.find(([id]) => id === townCenter!.id)?.[1]
        .cooldownTicks,
    ).toBe(12);

    // Let the arrows land. The contract under test is unchanged: the pass
    // targeted from the pass-start snapshot, and once the kill lands the final
    // LOS is published — the spotter's vision is gone.
    const targetHp = () => {
      const rows = world.getState(combatStatesCodec.slot) as Array<
        [number, CombatState]
      >;
      return rows.find(([id]) => id === target)?.[1].currentHp;
    };
    // The two buildings are different distances away, so their shots land on
    // different ticks; wait for both rather than for whichever is first.
    let spotterGone = false;
    let targetHit = false;
    for (let step = 0; step < 40 && !(spotterGone && targetHit); step += 1) {
      world.step();
      spotterGone = world.getEntityRef(spotter) === null;
      targetHit = targetHp() !== 45;
    }
    expect(spotterGone).toBe(true);
    expect(targetHit).toBe(true);
    expect(getReplayWorldContext(world)?.visibility.isVisible(2, 29, 20)).toBe(
      false,
    );
    const finalCombatStates = world.getState(combatStatesCodec.slot) as Array<
      [number, CombatState]
    >;
    expect(finalCombatStates.find(([id]) => id === target)?.[1].currentHp).toBe(
      40,
    );
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
      grid: { width: MAP_WIDTH, height: MAP_HEIGHT },
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
        // The civ/team building bonuses read these two at completion.
        [playerTeamsCodec.slot, new Map()],
        [playerCivilizationsCodec.slot, new Map()],
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
        grid: { width: MAP_WIDTH, height: MAP_HEIGHT },
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
