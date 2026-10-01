// BOUND: base launch timing for the 44 pinned supported ranged attackers at
// the production launcher, plus one actual Cavalry Archer context order and
// its visible wind-up/save path. Six changed accuracy rows are sampled through
// the launcher. This does not prove every unit's command menu, bursts, miss
// collision or technology/civilization modifiers, nor historical replay parity.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { launchProjectile } from '../../src/game/simulation/bridge/projectileOps';
import { createEmptyProjectileSlot } from '../../src/game/simulation/bridge/projectileTypes';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { UnitType } from '../../src/game/simulation/types';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

interface SourceRow {
  readonly id: UnitType;
  readonly accuracyPercent: number | null;
  readonly attackDelaySeconds: number;
}
const source = (JSON.parse(readFileSync('tests/content/fixtures/deProjectileStats.json', 'utf8')) as { units: SourceRow[] }).units;

function shoot(unitType: UnitType, tick: number) {
  return launchProjectile({
    slot: createEmptyProjectileSlot(), tick,
    attacker: { id: 1, owner: 1, unitType, position: { x: 10, y: 10 }, baseDamage: 10 },
    target: { id: 2, kind: 'unit', position: { x: 14, y: 10 }, destination: null },
    leads: false, mapSize: { width: 60, height: 36 },
  });
}

describe('DE projectile stats reach launched shots', () => {
  it('schedules every supported shot from the pinned wind-up', () => {
    const differences: string[] = [];
    for (const row of source) {
      const shot = shoot(row.id, 100);
      const expected = 100 + Math.round(row.attackDelaySeconds * 10);
      if (shot.launchTick !== expected) differences.push(`${row.id}: launch ${String(shot.launchTick)} vs DE ${String(expected)}`);
      expect(shot.impactTick, row.id).toBeGreaterThan(shot.launchTick);
    }
    expect(differences, differences.join('\n')).toEqual([]);
  });

  it('makes changed accuracy units miss at their sourced base rate', () => {
    const changed = new Set<UnitType>(['heavy-cavalry-archer', 'hand-cannoneer', 'elite-longbowman', 'elite-plumed-archer', 'bombard-cannon', 'elite-janissary']);
    for (const row of source.filter((row) => changed.has(row.id))) {
      let aimed = 0;
      for (let tick = 0; tick < 800; tick += 1) if (shoot(row.id, tick).willHit) aimed += 1;
      const fraction = aimed / 800;
      const expected = row.accuracyPercent! / 100;
      expect(fraction, `${row.id} aimed ${String(aimed)}/800`).toBeGreaterThanOrEqual(expected - 0.05);
      expect(fraction, row.id).toBeLessThanOrEqual(expected + 0.05);
      if (expected === 1) expect(aimed, row.id).toBe(800);
    }
  });

  it('a real context order winds up nine ticks, stays hidden, and survives saving', () => {
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');
    const target = bridge.getEconomyState().units.find((unit) => unit.owner === 2 && unit.unitType === 'militia');
    expect(target).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'cavalry-archer')).toBe(true);
    const orderTick = bridge.world.tick;
    expect(bridge.issueContextCommand(target!.x, target!.y)).toBe(true);
    expect(stepBridgeUntil(bridge, () => bridge.getInFlightProjectiles().length > 0, { maxSteps: 30 })).toBe(true);
    const shot = bridge.getInFlightProjectiles().find((shot) => shot.attackerUnitType === 'cavalry-archer')!;
    expect(shot).toBeDefined();
    // The fixture is in range before the command, so it fires on the first
    // command-processing tick. The animation feed labels completed tick + 1;
    // use the world tick the shot schedules from, not that presentation label.
    expect(shot.launchTick - orderTick).toBe(9); // DE 0.91 s at 10 TPS; not the runtime accessor.
    expect(bridge.getRenderState().frame!.projectiles.some((view) => view.id === shot.id)).toBe(false);

    const saved = structuredClone(bridge.saveGame());
    const restored = createSimulationBridge('cavalry-archer-ranged-fixture', { savedGame: saved });
    expect(restored.getInFlightProjectiles()).toEqual(bridge.getInFlightProjectiles());
    for (const run of [bridge, restored]) {
      expect(stepBridgeUntil(run, () => run.getRenderState().tick >= shot.launchTick - 1, { maxSteps: 20 })).toBe(true);
      expect(run.getRenderState().frame!.projectiles.some((view) => view.id === shot.id)).toBe(false);
      run.step(100);
      expect(run.getRenderState().tick).toBe(shot.launchTick);
      expect(run.getRenderState().frame!.projectiles.some((view) => view.id === shot.id)).toBe(true);
    }
  });
});
