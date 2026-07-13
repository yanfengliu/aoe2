import { isoToWorld } from '../isometricProjection';
import type { CameraState } from '../viewTypes';

export interface AoeVoxelCameraView {
  readonly center: { readonly x: number; readonly y: number; readonly z: number };
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

export function cameraStateToVoxelView(camera: CameraState): AoeVoxelCameraView {
  const isoCenterX = camera.viewX + camera.viewWidth / 2;
  const isoCenterY = camera.viewY + camera.viewHeight / 2;
  const cellCenter = isoToWorld(isoCenterX, isoCenterY);

  return {
    center: { x: cellCenter.cellX, y: 0, z: cellCenter.cellY },
    width: camera.width,
    height: camera.height,
    zoom: camera.zoom,
  };
}
