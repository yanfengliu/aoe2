// Building entity renderer factored out of `GameScene.ts`.
//
// M7 building-visuals slice 1: completed buildings used to draw ONE generic
// body rect + roof triangle regardless of type. They now draw a READABLE
// PER-ROLE procedural silhouette (`buildingRole` → `drawBuildingSilhouette`),
// the building analogue of the v0.1.41 per-role unit silhouettes — so a Town
// Center, House, Castle, Wonder, Mill, Tower, Wall, Farm, … are distinguishable
// at a glance. Body fill = owner `tint`; details = a darkened tint. Pure
// per-frame draw (no random/time); every primitive stays inside the footprint
// rect so HP-bar / selection / footprint geometry is unchanged.
//
// The construction (foundation slab + scaffold posts) and memory (flat ghost)
// paths are role-AGNOSTIC and unchanged — a building under construction or a
// last-seen ghost reads the same for every type by design. Deferred (M7):
// per-building (vs per-role) silhouettes, a construction→complete progress
// fill, rubble/damage states, per-civ architecture.
//
// Output shape: a single `renderBuildingEntity(entity, px, py)` that returns an
// optional `BuildingVisualState` (null for memory buildings + non-buildings).
// The scene's existing buffer (`lastBuildingVisualStates`) collects those
// records for the browser-test assertions; the boolean flags below preserve the
// pre-slice contract (completed → body/roof/completion; construction →
// foundation/scaffold/construction).

import Phaser from 'phaser';

import type { BuildingType, ProjectedEntityView } from '../../../game/simulation/types';
import { buildingRole } from './buildingRole';
import { darken, drawBuildingSilhouette } from './buildingSilhouettes';

// Re-exported from GameScene.ts for backward compatibility — moving the
// type here would force every existing import to update. The shape is
// owned by this module now; GameScene's interface alias forwards.
export interface BuildingRendererVisualState {
  id: number;
  buildingType: ProjectedEntityView['entityType'];
  owner: number | null;
  cellX: number;
  cellY: number;
  footprintWidthCells: number;
  footprintHeightCells: number;
  widthPx: number;
  heightPx: number;
  visualVariant: ProjectedEntityView['visualVariant'];
  hasFoundationSlab: boolean;
  hasScaffoldPosts: boolean;
  hasStructureBody: boolean;
  hasRoofAccent: boolean;
  hasConstructionIndicator: boolean;
  hasCompletionAccent: boolean;
}

export interface BuildingRendererDeps {
  entityLayer: Phaser.GameObjects.Graphics;
  cellSize: number;
}

export interface BuildingRenderer {
  // Paint the building entity at (px, py). Returns a visual-state
  // record for non-memory buildings so the scene can stash it for
  // browser-test assertions; returns null for memory buildings (the
  // ghost-rendering path) and non-building entities.
  renderBuildingEntity(
    entity: ProjectedEntityView,
    px: number,
    py: number,
  ): BuildingRendererVisualState | null;
}

