// The FU4 AI late-game pursuits: the AI's Monks and its Wonder victory push.
//
// This half holds the Monk cases — task assignment deferred through the
// command queue, queued intentions surviving save/load, the Monastery, Monk
// training, healing, and relic pickup/deposit — together with the Wonder
// build-and-win case. Its sibling `aiPlayer.test.ts` holds the Slice 10
// planner core (the pure helpers and the end-to-end economy/age-up runs).
//
// Split out of `aiPlayer.test.ts` on 2026-09-05, when that file sat at exactly
// the 500-line hard cap enforced by
// `tests/architecture/fileSizeBudget.test.ts`. The split is purely
// structural: every case moved verbatim, no assertion or budget changed.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  monkCarriedRelicCodec,
  monkTasksCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { PendingCommand } from '../../src/game/simulation/dispatcher';
import {
  PENDING_COMMANDS_STATE_SLOT,
  codecSlotValue,
  stateSlot,
} from './saveBlobTestUtils';

describe('FU4 AI Monks', () => {
  it('defers AI Monk task assignment through the command queue', () => {
    const bridge = createSimulationBridge('ai-monk-relic-fixture');
    const initialEconomy = bridge.getEconomyState();
    const monk = initialEconomy.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'monk',
    );
    const relic = initialEconomy.resources.find((resource) => resource.resourceType === 'relic');
    expect(monk).toBeDefined();
    expect(relic).toBeDefined();
    if (!monk || !relic) return;

    bridge.step(100);

    const afterDecision = bridge.getEconomyState();
    expect(afterDecision.resources.some((resource) => resource.id === relic.id)).toBe(true);
    expect(
      codecSlotValue(bridge.saveGame(), monkCarriedRelicCodec).some(
        ([monkId, relicId]) => monkId === monk.id && relicId === relic.id,
      ),
    ).toBe(false);

    bridge.step(100);

    expect(
      codecSlotValue(bridge.saveGame(), monkCarriedRelicCodec).some(
        ([monkId, relicId]) => monkId === monk.id && relicId === relic.id,
      ),
    ).toBe(true);
  }, 120_000);

  it('preserves queued AI Monk assignment across save/load before the handler tick', () => {
    const bridge = createSimulationBridge('ai-monk-relic-fixture');
    const initialEconomy = bridge.getEconomyState();
    const monk = initialEconomy.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'monk',
    );
    const relic = initialEconomy.resources.find((resource) => resource.resourceType === 'relic');
    expect(monk).toBeDefined();
    expect(relic).toBeDefined();
    if (!monk || !relic) return;

    bridge.step(100);
    const blob = bridge.saveGame();
    expect(
      stateSlot<PendingCommand[]>(blob, PENDING_COMMANDS_STATE_SLOT).some(
        (command) =>
          command.type === 'monk.contextAtEntity'
          && command.data.unitId === monk.id
          && command.data.targetEntityId === relic.id
          && command.data.expectedOwner === 2
          && command.data.intendedTaskKind === 'pickup',
      ),
    ).toBe(true);

    const loaded = createSimulationBridge('ai-monk-relic-fixture', {
      savedGame: JSON.parse(JSON.stringify(blob)) as typeof blob,
    });
    loaded.step(100);

    expect(
      stateSlot<PendingCommand[]>(
        { worldSnapshot: loaded.world.serialize() },
        PENDING_COMMANDS_STATE_SLOT,
      ),
    ).toEqual([]);
    expect(
      codecSlotValue(loaded.saveGame(), monkCarriedRelicCodec).some(
        ([monkId, relicId]) => monkId === monk.id && relicId === relic.id,
      ),
    ).toBe(true);
  }, 120_000);

  it('keeps saved pending AI Monk intentions isolated from the live queue', () => {
    const bridge = createSimulationBridge('ai-monk-relic-fixture');
    const initialEconomy = bridge.getEconomyState();
    const monk = initialEconomy.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'monk',
    );
    const relic = initialEconomy.resources.find((resource) => resource.resourceType === 'relic');
    expect(monk).toBeDefined();
    expect(relic).toBeDefined();
    if (!monk || !relic) return;

    bridge.step(100);
    const blob = bridge.saveGame();
    const queued = stateSlot<PendingCommand[]>(blob, PENDING_COMMANDS_STATE_SLOT).find(
      (command) => command.type === 'monk.contextAtEntity',
    );
    expect(queued).toBeDefined();
    if (!queued || queued.type !== 'monk.contextAtEntity') return;

    queued.data.targetEntityId = -1;
    bridge.step(100);

    expect(
      codecSlotValue(bridge.saveGame(), monkCarriedRelicCodec).some(
        ([monkId, relicId]) => monkId === monk.id && relicId === relic.id,
      ),
    ).toBe(true);
  }, 120_000);

  it('no-ops queued AI Monk assignments whose intended task no longer matches', () => {
    const bridge = createSimulationBridge('ai-monk-relic-fixture');
    const initialEconomy = bridge.getEconomyState();
    const monk = initialEconomy.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'monk',
    );
    const relic = initialEconomy.resources.find((resource) => resource.resourceType === 'relic');
    expect(monk).toBeDefined();
    expect(relic).toBeDefined();
    if (!monk || !relic) return;

    const result = bridge.world.submitWithResult('monk.contextAtEntity', {
      unitId: monk.id,
      targetEntityId: relic.id,
      expectedOwner: 2,
      intendedTaskKind: 'heal',
    });
    expect(result.accepted).toBe(true);

    bridge.step(100);

    const afterMismatch = bridge.saveGame();
    expect(codecSlotValue(afterMismatch, monkTasksCodec)).toEqual([]);
    expect(
      codecSlotValue(afterMismatch, monkCarriedRelicCodec).some(
        ([monkId, relicId]) => monkId === monk.id && relicId === relic.id,
      ),
    ).toBe(false);
  }, 120_000);

  it('builds a Monastery in Castle Age on the ai-monk-fixture', () => {
    const bridge = createSimulationBridge('ai-monk-fixture');
    let aiMonasteryComplete = false;
    for (let i = 0; i < 3_000; i += 1) {
      bridge.step(100);
      const economy = bridge.getEconomyState();
      if (
        economy.buildings.some(
          (b) => b.owner === 2 && b.buildingType === 'monastery' && b.isComplete,
        )
      ) {
        aiMonasteryComplete = true;
        break;
      }
    }
    expect(aiMonasteryComplete).toBe(true);
  }, 120_000);

  it('trains Monks at the Monastery once Castle Age opens', () => {
    const bridge = createSimulationBridge('ai-monk-fixture');
    let aiMonkSpawned = false;
    for (let i = 0; i < 4_000; i += 1) {
      bridge.step(100);
      const economy = bridge.getEconomyState();
      if (economy.units.some((u) => u.owner === 2 && u.unitType === 'monk')) {
        aiMonkSpawned = true;
        break;
      }
    }
    expect(aiMonkSpawned).toBe(true);
  }, 120_000);

  it("heals a wounded military unit via the AI's Monk", () => {
    const bridge = createSimulationBridge('ai-monk-heal-fixture');
    const initialEconomy = bridge.getEconomyState();
    const startingPikeman = initialEconomy.units.find(
      (u) => u.owner === 2 && u.unitType === 'pikeman',
    );
    expect(startingPikeman).toBeDefined();
    if (!startingPikeman) {
      return;
    }
    const initialHealth = bridge.getEntityHealth(startingPikeman.id);
    expect(initialHealth).not.toBeNull();
    if (!initialHealth) {
      return;
    }
    const initialHp = initialHealth.currentHp;
    expect(initialHp).toBeGreaterThan(0);
    expect(initialHp).toBeLessThan(initialHealth.maxHp);

    let healed = false;
    for (let i = 0; i < 1_500; i += 1) {
      bridge.step(100);
      const health = bridge.getEntityHealth(startingPikeman.id);
      if (!health) {
        break;
      }
      if (health.currentHp > initialHp) {
        healed = true;
        break;
      }
    }
    expect(healed).toBe(true);
  }, 120_000);

  it("picks up and deposits a visible neutral relic via the AI's Monk", () => {
    const bridge = createSimulationBridge('ai-monk-relic-fixture');
    const aiOwner = 2;
    const initialEconomy = bridge.getEconomyState();
    const initialRelics = initialEconomy.resources.filter((r) => r.resourceType === 'relic');
    expect(initialRelics.length).toBe(1);

    let depositedRelic = false;
    for (let i = 0; i < 2_500; i += 1) {
      bridge.step(100);
      const economy = bridge.getEconomyState();
      const relicsLeft = economy.resources.filter((r) => r.resourceType === 'relic');
      // The relic disappears (and the AI's gold ticks up via
      // prototypeRelicGold) when a Monk deposits it in a friendly
      // Monastery — verify both signals to keep the test honest.
      const aiGold = economy.playerResources[aiOwner].gold;
      if (relicsLeft.length === 0 && aiGold > initialEconomy.playerResources[aiOwner].gold) {
        depositedRelic = true;
        break;
      }
    }
    expect(depositedRelic).toBe(true);
  }, 120_000);
});

describe('FU4 AI Wonder pursuit', () => {
  it('builds a Wonder and wins via Wonder victory in Imperial Age', () => {
    const bridge = createSimulationBridge('ai-wonder-fixture');
    let wonderPlaced = false;
    let wonderComplete = false;
    let aiVictory = false;
    for (let i = 0; i < 5_000; i += 1) {
      bridge.step(100);
      const economy = bridge.getEconomyState();
      const aiWonders = economy.buildings.filter(
        (b) => b.owner === 2 && b.buildingType === 'wonder',
      );
      if (aiWonders.length > 0) {
        wonderPlaced = true;
        if (aiWonders.some((w) => w.isComplete)) {
          wonderComplete = true;
        }
      }
      const matchState = bridge.getMatchState();
      if (matchState.outcome !== 'running' && matchState.winCondition === 'wonder') {
        // The AI is owner 2 — when the AI wins, the human player loses
        // by Wonder victory.
        aiVictory = matchState.outcome === 'defeat';
        break;
      }
    }
    expect(wonderPlaced).toBe(true);
    expect(wonderComplete).toBe(true);
    expect(aiVictory).toBe(true);
  }, 180_000);
});
