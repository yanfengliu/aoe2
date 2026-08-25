import { MAP_HEIGHT, MAP_WIDTH } from '../../src/game/simulation/mapGeneration/constants';
import { describe, expect, it } from 'vitest';

import {
  PROJECTILE_HIT_TOLERANCE,
  projectileAimPoint,
  projectileHitsTarget,
  targetLeadVelocity,
} from '../../src/game/simulation/projectileRules';
import {
  ballisticsLeadsShots,
  thumbRingAccuracy,
} from '../../src/game/simulation/projectileTechEffects';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { deliverUnitAttackOnUnit } from '../../src/game/simulation/bridge/attackDelivery';
import { createEmptyProjectileSlot } from '../../src/game/simulation/bridge/projectileTypes';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { CombatState } from '../../src/game/simulation/bridge/systems/systemTypes';

const NONE: ReadonlySet<ResearchableTechnologyType> = new Set();
const BALLISTICS: ReadonlySet<ResearchableTechnologyType> = new Set(['ballistics']);
const THUMB_RING: ReadonlySet<ResearchableTechnologyType> = new Set(['thumb-ring']);

describe('lead velocity — aiming at where the target is going', () => {
  it('is zero for a target with no destination', () => {
    expect(targetLeadVelocity({ x: 5, y: 5 }, null, 0.4, 6)).toEqual({ x: 0, y: 0 });
  });

  it('is zero for a target already standing on its destination', () => {
    expect(targetLeadVelocity({ x: 5, y: 5 }, { x: 5, y: 5 }, 0.4, 6)).toEqual({ x: 0, y: 0 });
  });

  it('points along the target’s path at its movement speed', () => {
    const velocity = targetLeadVelocity({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.4, 6);
    expect(velocity.x).toBeCloseTo(0.4, 10);
    expect(velocity.y).toBeCloseTo(0, 10);
  });

  it('never leads past the destination the target is walking to', () => {
    // Destination is 1 tile away but the flight is long enough to cover 2.4.
    const velocity = targetLeadVelocity({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.4, 6);
    // Six ticks of this velocity lands exactly on the destination, not beyond.
    expect(velocity.x * 6).toBeCloseTo(1, 10);
  });

  it('handles diagonal travel without exceeding the movement speed', () => {
    const velocity = targetLeadVelocity({ x: 0, y: 0 }, { x: 10, y: 10 }, 0.4, 6);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(0.4, 10);
  });

  it('turns an un-led miss into a hit when combined with the aim point', () => {
    const target = { x: 10, y: 10 };
    const destination = { x: 20, y: 10 };
    const flightTicks = 6;
    const speed = 0.4;
    const whereItWillBe = { x: target.x + speed * flightTicks, y: target.y };

    const unled = projectileAimPoint(target, { x: 0, y: 0 }, flightTicks, false);
    expect(projectileHitsTarget(unled, whereItWillBe)).toBe(false);

    const velocity = targetLeadVelocity(target, destination, speed, flightTicks);
    const led = projectileAimPoint(target, velocity, flightTicks, true);
    expect(projectileHitsTarget(led, whereItWillBe)).toBe(true);
    expect(Math.hypot(led.x - whereItWillBe.x, led.y - whereItWillBe.y))
      .toBeLessThanOrEqual(PROJECTILE_HIT_TOLERANCE);
  });
});

describe('Ballistics', () => {
  it('does not lead shots until it is researched', () => {
    expect(ballisticsLeadsShots(NONE)).toBe(false);
    expect(ballisticsLeadsShots(BALLISTICS)).toBe(true);
  });

  it('applies to buildings as well as units', () => {
    // technologies.csv scopes Ballistics to "Arrow/Bolt-firing units;Buildings;
    // Bombard Towers", so it is a per-OWNER property, not a per-unit one.
    expect(ballisticsLeadsShots(BALLISTICS)).toBe(true);
  });
});

describe('Thumb Ring', () => {
  it('leaves accuracy untouched for units it does not cover', () => {
    expect(thumbRingAccuracy(NONE, 'archer')).toBeNull();
    expect(thumbRingAccuracy(THUMB_RING, 'skirmisher')).toBeNull();
    expect(thumbRingAccuracy(THUMB_RING, 'mangonel')).toBeNull();
    expect(thumbRingAccuracy(THUMB_RING, 'trebuchet')).toBeNull();
    expect(thumbRingAccuracy(THUMB_RING, 'scorpion')).toBeNull();
  });

  it('gives the archer line and cavalry archers perfect accuracy', () => {
    // technologies.csv: "Faster reload time (10-20%) and 100% accuracy",
    // scoped to Archer;Cavalry Archer (i.e. both whole lines).
    for (const unitType of [
      'archer', 'crossbowman', 'arbalest',
      'cavalry-archer', 'heavy-cavalry-archer',
      'longbowman', 'elite-longbowman',
    ] as const) {
      expect(thumbRingAccuracy(THUMB_RING, unitType)).toBe(1);
    }
  });
});

describe('Ballistics wiring at the launch site', () => {
  // Tests the seam the pure functions cannot: that deliverUnitAttackOnUnit
  // reads Ballistics and Thumb Ring off the ATTACKER'S researched set and
  // passes the target's destination through to the aim point.
  function combat(overrides: Partial<CombatState> = {}): CombatState {
    return {
      currentHp: 40, maxHp: 40, attackDamage: 6, attackRange: 4,
      reloadTicks: 20, cooldownTicks: 0, armor: 0, pierceArmorBonus: 0,
      ...overrides,
    };
  }

  function deliver(
    techs: ReadonlySet<ResearchableTechnologyType>,
    destination: { x: number; y: number } | null,
  ) {
    const projectiles = createEmptyProjectileSlot();
    const attackerPosition = { x: 0, y: 10 };
    const world = {
      getComponent: (id: number, component: string) =>
        (id === 1 && component === 'position' ? attackerPosition : undefined),
      query: () => [],
      grid: { width: MAP_WIDTH, height: MAP_HEIGHT },
    } as unknown as GameWorld;

    deliverUnitAttackOnUnit({
      world,
      combatStates: new Map(),
      projectiles,
      tick: 0,
      attacker: { id: 1, unitType: 'archer', owner: 1, combat: combat() },
      target: {
        id: 2, unitType: 'militia',
        position: { x: 10, y: 10 }, combat: combat(),
      },
      attackerTechs: techs,
      targetDestination: destination,
      destroyUnit: () => {},
      addKill: () => {},
      markCombatDirty: () => {},
      markRender: () => {},
    });
    expect(projectiles.inFlight).toHaveLength(1);
    return projectiles.inFlight[0]!;
  }

  it('aims at the target’s cell without the technology', () => {
    const shot = deliver(NONE, { x: 10, y: 30 });
    expect(shot.aimX).toBeCloseTo(10, 6);
    expect(shot.aimY).toBeCloseTo(10, 6);
  });

  it('aims ahead along the target’s path once Ballistics is researched', () => {
    const shot = deliver(BALLISTICS, { x: 10, y: 30 });
    // The target is walking +y, so the shot leads that way and nowhere else.
    expect(shot.aimX).toBeCloseTo(10, 6);
    expect(shot.aimY).toBeGreaterThan(10 + PROJECTILE_HIT_TOLERANCE);
  });

  it('does not lead a target that is standing still, even with Ballistics', () => {
    const shot = deliver(BALLISTICS, null);
    expect(shot.aimX).toBeCloseTo(10, 6);
    expect(shot.aimY).toBeCloseTo(10, 6);
  });

  it('makes an archer’s shot unmissable once Thumb Ring is researched', () => {
    // A stationary target and a truly-aimed shot: with the archer's own 80%
    // accuracy some rolls miss, so scatter is possible; with Thumb Ring the
    // aim point is always the target itself.
    const withRing: ReadonlySet<ResearchableTechnologyType> = new Set(['thumb-ring']);
    for (let tick = 0; tick < 25; tick += 1) {
      const projectiles = createEmptyProjectileSlot();
      const world = {
        getComponent: () => ({ x: 0, y: 10 }),
        query: () => [],
        grid: { width: MAP_WIDTH, height: MAP_HEIGHT },
      } as unknown as GameWorld;
      deliverUnitAttackOnUnit({
        world,
        combatStates: new Map(),
        projectiles,
        tick,
        attacker: { id: 1, unitType: 'archer', owner: 1, combat: combat() },
        target: {
          id: 2, unitType: 'militia',
          position: { x: 10, y: 10 }, combat: combat(),
        },
        attackerTechs: withRing,
        targetDestination: null,
        destroyUnit: () => {},
        addKill: () => {},
        markCombatDirty: () => {},
        markRender: () => {},
      });
      const shot = projectiles.inFlight[0]!;
      expect(shot.willHit).toBe(true);
      expect(shot.aimX).toBeCloseTo(10, 6);
      expect(shot.aimY).toBeCloseTo(10, 6);
    }
  });
});

describe('researching the projectile techs in a real match', () => {
  // The end-to-end path the wiring test above cannot see: the building can be
  // built, it offers the technology, and researching it completes. This is
  // what would have caught the University offering nothing.
  it('lets a Castle-Age player build a University and research Ballistics', () => {
    const bridge = createSimulationBridge('imperial-age-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('university');
    placeBuildingNearTownCenter(bridge, 'university');
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().buildings.some(
        (building) => building.owner === 1
          && building.buildingType === 'university'
          && building.isComplete,
      ),
      { maxSteps: 1_200 },
    )).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'university')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('ballistics');
    expect(bridge.queueResearch('ballistics')).toBe(true);

    // A researched technology drops out of the building's options, which is
    // the observable signal that it completed.
    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'university');
        return !bridge.getSelectionState().researchOptions.includes('ballistics');
      },
      { maxSteps: 1_200 },
    )).toBe(true);
  }, 60_000);

  it('offers Thumb Ring at an existing Archery Range', () => {
    const bridge = createSimulationBridge('imperial-upgrades-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('thumb-ring');
    expect(bridge.queueResearch('thumb-ring')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'archery-range');
        return !bridge.getSelectionState().researchOptions.includes('thumb-ring');
      },
      { maxSteps: 1_200 },
    )).toBe(true);
  }, 60_000);
});
