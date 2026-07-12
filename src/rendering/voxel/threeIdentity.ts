import { OrthographicCamera } from 'three';
import { createIsometricOrthographicCamera } from 'voxel/three';

/** Browser-bundle probe: linked consumers must resolve one Three constructor. */
export function hasSingleThreeIdentity(): boolean {
  return createIsometricOrthographicCamera({
    viewportWidth: 1,
    viewportHeight: 1,
    center: { x: 0, y: 0, z: 0 },
    zoom: 1,
  }) instanceof OrthographicCamera;
}
