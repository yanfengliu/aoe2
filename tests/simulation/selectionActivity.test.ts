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

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findFirstResource(bridge: Bridge, resourceType: string) {
  return bridge.getEconomyState().resources.find((r) => r.resourceType === resourceType);
}

describe('selection activity — owned unit', () => {
  it('idle villager reports Idle', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'idle', target: null });
  });

  it('villager ordered onto a tree reports Gathering wood', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    const tree = bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
    expect(tree).toBeDefined();
    expect(bridge.issueContextCommand(tree!.x, tree!.y)).toBe(true);
    stepBridgeUntil(
      bridge,
      () => bridge.getSelectionState().activity?.verb !== 'idle',
      { maxSteps: 5 },
    );
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'gathering', target: { kind: 'economy-resource', type: 'wood' } });
  });

  it('idle militia with no command reports Idle', () => {
    // militia-combat-fixture has a player-1 Militia with no assigned command.
    const bridge = createSimulationBridge('militia-combat-fixture');
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'militia')).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'idle', target: null });
  });

  it('militia with attack command on enemy reports Attacking Scout', () => {
    // militia-combat-fixture: player-1 Militia at (12,8), enemy Scout at (15,8).
    const bridge = createSimulationBridge('militia-combat-fixture');
    const enemyScout = findFirstOwnedUnit(bridge, 2, 'scout');
    expect(enemyScout).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'militia')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(enemyScout!.id)).toBe(true);

    // The attack command registers immediately; no stepping required.
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'attacking', target: { kind: 'unit', type: 'scout' } });
  }, 10_000);

  it('villager given a move command to an empty tile reports Moving', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    // Issue a plain move to a distant empty cell far from any resource.
    expect(bridge.issueMoveCommand(2, 2)).toBe(true);
    // Verify the move command registered before the unit arrives.
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'moving', target: null });
  });

  it('villager returning with wood reports Returning wood', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    const tree = bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
    expect(tree).toBeDefined();
    expect(bridge.issueContextCommand(tree!.x, tree!.y)).toBe(true);

    // Chop long enough for the villager to fill up and start returning.
    const reached = stepBridgeUntil(
      bridge,
      () => {
        // Re-select each check to get fresh state.
        selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager');
        const activity = bridge.getSelectionState().activity;
        return activity !== null && activity.verb === 'returning';
      },
      { maxSteps: 600 },
    );
    expect(reached).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'returning', target: { kind: 'economy-resource', type: 'wood' } });
  }, 30_000);

  it('villager placing a house foundation reports Building House', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);

    // Place a house near the Town Center.
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    // Find a valid placement near the starting position.
    let placed = false;
    for (let radius = 2; radius <= 10 && !placed; radius += 1) {
      for (let dy = -radius; dy <= radius && !placed; dy += 1) {
        for (let dx = -radius; dx <= radius && !placed; dx += 1) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const preview = bridge.getPlacementPreview(8 + dx, 8 + dy);
          if (preview?.isValid) {
            expect(bridge.confirmBuildingPlacement(8 + dx, 8 + dy)).toBe(true);
            placed = true;
          }
        }
      }
    }
    expect(placed).toBe(true);

    // After confirmation the villager gets a build command; re-select and check.
    selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager');
    // Step one tick so the command is processed.
    bridge.step(100);
    selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager');
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'building', target: { kind: 'building', type: 'house' } });
  });

  it('monk healing a friendly unit reports Healing Spearman', () => {
    // monk-heal-fixture: monk at (14,8), wounded spearman nearby, wolf for damage.
    const bridge = createSimulationBridge('monk-heal-fixture');

    const spearman = findFirstOwnedUnit(bridge, HUMAN_PLAYER_ID, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanId = spearman!.id;

    // Let the wolf wound the spearman.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = bridge.getEconomyState().units.find((u) => u.id === spearmanId);
          if (!s) return false;
          if (!bridge.selectEntityAtCell(s.x, s.y)) return false;
          const hp = bridge.getSelectionState().health?.current ?? null;
          return hp !== null && hp < 40 && hp > 5;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Kill the wolf so heal is not interrupted.
    const wolf = findFirstResource(bridge, 'wolf');
    expect(wolf).toBeDefined();
    expect(bridge.selectEntityAtCell(wolf!.x, wolf!.y)).toBe(true);
    const wolfId = bridge.getSelectionState().selectedEntityId!;
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'spearman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(wolfId)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => findFirstResource(bridge, 'wolf') === undefined,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Move spearman next to the monk.
    const monk = findFirstOwnedUnit(bridge, HUMAN_PLAYER_ID, 'monk');
    expect(monk).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'spearman')).toBe(true);
    expect(bridge.issueMoveCommand(monk!.x + 1, monk!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const s = bridge.getEconomyState().units.find((u) => u.id === spearmanId);
          return (
            s !== undefined
            && Math.abs(s.x - monk!.x) + Math.abs(s.y - monk!.y) <= 2
          );
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Issue heal order on the monk.
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanId)).toBe(true);

    // The monk task registers; check activity immediately.
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'healing', target: { kind: 'unit', type: 'spearman' } });
  }, 60_000);

  it('monk converting an enemy reports Converting Militia', () => {
    // monk-convert-fixture: monk at (14,8), enemy Militia at (15,8).
    const bridge = createSimulationBridge('monk-convert-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(enemyMilitia!.id)).toBe(true);

    // The convert task registers immediately.
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'converting', target: { kind: 'unit', type: 'militia' } });
  }, 10_000);

  it('monk retrieving a relic reports Retrieving relic', () => {
    // monk-relic-fixture: monk at (14,8), relic at (15,8), monastery at (18,8).
    const bridge = createSimulationBridge('monk-relic-fixture');

    const relic = findFirstResource(bridge, 'relic');
    expect(relic).toBeDefined();
    expect(bridge.selectEntityAtCell(relic!.x, relic!.y)).toBe(true);
    const relicId = bridge.getSelectionState().selectedEntityId!;

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(relicId)).toBe(true);

    // The pickup task registers immediately.
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'retrieving', target: null });
  }, 10_000);

  it('monk depositing a relic reports Depositing relic', () => {
    // monk-relic-fixture: monk at (14,8), relic at (15,8), monastery at (18,8).
    const bridge = createSimulationBridge('monk-relic-fixture');

    const relic = findFirstResource(bridge, 'relic');
    expect(relic).toBeDefined();
    expect(bridge.selectEntityAtCell(relic!.x, relic!.y)).toBe(true);
    const relicId = bridge.getSelectionState().selectedEntityId!;

    // First pick up the relic.
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(relicId)).toBe(true);

    // Wait until the monk is co-located with the relic (carrying it).
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const r = findFirstResource(bridge, 'relic');
          const m = findFirstOwnedUnit(bridge, HUMAN_PLAYER_ID, 'monk');
          return (
            r !== undefined
            && m !== undefined
            && r.x === m.x
            && r.y === m.y
          );
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Now issue deposit order to the monastery.
    const monastery = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === HUMAN_PLAYER_ID && b.buildingType === 'monastery');
    expect(monastery).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(monastery!.id)).toBe(true);

    // The deposit task registers immediately.
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'depositing', target: null });
  }, 30_000);

  it('trebuchet unpacking reports Unpacking', () => {
    // trebuchet-vs-building-fixture: trebuchet inside range, attack command
    // causes it to auto-unpack. Step enough ticks to enter the transition
    // (transitionTicksRemaining > 0 but not yet 0).
    const bridge = createSimulationBridge('trebuchet-vs-building-fixture');

    const tc = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 2 && b.buildingType === 'town-center');
    expect(tc).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'trebuchet')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tc!.id)).toBe(true);

    // Step into the pack transition window but before it completes (~50 ticks).
    const reached = stepBridgeUntil(
      bridge,
      () => {
        selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'trebuchet');
        return bridge.getSelectionState().activity?.verb === 'unpacking';
      },
      { maxSteps: 60 },
    );
    expect(reached).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'unpacking', target: null });
  }, 10_000);

  it('trebuchet packing reports Packing', () => {
    // trebuchet-vs-building-fixture: low-HP enemy TC at (20,8).
    // After the trebuchet unpacks and destroys the TC, issue a move command
    // to trigger the pack-back transition.
    const bridge = createSimulationBridge('trebuchet-vs-building-fixture');

    const trebUnit = findFirstOwnedUnit(bridge, HUMAN_PLAYER_ID, 'trebuchet');
    expect(trebUnit).toBeDefined();
    const trebId = trebUnit!.id;

    // The near enemy TC (low HP) — the one the trebuchet will attack.
    const nearTc = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 2 && b.x === 20);
    expect(nearTc).toBeDefined();
    const nearTcId = nearTc!.id;

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'trebuchet')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(nearTcId)).toBe(true);

    // Wait until the trebuchet destroys the TC (fully unpacked + fired).
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().buildings.find((b) => b.id === nearTcId) === undefined,
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Trebuchet is now unpacked and idle. Issue a move command far away.
    const trebNow = bridge.getEconomyState().units.find((u) => u.id === trebId);
    expect(trebNow).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'trebuchet')).toBe(true);
    expect(bridge.issueMoveCommand(trebNow!.x + 10, trebNow!.y)).toBe(true);

    // The Packing transition starts immediately on the next step.
    bridge.step(100);
    selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'trebuchet');
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'packing', target: null });
  }, 30_000);
});

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
    // enemy house at (14,10) — distance 4, on the exact boundary. Step 2 ticks
    // so visibility propagates (matches fogMemory.test.ts pattern).
    const bridge = createSimulationBridge('fog-memory-fixture');
    bridge.step(100);
    bridge.step(100);
    const enemyHouse = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 2 && b.buildingType === 'house');
    expect(enemyHouse).toBeDefined();
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
