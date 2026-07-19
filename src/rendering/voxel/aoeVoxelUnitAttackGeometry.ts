import { matrixForPart, type VoxelPart } from './aoeVoxelRecipeTypes';

export interface UnitAttackDirection {
  readonly directionX: number;
  readonly directionZ: number;
}

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function unitPartSuffix(part: VoxelPart): string {
  return part.key.slice(part.key.lastIndexOf(':') + 1);
}

export function findUnitPart(
  parts: readonly VoxelPart[],
  suffix: string,
): VoxelPart | undefined {
  return parts.find((part) => unitPartSuffix(part) === suffix);
}

export function centerOfUnitPart(part: VoxelPart): Point3 {
  return { x: part.centerX, y: part.centerY, z: part.centerZ };
}

export function lowerEndOfUnitPart(part: VoxelPart): Point3 {
  const matrix = matrixForPart(part);
  return {
    x: part.centerX - matrix[4]! / 2,
    y: part.centerY - matrix[5]! / 2,
    z: part.centerZ - matrix[6]! / 2,
  };
}

export function midpointOfUnitParts(first: VoxelPart, second: VoxelPart): Point3 {
  return {
    x: (first.centerX + second.centerX) / 2,
    y: (first.centerY + second.centerY) / 2,
    z: (first.centerZ + second.centerZ) / 2,
  };
}

function rotateX(point: Point3, radians: number): Point3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x,
    y: point.y * cosine - point.z * sine,
    z: point.y * sine + point.z * cosine,
  };
}

function rotateY(point: Point3, radians: number): Point3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
}

function rotateZ(point: Point3, radians: number): Point3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
    z: point.z,
  };
}

function rotateAttackOffset(
  offset: Point3,
  state: UnitAttackDirection,
  yaw: number,
  pitch: number,
  roll: number,
): Point3 {
  const rolled = rotateY(
    rotateZ(rotateY(offset, -yaw), roll),
    yaw,
  );
  const heading = Math.atan2(state.directionX, state.directionZ);
  return rotateY(
    rotateX(rotateY(rolled, -heading), pitch),
    heading,
  );
}

export function transformUnitAttackPart(
  part: VoxelPart,
  state: UnitAttackDirection,
  forward: number,
  vertical: number,
  pitch: number,
  roll = 0,
  pivot?: Point3,
): VoxelPart {
  const rotatedOffset = pivot
    ? rotateAttackOffset(
      {
        x: part.centerX - pivot.x,
        y: part.centerY - pivot.y,
        z: part.centerZ - pivot.z,
      },
      state,
      part.yaw ?? 0,
      pitch,
      roll,
    )
    : undefined;
  return {
    ...part,
    centerX: (pivot && rotatedOffset ? pivot.x + rotatedOffset.x : part.centerX)
      + state.directionX * forward,
    centerY: (pivot && rotatedOffset ? pivot.y + rotatedOffset.y : part.centerY)
      + vertical,
    centerZ: (pivot && rotatedOffset ? pivot.z + rotatedOffset.z : part.centerZ)
      + state.directionZ * forward,
    pitch: (part.pitch ?? 0) + pitch,
    pitchHeadingRadians: Math.atan2(state.directionX, state.directionZ),
    roll: (part.roll ?? 0) + roll,
  };
}
