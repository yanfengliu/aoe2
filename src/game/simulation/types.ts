export type TerrainKind = 'grass' | 'forest' | 'water' | 'hill';

export interface TerrainComponent {
  kind: TerrainKind;
  buildable: boolean;
  elevation: number;
}

export interface RenderableComponent {
  kind: 'tile' | 'unit' | 'building';
  layer: 'terrain' | 'unit' | 'building';
  tint: number;
  size: number;
}

export interface UnitComponent {
  owner: number;
  unitType: 'villager' | 'scout';
}

export interface BuildingComponent {
  owner: number;
  buildingType: 'town-center';
}

export interface VelocityComponent {
  dx: number;
  dy: number;
}

export interface WanderBoundsComponent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ProjectedEntityView {
  kind: 'tile' | 'unit' | 'building';
  layer: 'terrain' | 'unit' | 'building';
  x: number;
  y: number;
  tint: number;
  size: number;
}

export interface ProjectedFrameView {
  tick: number;
}

export interface HudState {
  tick: number;
  entityCount: number;
  visibleEntities: number;
  tickDurationMs: number;
  fpsTarget: number;
  worldSize: string;
}
