// The Natural style's ground (spec §14.5; the de-look plan's step 2): one mesh, owned by AoE and drawn in the
// scene it lends the voxel runtime, in place of the voxel terrain chunks. The adapter leaves the chunks out of
// the snapshot while this is shown (a mesh laid over them z-fights, the plan's experiment E3). Picking never
// touches it: ground picks are analytic.
//
// The mesh is the map's top face at y = 0, where the voxel terrain's top face is, plus the four side faces the
// voxel slab shows at the map's edge (y from -1 to 0). Everything on it comes from the shader
// (aoeDeGroundShader.ts): the per-cell data changes with the fog every frame, the geometry only when the map
// size does. Nothing here animates, so a paused frame is the same frame.

import {
  BufferGeometry,
  ClampToEdgeWrapping,
  DataArrayTexture,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
} from 'three';

import type { DeGroundData } from './aoeDeGroundData';
import {
  DE_GROUND_DETAIL_SIZE,
  DE_GROUND_LAYERS,
  DE_GROUND_MACRO_SIZE,
  deGroundDetailBytes,
  deGroundMacroBytes,
} from './aoeDeGroundDetail';
import { DE_GROUND_PROGRAM_KEY, spliceDeGroundShader, type DeGroundUniforms } from './aoeDeGroundShader';

/** The map's top face and its four edge faces, in world units: a cell (x, z) spans [x, x+1] x [z, z+1]. */
export function createDeGroundGeometry(width: number, height: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const quad = (corners: readonly (readonly [number, number, number])[], normal: readonly [number, number, number]) => {
    const first = positions.length / 3;
    for (const corner of corners) {
      positions.push(...corner);
      normals.push(...normal);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  // Wound counter-clockwise seen from outside, so each face's front looks along its normal.
  quad([[0, 0, 0], [0, 0, height], [width, 0, height], [width, 0, 0]], [0, 1, 0]);
  quad([[0, -1, height], [width, -1, height], [width, 0, height], [0, 0, height]], [0, 0, 1]);
  quad([[width, -1, height], [width, -1, 0], [width, 0, 0], [width, 0, height]], [1, 0, 0]);
  quad([[width, -1, 0], [0, -1, 0], [0, 0, 0], [width, 0, 0]], [0, 0, -1]);
  quad([[0, -1, 0], [0, -1, height], [0, 0, height], [0, 0, 0]], [-1, 0, 0]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function detailTexture(): DataArrayTexture {
  const texture = new DataArrayTexture(
    deGroundDetailBytes(),
    DE_GROUND_DETAIL_SIZE,
    DE_GROUND_DETAIL_SIZE,
    DE_GROUND_LAYERS.length,
  );
  texture.format = RGBAFormat;
  texture.type = UnsignedByteType;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function macroTexture(): DataTexture {
  const texture = new DataTexture(deGroundMacroBytes(), DE_GROUND_MACRO_SIZE, DE_GROUND_MACRO_SIZE, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function cellTexture(data: DeGroundData): DataTexture {
  const texture = new DataTexture(data.cells.slice(), data.width, data.height, RGBAFormat, UnsignedByteType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function fogTexture(data: DeGroundData): DataTexture {
  const texture = new DataTexture(data.fog.slice(), data.width, data.height, RedFormat, UnsignedByteType);
  // A width that is not a multiple of four would otherwise be read with four-byte row padding.
  texture.unpackAlignment = 1;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

export class AoeDeGround {
  /** Added to the scene the runtime borrows; hidden while another ground draws. */
  readonly mesh: Mesh<BufferGeometry, MeshLambertMaterial>;
  private readonly uniforms: DeGroundUniforms;
  private readonly mapSize = new Vector2(1, 1);
  private detail: DataArrayTexture | null = null;
  private macro: DataTexture | null = null;
  private cells: DataTexture | null = null;
  private fog: DataTexture | null = null;
  private width = 0;
  private height = 0;
  /** Whether the style draws this ground; it shows once there is also ground to draw. */
  private shown = false;

  constructor() {
    const material = new MeshLambertMaterial({ color: 0xffffff });
    this.uniforms = {
      deCells: { value: null },
      deFog: { value: null },
      deDetail: { value: null },
      deMacro: { value: null },
      deMapSize: { value: this.mapSize },
    };
    material.onBeforeCompile = (shader) => spliceDeGroundShader(shader, this.uniforms);
    material.customProgramCacheKey = () => DE_GROUND_PROGRAM_KEY;
    // Read-only diagnostics: the textures the shader samples, so a test can see what the ground was given.
    material.userData.deGroundUniforms = this.uniforms;
    this.mesh = new Mesh(createDeGroundGeometry(1, 1), material);
    this.mesh.name = 'aoe2-de-ground';
    this.mesh.visible = false;
  }

  /** Whether the ground is in the picture. */
  get visible(): boolean {
    return this.mesh.visible;
  }

  /** Shows or hides the ground. The first show bakes the surface textures (85-91 ms on the development machine,
   *  2026-09-24). */
  setVisible(visible: boolean): void {
    if (visible && !this.detail) {
      this.detail = detailTexture();
      this.macro = macroTexture();
      this.uniforms.deDetail.value = this.detail;
      this.uniforms.deMacro.value = this.macro;
    }
    this.shown = visible;
    this.mesh.visible = visible && this.width > 0 && this.height > 0;
  }

  /** Takes this frame's cells and fog. Uploads only what changed. */
  update(data: DeGroundData): void {
    if (data.width !== this.width || data.height !== this.height || !this.cells || !this.fog) {
      this.cells?.dispose();
      this.fog?.dispose();
      this.cells = cellTexture(data);
      this.fog = fogTexture(data);
      this.uniforms.deCells.value = this.cells;
      this.uniforms.deFog.value = this.fog;
      this.mapSize.set(data.width, data.height);
      this.mesh.geometry.dispose();
      this.mesh.geometry = createDeGroundGeometry(data.width, data.height);
      this.width = data.width;
      this.height = data.height;
    } else {
      const cells = this.cells.image.data as Uint8Array;
      if (!sameBytes(cells, data.cells)) {
        cells.set(data.cells);
        this.cells.needsUpdate = true;
      }
      const fog = this.fog.image.data as Uint8Array;
      if (!sameBytes(fog, data.fog)) {
        fog.set(data.fog);
        this.fog.needsUpdate = true;
      }
    }
    this.mesh.visible = this.shown && data.width > 0 && data.height > 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.detail?.dispose();
    this.macro?.dispose();
    this.cells?.dispose();
    this.fog?.dispose();
    this.detail = null;
    this.macro = null;
    this.cells = null;
    this.fog = null;
  }
}
