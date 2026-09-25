// The Natural style's ground mesh and its shader splice (src/rendering/voxel/aoeDeGround*.ts), without a GPU:
// the geometry sits where the voxel terrain's faces were, the ground shows only when the style asks and there is
// ground to draw, an unchanged frame uploads nothing, and the shader splices into Three's own Lambert program,
// failing by name if Three's chunks move. What the shader DRAWS is tests/browser/de-ground.spec.ts's.
import { DataTexture, ShaderLib } from 'three';
import { describe, expect, it } from 'vitest';

import { AoeDeGround, createDeGroundGeometry } from '../../src/rendering/voxel/aoeDeGround';
import type { DeGroundData } from '../../src/rendering/voxel/aoeDeGroundData';
import {
  bakeDeGroundDetail,
  bakeDeGroundMacro,
  DE_GROUND_DETAIL_SIZE,
  DE_GROUND_LAYERS,
  DE_GROUND_MACRO_SIZE,
} from '../../src/rendering/voxel/aoeDeGroundDetail';
import { spliceDeGroundShader, type DeGroundUniforms } from '../../src/rendering/voxel/aoeDeGroundShader';

function data(width: number, height: number, fill = 1): DeGroundData {
  const cells = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    cells[index * 4] = fill;
    cells[index * 4 + 3] = 255;
  }
  return { width, height, cells, fields: new Uint8Array(width * height * 4).fill(255) };
}

function uniformsOf(ground: AoeDeGround): DeGroundUniforms {
  return ground.mesh.material.userData.deGroundUniforms as DeGroundUniforms;
}

describe('Natural ground mesh', () => {
  it('lies where the voxel terrain\'s top face is, with the map edge\'s four sides below it', () => {
    const geometry = createDeGroundGeometry(12, 7);
    const box = geometry.boundingBox!;
    expect([box.min.x, box.min.y, box.min.z]).toEqual([0, -1, 0]);
    expect([box.max.x, box.max.y, box.max.z]).toEqual([12, 0, 7]);
    const normals = geometry.getAttribute('normal');
    const up = Array.from({ length: normals.count }, (_, i) => normals.getY(i)).filter((y) => y === 1).length;
    expect(up).toBe(4);
    expect(geometry.getIndex()!.count).toBe(30);
  });

  it('shows only when the style asks for it and there is ground to draw', () => {
    const ground = new AoeDeGround();
    expect(ground.visible).toBe(false);
    ground.setVisible(true);
    expect(ground.visible, 'no data yet').toBe(false);
    ground.update(data(4, 3));
    expect(ground.visible).toBe(true);
    ground.setVisible(false);
    expect(ground.visible).toBe(false);
    ground.update(data(4, 3));
    expect(ground.visible, 'data alone does not show a hidden ground').toBe(false);
    ground.dispose();
  });

  it('uploads a frame only when its bytes changed, and rebuilds for a new map size', () => {
    const ground = new AoeDeGround();
    ground.setVisible(true);
    ground.update(data(4, 3));
    const cells = uniformsOf(ground).deCells.value as DataTexture;
    const fields = uniformsOf(ground).deFields.value as DataTexture;
    const [cellVersion, fieldVersion] = [cells.version, fields.version];
    ground.update(data(4, 3));
    expect([cells.version, fields.version]).toEqual([cellVersion, fieldVersion]);

    const dimmed = data(4, 3);
    dimmed.fields[5 * 4] = 153;
    ground.update(dimmed);
    expect(cells.version).toBe(cellVersion);
    expect(fields.version).toBe(fieldVersion + 1);
    expect((fields.image.data as Uint8Array)[5 * 4]).toBe(153);

    ground.update(data(6, 5, 2));
    expect(uniformsOf(ground).deCells.value).not.toBe(cells);
    expect(ground.mesh.geometry.boundingBox!.max.x).toBe(6);
    ground.dispose();
  });

  it('draws the blend until told otherwise, and builds one program per tier', () => {
    const ground = new AoeDeGround();
    const material = ground.mesh.material;
    expect(ground.tier).toBe('blend');
    expect(material.defines?.DE_GROUND_SINGLE_SAMPLE).toBeUndefined();
    const blendKey = material.customProgramCacheKey();
    const version = material.version;
    ground.setTier('single-sample');
    expect(ground.tier).toBe('single-sample');
    expect(material.defines).toHaveProperty('DE_GROUND_SINGLE_SAMPLE');
    expect(material.customProgramCacheKey()).not.toBe(blendKey);
    expect(material.version, 'the program is rebuilt').toBe(version + 1);
    ground.setTier('single-sample');
    expect(material.version, 'the same tier again rebuilds nothing').toBe(version + 1);
    ground.setTier('blend');
    expect(material.defines?.DE_GROUND_SINGLE_SAMPLE).toBeUndefined();
    expect(material.customProgramCacheKey()).toBe(blendKey);
    ground.dispose();
  });

  it('bakes the same surface layers every time, each in its own colour family', () => {
    const detail = bakeDeGroundDetail();
    expect(detail.length).toBe(DE_GROUND_DETAIL_SIZE ** 2 * 4 * DE_GROUND_LAYERS.length);
    // Byte equality without a 1.5 MB structural diff (toEqual took three seconds of the unit suite).
    expect(Buffer.from(bakeDeGroundDetail()).equals(Buffer.from(detail))).toBe(true);
    expect(bakeDeGroundMacro().length).toBe(DE_GROUND_MACRO_SIZE ** 2 * 4);
    const mean = (layer: (typeof DE_GROUND_LAYERS)[number]) => {
      const start = DE_GROUND_LAYERS.indexOf(layer) * DE_GROUND_DETAIL_SIZE ** 2 * 4;
      const sum = [0, 0, 0];
      for (let offset = start; offset < start + DE_GROUND_DETAIL_SIZE ** 2 * 4; offset += 4) {
        for (let channel = 0; channel < 3; channel += 1) sum[channel]! += detail[offset + channel]!;
      }
      return sum.map((total) => total / DE_GROUND_DETAIL_SIZE ** 2);
    };
    for (const green of ['grass', 'forest', 'hill'] as const) {
      const [r, g, b] = mean(green);
      expect(g!, green).toBeGreaterThan(r!);
      expect(g!, green).toBeGreaterThan(b!);
    }
    const [wr, , wb] = mean('water');
    expect(wb!).toBeGreaterThan(wr!);
    for (const earth of ['sand', 'dirt'] as const) {
      const [r, g, b] = mean(earth);
      expect(r!, earth).toBeGreaterThan(g!);
      expect(g!, earth).toBeGreaterThan(b!);
    }
    expect(mean('forest')[1]!).toBeLessThan(mean('grass')[1]!);
  });
});

