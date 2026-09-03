import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { ALL_UNIT_TYPES } from '../../src/input/unitTypeMap';
import type { AoeUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

const UNIT_TYPES = Object.keys(ALL_UNIT_TYPES) as UnitType[];

function unit(entityType: UnitType, isMemory = false): ProjectedEntityView {
  return {
    id: 37,
    generation: 4,
    kind: 'unit',
    layer: 'unit',
    entityType,
    owner: 1,
    x: 3.125,
    y: 5.375,
    elevation: 0.6,
    tint: 0x3568c0,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory,
  };
}

function state(overrides: Partial<AoeUnitAnimationState> = {}): AoeUnitAnimationState {
  return {
    mode: 'idle',
    phaseRadians: 1.234,
    gaitPhaseRadians: 0,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase: 0,
    attackWeight: 0,
    ambientSuppressionWeight: 0,
    workPhase: 0,
    workWeight: 0,
    targetDistance: 0,
    ...overrides,
  };
}

function digestParts(animationState: AoeUnitAnimationState, isMemory = false): string {
  const payload = UNIT_TYPES.map((entityType, index) => createUnitParts(
    unit(entityType, isMemory),
    `37:${index}`,
    0.6,
    animationState,
  ));
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

describe('AoE voxel unit recipe characterization', () => {
  it('pins every unit type across the recipe and attack-animation state space', () => {
    expect({
      idle: digestParts(state()),
      locomotion: digestParts(state({
        mode: 'moving',
        gaitPhaseRadians: 0.83,
        locomotionWeight: 0.74,
        speedWorldUnitsPerSecond: 2.6,
        directionX: 0.6,
        directionZ: 0.8,
      })),
      builderWork: digestParts(state({
        workPhase: 0.63,
        workWeight: 0.81,
      })),
      attackCoil: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.42,
        attackWeight: 0.9,
        ambientSuppressionWeight: 0.9,
        targetDistance: 1.4,
      })),
      attackImpact: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.55,
        attackWeight: 1,
        ambientSuppressionWeight: 1,
        targetDistance: 1.4,
      })),
      attackSnap: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.586,
        attackWeight: 1,
        ambientSuppressionWeight: 1,
        targetDistance: 1.4,
      })),
      attackRecovery: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.83,
        attackWeight: 0.67,
        ambientSuppressionWeight: 0.67,
        targetDistance: 1.4,
      })),
      memory: digestParts(state(), true),
      // Re-recorded 2026-09-03 for shape-matched shadows: a caster's shadow is
      // now its SILHOUETTE, tiled with triangles, instead of one box's swept
      // footprint, so every live unit's shadow part count and matrices moved.
      // `memory` casts nothing and did not move — it is the control.
      // Proved the slice the same way the last two re-recordings did: a digest
      // over every unit, resource and building recipe's NON-shadow parts is
      // byte-identical across the change
      // (e2f40e86a2352cb74c7c071ab2c1e5b4f3f31a5b3d64463b4dd0f316a0471c3a,
      // 2326 parts on both sides) while the shadow-only digest moves and the
      // shadow part count goes 438 -> 2304 over those 146 recipe instances.
      // (Recorded once at 2098 mid-slice, before a caster's own pad became a
      // shadow receiver; the non-shadow digest is the same on all three sides,
      // which is the point of measuring it.)
      // Re-recorded 2026-09-02 for the sun-cast shadows (v0.3.193): every
      // live unit's one contact slab became three shadow slabs, so all seven
      // live digests moved and `memory` (which casts nothing) did not. Proved
      // the slice first with a per-unit digest keyed by TYPE over the parts
      // EXCLUDING the shadow surface: 93 units x 3 states, 279 of 279
      // byte-identical, shadow parts 1 -> 3 for every one.
      // Re-recorded again the same day, after review, when the caster box
      // stopped sweeping mass BELOW the ground plane (a boot bottom sitting a
      // hair under 0 shortened every unit's sweep) and `water` left the
      // casting surfaces. Same proof: a digest over every unit, resource and
      // building recipe's NON-shadow parts is byte-identical across the change
      // (367b992ed23c2fc274261f2f4d9878d0b9c6ed25c6188ba35b9f67728c2a9169)
      // while the shadow-only digest moves.
      // Re-recorded 2026-08-24 for the Missionary (v0.3.71: one additive
      // profile row plus the mounted-staff branch replacing its lance
      // fallback). Before that for the Trade Cog (v0.3.69, one additive
      // ship-profile row). Before that, twice for the Trade Cart (v0.3.68): first the
      // added unit, then its cargo branch replacing the trebuchet fallback its
      // 'tool' weapon fell into — a cart with a throwing arm, caught by the
      // close-zoom capture, not by any test. The rendering
      // diff was three additive 'trade-cart' table rows and nothing else
      // (git diff: 6 insertions, 0 deletions), so every other unit's recipe
      // input is textually unchanged. Previously re-recorded 2026-08-23 for
      // the three line tiers (Capped Ram, Siege Onager, Elite Skirmisher). A whole-population hash cannot say WHICH
      // unit moved it, so before touching these the per-unit digest check was
      // run with an identity keyed by TYPE rather than by list position: all 83
      // pre-existing units were byte-identical and only the three new entries
      // appeared. Keying by position — which this payload does — makes an
      // insertion shift every later unit's identity, which is why 56 units
      // first looked changed and none of them were.
    }).toEqual({
      idle: '3bf3722c4c52069ed7188f8f4820c397ca10312feadf006ea95a5a27921065b3',
      locomotion: '7eb585c57a3727da95f2bd13b45834bbf3de21012176accd79fd9052450caddb',
      builderWork: '3ebe2336e772a47fad66fe7f8221bfa461d78adbcdbca7a73b3ee455de53d40e',
      attackCoil: '77c5e58de6ca422c3d3fdf713f9e756ce67f9902bd132af2790bea1a0e6263b4',
      attackImpact: 'd8226cd04f79ce5fb0bacae470235d99b8a8d0170ceca93d7ca2cfd862859de6',
      attackSnap: 'a8d6ec048e309214f03ea02f2e63ed361aac6b176f15ee83e4d704f2916e9030',
      attackRecovery: 'e73021137cdfd356dd2b05fe544facc25a9f8c7c801212179268f1871611bc00',
      memory: 'd0f5d53c2ee044c3e80e7fff8250d58fbd49a2dd4f44bc606dc3fd04450ca46a',
    });
  });
});
