import { Euler, Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { voxelPartWorldCornersAtTime } from '../../src/rendering/voxel/aoeVoxelGeometry';
import {
  matrixForPart,
  type VoxelPart,
} from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

describe('voxel animated geometry query', () => {
  it('matches the Three runtime rigid-transform order exactly', () => {
    const part: VoxelPart = {
      key: 'test:animated-part',
      surface: 'matte',
      tint: 0xffffff,
      centerX: 3,
      centerY: 2,
      centerZ: 5,
      width: 0.8,
      height: 1.2,
      depth: 0.6,
      yaw: 0.3,
      pitch: -0.2,
      roll: 0.1,
      animation: {
        periodMs: 1_200,
        phaseRadians: 0.4,
        translationAmplitude: { x: 0.08, y: 0.04, z: -0.03 },
        rotationAmplitude: { x: 0.2, y: -0.15, z: 0.1 },
        scaleAmplitude: { x: 0.05, y: -0.03, z: 0.07 },
      },
    };
    const nowMs = 347;
    const phase = nowMs / part.animation!.periodMs * Math.PI * 2
      + part.animation!.phaseRadians;
    const wave = Math.sin(phase);
    const offset = new Matrix4()
      .makeRotationFromEuler(new Euler(
        part.animation!.rotationAmplitude.x * wave,
        part.animation!.rotationAmplitude.y * wave,
        part.animation!.rotationAmplitude.z * wave,
      ))
      .scale(new Vector3(
        1 + part.animation!.scaleAmplitude.x * wave,
        1 + part.animation!.scaleAmplitude.y * wave,
        1 + part.animation!.scaleAmplitude.z * wave,
      ));
    const base = new Matrix4().fromArray(matrixForPart(part));
    const expected: Vector3[] = [];
    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) {
        for (const z of [-0.5, 0.5]) {
          expected.push(new Vector3(x, y, z)
            .applyMatrix4(offset)
            .applyMatrix4(base)
            .addScaledVector(new Vector3(
              part.animation!.translationAmplitude.x,
              part.animation!.translationAmplitude.y,
              part.animation!.translationAmplitude.z,
            ), wave));
        }
      }
    }

    voxelPartWorldCornersAtTime(part, nowMs).forEach((actual, index) => {
      expect(actual.x).toBeCloseTo(expected[index]!.x, 10);
      expect(actual.y).toBeCloseTo(expected[index]!.y, 10);
      expect(actual.z).toBeCloseTo(expected[index]!.z, 10);
    });
  });
});
