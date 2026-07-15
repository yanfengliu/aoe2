// Wildlife retaliation gore pose (spec §14.5, user directive 2026-07-14).
// The boar's landed strike must read as a target-facing charge/gore through
// the same sampled channel as unit attacks: reared coil at the impact sample,
// snap into the gore, damped recovery, byte-identical rest outside the window.

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import { createResourceParts } from '../../src/rendering/voxel/aoeVoxelResourceRecipes';
import {
  poseWildlifeAttackParts,
  resolveWildlifeFacing,
  type WildlifeFacing,
} from '../../src/rendering/voxel/aoeVoxelWildlifePose';
import { matrixForPart, type VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

const ATTACK_TICK = 40;
const TICK_MS = 1_000 / TPS;

function boarView(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 90,
    generation: 2,
    kind: 'resource',
    layer: 'resource',
    entityType: 'boar',
    owner: null,
    x: 12,
    y: 8,
    elevation: 0,
    tint: 0x6b4a2f,
    size: 0.9,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 69,
    maxHp: 75,
    isMemory: false,
    ...overrides,
  };
}

function withAttack(target: { x: number; y: number }): ProjectedEntityView {
  return {
    ...boarView(),
    attackAnimation: {
      tick: ATTACK_TICK,
      sourceX: 12,
      sourceY: 8,
      targetX: target.x,
      targetY: target.y,
    },
  } as ProjectedEntityView;
}

// Mirrors what the adapter does per snapshot: resolve the retained facing,
// then pose with it.
function partsAt(entity: ProjectedEntityView, sampleTimeMs: number): readonly VoxelPart[] {
  return poseWildlifeAttackParts(
    createResourceParts(entity, '90:2', 0),
    entity,
    sampleTimeMs,
    resolveWildlifeFacing(entity, sampleTimeMs, undefined),
  );
}

function part(parts: readonly VoxelPart[], suffix: string): VoxelPart {
  const match = parts.find((candidate) => candidate.key.endsWith(`:${suffix}`));
  if (!match) throw new Error(`Missing boar part ${suffix}`);
  return match;
}

function matricesEqual(left: VoxelPart, right: VoxelPart): boolean {
  const a = matrixForPart(left);
  const b = matrixForPart(right);
  return a.every((value, index) => Math.abs(value - b[index]!) < 1e-9);
}

describe('wildlife facing retention (spec §14.5)', () => {
  const goreTimeMs = ATTACK_TICK * TICK_MS + 120;
  // Well past the 650ms pose window: the gore is over, but the boar must not
  // rotate back to its authored facing.
  const afterGoreMs = ATTACK_TICK * TICK_MS + 900;

  function headOffsetX(entity: ProjectedEntityView, timeMs: number, facing?: WildlifeFacing): number {
    const posed = poseWildlifeAttackParts(
      createResourceParts(entity, '90:2', 0),
      entity,
      timeMs,
      facing,
    );
    return part(posed, 'boar-head').centerX - (entity.x + 0.5);
  }

  it('keeps facing the target after the strike instead of turning back', () => {
    // A boar that bit something to its -x side must still be looking that way
    // once the gore finishes. Before this fix the facing was weighted by the
    // pose weight, so it swung back to authored forward as the pose decayed —
    // and snapped again on the next bite, reading as turning back and forth.
    const struck = withAttack({ x: 11, y: 8 });
    const facing = resolveWildlifeFacing(struck, goreTimeMs, undefined);
    expect(facing).toBeDefined();

    const duringGore = headOffsetX(struck, goreTimeMs, facing);
    expect(duringGore, 'head must swing toward the -x target during the gore')
      .toBeLessThan(0);

    // Same retained facing, sampled after the window with no live attack.
    const settled = boarView();
    const heldFacing = resolveWildlifeFacing(settled, afterGoreMs, facing);
    expect(headOffsetX(settled, afterGoreMs, heldFacing), 'the boar turned back to authored facing')
      .toBeLessThan(0);
  });

  it('retains the last facing when no attack is active, and adopts a new one on the next strike', () => {
    const first = resolveWildlifeFacing(withAttack({ x: 11, y: 8 }), goreTimeMs, undefined)!;
    const held = resolveWildlifeFacing(boarView(), afterGoreMs, first)!;
    expect(held.directionX).toBeCloseTo(first.directionX, 10);
    expect(held.directionZ).toBeCloseTo(first.directionZ, 10);

    // A later bite from the opposite side re-aims it.
    const second = resolveWildlifeFacing(withAttack({ x: 13, y: 8 }), goreTimeMs, held)!;
    expect(second.directionX).toBeGreaterThan(0);
    expect(first.directionX).toBeLessThan(0);
  });

  it('leaves a boar that has never attacked at its authored facing', () => {
    const never = boarView();
    expect(resolveWildlifeFacing(never, goreTimeMs, undefined)).toBeUndefined();
    expect(poseWildlifeAttackParts(createResourceParts(never, '90:2', 0), never, goreTimeMs, undefined))
      .toEqual(createResourceParts(never, '90:2', 0));
  });
});

describe('wildlife gore pose (spec §14.5)', () => {
  const rest = boarView();
  const goreTimeMs = ATTACK_TICK * TICK_MS + 120;

  it('poses head and tusks during the strike while legs and shadow stay planted', () => {
    const restParts = partsAt(rest, goreTimeMs);
    const struckParts = partsAt(withAttack({ x: 13, y: 8 }), goreTimeMs);
    expect(matricesEqual(part(struckParts, 'boar-head'), part(restParts, 'boar-head'))).toBe(false);
    expect(matricesEqual(part(struckParts, 'boar-tusk-left'), part(restParts, 'boar-tusk-left'))).toBe(false);
    expect(matricesEqual(part(struckParts, 'resource-shadow'), part(restParts, 'resource-shadow'))).toBe(true);
  });

  it('drives the tusks TOWARD the captured target at the gore', () => {
    const restParts = partsAt(rest, goreTimeMs);
    for (const target of [{ x: 13, y: 8 }, { x: 12, y: 9 }, { x: 11, y: 8 }]) {
      const struckParts = partsAt(withAttack(target), goreTimeMs);
      const restTusk = part(restParts, 'boar-tusk-left');
      const goreTusk = part(struckParts, 'boar-tusk-left');
      const towardX = (target.x - 12) || 0;
      const towardZ = (target.y - 8) || 0;
      const dot = (goreTusk.centerX - restTusk.centerX) * towardX
        + (goreTusk.centerZ - restTusk.centerZ) * towardZ;
      expect(dot, `tusk must drive toward (${String(target.x)},${String(target.y)})`)
        .toBeGreaterThan(0.01);
    }
  });

  it('returns byte-identical rest parts outside the strike window and without a channel', () => {
    const afterWindow = partsAt(withAttack({ x: 13, y: 8 }), ATTACK_TICK * TICK_MS + 660);
    const restParts = partsAt(rest, ATTACK_TICK * TICK_MS + 660);
    for (const [index, posed] of afterWindow.entries()) {
      expect(matricesEqual(posed, restParts[index]!)).toBe(true);
    }
    expect(partsAt(rest, goreTimeMs)).toEqual(createResourceParts(rest, '90:2', 0));
  });

  it('is deterministic for identical inputs', () => {
    const struck = withAttack({ x: 13, y: 8 });
    expect(partsAt(struck, goreTimeMs)).toEqual(partsAt(struck, goreTimeMs));
  });
});
