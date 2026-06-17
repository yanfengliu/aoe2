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
import {
  attackGroupSize,
  decisionIntervalTicks,
  gatherMultiplier,
  pickNextAgeResearch,
  pickNextBuildTarget,
  pickUnitMix,
  planForAge,
  villagerTargetsEqual,
  villagerTargetsForAge,
} from '../../src/game/simulation/ai';

// Slice 10: AI planner-style behavior tests. The suite mixes pure-helper
// checks (fast, deterministic) with end-to-end simulation runs on the
// `ai-planner-fixture` / `ai-scouting-response-fixture` / `ai-difficulty-
// fixture` scenarios. The E2E cases drive the bridge through a fixed
// tick budget and assert on `getEconomyState` / `getHudState`.

describe('Slice 10 AI planner — pure helpers', () => {
  it('maps each age to a distinct plan label', () => {
    expect(planForAge('dark-age')).toBe('opening');
    expect(planForAge('feudal-age')).toBe('feudal-push');
    expect(planForAge('castle-age')).toBe('castle-push');
    expect(planForAge('imperial-age')).toBe('imperial-push');
  });

  it('advances villager targets across ages', () => {
    const dark = villagerTargetsForAge('dark-age');
    const feudal = villagerTargetsForAge('feudal-age');
    const imperial = villagerTargetsForAge('imperial-age');
    expect(dark.food ?? 0).toBeLessThan(feudal.food ?? 0);
    expect(feudal.gold ?? 0).toBeLessThan(imperial.gold ?? 0);
    expect(imperial.stone ?? 0).toBeGreaterThan(dark.stone ?? 0);
  });

  it('returns the next age for each current age', () => {
    const allowAll = () => true;
    expect(pickNextAgeResearch('dark-age', allowAll, allowAll)).toBe('feudal-age');
    expect(pickNextAgeResearch('feudal-age', allowAll, allowAll)).toBe('castle-age');
    expect(pickNextAgeResearch('castle-age', allowAll, allowAll)).toBe('imperial-age');
    expect(pickNextAgeResearch('imperial-age', allowAll, allowAll)).toBeNull();
  });

  it('returns null when age-up prerequisites or cost are unmet', () => {
    const ok = () => true;
    const block = () => false;
    expect(pickNextAgeResearch('dark-age', block, ok)).toBeNull();
    expect(pickNextAgeResearch('dark-age', ok, block)).toBeNull();
  });

  it('picks a sensible next build target in each age', () => {
    const allMissing = (): boolean => true;
    // Barracks first in Dark Age so the AI has a military presence
    // before committing wood to drop-off camps.
    expect(pickNextBuildTarget('dark-age', allMissing, false)).toBe('barracks');
    const onlyMillMissing = (b: string): boolean => b === 'mill';
    expect(pickNextBuildTarget('dark-age', onlyMillMissing, false)).toBe('mill');
    // Population block pre-empts everything — a fresh House takes priority.
    expect(pickNextBuildTarget('castle-age', allMissing, true)).toBe('house');
  });

  it('ramps the attack-group threshold across ages', () => {
    expect(attackGroupSize('dark-age')).toBeLessThan(attackGroupSize('feudal-age'));
    expect(attackGroupSize('feudal-age')).toBeLessThan(attackGroupSize('castle-age'));
    expect(attackGroupSize('castle-age')).toBeLessThan(attackGroupSize('imperial-age'));
  });

  it('returns distinct unit mixes per age', () => {
    const mixes = (['dark-age', 'feudal-age', 'castle-age', 'imperial-age'] as const).map(pickUnitMix);
    for (let i = 1; i < mixes.length; i += 1) {
      const current = mixes[i].map((m) => m.unitType).join(',');
      const previous = mixes[i - 1].map((m) => m.unitType).join(',');
      expect(current).not.toBe(previous);
    }
  });

  it('maps difficulty to monotone gather + decision-interval multipliers', () => {
    expect(gatherMultiplier('easy')).toBeLessThan(gatherMultiplier('standard'));
    expect(gatherMultiplier('standard')).toBeLessThan(gatherMultiplier('hard'));
    expect(decisionIntervalTicks('easy')).toBeGreaterThan(decisionIntervalTicks('standard'));
    expect(decisionIntervalTicks('standard')).toBeGreaterThan(decisionIntervalTicks('hard'));
  });

  it('villagerTargetsEqual treats missing entries as zero', () => {
    expect(villagerTargetsEqual({ food: 3 }, { food: 3, wood: 0 })).toBe(true);
    expect(villagerTargetsEqual({ food: 3 }, { food: 4 })).toBe(false);
  });
});

