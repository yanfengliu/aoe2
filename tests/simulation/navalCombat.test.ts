import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { firesProjectile, unitAccuracy } from '../../src/game/simulation/projectileRules';
import { unitBlastRadius } from '../../src/game/simulation/prototypeUnitRules';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

describe('warships inherit the projectile system', () => {
  it('makes every gun-armed ship fire projectiles rather than touch its target', () => {
    for (const unitType of [
      'galley', 'war-galley', 'galleon',
      'fire-ship', 'fast-fire-ship',
      'cannon-galleon', 'elite-cannon-galleon',
    ] as const) {
      expect(firesProjectile(unitType)).toBe(true);
      expect(unitAccuracy(unitType)).toBeGreaterThan(0);
    }
  });

  it('gives the demolition line the widest blast in the game and no ranged shot', () => {
    // A demolition ship closes and detonates; it is not an artillery piece.
    expect(unitBlastRadius('demolition-ship')).toBe(2.5);
    expect(unitBlastRadius('heavy-demolition-ship')).toBe(3.5);
    expect(unitBlastRadius('heavy-demolition-ship'))
      .toBeGreaterThan(unitBlastRadius('onager'));
    expect(firesProjectile('demolition-ship')).toBe(false);
  });
});

describe('a naval engagement', () => {
  it('lets a Galley shoot an enemy Galley across open water', () => {
    const bridge = createSimulationBridge('naval-fixture');
    const enemy = bridge.getEconomyState().units
      .find((unit) => unit.owner === 2 && unit.unitType === 'galley');
    expect(enemy).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'galley')).toBe(true);
    expect(bridge.issueContextCommand(enemy!.x, enemy!.y)).toBe(true);

    // A shot must actually be in the air — this is the projectile system
    // serving a unit type it was written before.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getInFlightProjectiles().length > 0,
      { maxSteps: 200 },
    )).toBe(true);

    // Damage lands, rather than a kill: a Galley's 6 pierce attack against
    // another Galley's 6 pierce armour floors at 1 per hit, so gun-line duels
    // are genuinely slow in AoE2 — which is the whole reason Fire Ships and
    // Demolition Ships exist. Asserting the hit is the real contract here.
    const enemyHp = () => bridge.getEntityHealth(enemy!.id)?.currentHp ?? 0;
    const startingHp = enemyHp();
    expect(startingHp).toBe(120);
    expect(stepBridgeUntil(
      bridge,
      () => enemyHp() < startingHp,
      { maxSteps: 400 },
    )).toBe(true);
  }, 120_000);

  it('keeps both ships on water for the whole engagement', () => {
    const bridge = createSimulationBridge('naval-fixture');
    const enemy = bridge.getEconomyState().units
      .find((unit) => unit.owner === 2 && unit.unitType === 'galley')!;
    expect(selectOwnedUnitDirect(bridge, 1, 'galley')).toBe(true);
    expect(bridge.issueContextCommand(enemy.x, enemy.y)).toBe(true);

    const waterCells = new Set(
      bridge.getRenderState().entities
        .filter((entity) => entity.layer === 'terrain' && entity.entityType === 'water')
        .map((entity) => `${String(entity.x)}:${String(entity.y)}`),
    );
    for (let step = 0; step < 400; step += 1) {
      bridge.step(100);
      for (const ship of bridge.getEconomyState().units) {
        if (ship.unitType !== 'galley') continue;
        expect(waterCells.has(`${String(ship.x)}:${String(ship.y)}`)).toBe(true);
      }
    }
  }, 120_000);
});
