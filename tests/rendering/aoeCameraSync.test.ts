import { describe, expect, it } from 'vitest';

import { cameraStateToVoxelView } from '../../src/rendering/voxel/aoeCameraSync';
import { worldToIso } from '../../src/rendering/isometricProjection';

describe('cameraStateToVoxelView', () => {
  it('maps the standalone iso-pixel viewport centre back to the Three cell plane', () => {
    const target = worldToIso(10, 12);
    const width = 800;
    const height = 600;

    expect(cameraStateToVoxelView({
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width,
      height,
      viewX: target.x - width / 2,
      viewY: target.y - height / 2,
      viewWidth: width,
      viewHeight: height,
      viewCorners: [],
    })).toEqual({
      center: { x: 10, y: 0, z: 12 },
      width,
      height,
      zoom: 1,
    });
  });

  it('preserves the logical viewport size and standalone zoom', () => {
    const view = cameraStateToVoxelView({
      scrollX: 100,
      scrollY: 50,
      zoom: 2,
      width: 1000,
      height: 500,
      viewX: 100,
      viewY: 50,
      viewWidth: 500,
      viewHeight: 250,
      viewCorners: [],
    });

    expect(view.width).toBe(1000);
    expect(view.height).toBe(500);
    expect(view.zoom).toBe(2);
  });
});