describe('Slice 10 AI planner — simulation end-to-end', () => {
  it('assigns villagers across at least three resource types within 300 ticks', () => {
    const bridge = createSimulationBridge('ai-planner-fixture');

    for (let i = 0; i < 300; i += 1) {
      bridge.step(100);
    }

    const economy = bridge.getEconomyState();
    const aiVillagers = economy.villagers.filter((v) => v.owner === 2);
    const kinds = new Set(aiVillagers.map((v) => v.desiredResource));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it('ages up through the ages within a generous tick budget', () => {
    const bridge = createSimulationBridge('ai-planner-fixture');
    const ageSeen = new Set<string>();
    let ticksElapsed = 0;
    const ageSnapshots: Array<{ tick: number; age: string }> = [];
    for (let i = 0; i < 8_000; i += 1) {
      bridge.step(100);
      ticksElapsed += 1;
      const age = bridge.getEconomyState().ages[2];
      if (age) {
        if (!ageSeen.has(age)) {
          ageSnapshots.push({ tick: ticksElapsed, age });
        }
        ageSeen.add(age);
      }
      if (age === 'castle-age') break;
    }
    const finalEconomy = bridge.getEconomyState();
    const aiBuildings = finalEconomy.buildings
      .filter((b) => b.owner === 2)
      .map((b) => ({ t: b.buildingType, done: b.isComplete }));
    const aiRes = finalEconomy.playerResources[2];
    const diagnosticMessage =
      `ages: ${JSON.stringify(ageSnapshots)} ticks: ${ticksElapsed} `
      + `res: ${JSON.stringify(aiRes)} buildings: ${JSON.stringify(aiBuildings)}`;
    // The full age pipeline (Dark → Feudal → Castle) is the load-
    // bearing check for Slice 10 + FU4 — the planner has to issue the
    // right research at the right time at every Age-up gate. FU4
    // retuned the villager targets so the AI reliably reaches Castle
    // Age inside the 8000-tick budget. Imperial Age is aspirational
    // but not required within this budget; later tuning may push the
    // AI further.
    expect(ageSeen.has('feudal-age'), diagnosticMessage).toBe(true);
    expect(ageSeen.has('castle-age'), diagnosticMessage).toBe(true);
    // 300s: isolated runtime is ~140s but full-suite contention adds
    // 30%+ (187s observed 2026-06-09, tripping the previous 180s cap).
    // Sized per the vitest-timeout-headroom precedent (~2x isolated).
  }, 300_000);

  it('builds a Watch Tower toward the sighted enemy', () => {
    const bridge = createSimulationBridge('ai-scouting-response-fixture');
    for (let i = 0; i < 600; i += 1) {
      bridge.step(100);
    }

    const towers = bridge
      .getEconomyState()
      .buildings.filter((b) => b.owner === 2 && b.buildingType === 'watch-tower');
    expect(towers.length).toBeGreaterThan(0);
    // The tower anchor should sit between the AI's Town Center
    // (30, 20) and the sighting (28, 24) — so y > TC.y.
    expect(towers[0].y).toBeGreaterThanOrEqual(20);
  }, 120_000);

  it('accumulates 5+ military units before pushing in Feudal Age', () => {
    const bridge = createSimulationBridge('ai-planner-fixture');
    let sawGroup = false;
    for (let i = 0; i < 3_000; i += 1) {
      bridge.step(100);
      const aiMilitary = bridge
        .getEconomyState()
        .units.filter(
          (u) =>
            u.owner === 2
            && u.unitType !== 'villager'
            && u.unitType !== 'scout'
            && u.unitType !== 'monk',
        );
      if (aiMilitary.length >= 5) {
        sawGroup = true;
        break;
      }
    }
    expect(sawGroup).toBe(true);
  }, 120_000);

  it('hard AI accumulates more food than easy AI after a fixed tick budget', () => {
    // Runs an easy (owner 2) and a hard (owner 3) AI side-by-side and compares
    // the food each gathers — a proxy for gather rate (hard gathers 1.3x and
    // thinks ~4x more often). We track each AI's PEAK Dark-Age food, not its
    // final stockpile: since v0.1.48 (the age-up-priority fix) the AI reserves
    // and commits its Feudal age-up the moment it has 2 prerequisites + 500
    // food, spending 500 food in one step. The faster hard AI reaches that
    // point FIRST, so its FINAL food dips below the slower easy AI's
    // still-accumulating stockpile even though it out-gathered it the whole
    // way (probe: hard peaks ~500 then commits ~tick 1400 → 81; easy is still
    // climbing at 313). Peak-before-age-up food is the un-masked gather signal.
    const bridge = createSimulationBridge('ai-difficulty-fixture');
    let easyPeakFood = 0;
    let hardPeakFood = 0;
    for (let i = 0; i < 1500; i += 1) {
      bridge.step(100);
      const economy = bridge.getEconomyState();
      // Only sample while still in the Dark Age — once the age-up research
      // commits, the 500-food spend would mask the gather-rate comparison.
      if (economy.ages[2] === 'dark-age') {
        easyPeakFood = Math.max(easyPeakFood, economy.playerResources[2].food);
      }
      if (economy.ages[3] === 'dark-age') {
        hardPeakFood = Math.max(hardPeakFood, economy.playerResources[3].food);
      }
    }
    expect(hardPeakFood).toBeGreaterThan(easyPeakFood);
  }, 120_000);

  it('preserves baseline barracks-rush behavior: AI builds a Barracks and trains Militia on ai-rush-fixture', () => {
    const bridge = createSimulationBridge('ai-rush-fixture');
    let aiBarracksComplete = false;
    let aiMilitiaSpawned = false;
    for (let i = 0; i < 3_000; i += 1) {
      bridge.step(100);
      const economy = bridge.getEconomyState();
      if (
        economy.buildings.some(
          (b) => b.owner === 2 && b.buildingType === 'barracks' && b.isComplete,
        )
      ) {
        aiBarracksComplete = true;
      }
      if (economy.units.some((u) => u.owner === 2 && u.unitType === 'militia')) {
        aiMilitiaSpawned = true;
      }
      if (aiBarracksComplete && aiMilitiaSpawned) break;
    }
    expect(aiBarracksComplete).toBe(true);
    expect(aiMilitiaSpawned).toBe(true);
  }, 120_000);
});

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
