// The Natural ground's fog rim, sampled on the world canvas: shared by tests/browser/de-ground.spec.ts, which
// samples it in whichever tier the suite's rasteriser draws, and tests/browser/de-ground-full-blend.spec.ts, which
// samples the full blend on SwiftShader. How the rim is sampled is de-ground.spec.ts's header.
import type { Page } from '@playwright/test';

export interface RimReport {
  readonly cells: number;
  readonly points: number;
  readonly brightestUnexplored: number;
  readonly brightestAt: string;
  readonly knownCentreLuma: number[];
  readonly knownEdgeLuma: number[];
}

export async function sampleRim(page: Page): Promise<RimReport> {
  return page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const state = api.getRenderState();
    const frame = state.frame!;
    const width = frame.mapWidth;
    const height = frame.mapHeight;
    const explored = new Set(frame.exploredCells);
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
    const known = (x: number, y: number) => inMap(x, y) && explored.has(y * width + x);
    const occupied = new Set<number>();
    for (const entity of state.entities) {
      if (entity.layer === 'terrain') continue;
      const x0 = Math.floor(entity.x);
      const y0 = Math.floor(entity.y);
      for (let dy = 0; dy < Math.max(1, Math.ceil(entity.footprintHeight)); dy += 1) {
        for (let dx = 0; dx < Math.max(1, Math.ceil(entity.footprintWidth)); dx += 1) occupied.add((y0 + dy) * width + x0 + dx);
      }
    }
    const nearEntity = (cx: number, cy: number) => {
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (occupied.has((cy + dy) * width + cx + dx)) return true;
      return false;
    };
    const origin = api.worldToScreen(0, 0);
    const alongX = api.worldToScreen(1, 0);
    const alongY = api.worldToScreen(0, 1);
    const capture = api.captureWorldFrame();
    const image = new Image();
    image.src = capture.dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rect = document.querySelector('.voxel-world-canvas')!.getBoundingClientRect();
    const scale = image.width / rect.width;
    // A world point (x + u, y + v), u and v from the cell's corner; worldToScreen names cell centres.
    const pixelAt = (x: number, y: number, u: number, v: number): number[] | null => {
      const wx = x + u - 0.5;
      const wy = y + v - 0.5;
      const px = Math.round((origin.x + (alongX.x - origin.x) * wx + (alongY.x - origin.x) * wy - rect.left) * scale);
      const py = Math.round((origin.y + (alongX.y - origin.y) * wx + (alongY.y - origin.y) * wy - rect.top) * scale);
      if (px < 2 || py < 2 || px >= image.width - 2 || py >= image.height - 2) return null;
      const offset = (py * image.width + px) * 4;
      return [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!];
    };
    const luma = (rgb: number[]) => 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
    let cells = 0;
    let points = 0;
    let brightestUnexplored = 0;
    let brightestAt = 'none';
    const knownCentreLuma: number[] = [];
    const knownEdgeLuma: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (known(x, y) || nearEntity(x, y)) continue;
        let frontUnknown = true;
        for (let j = 0; j <= 3 && frontUnknown; j += 1) for (let i = 0; i <= 3; i += 1) if (known(x + i, y + j)) frontUnknown = false;
        if (!frontUnknown) continue;
        // Explored neighbours behind: across the west edge (x - 1) or the north edge (y - 1).
        const edges: Array<[number, number, (t: number) => [number, number]]> = [];
        if (known(x - 1, y)) edges.push([x - 1, y, (t) => [0.1, t]]);
        if (known(x, y - 1)) edges.push([x, y - 1, (t) => [t, 0.1]]);
        if (edges.length === 0) continue;
        const samples: Array<[number, number]> = [[0.5, 0.5]];
        for (const [, , at] of edges) for (const t of [0.3, 0.5, 0.7]) samples.push(at(t));
        const drawn = samples.map(([u, v]) => pixelAt(x, y, u, v));
        if (drawn.some((rgb) => rgb === null)) continue;
        cells += 1;
        drawn.forEach((rgb, index) => {
          points += 1;
          const brightest = Math.max(...rgb!);
          if (brightest > brightestUnexplored) {
            brightestUnexplored = brightest;
            brightestAt = `cell (${x}, ${y}) at (${samples[index]!.join(', ')}): ${rgb!.join(',')}`;
          }
        });
        // The known neighbour behind: lit at its centre, dark just short of the shared edge.
        for (const [kx, ky] of edges) {
          const centre = pixelAt(kx, ky, 0.5, 0.5);
          const edge = kx === x - 1 ? pixelAt(kx, ky, 0.94, 0.5) : pixelAt(kx, ky, 0.5, 0.94);
          if (centre && edge && !nearEntity(kx, ky)) {
            knownCentreLuma.push(luma(centre));
            knownEdgeLuma.push(luma(edge));
          }
        }
      }
    }
    return { cells, points, brightestUnexplored, brightestAt, knownCentreLuma, knownEdgeLuma };
  });
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}
