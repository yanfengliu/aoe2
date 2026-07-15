import { describe, expect, it } from 'vitest';

import type {
  ProjectedEntityView,
  UnitType,
} from '../../src/game/simulation/types';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import {
  findPreparedVoxelEntitiesAtIsoPoint,
  preparedVoxelEntityHitRegions,
} from '../../src/rendering/voxel/aoeVoxelHitProxy';
import {
  resolveUnitAnimationState,
  type AoeUnitAnimationState,
} from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import {
  voxelPartWorldCorners,
  voxelPartWorldCornersAtTime,
} from '../../src/rendering/voxel/aoeVoxelGeometry';
import {
  matrixForPart,
  type VoxelPart,
} from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

interface AttackAnimationProjection {
  readonly tick: number;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
}

type AttackProjectedEntity = ProjectedEntityView & {
  readonly attackAnimation?: AttackAnimationProjection;
};

type AttackAnimationState = Omit<AoeUnitAnimationState, 'mode'> & {
  readonly mode: 'idle' | 'moving' | 'attacking';
  readonly attackPhase: number;
  readonly attackWeight: number;
};

function unit(
  overrides: Partial<AttackProjectedEntity> = {},
): AttackProjectedEntity {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 0,
    y: 0,
    elevation: 0,
    tint: 0x3568c0,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

function animationState(
  overrides: Partial<AttackAnimationState> = {},
): AoeUnitAnimationState {
  return {
    mode: 'idle',
    phaseRadians: 0.4,
    gaitPhaseRadians: 0,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase: 0,
    attackWeight: 0,
    ambientSuppressionWeight: 0,
    ...overrides,
  } as unknown as AoeUnitAnimationState;
}

function attackState(state: AoeUnitAnimationState): AttackAnimationState {
  return state as unknown as AttackAnimationState;
}

function part(parts: readonly VoxelPart[], suffix: string): VoxelPart {
  const match = parts.find((candidate) => candidate.key.endsWith(`:${suffix}`));
  if (!match) throw new Error(`Missing unit part ${suffix}`);
  return match;
}

function expectSameMatrix(left: VoxelPart, right: VoxelPart): void {
  expect(matrixForPart(left)).toEqual(matrixForPart(right));
}

function expectDifferentMatrix(left: VoxelPart, right: VoxelPart): void {
  const leftMatrix = matrixForPart(left);
  const rightMatrix = matrixForPart(right);
  expect(
    leftMatrix.some(
      (value, index) => Math.abs(value - rightMatrix[index]!) > 1e-6,
    ),
  ).toBe(true);
}

function attachmentDistances(first: VoxelPart, second: VoxelPart): number[] {
  return voxelPartWorldCorners(first).flatMap((firstCorner) =>
    voxelPartWorldCorners(second).map((secondCorner) =>
      Math.hypot(
        firstCorner.x - secondCorner.x,
        firstCorner.y - secondCorner.y,
        firstCorner.z - secondCorner.z,
      ),
    ),
  );
}

describe('AoE voxel unit attack animation sampling', () => {
  it('uses deterministic target-facing impact motion, freezes at equal display time, and eases out', () => {
    const identity = '7:3';
    const idle = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const attack = unit({
      attackAnimation: { tick: 0, sourceX: 0, sourceY: 0, targetX: 6, targetY: 0 },
    });
    const entered = resolveUnitAnimationState(
      attack,
      identity,
      idle.history,
      1_000 / 60,
    );
    const progressed = resolveUnitAnimationState(
      attack,
      identity,
      entered.history,
      100,
    );
    const frozen = resolveUnitAnimationState(
      attack,
      identity,
      progressed.history,
      100,
    );
    const exited = resolveUnitAnimationState(
      unit(),
      identity,
      progressed.history,
      1_000 / 60 + 100,
    );
    const enteredState = attackState(entered.state);
    const progressedState = attackState(progressed.state);
    const exitedState = attackState(exited.state);

    expect(enteredState.mode).toBe('attacking');
    expect(enteredState.attackWeight).toBe(1);
    expect(enteredState.attackPhase).toBeGreaterThanOrEqual(0.55);
    expect(enteredState.directionX).toBeCloseTo(1);
    expect(enteredState.directionZ).toBeCloseTo(0);
    expect(progressedState.directionX).toBeCloseTo(enteredState.directionX);
    expect(progressedState.directionZ).toBeCloseTo(enteredState.directionZ);
    expect(progressedState.attackPhase).toBeGreaterThan(
      enteredState.attackPhase,
    );
    expect(progressedState.attackWeight).toBe(1);
    expect(frozen).toEqual(progressed);
    expect(exitedState.attackWeight).toBe(0);
    expect(exitedState.ambientSuppressionWeight).toBe(0);
  });

  it('keeps distance-driven gait while an attacker is still approaching its target', () => {
    const identity = '7:3';
    const idle = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const approaching = resolveUnitAnimationState(
      unit({
        x: 0.2,
        attackAnimation: { tick: 1, sourceX: 0, sourceY: 0, targetX: 6, targetY: 0 },
      }),
      identity,
      idle.history,
      100,
    );
    const continuing = resolveUnitAnimationState(
      unit({
        x: 0.4,
        attackAnimation: { tick: 1, sourceX: 0, sourceY: 0, targetX: 6, targetY: 0 },
      }),
      identity,
      approaching.history,
      200,
    );

    expect(attackState(approaching.state).mode).toBe('moving');
    expect(approaching.state.locomotionWeight).toBeGreaterThan(0);
    expect(approaching.state.gaitPhaseRadians).not.toBe(
      idle.state.gaitPhaseRadians,
    );
    expect(continuing.state.gaitPhaseRadians).not.toBe(
      approaching.state.gaitPhaseRadians,
    );
  });

  it('keeps a coincident-root attack visible with deterministic prior facing', () => {
    const identity = 'overflow-convert:7';
    const idle = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const coincidentAttack = unit({
      attackAnimation: { tick: 0, sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
    });

    const entered = resolveUnitAnimationState(
      coincidentAttack,
      identity,
      idle.history,
      1_000 / 60,
    );
    const fresh = resolveUnitAnimationState(
      coincidentAttack,
      identity,
      undefined,
      1_000 / 60,
    );

    expect(attackState(entered.state).mode).toBe('attacking');
    expect(entered.state.attackWeight).toBe(1);
    expect(entered.state.ambientSuppressionWeight).toBe(1);
    expect(entered.state.directionX).toBeCloseTo(idle.state.directionX);
    expect(entered.state.directionZ).toBeCloseTo(idle.state.directionZ);
    expect(attackState(fresh.state).mode).toBe('attacking');
    expect(fresh.state.attackWeight).toBe(1);
    expect(fresh.state.ambientSuppressionWeight).toBe(1);
    expect(Math.hypot(fresh.state.directionX, fresh.state.directionZ)).toBeCloseTo(1);
  });
});

describe('AoE voxel role-aware attack poses', () => {
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly unitType: UnitType;
    readonly weapon: string;
    readonly planted: readonly string[];
  }> = [
    {
      label: 'villager tool',
      unitType: 'villager',
      weapon: 'villager-tool-head',
      planted: ['villager-boot-left', 'villager-boot-right'],
    },
    {
      label: 'infantry sword',
      unitType: 'militia',
      weapon: 'infantry-sword',
      planted: ['infantry-boot-left', 'infantry-boot-right'],
    },
    {
      label: 'archer bow',
      unitType: 'archer',
      weapon: 'archer-bow-upper',
      planted: ['archer-boot-left', 'archer-boot-right'],
    },
    {
      label: 'cavalry lance',
      unitType: 'knight',
      weapon: 'cavalry-lance',
      planted: [
        'cavalry-horse-leg-front-left',
        'cavalry-horse-leg-front-right',
        'cavalry-horse-leg-back-left',
        'cavalry-horse-leg-back-right',
      ],
    },
    {
      label: 'mounted archer bow',
      unitType: 'cavalry-archer',
      weapon: 'cavalry-archer-bow-upper',
      planted: [
        'cavalry-horse-leg-front-left',
        'cavalry-horse-leg-front-right',
        'cavalry-horse-leg-back-left',
        'cavalry-horse-leg-back-right',
      ],
    },
    {
      label: 'ram beam',
      unitType: 'battering-ram',
      weapon: 'siege-ram-beam',
      planted: ['siege-wheel-left', 'siege-wheel-right'],
    },
    {
      label: 'throwing-siege arm',
      unitType: 'mangonel',
      weapon: 'siege-throwing-arm',
      planted: ['siege-wheel-left', 'siege-wheel-right'],
    },
  ];

  it.each(cases)(
    '$label visibly strikes while its planted root stays stable',
    ({ unitType, weapon, planted }) => {
      const entity = unit({ entityType: unitType });
      const resting = createUnitParts(entity, '7:3', 0, animationState());
      const strike = createUnitParts(
        entity,
        '7:3',
        0,
        animationState({
          mode: 'attacking',
          attackPhase: 0.55,
          attackWeight: 1,
          ambientSuppressionWeight: 1,
        }),
      );
      const phaseStart = createUnitParts(
        entity,
        '7:3',
        0,
        animationState({
          mode: 'attacking',
          attackPhase: 0,
          attackWeight: 1,
        }),
      );
      const recovered = createUnitParts(
        entity,
        '7:3',
        0,
        animationState({
          mode: 'attacking',
          attackPhase: 1,
          attackWeight: 1,
        }),
      );

      expectDifferentMatrix(part(strike, weapon), part(resting, weapon));
      expectSameMatrix(part(phaseStart, weapon), part(resting, weapon));
      expectSameMatrix(part(recovered, weapon), part(resting, weapon));
      expectSameMatrix(
        part(strike, 'unit-shadow'),
        part(resting, 'unit-shadow'),
      );
      for (const suffix of planted) {
        expectSameMatrix(part(strike, suffix), part(resting, suffix));
      }
      expect(strike.flatMap(matrixForPart).every(Number.isFinite)).toBe(true);
    },
  );

  it.each([
    ['villager tool', 'villager', 'villager-tool-handle', 'villager-tool-head'],
    ['infantry sword', 'militia', 'infantry-sword', 'infantry-sword-hilt'],
    ['archer upper bow', 'archer', 'archer-bow-upper', 'archer-bow-grip'],
    ['archer lower bow', 'archer', 'archer-bow-lower', 'archer-bow-grip'],
    [
      'mounted archer bow',
      'cavalry-archer',
      'cavalry-archer-bow-upper',
      'cavalry-archer-bow-lower',
    ],
    ['ram beam', 'battering-ram', 'siege-ram-beam', 'siege-ram-head'],
    ['throwing-siege arm', 'mangonel', 'siege-throwing-arm', 'siege-bucket'],
  ] as const)(
    '%s keeps its compound parts attached through the strike',
    (_label, unitType, firstSuffix, secondSuffix) => {
      const entity = unit({ entityType: unitType });
      const resting = createUnitParts(entity, '7:3', 0, animationState());
      const strike = createUnitParts(
        entity,
        '7:3',
        0,
        animationState({
          mode: 'attacking',
          attackPhase: 0.55,
          attackWeight: 1,
          ambientSuppressionWeight: 1,
        }),
      );
      const restingDistances = attachmentDistances(
        part(resting, firstSuffix),
        part(resting, secondSuffix),
      );
      const strikeDistances = attachmentDistances(
        part(strike, firstSuffix),
        part(strike, secondSuffix),
      );

      strikeDistances.forEach((distance, index) => {
        expect(distance).toBeCloseTo(restingDistances[index]!, 5);
      });
    },
  );

  it.each([
    ['villager', 'villager', ['villager-tool-handle', 'villager-tool-head', 'villager-arm-left', 'villager-arm-right', 'villager-tunic']],
    ['infantry', 'militia', ['infantry-sword', 'infantry-sword-hilt', 'infantry-arm-right', 'infantry-shield', 'infantry-shield-boss', 'infantry-arm-left', 'infantry-tunic']],
    ['archer', 'archer', ['archer-bow-upper', 'archer-bow-lower', 'archer-bow-grip', 'archer-arm-left', 'archer-arm-right', 'archer-tunic']],
    ['cavalry', 'knight', ['cavalry-lance', 'cavalry-rider-tunic', 'cavalry-shield']],
    ['mounted archer', 'cavalry-archer', ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower', 'cavalry-rider-tunic']],
    ['ram', 'battering-ram', ['siege-ram-beam', 'siege-ram-head', 'siege-chassis', 'siege-deck']],
    ['throwing siege', 'mangonel', ['siege-throwing-arm', 'siege-bucket', 'siege-chassis', 'siege-deck']],
  ] as const)(
    '%s attack-controlled pixels freeze with simulation time',
    (_label, unitType, controlledSuffixes) => {
      const strike = createUnitParts(
        unit({ entityType: unitType }),
        '7:3',
        0,
        animationState({
          mode: 'attacking',
          attackPhase: 0.55,
          attackWeight: 1,
          ambientSuppressionWeight: 1,
        }),
      );

      for (const suffix of controlledSuffixes) {
        const controlledPart = part(strike, suffix);
        if (controlledPart.animation) {
          expect(controlledPart.animation.translationAmplitude).toEqual({ x: 0, y: 0, z: 0 });
          expect(controlledPart.animation.rotationAmplitude).toEqual({ x: 0, y: 0, z: 0 });
          expect(controlledPart.animation.scaleAmplitude).toEqual({ x: 0, y: 0, z: 0 });
        }
        expect(voxelPartWorldCornersAtTime(controlledPart, 0)).toEqual(
          voxelPartWorldCornersAtTime(controlledPart, 777),
        );
      }
    },
  );
});

describe('AoE voxel attacking hit-proxy parity', () => {
  it('prepares the exact attack pose used by rendered matrices and picking', () => {
    const adapter = new AoeVoxelAdapter();
    const idle = unit({ id: 41, entityType: 'militia' });
    adapter.createSnapshot([idle], 0);
    const idleWeapon = part(
      adapter.latestHitState()!.entities[0]!.parts,
      'infantry-sword',
    );
    const attacker = unit({
      id: 41,
      entityType: 'militia',
      attackAnimation: { tick: 1, sourceX: 0, sourceY: 0, targetX: 8, targetY: 0 },
    });
    adapter.createSnapshot([attacker], 100);
    const snapshot = adapter.createSnapshot([attacker], 458);
    const preparedState = adapter.latestHitState();
    const prepared = preparedState?.entities[0];
    expect(prepared).toBeDefined();
    const weapon = part(prepared!.parts, 'infantry-sword');
    expectDifferentMatrix(weapon, idleWeapon);
    const batch = snapshot.batches.find((candidate) =>
      candidate.instanceKeys.includes(weapon.key),
    );
    expect(batch).toBeDefined();
    const instanceIndex = batch!.instanceKeys.indexOf(weapon.key);
    const renderedMatrix = batch!.matrices.slice(
      instanceIndex * 16,
      instanceIndex * 16 + 16,
    );
    matrixForPart(weapon).forEach((value, index) => {
      expect(renderedMatrix[index]).toBeCloseTo(value, 5);
    });

    const weaponRegion = preparedVoxelEntityHitRegions(prepared!, 458).find(
      (region) => region.key === weapon.key,
    );
    expect(weaponRegion).toBeDefined();
    const point = {
      x:
        weaponRegion!.polygon.reduce((sum, candidate) => sum + candidate.x, 0) /
        weaponRegion!.polygon.length,
      y:
        weaponRegion!.polygon.reduce((sum, candidate) => sum + candidate.y, 0) /
        weaponRegion!.polygon.length,
    };
    expect(
      findPreparedVoxelEntitiesAtIsoPoint(
        preparedState!.entities,
        point.x,
        point.y,
        'selection',
        458,
      ).map((candidate) => candidate.id),
    ).toEqual([attacker.id]);
  });
});
