// @vitest-environment jsdom
//
// The art style is a player setting (spec §14.5). The renderer owns the four things a style changes: the
// resolve pass, the WebGL renderer's tone curve, how bright explored ground is, and what draws the ground. A
// live switch must change all four and rebuild nothing. Split from AoeVoxelWorldRenderer.test.ts at the
// 500-line cap when the ground joined them.

import {
  ACESFilmicToneMapping,
  Mesh,
  NoToneMapping,
  type BufferGeometry,
  type DataTexture,
  type MeshLambertMaterial,
  type ToneMapping,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaletteResourceV1, RenderSnapshotV1 } from 'voxel/core';
import type { ThreeRenderRuntimeOptions } from 'voxel/three';

import { artStyleById, DEFAULT_ART_STYLE_ID, MOEBIUS_RESOLVE } from '../../src/rendering/artStyles';
import type { DeGroundUniforms } from '../../src/rendering/voxel/aoeDeGroundShader';
import type { AoeVoxelOverlayInput } from '../../src/rendering/voxel/aoeVoxelOverlayParts';
import {
  AoeVoxelWorldRenderer,
  type ToneMappedRenderer,
} from '../../src/rendering/voxel/AoeVoxelWorldRenderer';
import { FakeRuntime, terrain } from './helpers/fakeVoxelRuntime';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('AoeVoxelWorldRenderer art style', () => {
  function fakeWebGLRenderer(): ToneMappedRenderer {
    return {
      domElement: { width: 320, height: 200 },
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      getSize: (target) => target,
      getPixelRatio: () => 1,
      dispose: vi.fn(),
      toneMapping: -1 as ToneMapping,
      toneMappingExposure: -1,
    };
  }

  // Builds a renderer and plays the runtime's part: a real ThreeRenderRuntime
  // calls `rendererFactory` once, while it is being constructed.
  function build(artStyleId?: 'moebius' | 'de') {
    const runtime = new FakeRuntime();
    let seen: ThreeRenderRuntimeOptions | null = null;
    const renderer = new AoeVoxelWorldRenderer({
      host: document.createElement('div'),
      width: 320,
      height: 200,
      ...(artStyleId ? { artStyleId } : {}),
      createRuntime: (options) => { seen = options; return runtime; },
      createWebGLRenderer: fakeWebGLRenderer,
    });
    const webgl = seen!.rendererFactory!({}) as ToneMappedRenderer;
    return { runtime, renderer, options: seen!, webgl };
  }

  // The textured ground in the scene the runtime was lent, and the data it was last given.
  function groundMesh(options: ThreeRenderRuntimeOptions): Mesh<BufferGeometry, MeshLambertMaterial> {
    const mesh = options.scene?.getObjectByName('aoe2-de-ground');
    if (!(mesh instanceof Mesh)) throw new Error('The runtime was not lent a scene holding aoe2-de-ground.');
    return mesh as Mesh<BufferGeometry, MeshLambertMaterial>;
  }
  function groundData(options: ThreeRenderRuntimeOptions): { cells: Uint8Array; fog: Uint8Array } {
    const uniforms = groundMesh(options).material.userData.deGroundUniforms as DeGroundUniforms;
    return {
      cells: (uniforms.deCells.value as DataTexture).image.data as Uint8Array,
      fog: (uniforms.deFog.value as DataTexture).image.data as Uint8Array,
    };
  }

  // Cell 0 is explored and not visible; cell 1 is visible.
  const fogOverlays: AoeVoxelOverlayInput = {
    frame: {
      tick: 1,
      playerId: 1,
      seed: 'art-style',
      mapWidth: 2,
      mapHeight: 1,
      visibleCells: [1],
      exploredCells: [0, 1],
      recentUnitDeaths: [],
      projectiles: [],
    },
    placementPreview: null,
    selectionPreviewEntityIds: [],
  };
  const exploredGroundLuma = (snapshot: RenderSnapshotV1): number => {
    const chunk = snapshot.chunks[0]!;
    const palette = snapshot.resources.find(
      (resource): resource is PaletteResourceV1 => resource.kind === 'palette',
    )!;
    const { r, g, b } = palette.entries[(chunk.voxels as Uint16Array)[0]!]!.color;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('draws Moebius through its tuned pass with no tone curve', () => {
    const { renderer, options, webgl } = build('moebius');
    expect(options.stylizedResolve).toBe(MOEBIUS_RESOLVE);
    expect(webgl.toneMapping).toBe(NoToneMapping);
    expect(webgl.toneMappingExposure).toBe(1);
    expect(renderer.artStyleId()).toBe('moebius');
    expect(renderer.state().artStyle).toBe('moebius');
    renderer.dispose();
  });

  it('asks for no pass at all in the DE style, and tone-maps with ACES', () => {
    // No pass rather than a pass configured to do nothing, which would still
    // cost a second scene render every frame.
    const { renderer, options, webgl } = build('de');
    expect(options.stylizedResolve).toBeUndefined();
    expect(webgl.toneMapping).toBe(ACESFilmicToneMapping);
    expect(webgl.toneMappingExposure).toBeCloseTo(artStyleById('de').exposure, 10);
    expect(renderer.state().artStyle).toBe('de');
    renderer.dispose();
  });

  it('switches every part of the look live, without rebuilding the world', () => {
    const { runtime, renderer, webgl } = build('moebius');

    renderer.setArtStyle('de');
    expect(renderer.artStyleId()).toBe('de');
    expect(runtime.setStylizedResolve).toHaveBeenLastCalledWith(null);
    expect(webgl.toneMapping).toBe(ACESFilmicToneMapping);
    expect(webgl.toneMappingExposure).toBeCloseTo(1.5, 10);
    // Switching the look must not touch voxel content by itself.
    expect(runtime.acceptSnapshot).not.toHaveBeenCalled();

    renderer.setArtStyle('moebius');
    expect(runtime.setStylizedResolve).toHaveBeenLastCalledWith(MOEBIUS_RESOLVE);
    expect(webgl.toneMapping).toBe(NoToneMapping);
    expect(webgl.toneMappingExposure).toBe(1);
    renderer.dispose();
  });

  it('dims explored ground to the new style\'s level from the next snapshot', () => {
    // Moebius dims the voxel palette's tint. The Natural style's snapshot carries no terrain at all: it hands
    // its level to the textured ground's fog data.
    const { runtime, renderer, options } = build('moebius');
    const ground = [terrain(), { ...terrain(), id: 2, x: 1 }];
    const allVisible = { ...fogOverlays, frame: { ...fogOverlays.frame!, visibleCells: [0, 1] } };

    renderer.present(ground, 100, allVisible);
    const lit = exploredGroundLuma(runtime.accepted.at(-1)!);
    renderer.present(ground, 100, fogOverlays);
    const dimmed = exploredGroundLuma(runtime.accepted.at(-1)!);
    expect(dimmed / lit).toBeCloseTo(artStyleById('moebius').exploredGround, 1);

    renderer.setArtStyle('de');
    renderer.present(ground, 100, fogOverlays);
    expect(runtime.accepted.at(-1)!.chunks).toEqual([]);
    const fog = groundData(options).fog;
    expect(fog[0]).toBe(Math.round(artStyleById('de').exploredGround * 255));
    expect(fog[1]).toBe(255);
    renderer.dispose();
  });

  it('draws one ground at a time: voxel chunks in Moebius, the textured ground in the Natural style', () => {
    // Both at once z-fight (the de-look plan's experiment E3), so a switch trades one for the other in the
    // next snapshot. The runtime draws AoE's scene, which holds the ground mesh.
    const { runtime, renderer, options } = build('de');
    const ground = [terrain(), { ...terrain(), id: 2, x: 1 }];
    expect(options.scene?.getObjectByName('aoe2-de-ground')).toBeDefined();

    renderer.present(ground, 100, fogOverlays);
    expect(runtime.accepted.at(-1)!.chunks).toEqual([]);
    expect(groundMesh(options).visible).toBe(true);
    expect(renderer.state().ground).toBe('textured');

    renderer.setArtStyle('moebius');
    expect(groundMesh(options).visible).toBe(false);
    renderer.present(ground, 200, fogOverlays);
    const chunks = runtime.accepted.at(-1)!.chunks;
    expect(chunks.length).toBeGreaterThan(0);
    expect(renderer.state().ground).toBe('voxel');

    renderer.setArtStyle('de');
    renderer.present(ground, 300, fogOverlays);
    expect(runtime.accepted.at(-1)!.chunks).toEqual([]);
    expect(groundMesh(options).visible).toBe(true);

    // Back to Moebius: the chunks return as new incarnations, as voxel requires of a key it retired.
    renderer.setArtStyle('moebius');
    renderer.present(ground, 400, fogOverlays);
    const returned = runtime.accepted.at(-1)!.chunks;
    expect(returned.map((chunk) => chunk.key)).toEqual(chunks.map((chunk) => chunk.key));
    expect(returned[0]!.incarnation).toBe(chunks[0]!.incarnation + 1);
    // The ground goes before the runtime, whose disposal takes the WebGL renderer that could free its textures.
    let groundGoneFirst = false;
    runtime.dispose.mockImplementation(() => {
      groundGoneFirst = options.scene?.getObjectByName('aoe2-de-ground') === undefined;
    });
    renderer.dispose();
    expect(groundGoneFirst).toBe(true);
  });

  it('keeps drawing the old style when the runtime refuses the new pass', () => {
    // Voxel keeps the old pass drawing when a swap throws, so the renderer
    // must not record, tone-map, re-fog or swap the ground for a style the
    // canvas is not in.
    const { runtime, renderer, webgl, options } = build('de');
    const ground = [terrain(), { ...terrain(), id: 2, x: 1 }];
    renderer.present(ground, 100, fogOverlays);
    runtime.setStylizedResolve.mockImplementationOnce(() => { throw new Error('refused'); });

    expect(() => renderer.setArtStyle('moebius')).toThrow('refused');
    expect(renderer.artStyleId()).toBe('de');
    expect(webgl.toneMapping).toBe(ACESFilmicToneMapping);
    expect(groundMesh(options).visible).toBe(true);
    renderer.present(ground, 200, fogOverlays);
    expect(runtime.accepted.at(-1)!.chunks).toEqual([]);
    expect(groundData(options).fog[0]).toBe(Math.round(artStyleById('de').exploredGround * 255));
    renderer.dispose();
  });

  it('opens in the stored style when none is passed', () => {
    window.localStorage.setItem('aoe2:art-style', 'de');
    try {
      const { renderer, options } = build();
      expect(renderer.artStyleId()).toBe('de');
      expect(options.stylizedResolve).toBeUndefined();
      renderer.dispose();
    } finally {
      window.localStorage.removeItem('aoe2:art-style');
    }
    const { renderer } = build();
    expect(renderer.artStyleId()).toBe(DEFAULT_ART_STYLE_ID);
    renderer.dispose();
  });
});
