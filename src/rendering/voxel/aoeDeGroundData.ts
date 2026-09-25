// What the Natural style's ground shader knows about each cell (spec §14.5; the de-look plan's step 2), packed
// into the two textures it samples. Pure: the same entities and fog give the same bytes, so nothing here can
// become simulation state, and a test can hold the fog rule without a GPU.
//
// FOG HONESTY. A cell the player has never explored packs as kind 0 and nothing else: no dirt, and no part in
// any neighbour's data. The shader draws kind 0 black and never blends a known cell toward it, so the picture
// cannot depend on what an unexplored cell holds (defect register, 2026-09-23: unexplored ground drawn at 12%
// showed every lake under a contrast stretch, and a colour blend read the true kind of an unexplored neighbour).
// tests/rendering/aoeDeGroundData.test.ts changes each unexplored cell to every other kind and requires the same
// bytes.

import type { ProjectedFrameView } from '../../game/simulation/renderViewTypes';
import type { ProjectedEntityView, TerrainKind } from '../../game/simulation/types';

/** The red channel of the cell texture. The shader reads the same numbers (aoeDeGroundShader.ts). */
export const DE_GROUND_KIND_CODE: Readonly<Record<TerrainKind, number>> = {
  grass: 1,
  forest: 2,
  hill: 3,
  water: 4,
};

/** A cell the player has never explored. */
export const DE_GROUND_UNEXPLORED = 0;

/** Dirt under a building's footprint, and on the ring of land cells around it. The shader thresholds the
 *  bilinear field of these at about half, so the dirt edge wanders around the ring cells' centres: roughly half
 *  a tile past the footprint, as Definitive Edition's building foundations spread. */
export const DE_GROUND_DIRT_FOOTPRINT = 255;
export const DE_GROUND_DIRT_RING = 115;

export interface DeGroundData {
  readonly width: number;
  readonly height: number;
  /** RGBA per cell, row-major from (0, 0): R the kind code, G dirt (0-255), B 0, A 255. Read unfiltered. */
  readonly cells: Uint8Array;
  /** RGBA per cell, row-major from (0, 0), read LINEARLY FILTERED, so each channel is a field that runs smoothly
   *  from one cell centre to the next:
   *  - R how bright the fog leaves the ground, 255 for visible. An unexplored cell holds the explored level, so
   *    linear filtering treats it as explored ground: a visible neighbour's outer half dims toward it as toward
   *    any explored cell, and nothing is lit by it. The darkening toward black is the shader's own.
   *  - G 255 where the cell is known, 0 where it is unexplored.
   *  - B the cell's dirt, the same byte as the cell texture's G.
   *  - A 255 where the cell is known water.
   *  The blend reads R alone. The single-sample tier (aoeDeGroundTier.ts) reads G, B and A in place of the 3x3
   *  of cells the blend reads, so the fog rule holds for them as for the cells: nothing in them depends on
   *  what an unexplored cell holds. */
  readonly fields: Uint8Array;
}

function requireCell(entity: ProjectedEntityView, width: number, height: number): { x: number; y: number } {
  const { x, y } = entity;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
    throw new RangeError(
      `Terrain cell (${String(x)}, ${String(y)}) is not a whole cell inside the ${String(width)}x${String(height)} `
      + 'map the frame names, so the Natural ground cannot place it.',
    );
  }
  return { x, y };
}

function mapSize(
  entities: readonly ProjectedEntityView[],
  frame: ProjectedFrameView | null,
): { width: number; height: number } {
  if (frame) return { width: frame.mapWidth, height: frame.mapHeight };
  let width = 0;
  let height = 0;
  for (const entity of entities) {
    if (entity.layer !== 'terrain') continue;
    width = Math.max(width, Math.floor(entity.x) + 1);
    height = Math.max(height, Math.floor(entity.y) + 1);
  }
  return { width, height };
}

