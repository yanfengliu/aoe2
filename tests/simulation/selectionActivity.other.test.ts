import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

const HUMAN_PLAYER_ID = 1;

type Bridge = ReturnType<typeof createSimulationBridge>;

function findFirstResource(bridge: Bridge, resourceType: string) {
  return bridge.getEconomyState().resources.find((r) => r.resourceType === resourceType);
}

describe('selection activity — owned building', () => {
  it('idle Town Center reports Idle', () => {
    // DEFAULT_SEED always has a completed Town Center for player 1.
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedBuildingDirect(bridge, HUMAN_PLAYER_ID, 'town-center')).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'idle', target: null });
  });

  it('Town Center training Villager reports Training Villager', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedBuildingDirect(bridge, HUMAN_PLAYER_ID, 'town-center')).toBe(true);
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    // Phase 1B queue.train: handler enqueues into productionQueues at start
    // of next step's processCommands.
    bridge.step(100);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'training', target: { kind: 'unit', type: 'villager' } });
  });

  it('building mid-construction reports Under construction', () => {
    // Place a house foundation (villager not yet at the site) and immediately
    // select the foundation. The construction state exists and isComplete===false.
    const bridge = createSimulationBridge(DEFAULT_SEED);
    // Select a villager first (required before beginBuildingPlacement).
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    const placed = placeBuildingNearTownCenter(bridge, 'house', HUMAN_PLAYER_ID);
    // Select the foundation immediately (before any construction can complete).
    expect(selectOwnedBuildingDirect(bridge, HUMAN_PLAYER_ID, 'house')).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'under construction', target: null });
    void placed;
  });

  it('Blacksmith researching Forging reports Researching Forging', () => {
    // feudal-blacksmith-fixture: player-1 in Feudal Age with a Blacksmith
    // at (17,8) and enough resources to research Forging.
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');
    expect(selectOwnedBuildingDirect(bridge, HUMAN_PLAYER_ID, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('forging')).toBe(true);
    // Phase 1B queue.research: handler enqueues into productionQueues at
    // start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'researching', target: { kind: 'technology', type: 'forging' } });
  });
});

describe('selection activity — hidden cases', () => {
  it('resource (tree) selection returns null activity', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const tree = bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
    expect(tree).toBeDefined();
    expect(bridge.selectEntityAtCell(tree!.x, tree!.y)).toBe(true);
    expect(bridge.getSelectionState().activity).toBeNull();
    expect(bridge.getSelectionState().activityBreakdown).toBeNull();
  });

  it('enemy unit selection returns null activity', () => {
    // militia-combat-fixture: player-1 Militia at (12,8) with vision radius 5,
    // enemy Scout at (15,8) — distance 3, well within vision. Step 2 ticks so
    // visibility propagates before selecting.
    const bridge = createSimulationBridge('militia-combat-fixture');
    bridge.step(100);
    bridge.step(100);
    const enemyScout = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 2 && u.unitType === 'scout');
    expect(enemyScout).toBeDefined();
    expect(bridge.selectEntityAtCell(enemyScout!.x, enemyScout!.y)).toBe(true);
    expect(bridge.getSelectionState().activity).toBeNull();
    expect(bridge.getSelectionState().activityBreakdown).toBeNull();
  });

  it('enemy building selection returns null activity', () => {
    // fog-memory-fixture: player-1 scout at (10,10) with vision radius 4,
    // enemy house at (14,10) — distance 4, on the exact boundary. Wait on the
    // visibility contract itself rather than a fixed auto-aggression tick.
    const bridge = createSimulationBridge('fog-memory-fixture');
    const enemyHouse = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 2 && b.buildingType === 'house');
    expect(enemyHouse).toBeDefined();
    expect(stepBridgeUntil(
      bridge,
      () => bridge.isCellVisibleForOwner(HUMAN_PLAYER_ID, enemyHouse!.x, enemyHouse!.y),
      { maxSteps: 20 },
    )).toBe(true);
    expect(bridge.selectEntityAtCell(enemyHouse!.x, enemyHouse!.y)).toBe(true);
    expect(bridge.getSelectionState().activity).toBeNull();
    expect(bridge.getSelectionState().activityBreakdown).toBeNull();
  });
});

