import {
  SessionRecorder,
  type SessionBundle,
} from 'civ-engine';

import {
  createSimulationBridge,
  type SimulationBridge,
} from '../../src/game/simulation/createSimulationBridge';
import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type {
  GameCommands,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';

type EconomyUnit = ReturnType<SimulationBridge['getEconomyState']>['units'][number];

export interface RecordedCommandFixture {
  bridge: SimulationBridge;
  bundle: SessionBundle<GameEvents, GameCommands>;
  pendingSnapshotTick?: number;
}

export function findOwnedUnit(
  bridge: SimulationBridge,
  owner: number,
  unitType: string,
): EconomyUnit {
  const unit = bridge.getEconomyState().units.find(
    (candidate) => candidate.owner === owner && candidate.unitType === unitType,
  );
  if (!unit) {
    throw new Error(`Expected ${unitType} owned by player ${owner}.`);
  }
  return unit;
}

export function recordCommandReplayFixture(): RecordedCommandFixture {
  const bridge = createSimulationBridge('ai-rush-fixture');
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: null,
    terminalSnapshot: false,
    sourceKind: 'session',
    sourceLabel: 'phase-3a-command-replay-test',
  });

  recorder.connect();

  const villager = findOwnedUnit(bridge, 1, 'villager');
  bridge.world.submitWithResult('unit.move', {
    unitId: villager.id,
    target: { x: villager.x + 2, y: villager.y },
  });

  for (let tick = 0; tick < 80; tick += 1) {
    bridge.step(100);
  }

  recorder.disconnect();

  return {
    bridge,
    bundle: recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>,
  };
}

export function recordCommandReplayFixtureAtPendingBoundary(): RecordedCommandFixture {
  const bridge = createSimulationBridge('ai-rush-fixture');
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: null,
    terminalSnapshot: false,
    sourceKind: 'session',
    sourceLabel: 'phase-3a-pending-boundary-test',
  });

  recorder.connect();

  const villager = findOwnedUnit(bridge, 1, 'villager');
  bridge.world.submitWithResult('unit.move', {
    unitId: villager.id,
    target: { x: villager.x + 2, y: villager.y },
  });
  bridge.step(100);

  const pending = bridge.world.getState(TIER_3_SLOTS.pendingCommands) as
    | unknown[]
    | undefined;
  if (!pending || pending.length === 0) {
    throw new Error('Expected first AI decision tick to persist pending commands.');
  }

  recorder.disconnect();

  return {
    bridge,
    bundle: recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>,
  };
}

export function recordCommandReplayFixtureWithPendingSnapshot(): RecordedCommandFixture {
  const bridge = createSimulationBridge('ai-rush-fixture');
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: null,
    terminalSnapshot: false,
    sourceKind: 'session',
    sourceLabel: 'phase-3a-pending-snapshot-test',
  });

  recorder.connect();

  bridge.step(100);
  const pending = bridge.world.getState(TIER_3_SLOTS.pendingCommands) as
    | unknown[]
    | undefined;
  if (!pending || pending.length === 0) {
    throw new Error('Expected first AI decision tick to persist pending commands.');
  }
  const snapshot = recorder.takeSnapshot();

  for (let tick = 0; tick < 40; tick += 1) {
    bridge.step(100);
  }

  recorder.disconnect();

  return {
    bridge,
    bundle: recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>,
    pendingSnapshotTick: snapshot.tick,
  };
}
