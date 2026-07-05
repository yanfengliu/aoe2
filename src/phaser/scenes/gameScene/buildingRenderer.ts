// Building entity renderer factored out of `GameScene.ts`.
//
// M7 isometric overhaul increment 6: a completed building draws as a 3/4-view
// ISO VOLUME — its footprint diamond (the four cell corners projected via
// worldToIso) extruded up by a per-role height into a solid box with a lit + a
// shadowed wall face and an owner-tinted roof (`isoBuilding.drawIsoBuilding`),
// then the role's roof accent (`buildingRoofAccents` — a Wonder dome, Monastery
// cross, Castle/Tower/Wall merlons, Barracks banner, Mill blades, Town Center
// turret) so every type still reads distinctly. Construction draws a low stub of
// the volume; a last-seen memory ghost is the flat footprint diamond at half
// alpha. Pure per-frame draw (no random/time). Deferred: per-building facades,
// a construction→complete progress fill, rubble/damage, per-civ architecture.
//
// Output shape: a single `renderBuildingEntity(entity, px, py)` that returns an
// optional `BuildingVisualState` (null for memory buildings + non-buildings).
// The scene's `lastBuildingVisualStates` buffer collects those records for the
// browser-test assertions; the boolean flags preserve the pre-iso contract
// (completed → body/roof/completion; construction → foundation/scaffold/
// construction). The render loop's px/py anchor is unused here — the iso volume
// is positioned from the cell coords directly.

import Phaser from 'phaser';

import type { BuildingType, ProjectedEntityView } from '../../../game/simulation/types';
import { buildingRole } from './buildingRole';
import { drawBuildingRoofAccent } from './buildingRoofAccents';
import { darken, drawIsoBuilding, isoBuildingHeightPx, type FootprintDiamond } from './isoBuilding';
import { worldToIso } from './isoProjection';

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

  // Footprint diamond in camera-world (iso-pixel) space — the building's four
  // cell corners projected. The entity layer draws in this space, so we compute
  // it straight from the cell coords; the render loop's px/py (a unit-style
  // anchor) is unused for the extruded iso volume.
  function footprintDiamond(entity: ProjectedEntityView): FootprintDiamond {
    return {
      top: worldToIso(entity.x, entity.y),
      right: worldToIso(entity.x + entity.footprintWidth, entity.y),
      bottom: worldToIso(entity.x + entity.footprintWidth, entity.y + entity.footprintHeight),
      left: worldToIso(entity.x, entity.y + entity.footprintHeight),
    };
  }

  function renderBuildingEntity(
    entity: ProjectedEntityView,
    px: number,
    py: number,
  ): BuildingRendererVisualState | null {
    void px;
    void py;
    if (entity.kind !== 'building') {
      return null;
    }

    const widthPx = entity.footprintWidth * cellSize;
    const heightPx = entity.footprintHeight * cellSize;
    const isConstruction = entity.visualVariant === 'construction';
    const baseFillAlpha = isConstruction ? 0.72 : 1;
    const fillAlpha = entity.isMemory ? baseFillAlpha * 0.5 : baseFillAlpha;
    const outlineAlpha = entity.isMemory ? 0.5 : 0.98;

    const corners = footprintDiamond(entity);
    const groundDiamond = [corners.top, corners.right, corners.bottom, corners.left];
    const role = buildingRole(entity.entityType as BuildingType);
    const outline = darken(entity.tint, 0.55);

    let hasFoundationSlab = false;
    let hasScaffoldPosts = false;
    let hasStructureBody = false;
    let hasRoofAccent = false;
    let hasConstructionIndicator = false;
    let hasCompletionAccent = false;

    if (entity.isMemory) {
      // Last-seen ghost: the flat footprint diamond at half alpha (no volume —
      // an extruded box would paint opaque pixels over the "stale" cue).
      entityLayer.fillStyle(entity.tint, fillAlpha);
      entityLayer.fillPoints(groundDiamond, true);
      entityLayer.lineStyle(1.5, outline, outlineAlpha);
      entityLayer.strokePoints(groundDiamond, true, true);
      return null; // memory buildings do not contribute a visual-state record
    }

    const fullHeightPx = isoBuildingHeightPx(role);

    if (isConstruction) {
      // Under construction: a low stub of the eventual volume, iso-consistent
      // with the ground, at construction alpha so it reads as "rising".
      drawIsoBuilding(entityLayer, corners, fullHeightPx * 0.4, {
        tint: entity.tint,
        outline: 0xf7e6c3,
        fillAlpha,
        outlineAlpha,
      });
      hasFoundationSlab = true;
      hasScaffoldPosts = true;
      hasConstructionIndicator = true;
    } else {
      // Completed: the full extruded iso volume + the role's roof accent so a
      // Wonder / Castle / Monastery / Barracks / Mill / Town Center still reads
      // distinctly (the iso analogue of the old flat per-role silhouettes).
      const roof = drawIsoBuilding(entityLayer, corners, fullHeightPx, {
        tint: entity.tint,
        outline,
        fillAlpha,
        outlineAlpha,
      });
      drawBuildingRoofAccent(entityLayer, role, roof, {
        tint: entity.tint,
        outline,
        fillAlpha,
        outlineAlpha,
      });
      hasStructureBody = true;
      hasRoofAccent = true;
      hasCompletionAccent = true;
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
