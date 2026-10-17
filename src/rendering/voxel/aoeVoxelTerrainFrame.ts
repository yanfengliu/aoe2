// The ground's share of a snapshot, kept between frames while what it is built from does not change (work 130).
//
// Two pieces come from the terrain cells and the fog: the voxel ground chunks that Moebius draws (the Natural style
// draws its own ground and leaves them out), and the decor and water detail on the cells the player can see now.
// Both used to be built from every cell on every presented frame. Within one tick the render state is the same
// object, so its frame and its terrain cells are too; across ticks the cells are new objects with equal contents, so
// the visible detail is compared field by field and rebuilt only when the visible ground really changed. The chunk
// drafts are rebuilt once a tick at most, and the adapter keeps a chunk's revision while its drafted cells are equal.
import type { ProjectedEntityView, ProjectedFrameView } from '../../game/simulation/types';
import { sameView } from './aoeVoxelEntityPrep';
import { shade, type VoxelPart } from './aoeVoxelRecipeTypes';
import {
  createTerrainDetailParts,
  draftTerrainChunks,
  terrainCells,
  type IsUnexplored,
  type TerrainCell,
  type TerrainChunkDraft,
} from './aoeVoxelTerrain';

/** Ground under fog: explored-but-unseen cells dimmed to the art style's
 *  level, and the cells the player has never explored named, so the terrain
 *  pipeline draws them black and never reads what they hold. */
function terrainWithVoxelFog(
  entities: readonly ProjectedEntityView[],
  frame: ProjectedFrameView | null,
  exploredGround: number,
): { readonly entities: readonly ProjectedEntityView[]; readonly isUnexplored?: IsUnexplored } {
  if (!frame) return { entities };
  const visible = new Set(frame.visibleCells);
  const explored = new Set(frame.exploredCells);
  const cellIndex = (x: number, y: number) => Math.floor(y) * frame.mapWidth + Math.floor(x);
  return {
    entities: entities.map((entity) => {
      if (entity.layer !== 'terrain') return entity;
      const index = cellIndex(entity.x, entity.y);
      if (visible.has(index) || !explored.has(index)) return entity;
      return { ...entity, tint: shade(entity.tint, exploredGround) };
    }),
    isUnexplored: (x, y) => !explored.has(cellIndex(x, y)),
  };
}

export interface VoxelGroundDraft {
  readonly cells: readonly TerrainCell[];
  readonly paletteSignature: string;
  readonly drafts: readonly TerrainChunkDraft[];
}

function sameObjects(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

function sameViews(a: readonly ProjectedEntityView[], b: readonly ProjectedEntityView[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (!sameView(a[index]!, b[index]!)) return false;
  return true;
}

export class AoeVoxelTerrainFrame {
  private ground: {
    readonly frame: ProjectedFrameView | null;
    readonly exploredGround: number;
    readonly terrain: readonly ProjectedEntityView[];
    readonly draft: VoxelGroundDraft;
  } | null = null;
  private detail: {
    readonly frame: ProjectedFrameView | null;
    readonly terrain: readonly ProjectedEntityView[];
    readonly visible: readonly ProjectedEntityView[];
    readonly shoreSurf: boolean;
    readonly parts: readonly VoxelPart[];
  } | null = null;
  private detailVersionValue = 0;

  /** Changes whenever `detailParts` hands back different parts. */
  get detailVersion(): number {
    return this.detailVersionValue;
  }

  reset(): void {
    this.ground = null;
    this.detail = null;
    this.detailVersionValue += 1;
  }

  /** The voxel ground's cells and chunk drafts for this frame's terrain and fog. */
  groundDraft(
    terrain: readonly ProjectedEntityView[],
    frame: ProjectedFrameView | null,
    exploredGround: number,
  ): VoxelGroundDraft {
    const kept = this.ground;
    if (kept && kept.frame === frame && frame !== null && kept.exploredGround === exploredGround
      && sameObjects(kept.terrain, terrain)) return kept.draft;
    const fogged = terrainWithVoxelFog(terrain, frame, exploredGround);
    const cells = terrainCells(fogged.entities, fogged.isUnexplored);
    const paletteSignature = [...new Set(cells.map((cell) => cell.tint))]
      .sort((a, b) => a - b)
      .join(',');
    const draft = { cells, paletteSignature, drafts: draftTerrainChunks(cells, paletteSignature) };
    this.ground = { frame, exploredGround, terrain, draft };
    return draft;
  }

  /** The decor and water detail of the cells the player can see now (every cell when there is no fog). */
  detailParts(
    terrain: readonly ProjectedEntityView[],
    frame: ProjectedFrameView | null,
    shoreSurf: boolean,
  ): readonly VoxelPart[] {
    const kept = this.detail;
    if (kept && kept.frame === frame && frame !== null && kept.shoreSurf === shoreSurf
      && sameObjects(kept.terrain, terrain)) return kept.parts;
    let visible = terrain;
    if (frame) {
      const seen = new Set(frame.visibleCells);
      visible = terrain.filter((entity) => seen.has(Math.floor(entity.y) * frame.mapWidth + Math.floor(entity.x)));
    }
    if (kept && kept.shoreSurf === shoreSurf && sameViews(kept.visible, visible)) {
      this.detail = { ...kept, frame, terrain };
      return kept.parts;
    }
    const parts = createTerrainDetailParts(visible, { shoreSurf });
    this.detail = { frame, terrain, visible, shoreSurf, parts };
    this.detailVersionValue += 1;
    return parts;
  }
}
