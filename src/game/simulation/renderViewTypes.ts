// Render-facing projected view types. Split out of `types.ts` to keep that
// file under the 500-LOC budget. These describe what the renderer is handed
// each frame; they are derived presentation shapes, never persisted state.

import type { ProjectedEntityView, UnitComponent } from './types';

// One unit death, as surfaced to the render layer (v0.1.129 death feedback).
// Emitted at the sim's destroyUnitEntity chokepoint and fog-filtered per
// viewing player before it reaches a frame, because present→absent diffing on
// the entity view cannot distinguish death from fog exit or garrisoning. x/y
// are the unit's PROJECTED (sub-cell fine) coordinates at death.
export interface ProjectedUnitDeathView {
  id: number;
  tick: number;
  x: number;
  y: number;
  owner: number;
  unitType: UnitComponent['unitType'];
  tint: number;
  size: number;
  // Players who could see the death cell AT THE MOMENT OF DEATH (captured
  // before the unit is destroyed and vision recomputed) — the cue is gated on
  // this, not current visibility: a kill in your fog never surfaces when you
  // later uncover the cell, and your own lone unit's death still shows even
  // though losing it re-fogs its cell the same tick.
  witnessedBy: number[];
}

// One projectile in flight, as surfaced to the render layer (spec §10.4).
// TRANSIENT render info derived from the authoritative in-flight slot: the
// renderer interpolates along origin->aim between launch and impact.
export interface ProjectedProjectileView {
  id: number;
  originX: number;
  originY: number;
  aimX: number;
  aimY: number;
  launchTick: number;
  impactTick: number;
  visual: 'arrow' | 'bolt' | 'stone' | 'boulder' | 'cannonball';
}

export interface ProjectedFrameView {
  tick: number;
  playerId: number;
  seed: string;
  mapWidth: number;
  mapHeight: number;
  visibleCells: number[];
  exploredCells: number[];
  // Deaths from the last DEATH_FEED_TICKS at cells this player can currently
  // see. TRANSIENT render info: never persisted (a load drops in-flight
  // animations), re-emitted naturally during replays.
  recentUnitDeaths: ProjectedUnitDeathView[];
  // Shots currently in the air over cells this player can see (spec §10.4).
  projectiles: ProjectedProjectileView[];
}

export interface RenderPositionFrame {
  tick: number;
  positions: Array<{ id: number; generation: number; x: number; y: number }>;
}

export interface RenderState {
  tick: number;
  entities: ProjectedEntityView[];
  frame: ProjectedFrameView | null;
  previousPositionFrame?: RenderPositionFrame | null;
}