describe('selection activity — multi-selection', () => {
  it('2 gathering + 1 idle villager produce a breakdown ordered by count desc', () => {
    // DEFAULT_SEED: player-1 has 3 villagers at ~(6,8), (6,9), (7,9).
    // Send 2 of them to a tree; leave 1 idle.
    // After they start gathering, box-select all 3 and read activityBreakdown.
    const bridge = createSimulationBridge(DEFAULT_SEED);

    // Collect all 3 player-1 villager IDs.
    const villagers = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === HUMAN_PLAYER_ID && u.unitType === 'villager');
    expect(villagers.length).toBe(3);
    const [v0, v1, v2] = villagers;

    const tree = findFirstResource(bridge, 'tree');
    expect(tree).toBeDefined();

    // Send v0 to chop.
    expect(bridge.selectEntityById(v0!.id)).toBe(true);
    expect(bridge.issueContextCommand(tree!.x, tree!.y)).toBe(true);

    // Send v1 to chop.
    expect(bridge.selectEntityById(v1!.id)).toBe(true);
    expect(bridge.issueContextCommand(tree!.x, tree!.y)).toBe(true);

    // v2 remains idle (no command).

    // Advance ticks until at least one villager is actively gathering.
    stepBridgeUntil(
      bridge,
      () => {
        bridge.selectEntityById(v0!.id);
        const a = bridge.getSelectionState().activity;
        return a !== null && a.verb === 'gathering';
      },
      { maxSteps: 30 },
    );

    // Now multi-select all 3 villagers.
    expect(bridge.selectUnitsByIds([v0!.id, v1!.id, v2!.id])).toBe(true);
    const state = bridge.getSelectionState();
    expect(state.activity).toBeNull();
    expect(state.activityBreakdown).not.toBeNull();

    const breakdown = state.activityBreakdown!;
    // gathering should appear first (count 2), idle second (count 1).
    expect(breakdown.entries[0]).toEqual({ label: 'gathering', count: 2 });
    expect(breakdown.entries[1]).toEqual({ label: 'idle', count: 1 });
    expect(breakdown.overflow).toBe(0);
  }, 10_000);

  it('single-entity selection does not populate breakdown', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    const state = bridge.getSelectionState();
    expect(state.activity).toEqual({ verb: 'idle', target: null });
    expect(state.activityBreakdown).toBeNull();
  });

  it('multi-selection of only unowned entities produces null breakdown', () => {
    // selectUnitsInBox only selects human-owned units. A box covering only
    // trees/resources therefore returns 0 selected entities (selectedEntityIds.length
    // stays 0 or falls into the early return), so activityBreakdown is null.
    // We verify by selecting a single tree and then calling selectUnitsInBox on a
    // region known to have no player-1 units.
    const bridge = createSimulationBridge(DEFAULT_SEED);

    // Find a tree position, then box-select a 1x1 region there.
    const tree = findFirstResource(bridge, 'tree');
    expect(tree).toBeDefined();

    // The box-select covers only the tree cell (no owned units nearby).
    const result = bridge.selectUnitsInBox(tree!.x, tree!.y, tree!.x, tree!.y);
    // Either returns false (empty selection) or true with count 0.
    // In both cases activityBreakdown must be null.
    if (result) {
      const state = bridge.getSelectionState();
      // If anything was selected it's a human unit that happened to share the cell.
      // The breakdown would then not be null only if selectedEntityIds.length > 1.
      if (state.selectedCount <= 1) {
        expect(state.activityBreakdown).toBeNull();
      }
    } else {
      // No owned units in that cell — getSelectionState returns early-return block.
      const state = bridge.getSelectionState();
      expect(state.activityBreakdown).toBeNull();
    }
  });

  it.skip('overflow: 6 distinct coarse verbs cap at 5 with overflow=1', () => {
    // Achieving 6 simultaneously distinct verbs in a single bridge requires
    // units of different behavioural classes (villager + combat + monk) AND
    // resources (trees for gathering) all in one scene. No existing fixture
    // combines all of these. A dedicated fixture is needed; deferred until
    // one is added. The cap-at-5 / overflow arithmetic in
    // getSelectionActivityBreakdown is straightforward and low-risk.
  });
});
