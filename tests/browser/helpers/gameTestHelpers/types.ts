import type { SelectionBoxState } from '../../../../src/rendering/viewTypes';

export interface MinimapStats {
  width: number;
  height: number;
  nonBackgroundPixelCount: number;
}

export interface MinimapViewportState {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export type SelectionBoxPreviewState = SelectionBoxState;

export interface HudChipRect {
  left: number;
  width: number;
}

export interface DisplayedEntityState {
  id: number;
  kind: 'tile' | 'unit' | 'building' | 'resource';
  entityType: string;
  owner: number | null;
  x: number;
  y: number;
}

export interface RenderedUnitState {
  id: number;
  owner: number | null;
  unitType: string;
  x: number;
  y: number;
  size: number;
}

export interface RenderedEntityStateWithSize {
  id: number;
  kind: 'unit' | 'resource' | 'building' | 'tile';
  entityType: string;
  owner: number | null;
  x: number;
  y: number;
  size: number;
}
