// The one primitive a cast shadow is drawn from: a flat triangle.
//
// Every other voxel part is a box, and a box can only ever be a parallelogram
// on the ground — which is why shadows used to be rectangles. A caster's real
// silhouette is a polygon, and a polygon tiles exactly with triangles and not
// with parallelograms, so the shadow lane gets its own geometry.
//
// FLAT, with no thickness and no side walls, and that matters. A shadow is a
// decal on the ground, but the first version of this was a prism like the
// slab it replaced: 0.036 tall, three vertical walls each. Two neighbouring
// pieces then stand their walls back to back along every SHARED edge, the
// translucent material blends both, and the tiling draws itself as a mesh of
// dark seam lines across every shadow in the scene — visible at the default
// zoom, worse the more pieces a silhouette has. A flat triangle has no wall
// to blend, so adjacent pieces meet on the rasteriser's own fill rule and
// cover each shared pixel exactly once.
//
// The footprint is the local triangle (0,0) (1,0) (0,1) in x/z, pivoted at
// the centre like the cube. With a part's `groundAxes` set to the world edge
// vectors `Q-P` and `R-P` and its centre at `(Q+R)/2`, the instance IS the
// world triangle `P Q R` — see `shadowTrianglePart`. The part's `height`
// scales a zero extent and so has no effect; it is kept positive because
// `makePart` refuses a degenerate one.
import type { GeometryResourceV1 } from 'voxel/core';

export const SHADOW_WEDGE_GEOMETRY_KEY = 'aoe2:geometry:shadow-wedge';

/** Local x/z of the three corners, at the pivot's own height. */
const CORNERS: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [0, 1]];

export function shadowWedgeGeometry(): GeometryResourceV1 {
  return {
    kind: 'geometry',
    key: SHADOW_WEDGE_GEOMETRY_KEY,
    incarnation: 1,
    revision: 1,
    topology: 'triangles',
    positions: new Float32Array(CORNERS.flatMap(([x, z]) => [x, 0.5, z])),
    normals: new Float32Array(CORNERS.flatMap(() => [0, 1, 0])),
    indices: new Uint16Array([0, 1, 2]),
    // Group-less geometry lets each instance batch select its own material.
    groups: [],
    // A zero-height bound would be exact but leaves nothing for a frustum
    // test to work with, so the bounds keep the unit cube's y span.
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
    pivot: { x: 0.5, y: 0.5, z: 0.5 },
  };
}
