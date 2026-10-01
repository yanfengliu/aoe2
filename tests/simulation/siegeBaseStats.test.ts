// BOUND: ten base-stat corrections through actual training/research, connected
// neutral hits, isolated owner sight, save/load and specific replay endpoints.
// This does not prove full DE combat or whole-game replay determinism.
import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';
import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { combatStatesCodec, projectilesCodec, unitCommandsCodec, productionQueuesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { CombatState } from '../../src/game/simulation/bridge/systems/systemTypes';
import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import type { ProjectileSlotState } from '../../src/game/simulation/bridge/projectileTypes';
import { researchTimeTicks, trainingTimeTicks } from '../../src/game/simulation/prototypeEconomyRules';
import { attackBonusAgainstUnit } from '../../src/game/simulation/prototypeUnitRules';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { getReplayWorldContext, type ReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';
import type { ResearchableTechnologyType, TrainableUnitType, VisionSourceComponent } from '../../src/game/simulation/types';
import { stateSlot } from './saveBlobTestUtils';

const SEED = 'siege-base-stats-fixture';
const RAM_SITE = { x: 25, y: 29 };
const RAM_UPGRADES = ['capped-ram-upgrade', 'siege-ram-upgrade'] as const;
type Unit = ReturnType<SimulationBridge['getEconomyState']>['units'][number];

function scene(): SimulationBridge { return createSimulationBridge(SEED); }
function own(bridge: Pick<SimulationBridge, 'getEconomyState'>, type: string, owner = 1): Unit {
  const unit = bridge.getEconomyState().units.find(u => u.owner === owner && u.unitType === type);
  expect(unit, `${type} owned by ${String(owner)} exists`).toBeDefined();
  return unit!;
}
function combat(bridge: SimulationBridge, id: number): CombatState {
  const state = bridge.world.getState(combatStatesCodec.slot) as Array<[number, CombatState]>;
  const value = new Map(state).get(id);
  expect(value, `combat ${String(id)} exists`).toBeDefined();
  return value!;
}
function tick(bridge: SimulationBridge): void { expect(bridge.step(100).ticks).toBe(1); }
function until(bridge: SimulationBridge, condition: () => boolean, cap: number, label: string): void {
  for (let n = 0; n < cap && !condition(); n += 1) tick(bridge);
  expect(condition(), `${label} within ${String(cap)} actual ticks`).toBe(true);
}
function workshop(bridge: SimulationBridge): void {
  const building = bridge.getEconomyState().buildings.find(b => b.owner === 1 && b.buildingType === 'siege-workshop')!;
  expect(bridge.selectEntityById(building.id)).toBe(true);
}
function research(bridge: SimulationBridge, technology: ResearchableTechnologyType, target: string): void {
  workshop(bridge);
  expect(bridge.getSelectionState().researchOptions).toContain(technology);
  expect(bridge.queueResearch(technology)).toBe(true);
  until(bridge, () => bridge.getEconomyState().units.some(u => u.owner === 1 && u.unitType === target),
    researchTimeTicks(technology) + 2, technology);
}
function train(bridge: SimulationBridge, type: TrainableUnitType): Unit {
  const before = new Set(bridge.getEconomyState().units.map(u => u.id));
  workshop(bridge);
  expect(bridge.getSelectionState().trainOptions).toContain(type);
  expect(bridge.queueTrainUnit(type)).toBe(true);
  until(bridge, () => bridge.getEconomyState().units.some(u => u.owner === 1 && u.unitType === type && !before.has(u.id)),
    trainingTimeTicks(type) + 2, `train ${type}`);
  return bridge.getEconomyState().units.find(u => u.owner === 1 && u.unitType === type && !before.has(u.id))!;
}
function move(bridge: SimulationBridge, id: number, x: number, y: number): void {
  expect(bridge.selectEntityById(id)).toBe(true);
  expect(bridge.setSelectionStance('no-attack')).toBe(true);
  expect(bridge.issueMoveCommand(x, y)).toBe(true);
  until(bridge, () => {
    const u = bridge.getEconomyState().units.find(candidate => candidate.id === id)!;
    const commands = new Map(bridge.world.getState(unitCommandsCodec.slot) as Array<[number, { type: string }]>);
    return u.x === x && u.y === y && commands.get(id)?.type !== 'move';
  }, 1200, `move ${String(id)} to ${String(x)},${String(y)}`);
}
function vision(bridge: Pick<SimulationBridge, 'world'>, id: number): VisionSourceComponent {
  return bridge.world.getComponent<VisionSourceComponent>(id, 'visionSource')!;
}
function sight(bridge: Pick<SimulationBridge, 'world' | 'getEconomyState' | 'isCellVisibleForOwner'>, id: number): void {
  const u = bridge.getEconomyState().units.find(candidate => candidate.id === id)!;
  expect({ x: u.x, y: u.y }).toEqual(RAM_SITE);
  expect(vision(bridge, id)).toEqual({ playerId: 1, radius: 5 });
  for (const distance of [4, 5, 6]) {
    for (const [dx, dy] of [[distance, 0], [-distance, 0], [0, distance], [0, -distance]]) {
      expect(bridge.isCellVisibleForOwner(1, u.x + dx!, u.y + dy!), `owner1 axial ${String(distance)}`).toBe(distance <= 5);
      expect(bridge.isCellVisibleForOwner(2, u.x + dx!, u.y + dy!), `owner2 axial ${String(distance)}`).toBe(false);
    }
  }
}
function order(bridge: SimulationBridge, attackerId: number, targetId: number): void {
  expect(bridge.world.submitWithResult('unit.attack', { unitId: attackerId, targetEntityId: targetId, targetEntityKind: 'unit' }).accepted).toBe(true);
}
function firstHit(bridge: SimulationBridge, attackerId: number, targetId: number): number {
  for (let n = 0; n < 1000; n += 1) {
    const before = bridge.getEntityHealth(targetId)!.currentHp;
    tick(bridge);
    const hits = bridge.getRecentPlayerHits().filter(h => h.tick === bridge.world.tick && h.targetId === targetId);
    if (hits.some(h => h.attackerId === attackerId)) {
      expect(hits).toHaveLength(1); // No simultaneous damage can hide a stat error.
      const after = bridge.getEntityHealth(targetId)!.currentHp;
      expect(after).toBeGreaterThan(0);
      return before - after;
    }
  }
  throw new Error(`No connected hit from ${String(attackerId)} to ${String(targetId)} within 1000 ticks.`);
}
function prepareOnager(bridge: SimulationBridge): Unit {
  research(bridge, 'onager-upgrade', 'onager');
  const produced = train(bridge, 'onager');
  expect(combat(bridge, produced.id)).toMatchObject({ attackDamage: 55, currentHp: 60, maxHp: 60, reloadTicks: 60 });
  return produced;
}
function verifyReplay(bridge: SimulationBridge, bundle: SessionBundle<GameEvents, GameCommands>, endpoint: number,
  check: (context: ReplayWorldContext) => void): void {
  expect(bundle.commands.some(command => command.result.accepted)).toBe(true);
  const factory = (snapshot: Parameters<typeof createReplayWorldOnly>[0]) => createReplayWorldOnly(snapshot);
  const replay = SessionReplayer.fromBundle(bundle, { worldFactory: factory, skipRegistrationCheck: true });
  const result = replay.selfCheck();
  expect(result.ok, JSON.stringify(result)).toBe(true);
  expect(result.checkedSegments).toBeGreaterThan(0);
  expect(result.skippedSegments).toEqual([]);
  expect(result.coverage?.complete).toBe(true);
  expect(replay.snapshotTicks().at(-1)).toBe(endpoint);
  const tail = SessionReplayer.fromBundle({ ...bundle, snapshots: bundle.snapshots.filter(s => s.tick < endpoint) },
    { worldFactory: factory, skipRegistrationCheck: true }).openAt(endpoint);
  expect(tail.tick).toBe(bridge.world.tick);
  const context = getReplayWorldContext(tail);
  expect(context?.api).toBeDefined();
  check(context!);
}

describe('corrected siege bases reach actual production and combat', () => {
  it('researches and trains Onagers without healing the existing half-health Mangonel', () => {
    const bridge = scene();
    const predecessor = own(bridge, 'mangonel');
    const onager = prepareOnager(bridge);
    expect(own(bridge, 'onager').id).toBe(predecessor.id);
    expect(combat(bridge, predecessor.id)).toMatchObject({ attackDamage: 55, currentHp: 30, maxHp: 60, reloadTicks: 60 });
    expect(onager.id).not.toBe(predecessor.id);
    expect(combat(bridge, own(bridge, 'scorpion').id)).toMatchObject({ attackDamage: 12, currentHp: 20, maxHp: 40 });
  });

  it.each([
    ['mangonel', 'onager', 'onager-upgrade'],
    ['scorpion', 'heavy-scorpion', 'heavy-scorpion-upgrade'],
  ] as const)('%s keeps half HP and a nonzero cooldown through its final real %s research tick', (from, to, technology) => {
    const bridge = scene();
    const predecessor = own(bridge, from);
    workshop(bridge);
    expect(bridge.queueResearch(technology)).toBe(true);
    for (let n = 0; n < researchTimeTicks(technology) - 1; n += 1) tick(bridge);
    const saved = structuredClone(bridge.saveGame());
    const queues = stateSlot<Array<[number, Array<{ remainingTicks: number }> ]>>(saved, productionQueuesCodec.slot);
    expect(queues.some(([, queue]) => queue.some(item => item.remainingTicks === 1))).toBe(true);
    stateSlot<Array<[number, CombatState]>>(saved, combatStatesCodec.slot).find(([id]) => id === predecessor.id)![1].cooldownTicks = 17;
    const loaded = createSimulationBridge(SEED, { savedGame: saved });
    expect(combat(loaded, predecessor.id).cooldownTicks).toBe(17);
    tick(loaded);
    expect(own(loaded, to).id).toBe(predecessor.id);
    expect(combat(loaded, predecessor.id)).toMatchObject({ currentHp: 30, maxHp: 60, cooldownTicks: 17 });
  });

  for (const type of ['battering-ram', 'capped-ram', 'siege-ram'] as const) {
    it(`produced ${type}: owner-only sight reaches axial5 and stops before6 after a real move`, () => {
      const bridge = scene();
      for (const technology of RAM_UPGRADES.slice(0, type === 'siege-ram' ? 2 : type === 'capped-ram' ? 1 : 0))
        research(bridge, technology, technology === 'capped-ram-upgrade' ? 'capped-ram' : 'siege-ram');
      const produced = train(bridge, type);
      expect(combat(bridge, produced.id).attackDamage).toBe(type === 'battering-ram' ? 2 : type === 'capped-ram' ? 3 : 4);
      move(bridge, produced.id, RAM_SITE.x, RAM_SITE.y);
      sight(bridge, produced.id);
      const loaded = createSimulationBridge(SEED, { savedGame: structuredClone(bridge.saveGame()) });
      tick(loaded);
      sight(loaded, produced.id);
      expect(combat(loaded, produced.id)).toEqual(combat(bridge, produced.id));
    });
  }

  it('each completed Ram upgrade publishes radius5 for its existing unit', () => {
    const bridge = scene();
    const ram = own(bridge, 'battering-ram');
    move(bridge, ram.id, RAM_SITE.x, RAM_SITE.y);
    research(bridge, 'capped-ram-upgrade', 'capped-ram');
    sight(bridge, ram.id);
    expect(combat(bridge, ram.id)).toMatchObject({ maxHp: 200, currentHp: 200, reloadTicks: 50 });
    research(bridge, 'siege-ram-upgrade', 'siege-ram');
    sight(bridge, ram.id);
    expect(combat(bridge, ram.id)).toMatchObject({ maxHp: 270, currentHp: 270, reloadTicks: 50 });
  });

  it('Heavy Scorpion research/training adopts its five sourced base fields and fires at a 36-tick cadence', () => {
    const bridge = scene();
    const predecessor = own(bridge, 'scorpion');
    research(bridge, 'heavy-scorpion-upgrade', 'heavy-scorpion');
    expect(own(bridge, 'heavy-scorpion').id).toBe(predecessor.id);
    expect(combat(bridge, predecessor.id)).toMatchObject({ attackDamage: 14, currentHp: 30, maxHp: 60, reloadTicks: 36 });
    const produced = train(bridge, 'heavy-scorpion');
    expect(combat(bridge, produced.id)).toMatchObject({ attackDamage: 14, currentHp: 60, maxHp: 60, reloadTicks: 36 });
    move(bridge, produced.id, 35, 12);
    const target = own(bridge, 'champion', 2);
    expect(attackBonusAgainstUnit('heavy-scorpion', 'champion')).toBe(0);
    expect(bridge.getEntityHealth(target.id)?.currentHp).toBe(70);
    order(bridge, produced.id, target.id);
    until(bridge, () => bridge.getInFlightProjectiles().some(p => p.attackerId === produced.id), 300, 'Heavy Scorpion first launch');
    const launch = bridge.getInFlightProjectiles().find(p => p.attackerId === produced.id)!.launchTick;
    expect(firstHit(bridge, produced.id, target.id)).toBe(13); // 14 - unchanged Champion pierce1; above floor.
    until(bridge, () => bridge.getInFlightProjectiles().some(p => p.attackerId === produced.id && p.launchTick > launch), 100, 'Heavy Scorpion second launch');
    expect(bridge.getInFlightProjectiles().find(p => p.attackerId === produced.id && p.launchTick > launch)!.launchTick - launch).toBe(36);
  });

  it('Onager damage54 survives a new in-flight save/load and is re-executed at the recorded endpoint', () => {
    const bridge = scene();
    const onager = prepareOnager(bridge);
    move(bridge, onager.id, 35, 12);
    const target = own(bridge, 'champion', 2);
    expect(attackBonusAgainstUnit('onager', 'champion')).toBe(0);
    expect(bridge.getEntityHealth(target.id)?.currentHp).toBe(70);
    const recorder = new SessionRecorder({ world: bridge.world, snapshotInterval: 10, terminalSnapshot: true });
    recorder.connect();
    let loaded: SimulationBridge;
    try {
      order(bridge, onager.id, target.id);
      until(bridge, () => bridge.getInFlightProjectiles().some(p => p.attackerId === onager.id), 300, 'Onager launch');
      expect(bridge.getInFlightProjectiles().find(p => p.attackerId === onager.id)?.baseDamage).toBe(55);
      loaded = createSimulationBridge(SEED, { savedGame: structuredClone(bridge.saveGame()) });
      expect(loaded.getInFlightProjectiles()).toEqual(bridge.getInFlightProjectiles());
      expect(firstHit(bridge, onager.id, target.id)).toBe(54);
      expect(firstHit(loaded, onager.id, target.id)).toBe(54);
      expect(bridge.getEntityHealth(target.id)?.currentHp).toBe(16);
    } finally { recorder.disconnect(); }
    verifyReplay(bridge, recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>, bridge.world.tick,
      context => expect(context.api!.getEntityHealth(target.id)?.currentHp).toBe(16));
  });

  it('a connected sourced pierce attack distinguishes Onager armor8 from7 above the damage floor', () => {
    const bridge = scene();
    const onager = prepareOnager(bridge);
    move(bridge, onager.id, 42, 24);
    const attacker = own(bridge, 'hand-cannoneer', 2);
    expect(combat(bridge, attacker.id).attackDamage).toBe(17);
    expect(attackBonusAgainstUnit('hand-cannoneer', 'onager')).toBe(0);
    expect(combat(bridge, onager.id)).toMatchObject({ armor: 0, pierceArmorBonus: 0 });
    order(bridge, attacker.id, onager.id);
    expect(firstHit(bridge, attacker.id, onager.id)).toBe(9);
  });

  for (const family of ['melee', 'pierce'] as const) {
    it(`produced Heavy Scorpion ${family} defense uses its sourced armor above the damage floor`, () => {
      const bridge = scene();
      research(bridge, 'heavy-scorpion-upgrade', 'heavy-scorpion');
      const scorpion = train(bridge, 'heavy-scorpion');
      move(bridge, scorpion.id, family === 'melee' ? 35 : 42, family === 'melee' ? 12 : 24);
      const attacker = own(bridge, family === 'melee' ? 'champion' : 'hand-cannoneer', 2);
      // Local Champion13 is an unchanged control, not a claim of DE attack parity.
      expect(combat(bridge, attacker.id).attackDamage).toBe(family === 'melee' ? 13 : 17);
      expect(attackBonusAgainstUnit(attacker.unitType, 'heavy-scorpion')).toBe(0);
      expect(combat(bridge, scorpion.id)).toMatchObject({ currentHp: 60, armor: 0, pierceArmorBonus: 0 });
      order(bridge, attacker.id, scorpion.id);
      expect(firstHit(bridge, attacker.id, scorpion.id)).toBe(family === 'melee' ? 12 : 9);
    });
  }

  it('replays the final real Ram research tick through its new visibility endpoint', () => {
    const bridge = scene();
    const ram = own(bridge, 'battering-ram');
    move(bridge, ram.id, RAM_SITE.x, RAM_SITE.y);
    workshop(bridge);
    expect(bridge.queueResearch('capped-ram-upgrade')).toBe(true);
    for (let n = 0; n < researchTimeTicks('capped-ram-upgrade') - 1; n += 1) tick(bridge);
    const recorder = new SessionRecorder({ world: bridge.world, snapshotInterval: null, terminalSnapshot: true });
    recorder.connect();
    try {
      expect(bridge.selectEntityById(ram.id)).toBe(true);
      expect(bridge.setSelectionStance('no-attack')).toBe(true);
      tick(bridge);
      expect(own(bridge, 'capped-ram').id).toBe(ram.id);
      sight(bridge, ram.id);
    } finally { recorder.disconnect(); }
    verifyReplay(bridge, recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>, bridge.world.tick,
      context => {
        expect(own(context.api!, 'capped-ram').id).toBe(ram.id);
        sight({ world: context.world, getEconomyState: context.api!.getEconomyState,
          isCellVisibleForOwner: (owner, x, y) => context.visibility.isVisible(owner, x, y) }, ram.id);
      });
  });

  it('retains reconstructed old serialized attack, launched damage and sight until applicable rebuilds', () => {
    const bridge = scene();
    const onager = prepareOnager(bridge);
    research(bridge, 'heavy-scorpion-upgrade', 'heavy-scorpion');
    const scorpion = own(bridge, 'heavy-scorpion');
    move(bridge, onager.id, 35, 12);
    const target = own(bridge, 'champion', 2);
    order(bridge, onager.id, target.id);
    until(bridge, () => bridge.getInFlightProjectiles().some(p => p.attackerId === onager.id), 300, 'old-shot reconstruction boundary');
    const saved = structuredClone(bridge.saveGame());
    const states = stateSlot<Array<[number, CombatState]>>(saved, combatStatesCodec.slot);
    states.find(([id]) => id === onager.id)![1].attackDamage = 50;
    states.find(([id]) => id === scorpion.id)![1].attackDamage = 16;
    Object.assign(states.find(([id]) => id === scorpion.id)![1], { currentHp: 25, maxHp: 50, reloadTicks: 35 });
    const projectiles = stateSlot<ProjectileSlotState>(saved, projectilesCodec.slot);
    projectiles.inFlight = projectiles.inFlight.map(p => p.attackerId === onager.id ? { ...p, baseDamage: 50 } : p);
    const ram = own(bridge, 'battering-ram');
    const snapshot = saved.worldSnapshot as unknown as { components: { visionSource: Array<[number, VisionSourceComponent]> } };
    snapshot.components.visionSource.find(([id]) => id === ram.id)![1].radius = 3;
    const loaded = createSimulationBridge(SEED, { savedGame: saved });
    expect(combat(loaded, onager.id).attackDamage).toBe(50);
    expect(combat(loaded, scorpion.id)).toMatchObject({ attackDamage: 16, currentHp: 25, maxHp: 50, reloadTicks: 35 });
    expect(vision(loaded, ram.id).radius).toBe(3);
    expect(firstHit(loaded, onager.id, target.id)).toBe(49);
    expect(combat(loaded, onager.id).attackDamage).toBe(50);
    expect(vision(loaded, ram.id).radius).toBe(3);
    move(loaded, onager.id, 42, 24);
    const attacker = own(loaded, 'hand-cannoneer', 2);
    expect(combat(loaded, attacker.id).attackDamage).toBe(17);
    expect(attackBonusAgainstUnit('hand-cannoneer', 'onager')).toBe(0);
    order(loaded, attacker.id, onager.id);
    expect(firstHit(loaded, attacker.id, onager.id)).toBe(9);
    expect(combat(loaded, onager.id).attackDamage).toBe(50);
    move(loaded, scorpion.id, 42, 24);
    expect(attackBonusAgainstUnit('hand-cannoneer', 'heavy-scorpion')).toBe(0);
    order(loaded, attacker.id, scorpion.id);
    expect(firstHit(loaded, attacker.id, scorpion.id)).toBe(9);
    expect(combat(loaded, scorpion.id)).toMatchObject({ attackDamage: 16, currentHp: 16, maxHp: 50, reloadTicks: 35 });
    expect(vision(loaded, ram.id).radius).toBe(3);
    research(loaded, 'capped-ram-upgrade', 'capped-ram');
    expect(vision(loaded, ram.id).radius).toBe(5);
  });
});
