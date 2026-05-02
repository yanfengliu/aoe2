import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
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

    // Phase 1B unit.attack (DESIGN v17 §6.5): the bridge facade routes
    // through `world.submitWithResult('unit.attack', ...)`. Validator runs
    // at submit time; handler runs at start of next step's
    // `processCommands`. Step once so the attack command is set on the
    // militia before checking the activity verb.
    bridge.step(100);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'attacking', target: { kind: 'unit', type: 'scout' } });
  }, 10_000);

  it('villager given a move command to an empty tile reports Moving', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    // Issue a plain move to a distant empty cell far from any resource.
    expect(bridge.issueMoveCommand(2, 2)).toBe(true);
    // Phase 1B (DESIGN v17 §6.5): the bridge facade now routes through
    // `world.submitWithResult('unit.move', ...)`. Validator runs at submit
    // time (returns true here); handler runs at start of next step's
    // `processCommands`. Step once so the handler executes before
    // checking the activity verb.
    bridge.step(100);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'moving', target: null });
  });

  it('villager returning with wood reports Dropping off wood', () => {
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
        return activity !== null && activity.verb === 'dropping off';
      },
      { maxSteps: 600 },
    );
    expect(reached).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'dropping off', target: { kind: 'economy-resource', type: 'wood' } });
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

    // Phase 1B monk.contextAtEntity: handler routes to setMonkTask at start
    // of next step's processCommands. Step once so the heal task lands.
    bridge.step(100);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'healing', target: { kind: 'unit', type: 'spearman' } });
  }, 60_000);

  it('monk converting an enemy reports Converting Militia', () => {
    // monk-convert-fixture: monk at (14,8), enemy Militia at (15,8).
    const bridge = createSimulationBridge('monk-convert-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(enemyMilitia!.id)).toBe(true);

    // Phase 1B monk.contextAtEntity: handler routes to setMonkTask at start
    // of next step's processCommands.
    bridge.step(100);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'converting', target: { kind: 'unit', type: 'militia' } });
  }, 10_000);

  it('monk retrieving a relic reports Retrieving relic', () => {
    // monk-relic-fixture: monk at (14,8), relic at (15,8), monastery at (18,8).
    // MONK_ACTION_RANGE=4, distance(monk, relic)=1, so a single step would
    // both queue the pickup task AND apply it (relic gets carried). To keep
    // the 'retrieving' verb observable, push the monk to (10,8) first so
    // distance to relic becomes 5 (> action range), and the pickup task
    // remains in monkTasks while the monk approaches across multiple ticks.
    const bridge = createSimulationBridge('monk-relic-fixture');

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueMoveCommand(14, 14)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const m = findFirstOwnedUnit(bridge, HUMAN_PLAYER_ID, 'monk');
          return m !== undefined && m.x === 14 && m.y === 14;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    const relic = findFirstResource(bridge, 'relic');
    expect(relic).toBeDefined();
    expect(bridge.selectEntityAtCell(relic!.x, relic!.y)).toBe(true);
    const relicId = bridge.getSelectionState().selectedEntityId!;

    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(relicId)).toBe(true);

    // Phase 1B monk.contextAtEntity: handler routes to setMonkTask at start
    // of next step's processCommands. With distance > range the pickup
    // task remains active across multiple ticks (monk approaches the relic).
    bridge.step(100);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'retrieving', target: null });
  }, 10_000);

  it('monk depositing a relic reports Carrying relic', () => {
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
    // After pickup, monk is co-located with relic at (14,8) carrying it.
    // Issue the deposit and assert WITHOUT stepping: the bridge facade's
    // submitWithResult queues the command (handler runs at start of NEXT
    // step), so monkTasks is unchanged and monkCarriedRelic still has the
    // relic. The activity layer's monkCarriedRelic fallthrough reports
    // 'carrying' from the carry state alone.
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(monastery!.id)).toBe(true);
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'carrying', target: null });
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