describe('Natural ground shader splice', () => {
  const uniforms = (): DeGroundUniforms => ({
    deCells: { value: null },
    deFields: { value: null },
    deDetail: { value: null },
    deMacro: { value: null },
    deMapSize: { value: { x: 1, y: 1 } },
  });

  it('splices into Three\'s own Lambert program and binds the ground\'s uniforms', () => {
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.lambert.vertexShader,
      fragmentShader: ShaderLib.lambert.fragmentShader,
    };
    const bound = uniforms();
    spliceDeGroundShader(shader as never, bound);
    expect(shader.vertexShader).toContain('vDeWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    expect(shader.fragmentShader).toContain('uniform sampler2DArray deDetail;');
    expect(shader.fragmentShader.indexOf('diffuseColor.rgb *= deGroundSample.rgb * deGroundSample.a;'))
      .toBeGreaterThan(shader.fragmentShader.indexOf('#include <color_fragment>'));
    expect((shader.uniforms as Record<string, unknown>).deFields).toBe(bound.deFields);
  });

  it('holds both tiers, and the single-sample tier reads one cell and one surface texel per fragment', () => {
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.lambert.vertexShader,
      fragmentShader: ShaderLib.lambert.fragmentShader,
    };
    spliceDeGroundShader(shader as never, uniforms());
    const source = shader.fragmentShader;
    const start = source.indexOf('#ifdef DE_GROUND_SINGLE_SAMPLE');
    const middle = source.indexOf('#else', start);
    const end = source.indexOf('#endif', middle);
    expect(start, 'the single-sample tier is compiled in only when its define is set').toBeGreaterThan(0);
    const single = source.slice(start, middle);
    const blend = source.slice(middle, end);
    // What the tier is for (aoeDeGroundTier.ts): on a CPU rasteriser every texture read is a routine call. The one
    // surface read is at an explicit mip level (explicit gradients cost SwiftShader far more), inside the loop that
    // a quad of unexplored fragments skips.
    expect(single.match(/\bdeDetail\b/g), 'surface reads in the single-sample tier').toHaveLength(1);
    expect(single).toMatch(/for \( int known = kind == 0 \? 0 : 1; known > 0; known -- \) \{\s*texel = textureLod\( deDetail,/);
    expect(single.match(/deCellAt\(/g), 'cell reads in the single-sample tier').toHaveLength(1);
    expect(single).not.toMatch(/for \( int j = 0; j < 3/);
    expect(blend.match(/deCellAt\(/g), 'the blend reads the 3x3 around the fragment').toHaveLength(1);
    expect(blend).toMatch(/for \( int j = 0; j < 3; j \+\+ \)/);
  });

  it('refuses by name a Lambert program whose chunks moved', () => {
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.lambert.vertexShader,
      fragmentShader: ShaderLib.lambert.fragmentShader.replace('#include <color_fragment>', ''),
    };
    expect(() => spliceDeGroundShader(shader as never, uniforms())).toThrow(
      /Lambert fragment shader at "#include <color_fragment>", which appears nowhere in it/,
    );
  });
});