export function createBuildingRenderer(deps: BuildingRendererDeps): BuildingRenderer {
  const { entityLayer, cellSize } = deps;

  function renderBuildingFoundation(
    px: number,
    py: number,
    widthPx: number,
    heightPx: number,
  ): void {
    const inset = 4;
    const slabX = px + inset;
    const slabY = py + inset;
    const slabWidth = Math.max(8, widthPx - inset * 2);
    const slabHeight = Math.max(8, heightPx - inset * 2);

    entityLayer.fillStyle(0xc8bea8, 0.92);
    entityLayer.fillRoundedRect(slabX, slabY, slabWidth, slabHeight, 3);
    entityLayer.lineStyle(2, 0x6a6257, 0.95);
    entityLayer.strokeRoundedRect(slabX, slabY, slabWidth, slabHeight, 3);

    entityLayer.lineStyle(1, 0xece4d2, 0.7);
    entityLayer.lineBetween(
      slabX + slabWidth * 0.5,
      slabY + 2,
      slabX + slabWidth * 0.5,
      slabY + slabHeight - 2,
    );
    entityLayer.lineBetween(
      slabX + 2,
      slabY + slabHeight * 0.5,
      slabX + slabWidth - 2,
      slabY + slabHeight * 0.5,
    );
  }

  function renderConstructionPosts(
    px: number,
    py: number,
    widthPx: number,
    heightPx: number,
  ): void {
    const postInset = 5;
    const postHeight = Math.max(8, Math.min(16, heightPx * 0.45));
    const topY = py + postInset;
    const bottomY = topY + postHeight;
    const leftX = px + postInset;
    const rightX = px + widthPx - postInset;

    entityLayer.lineStyle(2, 0x8d6c49, 0.95);
    entityLayer.lineBetween(leftX, topY, leftX, bottomY);
    entityLayer.lineBetween(rightX, topY, rightX, bottomY);
    entityLayer.lineBetween(leftX, topY, rightX, topY);
    entityLayer.lineStyle(2, 0xf5e9cf, 0.8);
    entityLayer.lineBetween(leftX, bottomY, rightX, topY);
    entityLayer.lineBetween(leftX, topY, rightX, bottomY);
  }

  function renderBuildingEntity(
    entity: ProjectedEntityView,
    px: number,
    py: number,
  ): BuildingRendererVisualState | null {
    if (entity.kind !== 'building') {
      return null;
    }

    const widthPx = entity.footprintWidth * cellSize;
    const heightPx = entity.footprintHeight * cellSize;
    const isConstruction = entity.visualVariant === 'construction';
    // Memory buildings are last-seen snapshots drawn at half opacity to cue the
    // player that the information may be stale.
    const baseFillAlpha = isConstruction ? 0.62 : 1;
    const fillAlpha = entity.isMemory ? baseFillAlpha * 0.5 : baseFillAlpha;
    const strokeAlpha = entity.isMemory ? 0.5 : 0.98;

    entityLayer.lineStyle(3, isConstruction ? 0xf7e6c3 : 0x2b2117, strokeAlpha);
    entityLayer.fillStyle(entity.tint, fillAlpha);
    entityLayer.fillRoundedRect(px, py, widthPx, heightPx, 6);
    entityLayer.strokeRoundedRect(px, py, widthPx, heightPx, 6);

    let hasFoundationSlab = false;
    let hasScaffoldPosts = false;
    let hasStructureBody = false;
    let hasRoofAccent = false;
    let hasConstructionIndicator = false;
    let hasCompletionAccent = false;

    if (entity.isMemory) {
      // Memory buildings render as a flat tinted rectangle only — the detailed
      // silhouette would paint fully-opaque pixels over the ghost, so we skip it
      // and rely on the base fillAlpha to communicate "stale / last-seen".
    } else if (isConstruction) {
      renderBuildingFoundation(px, py, widthPx, heightPx);
      renderConstructionPosts(px, py, widthPx, heightPx);
      hasFoundationSlab = true;
      hasScaffoldPosts = true;
      hasConstructionIndicator = true;
    } else {
      // Completed building: a readable per-role silhouette inside the footprint
      // rect. The flags below stay semantically "drew a completed structure with
      // a top accent" so the browser-test contract (house/TC) is preserved
      // across every role.
      drawBuildingSilhouette(buildingRole(entity.entityType as BuildingType), {
        g: entityLayer,
        x: px,
        y: py,
        w: widthPx,
        h: heightPx,
        tint: entity.tint,
        outline: darken(entity.tint, 0.55),
        fillAlpha,
        outlineAlpha: Math.min(1, fillAlpha),
      });
      hasStructureBody = true;
      hasRoofAccent = true;
      hasCompletionAccent = true;
    }

    if (entity.isMemory) {
      // Memory buildings do not contribute to visual-state test assertions — they
      // are ghosts of buildings the player has not confirmed still exist.
      return null;
    }

    return {
      id: entity.id,
      buildingType: entity.entityType,
      owner: entity.owner,
      cellX: entity.x,
      cellY: entity.y,
      footprintWidthCells: entity.footprintWidth,
      footprintHeightCells: entity.footprintHeight,
      widthPx,
      heightPx,
      visualVariant: entity.visualVariant,
      hasFoundationSlab,
      hasScaffoldPosts,
      hasStructureBody,
      hasRoofAccent,
      hasConstructionIndicator,
      hasCompletionAccent,
    };
  }

  return { renderBuildingEntity };
}
