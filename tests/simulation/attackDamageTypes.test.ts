// BOUND: first commanded hit for every changed contact/melee-projectile type
// and stable melee/pierce controls, against two asymmetric-armor targets.
// Commands use the live bridge facade without injecting world state. This
// checks armor-family wiring and projectile delivery, not all DE combat stats.
import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';
import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { attackBonusAgainstUnit, firesProjectile } from '../../src/game/simulation/prototypeUnitRules';
import { attackDamageTypesSeed } from '../../src/game/simulation/fixtures/attackDamageTypes';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { getReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';
import { projectilesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { ProjectileSlotState } from '../../src/game/simulation/bridge/projectileTypes';
import type { UnitType } from '../../src/game/simulation/types';
import { DE_ATTACK_DAMAGE_REFERENCE } from '../content/deAttackDamageReference';
import { stateSlot } from './saveBlobTestUtils';
import type { GameEvents, GameCommands } from '../../src/game/simulation/bridge/pureHelpers';

const CHANGED_CONTACT: UnitType[] = [
  'eagle-warrior', 'elite-eagle-warrior', 'petard', 'demolition-ship', 'heavy-demolition-ship',
  'jaguar-warrior', 'cataphract', 'woad-raider', 'huskarl', 'tarkan', 'samurai', 'war-elephant', 'teutonic-knight', 'berserk',
  'elite-jaguar-warrior', 'elite-cataphract', 'elite-woad-raider', 'elite-huskarl', 'elite-tarkan', 'elite-samurai',
  'elite-war-elephant', 'elite-teutonic-knight', 'elite-berserk',
];
const CHANGED_PROJECTILE: UnitType[] = [
  'mangonel', 'onager', 'siege-onager', 'bombard-cannon', 'cannon-galleon', 'elite-cannon-galleon',
  'throwing-axeman', 'elite-throwing-axeman', 'mameluke', 'elite-mameluke', 'fire-ship', 'fast-fire-ship',
];

function order(bridge: SimulationBridge, type: UnitType) {
  const units = bridge.getEconomyState().units;
  const attacker = units.find(u => u.owner === 1 && u.unitType === type)!;
  const target = units.find(u => u.owner === 2)!;
  expect(attacker, type).toBeDefined();
  expect(target, type).toBeDefined();
  expect(bridge.selectEntityById(attacker.id)).toBe(true);
  expect(bridge.issueContextCommandAtEntity(target.id)).toBe(true);
  return { attacker, target };
}

function firstHit(bridge: SimulationBridge, type: UnitType, ids: ReturnType<typeof order>) {
  let sawProjectile = false;
  for (let n = 0; n < 1000; n += 1) {
    const before = bridge.getEntityHealth(ids.target.id)?.currentHp;
    expect(bridge.step(100).ticks, `${type}: actual step`).toBe(1);
    sawProjectile ||= bridge.getInFlightProjectiles().some(p => p.attackerId === ids.attacker.id);
    if (bridge.getRecentPlayerHits().some(h => h.tick === bridge.world.tick
      && h.attackerId === ids.attacker.id && h.targetId === ids.target.id)) {
      expect(before).toBeDefined();
      const after = bridge.getEntityHealth(ids.target.id)?.currentHp ?? 0;
      return { damage: before! - after, sawProjectile };
    }
  }
  throw new Error(`${type}: no commanded hit within 1000 actual ticks`);
}

function expectedDamage(type: UnitType, ids: ReturnType<typeof order>) {
  const family = DE_ATTACK_DAMAGE_REFERENCE[type].family;
  // Target armor is an independent constant, not a call to the damage code.
  const armor = ids.target.unitType === 'battering-ram'
    ? family === 'melee' ? -3 : 180
    : family === 'melee' ? 0 : 8;
  return Math.max(ids.attacker.attackDamage + attackBonusAgainstUnit(type, ids.target.unitType) - armor, 1);
}

describe('commanded attacks use their own DE armor family', () => {
  for (const type of [...CHANGED_CONTACT, ...CHANGED_PROJECTILE, 'champion', 'scorpion', 'galley'] as UnitType[]) {
    it(`${type}: correct first hit and delivery`, () => {
      const bridge = createSimulationBridge(attackDamageTypesSeed(type));
      const ids = order(bridge, type);
      const hit = firstHit(bridge, type, ids);
      expect(hit.damage, `${type}: first hit armor family`).toBe(expectedDamage(type, ids));
      expect(hit.sawProjectile, `${type}: delivery preserved`).toBe(firesProjectile(type));
    });
  }

  it('derives the corrected direct family for a shot fired after loading', () => {
    const seed = attackDamageTypesSeed('throwing-axeman');
    const initial = createSimulationBridge(seed);
    const bridge = createSimulationBridge(seed, { savedGame: structuredClone(initial.saveGame()) });
    const ids = order(bridge, 'throwing-axeman');
    expect(firstHit(bridge, 'throwing-axeman', ids).damage).toBe(expectedDamage('throwing-axeman', ids));
  });

  for (const type of ['throwing-axeman', 'mangonel'] as const) {
    it(`${type}: keeps new in-flight damage deterministic across save/load`, () => {
      const seed = attackDamageTypesSeed(type);
      const live = createSimulationBridge(seed);
      const ids = order(live, type);
      for (let n = 0; n < 300 && !live.getInFlightProjectiles().some(p => p.attackerId === ids.attacker.id); n += 1) live.step(100);
      expect(live.getInFlightProjectiles().some(p => p.attackerId === ids.attacker.id)).toBe(true);
      const loaded = createSimulationBridge(seed, { savedGame: structuredClone(live.saveGame()) });
      expect(loaded.getInFlightProjectiles()).toEqual(live.getInFlightProjectiles());
      const before = firstHit(live, type, ids);
      const after = firstHit(loaded, type, ids);
      expect(after.damage).toBe(before.damage);
      expect(after.damage).toBe(expectedDamage(type, ids));
    });

    it(`${type}: explicitly follows the old saved shot's existing impact convention`, () => {
      const seed = attackDamageTypesSeed(type);
      const live = createSimulationBridge(seed);
      const ids = order(live, type);
      for (let n = 0; n < 300 && !live.getInFlightProjectiles().some(p => p.attackerId === ids.attacker.id); n += 1) live.step(100);
      expect(live.getInFlightProjectiles().some(p => p.attackerId === ids.attacker.id)).toBe(true);
      const saved = structuredClone(live.saveGame());
      const slot = stateSlot<ProjectileSlotState>(saved, projectilesCodec.slot);
      // Reconstruct the exact pre-fix serialized field, not live world state.
      // Direct shots consume it; area blasts already derive from unit type.
      slot.inFlight = slot.inFlight.map(shot => shot.attackerId === ids.attacker.id
        ? { ...shot, attackType: 'pierce' } : shot);
      const loaded = createSimulationBridge(seed, { savedGame: saved });
      expect(loaded.getInFlightProjectiles().find(p => p.attackerId === ids.attacker.id)?.attackType).toBe('pierce');
      const damage = firstHit(loaded, type, ids).damage;
      expect(damage).toBe(type === 'throwing-axeman' ? 1 : expectedDamage(type, ids));
    });
  }

  it('records and deterministically replays a corrected commanded hit', () => {
    const bridge = createSimulationBridge(attackDamageTypesSeed('throwing-axeman'));
    const snapshotInterval = 5;
    const recorder = new SessionRecorder({ world: bridge.world, snapshotInterval, terminalSnapshot: true });
    let firstHitTick = -1;
    let targetId = -1;
    let liveTargetHp = -1;
    recorder.connect();
    try {
      const ids = order(bridge, 'throwing-axeman');
      expect(firstHit(bridge, 'throwing-axeman', ids).damage).toBe(expectedDamage('throwing-axeman', ids));
      firstHitTick = bridge.world.tick;
      targetId = ids.target.id;
      liveTargetHp = bridge.getEntityHealth(targetId)!.currentHp;
      // Impact deliberately falls between periodic snapshots, so checking
      // earlier segments cannot satisfy the impact replay contract.
      expect(firstHitTick % snapshotInterval).not.toBe(0);
    } finally {
      recorder.disconnect();
    }
    const bundle = recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>;
    const replayer = SessionReplayer.fromBundle(bundle, {
      worldFactory: snapshot => createReplayWorldOnly(snapshot), skipRegistrationCheck: true,
    });
    const checked = replayer.selfCheck();
    const snapshotTicks = replayer.snapshotTicks();
    expect(checked.ok, JSON.stringify({
      state: checked.stateDivergences.map(d => ({ from: d.fromTick, to: d.toTick, path: d.firstDifferingPath })),
      events: checked.eventDivergences, executions: checked.executionDivergences,
    })).toBe(true);
    expect(checked.checkedSegments).toBeGreaterThan(0);
    expect(checked.skippedSegments).toEqual([]);
    expect(checked.checkedSegments).toBe(snapshotTicks.length - 1);
    expect(snapshotTicks.at(-1), `last checked snapshot must cover impact tick ${firstHitTick}`).toBeGreaterThanOrEqual(firstHitTick);
    // Drop the terminal endpoint only for this independent reconstruction;
    // openAt must execute the impact tail rather than hydrate its result.
    const tailReplay = SessionReplayer.fromBundle({
      ...bundle, snapshots: bundle.snapshots.filter(snapshot => snapshot.tick < firstHitTick),
    }, {
      worldFactory: snapshot => createReplayWorldOnly(snapshot), skipRegistrationCheck: true,
    }).openAt(firstHitTick);
    expect(tailReplay.tick).toBe(firstHitTick);
    expect(getReplayWorldContext(tailReplay)?.api?.getEntityHealth(targetId)?.currentHp).toBe(liveTargetHp);
  });
});
