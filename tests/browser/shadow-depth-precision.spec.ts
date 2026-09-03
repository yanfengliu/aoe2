// The depth precision the cast-shadow level scheme is calibrated against.
//
// `SHADOW_LEVEL_STEP` is 0.002 world units, derived arithmetically as "roughly
// four depth steps" from the orthographic camera's 4000-unit range on a
// 24-BIT depth buffer. Nothing in the renderer asks for that: the context is
// requested with `{alpha, antialias, powerPreference}` and the depth size is
// whatever the device hands back. On a 16-bit buffer one quantum is 0.061
// world units — thirty times the separation — every shadow lands in one depth
// bucket, and overlapping shadows z-fight into exactly the stripes the level
// scheme exists to prevent. There is no error and no warning: it degrades into
// the artifact, on that device only, silently.
//
// So this asserts the number instead of assuming it. It reads the buffer the
// SCENE ACTUALLY DRAWS INTO, which is not necessarily the canvas: an art style
// with a stylized resolve pass renders the scene into an offscreen target
// first, and a Three render target's depth attachment is allocated
// independently of the canvas's. Reading `DEPTH_BITS` off the default
// framebuffer alone would answer a question nobody asked.
import { expect, test } from '@playwright/test';

/** Depth bits of every framebuffer the scene's draw calls target in one frame. */
async function measureSceneDepthBits(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const world = document.querySelector<HTMLCanvasElement>('.voxel-world-canvas')!;
    const gl = (world.getContext('webgl2') ?? world.getContext('webgl')) as WebGL2RenderingContext;
    const bindFramebuffer = gl.bindFramebuffer.bind(gl);
    let bound: WebGLFramebuffer | null = null;
    const targets = new Set<WebGLFramebuffer | null>();
    gl.bindFramebuffer = (target: number, framebuffer: WebGLFramebuffer | null) => {
      if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) bound = framebuffer;
      return bindFramebuffer(target, framebuffer);
    };
    const draws = ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const;
    const originals = new Map<string, unknown>();
    for (const name of draws) {
      const original = gl[name];
      if (typeof original !== 'function') continue;
      originals.set(name, original);
      const bound_ = (original as (...args: unknown[]) => unknown).bind(gl);
      (gl as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
        targets.add(bound);
        return bound_(...args);
      };
    }
    // Draw real frames: rAF is what the renderer presents on, and a paused
    // page still redraws, but only when something asks it to.
    window.__AOE2_TEST__!.setPaused(false);
    for (let index = 0; index < 12; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    window.__AOE2_TEST__!.setPaused(true);
    for (const [name, original] of originals) {
      (gl as unknown as Record<string, unknown>)[name] = original;
    }
    gl.bindFramebuffer = bindFramebuffer;

    const depthOf = (framebuffer: WebGLFramebuffer | null): number | null => {
      if (framebuffer === null) return gl.getParameter(gl.DEPTH_BITS) as number;
      bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      let bits: number | null = null;
      for (const attachment of [gl.DEPTH_ATTACHMENT, gl.DEPTH_STENCIL_ATTACHMENT]) {
        const type = gl.getFramebufferAttachmentParameter(
          gl.FRAMEBUFFER, attachment, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE,
        );
        if (type === gl.NONE) continue;
        bits = gl.getFramebufferAttachmentParameter(
          gl.FRAMEBUFFER, attachment, gl.FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE,
        ) as number;
        if (bits) break;
      }
      bindFramebuffer(gl.FRAMEBUFFER, null);
      return bits;
    };

    return {
      drewAnything: targets.size > 0,
      frames: window.__AOE2_TEST__!.getWorldRendererState().metrics.frames,
      canvasSize: { width: world.width, height: world.height },
      // One entry per framebuffer the scene's draws targeted.
      buffers: [...targets].map((framebuffer) => ({
        target: framebuffer === null ? 'default' : 'offscreen',
        depthBits: depthOf(framebuffer),
      })),
    };
  });
}

test.describe('cast-shadow depth precision', () => {
  test('every buffer the scene draws into resolves the shadow level step', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);

    const measured = await measureSceneDepthBits(page);
    // The measurement is worthless if nothing rendered — a hidden or
    // zero-sized canvas fires no animation frame and draws nothing, which
    // would otherwise pass this test by having no buffer to fault.
    expect(measured.canvasSize.width, JSON.stringify(measured)).toBeGreaterThan(1);
    expect(measured.canvasSize.height, JSON.stringify(measured)).toBeGreaterThan(1);
    expect(measured.drewAnything, JSON.stringify(measured)).toBe(true);
    expect(measured.buffers.length, JSON.stringify(measured)).toBeGreaterThan(0);

    for (const buffer of measured.buffers) {
      // 0.002 world units over the orthographic camera's 4000-unit range needs
      // about four quanta at 24 bits. At 16 it is a thirtieth of one quantum
      // and the whole scheme is below the noise floor.
      expect(
        buffer.depthBits,
        `the scene draws into a ${buffer.target} buffer with ${String(buffer.depthBits)} depth bits; `
        + 'SHADOW_LEVEL_STEP = 0.002 needs at least 24 to separate two shadows '
        + `(measured: ${JSON.stringify(measured)})`,
      ).toBeGreaterThanOrEqual(24);
    }
  });
});
