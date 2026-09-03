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
      // shadow part count goes 438 -> 3093 over those 146 recipe instances.
      // Recorded FOUR times across this slice — 2098 before a caster's own pad
      // became a receiver, 2304 after, and 3093 once an independent review
      // found three defects in it: an unbounded relax loop that could hang the
      // renderer, a min/max envelope that invented shadow between bands where
      // the sun reaches the ground (9% of the watch tower's area), and a pad
      // layer drawn at a BAND's top rather than a real part's, floating up to
      // 0.147 world units above the surface it is painted on. The non-shadow
      // digest is byte-identical across ALL FOUR, which is the whole point of
      // measuring it: it is the control that says the change stayed in the
      // shadow surface while everything about the shadow moved.
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
      idle: 'b26719aff2f37322c6b192a9f3bc34b33e2d182ac4c92f005abc40f189ff55b8',
      locomotion: '7094ac6982e0410edc236bcd7fc638bcee2c3ab12d54efbd1ee27a7f89946979',
      builderWork: '19b3ce94ed068861fa38cd3490d6b1efdf0088dcc585e96fb553c4011d6de7df',
      attackCoil: '7faf3ee0b5215e38779b2c3194b9e83ef23501a53a3cc8135fc8890c2ea7b635',
      attackImpact: '7eb4629f9db8121884b4e7326abe0993223cc7308c6d2bc070a218cf4d68724b',
      attackSnap: 'b808e475d9b0f9e92c72db07ab8fe4b280a830e22a41802f75672bd6d378de2e',
      attackRecovery: 'edb38f8b5f56db6d85df67e34445b256409b437b2082cad92b0ce9f2f66e2bfe',
      memory: 'd0f5d53c2ee044c3e80e7fff8250d58fbd49a2dd4f44bc606dc3fd04450ca46a',
    });
  });
});
