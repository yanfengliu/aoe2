// Building entity renderer factored out of `GameScene.ts`. The scene
// previously held five private methods (`renderBuildingEntity`,
// `renderBuildingFoundation`, `renderConstructionPosts`,
// `renderCompletedBuildingBody`, `renderCompletedBuildingRoof`) totaling
// ~160 lines. They depended only on the `entityLayer` Graphics object
// plus the cell size constant — clean dep-bag for a factory extraction.
//
// Output shape: a single `renderBuildingEntity(entity, px, py)` that
// returns an optional `BuildingVisualState` (null for memory-buildings,
// which the scene drew without a visual-state record). The scene's
// existing buffer (`lastBuildingVisualStates`) collects those records
// for the browser-test assertions.

import Phaser from 'phaser';

import type { ProjectedEntityView } from '../../../game/simulation/types';

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
  // ghost-rendering path).
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

  function renderCompletedBuildingBody(
    px: number,
    py: number,
    widthPx: number,
    heightPx: number,
  ): void {
    const insetX = Math.max(5, widthPx * 0.14);
    const insetTop = Math.max(8, heightPx * 0.34);
    const insetBottom = Math.max(4, heightPx * 0.14);
    const bodyX = px + insetX;
    const bodyY = py + insetTop;
    const bodyWidth = Math.max(8, widthPx - insetX * 2);
    const bodyHeight = Math.max(8, heightPx - insetTop - insetBottom);

    entityLayer.fillStyle(0xf0d39a, 0.92);
    entityLayer.fillRoundedRect(bodyX, bodyY, bodyWidth, bodyHeight, 4);
    entityLayer.lineStyle(2, 0x5b4125, 0.9);
    entityLayer.strokeRoundedRect(bodyX, bodyY, bodyWidth, bodyHeight, 4);

    const doorWidth = Math.max(4, bodyWidth * 0.2);
    const doorHeight = Math.max(6, bodyHeight * 0.45);
    entityLayer.fillStyle(0x744d2d, 0.9);
    entityLayer.fillRoundedRect(
      bodyX + (bodyWidth - doorWidth) * 0.5,
      bodyY + bodyHeight - doorHeight,
      doorWidth,
      doorHeight,
      2,
    );
  }

  function renderCompletedBuildingRoof(
    px: number,
    py: number,
    widthPx: number,
    heightPx: number,
  ): void {
    const roofInset = Math.max(4, widthPx * 0.08);
    const roofBaseY = py + Math.max(10, heightPx * 0.38);
    const roofPeakY = py + Math.max(2, heightPx * 0.08);
    const leftX = px + roofInset;
    const rightX = px + widthPx - roofInset;
    const centerX = px + widthPx * 0.5;

    entityLayer.fillStyle(0x8d4f39, 0.96);
    entityLayer.fillTriangle(leftX, roofBaseY, centerX, roofPeakY, rightX, roofBaseY);
    entityLayer.lineStyle(2, 0x4c2418, 0.95);
    entityLayer.strokeTriangle(leftX, roofBaseY, centerX, roofPeakY, rightX, roofBaseY);
    entityLayer.lineStyle(1, 0xe7b07d, 0.65);
    entityLayer.lineBetween(centerX, roofPeakY + 1, centerX, roofBaseY - 2);
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
      // Memory buildings render as a flat tinted rectangle only — the detailed body
      // and roof layers would paint fully-opaque pixels over the ghost, so we skip
      // them and rely on the base fillAlpha to communicate "stale / last-seen".
    } else if (isConstruction) {
      renderBuildingFoundation(px, py, widthPx, heightPx);
      renderConstructionPosts(px, py, widthPx, heightPx);
      hasFoundationSlab = true;
      hasScaffoldPosts = true;
      hasConstructionIndicator = true;
    } else {
      renderCompletedBuildingBody(px, py, widthPx, heightPx);
      renderCompletedBuildingRoof(px, py, widthPx, heightPx);
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
