import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function militia(bridge: Bridge) {
  return bridge.getEconomyState().units
    .find((unit) => unit.owner === 1 && unit.unitType === 'militia');
}

describe('issuing a patrol', () => {
  it('is rejected with nothing selected', () => {
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    bridge.clearSelection();
    expect(bridge.issuePatrolCommand(20, 20)).toBe(false);
  });

  it('records a route between where the unit stands and where it was sent', () => {
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    const start = militia(bridge);
    expect(start).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issuePatrolCommand(start!.x + 6, start!.y)).toBe(true);

    // The accessor flushes to world.state on tick, so read after one step.
    bridge.step(100);
    const routes = bridge.world.getState('aoe2.patrolRoutes') as Array<
      [number, { a: { x: number; y: number }; b: { x: number; y: number } }]
    > | undefined ?? [];
    const route = routes.find(([id]) => id === start!.id)?.[1];
    expect(route).toBeDefined();
    expect(route!.a).toEqual({ x: start!.x, y: start!.y });
    expect(route!.b).toEqual({ x: start!.x + 6, y: start!.y });
  });
});

describe('a patrolling unit', () => {
  it('walks to the far end and comes back, without another order', () => {
    // The whole point: one command, indefinite back-and-forth. A unit that
    // merely walks there once is an attack-move, not a patrol.
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    const start = militia(bridge);
    expect(start).toBeDefined();
    const far = { x: start!.x + 5, y: start!.y };

    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issuePatrolCommand(far.x, far.y)).toBe(true);
    bridge.clearSelection();

    expect(stepBridgeUntil(
      bridge,
      () => {
        const now = militia(bridge);
        return now !== undefined && now.x >= far.x;
      },
      { maxSteps: 600 },
    ), 'never reached the far end').toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => {
        const now = militia(bridge);
        return now !== undefined && now.x <= start!.x;
      },
      { maxSteps: 600 },
    ), 'never came back').toBe(true);
  }, 90_000);

  it('stops patrolling the moment the player gives it another order', () => {
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    const start = militia(bridge);
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issuePatrolCommand(start!.x + 6, start!.y)).toBe(true);

    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issueMoveCommand(start!.x, start!.y + 4)).toBe(true);

    bridge.step(100);
    const routes = (bridge.world.getState('aoe2.patrolRoutes')
      ?? []) as Array<[number, unknown]>;
    expect(routes.find(([id]) => id === start!.id)).toBeUndefined();
  });
});

describe('a patrol survives what it meets', () => {
  it('keeps patrolling after killing an enemy it ran into', () => {
    // Auto-aggression takes the unit off its walk to fight. An attack-move is
    // lost at that point; a patrol is a standing route, so it resumes.
    const bridge = createSimulationBridge('auto-aggro-idle-militia-in-vision-fixture');
    const start = militia(bridge);
    const enemy = bridge.getEconomyState().units.find((unit) => unit.owner === 2);
    expect(enemy).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
    expect(bridge.issuePatrolCommand(enemy!.x, enemy!.y)).toBe(true);
    bridge.clearSelection();

    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.every((unit) => unit.id !== enemy!.id),
      { maxSteps: 900 },
    ), 'never killed the enemy on the route').toBe(true);

    const routes = (bridge.world.getState('aoe2.patrolRoutes')
      ?? []) as Array<[number, unknown]>;
    expect(routes.find(([id]) => id === start!.id), 'patrol was dropped by the fight')
      .toBeDefined();
  }, 90_000);
});
