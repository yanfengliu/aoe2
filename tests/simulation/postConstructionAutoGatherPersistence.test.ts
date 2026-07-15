// Persistence + replay coverage for automatic post-construction mining
// (spec §6.2). Two mechanisms carry the behavior across boundaries: applied
// orders live in ordinary gatherer state, and a completion->drain window
// order lives in the serialized `aoe2.pendingCommands` queue. In replay the
// queue is authority-DISCARDED every tick (aoe2ReplayPendingCommandDrain), so
// the recorded `unit.autoGather` command stream is the only delivery path —
// both directions are pinned here.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import type { GathererComponent } from '../../src/game/simulation/types';
import {
  CAMP_NEAREST_ANCHOR,
  campAt,
  gathererOf,
  mineIdAt,
  placeCampWithVillagers,
  stepUntil,
  stepUntilCampComplete,
  villagerIdsOf,
  type Bridge,
} from './postConstructionAutoGatherTestKit';

function driveToCompletion(bridge: Bridge): { builders: number[]; mineId: number } {
  const builders = villagerIdsOf(bridge, 1);
  placeCampWithVillagers(bridge, builders, CAMP_NEAREST_ANCHOR);
  stepUntilCampComplete(bridge, CAMP_NEAREST_ANCHOR);
  return { builders, mineId: mineIdAt(bridge, 18, 14) };
}

function restoredFrom(bridge: Bridge): Bridge {
  const blob = bridge.saveGame();
  return createSimulationBridge(DEFAULT_SEED, {
    savedGame: JSON.parse(JSON.stringify(blob)) as ReturnType<Bridge['saveGame']>,
  });
}

describe('post-construction auto-mine persistence and replay', () => {
  it('persists an APPLIED auto-order across save/load and keeps mining', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const { builders, mineId } = driveToCompletion(bridge);
    bridge.step(100);
    for (const id of builders) {
      expect(gathererOf(bridge, id).targetResourceId).toBe(mineId);
    }

    const restored = restoredFrom(bridge);
    for (const id of builders) {
      const gatherer = gathererOf(restored, id);
      expect(gatherer.targetResourceId).toBe(mineId);
      expect(gatherer.hasExplicitGatherOrder).toBe(true);
      expect(gatherer.desiredResource).toBe('gold');
    }
    const goldBefore = restored.getEconomyState().playerResources[1]!.gold;
    expect(stepUntil(
      restored,
      () => restored.getEconomyState().playerResources[1]!.gold > goldBefore,
      600,
    )).toBe(true);
  });

  it('persists a QUEUED (not yet drained) auto-order across save/load and fires it on the next step', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const { builders, mineId } = driveToCompletion(bridge);
    // Save in the completion->drain window: the intentions sit in
    // `aoe2.pendingCommands` and nothing has touched the gatherers yet.
    expect(bridge.pendingCommands.some((cmd) => cmd.type === 'unit.autoGather')).toBe(true);
    for (const id of builders) {
      expect(gathererOf(bridge, id).targetResourceId).toBeNull();
    }

    const restored = restoredFrom(bridge);
    restored.step(100);
    for (const id of builders) {
      expect(gathererOf(restored, id).targetResourceId).toBe(mineId);
    }
  });

  it('never self-fires the queued order in a REPLAY world — the recorded stream is the only authority', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const { builders } = driveToCompletion(bridge);
    expect(bridge.pendingCommands.some((cmd) => cmd.type === 'unit.autoGather')).toBe(true);

    const replayWorld = createReplayWorldOnly(structuredClone(bridge.world.serialize()));
    replayWorld.step();
    replayWorld.step();
    for (const id of builders) {
      const gatherer = replayWorld.getComponent<GathererComponent>(id, 'gatherer');
      expect(gatherer?.targetResourceId ?? null).toBeNull();
    }
  });

  it('executes a recorded unit.autoGather command through the replay world handler set', () => {
    const bridge = createSimulationBridge('auto-mine-camp-fixture');
    const { builders, mineId } = driveToCompletion(bridge);
    const camp = campAt(bridge, CAMP_NEAREST_ANCHOR);
    expect(camp).toBeDefined();

    const replayWorld = createReplayWorldOnly(structuredClone(bridge.world.serialize()));
    const result = replayWorld.submitWithResult('unit.autoGather', {
      unitId: builders[0]!,
      resourceId: mineId,
      campBuildingId: camp!.id,
    });
    expect(result.accepted).toBe(true);
    replayWorld.step();
    const gatherer = replayWorld.getComponent<GathererComponent>(builders[0]!, 'gatherer');
    expect(gatherer?.targetResourceId).toBe(mineId);
  });
});