/**
 * Packs the ground for one frame. `frame` null means no fog: every cell is known and visible.
 * `exploredGround` is the art style's brightness for explored-but-unseen ground, from 0 to 1.
 */
export function packDeGround(
  entities: readonly ProjectedEntityView[],
  frame: ProjectedFrameView | null,
  exploredGround: number,
): DeGroundData {
  if (!Number.isFinite(exploredGround) || exploredGround < 0 || exploredGround > 1) {
    throw new RangeError(`Explored ground brightness must be a number from 0 to 1; got ${String(exploredGround)}.`);
  }
  const { width, height } = mapSize(entities, frame);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 0 || height < 0) {
    throw new RangeError(`The map must be a whole number of cells across; got ${String(width)}x${String(height)}.`);
  }
  const count = width * height;
  const cells = new Uint8Array(count * 4);
  const fields = new Uint8Array(count * 4);
  const explored = frame ? new Set(frame.exploredCells) : null;
  const visible = frame ? new Set(frame.visibleCells) : null;
  const known = (index: number): boolean => explored === null || explored.has(index);
  const exploredByte = Math.round(exploredGround * 255);

  for (let index = 0; index < count; index += 1) {
    cells[index * 4 + 3] = 255;
    fields[index * 4] = visible === null || visible.has(index) ? 255 : exploredByte;
  }
  for (const entity of entities) {
    if (entity.layer !== 'terrain') continue;
    const { x, y } = requireCell(entity, width, height);
    const index = y * width + x;
    if (!known(index)) continue;
    const code = DE_GROUND_KIND_CODE[entity.entityType as TerrainKind];
    if (code === undefined) {
      throw new RangeError(
        `Terrain cell (${String(x)}, ${String(y)}) has kind "${entity.entityType}", which the Natural ground does not `
        + `draw; it draws ${Object.keys(DE_GROUND_KIND_CODE).join(', ')}. A new kind needs a code here and a surface `
        + 'in aoeDeGroundShader.ts.',
      );
    }
    cells[index * 4] = code;
    fields[index * 4 + 1] = 255;
    if (code === DE_GROUND_KIND_CODE.water) fields[index * 4 + 3] = 255;
  }
  // Dirt: every building the player knows of (live and visible, or remembered) marks its footprint and the ring
  // of cells around it. Water keeps none (a Dock stands on water), and neither does an unexplored cell. A
  // building with no explored cell under it lays nothing, so its ring cannot mark known ground beside it: the
  // bridge never projects such a building, and this does not rely on that.
  const dirt = (x: number, y: number, amount: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    const code = cells[offset]!;
    if (code === DE_GROUND_UNEXPLORED || code === DE_GROUND_KIND_CODE.water) return;
    cells[offset + 1] = Math.max(cells[offset + 1]!, amount);
  };
  for (const entity of entities) {
    if (entity.layer !== 'building') continue;
    const x0 = Math.floor(entity.x);
    const y0 = Math.floor(entity.y);
    const w = Math.max(1, Math.round(entity.footprintWidth));
    const h = Math.max(1, Math.round(entity.footprintHeight));
    let standsOnKnownGround = false;
    for (let y = Math.max(0, y0); y < Math.min(height, y0 + h) && !standsOnKnownGround; y += 1) {
      for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x += 1) {
        if (known(y * width + x)) standsOnKnownGround = true;
      }
    }
    if (!standsOnKnownGround) continue;
    for (let y = y0 - 1; y <= y0 + h; y += 1) {
      for (let x = x0 - 1; x <= x0 + w; x += 1) {
        const inside = x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
        dirt(x, y, inside ? DE_GROUND_DIRT_FOOTPRINT : DE_GROUND_DIRT_RING);
      }
    }
  }
  for (let index = 0; index < count; index += 1) fields[index * 4 + 2] = cells[index * 4 + 1]!;
  return { width, height, cells, fields };
}
