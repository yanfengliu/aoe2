import { Box3, BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import type { GeometryResourceV1, InstanceBatchV1, RenderResourceV1 } from 'voxel/core';

/** Sparse updates keep conservative bounds, whereas a complete put resets them. Three sorts transparent meshes
 *  by their bounds' centre, so a shrinking shadow/memory lane needs a complete put even if its keys stayed put.
 *  The real-runtime bounds test binds this guard to the pinned public renderer's actual presentation behavior. */
export function translucentBoundsChanged(previous: InstanceBatchV1, next: InstanceBatchV1, resources: readonly RenderResourceV1[]): boolean {
  const material = resources.find((resource) => resource.key === next.materialKey);
  if (material?.kind !== 'material' || !material.transparent) return false;
  // AoE's translucent lanes have no animation. An unusual future animated one keeps the full-put path until its
  // animated bounds have their own proof, rather than guessing at a renderer's motion envelope.
  if (previous.animation || next.animation) return true;
  const geometry = resources.find((resource): resource is GeometryResourceV1 => resource.key === next.geometryKey && resource.kind === 'geometry');
  if (!geometry) return true;
  const positions = geometry.positions.slice();
  for (let index = 0; index < positions.length; index += 3) {
    positions[index]! -= geometry.pivot.x;
    positions[index + 1]! -= geometry.pivot.y;
    positions[index + 2]! -= geometry.pivot.z;
  }
  const shape = new BufferGeometry();
  try {
    shape.setAttribute('position', new BufferAttribute(positions, 3));
    shape.computeBoundingSphere();
    const sphere = shape.boundingSphere!;
    const bounds = (batch: InstanceBatchV1): Box3 => {
      const box = new Box3();
      const matrix = new Matrix4();
      const center = new Vector3();
      const corner = new Vector3();
      const point = new Vector3();
      for (let index = 0; index < batch.instanceKeys.length; index += 1) {
        matrix.fromArray(batch.matrices, index * 16);
        const e = matrix.elements;
        const radius = sphere.radius * Math.sqrt(e[0]! ** 2 + e[1]! ** 2 + e[2]! ** 2
          + e[4]! ** 2 + e[5]! ** 2 + e[6]! ** 2 + e[8]! ** 2 + e[9]! ** 2 + e[10]! ** 2);
        center.copy(sphere.center).applyMatrix4(matrix);
        corner.setScalar(radius);
        box.expandByPoint(point.copy(center).sub(corner));
        box.expandByPoint(point.copy(center).add(corner));
      }
      return box;
    };
    return !bounds(previous).equals(bounds(next));
  } finally { shape.dispose(); }
}
