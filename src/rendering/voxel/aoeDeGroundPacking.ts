// The textured ground's packed bytes for a frame, kept while what they are packed from has not changed.
//
// The bytes read the terrain cells, the buildings and the fog (aoeDeGroundData.ts). Within one tick those are the
// same objects from frame to frame, so the renderer packs once a tick and hands the kept bytes to every frame
// between. Whether they changed is asked of the SOURCES: the list's terrain and building views, in list order.
//
// A map has one terrain view per cell (14,400 on a 120x120 map), and until work 150 M2b every frame filtered the
// whole list for its sources and compared them one by one. When the list's two halves are known
// (projectedEntityLists.ts) the sources are the terrain half, which is the same array until a cell changes, followed
// by the other half's buildings: the cells are then compared as one object, and walked only when that object is new.
// The decision is the one a comparison of every source would make, whichever way a list is known: a list nobody
// remembered and a remembered one with the same views hit the same kept bytes.
import { knownProjectedEntityLists } from '../../game/simulation/projectedEntityLists';
import type { ProjectedEntityView, ProjectedFrameView } from '../../game/simulation/types';
import { packDeGround, type DeGroundData } from './aoeDeGroundData';

/** The views the ground is packed from, in list order, as `head` followed by `tail`. */
interface GroundSources {
  readonly head: readonly ProjectedEntityView[];
  readonly tail: readonly ProjectedEntityView[];
}

function groundSources(entities: readonly ProjectedEntityView[]): GroundSources {
  const lists = knownProjectedEntityLists(entities);
  if (lists) return { head: lists.terrain, tail: lists.others.filter((entity) => entity.layer === 'building') };
  return { head: entities.filter((entity) => entity.layer === 'terrain' || entity.layer === 'building'), tail: [] };
}

/** Whether two source lists hold the same views in the same order, however each is cut into head and tail. */
function sameGroundSources(a: GroundSources, b: GroundSources): boolean {
  const length = a.head.length + a.tail.length;
  if (length !== b.head.length + b.tail.length) return false;
  // The usual case: one terrain array for both, so only the few buildings after it are compared.
  const from = a.head === b.head ? a.head.length : 0;
  for (let index = from; index < length; index += 1) {
    const left = index < a.head.length ? a.head[index] : a.tail[index - a.head.length];
    const right = index < b.head.length ? b.head[index] : b.tail[index - b.head.length];
    if (left !== right) return false;
  }
  return true;
}

/** Packs the ground for a frame, or hands back the last packing when nothing it read has changed. */
export class KeptDeGroundPacking {
  private kept: {
    readonly frame: ProjectedFrameView;
    readonly exploredGround: number;
    readonly sources: GroundSources;
    readonly data: DeGroundData;
  } | null = null;

  /** `frame` null means no fog, and nothing is kept for it: the fog's object is what says a tick has not passed. */
  pack(entities: readonly ProjectedEntityView[], frame: ProjectedFrameView | null, exploredGround: number): DeGroundData {
    const sources = groundSources(entities);
    const kept = this.kept;
    if (kept && kept.frame === frame && kept.exploredGround === exploredGround
      && sameGroundSources(kept.sources, sources)) {
      return kept.data;
    }
    const data = packDeGround(entities, frame, exploredGround);
    this.kept = frame === null ? null : { frame, exploredGround, sources, data };
    return data;
  }
}
