import type { SimulationBridge } from '../../../game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../../game/simulation/prototypeScenario';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
  RenderState,
  SelectionState,
} from '../../../game/simulation/types';
import { interpolateProjectedEntities, renderIdentityKey } from '../interpolateProjectedEntities';
import { createBuildingRenderer } from './buildingRenderer';
import type { CameraController } from './cameraController';
import { createDebugOverlayRenderer } from './debugOverlay';
import {
  createDeathEffectsRenderer,
  type DeathEffectsRenderer,
} from './deathEffects';
import {
  createFeedbackEffectsRenderer,
  type FeedbackEffectsRenderer,
} from './feedbackEffects';
import { worldToIso } from './isoProjection';
import { computeBaseFocusCell } from './isoViewHelpers';
import { drawResourceEntity } from './resourceRenderer';
import { createSelectionLayersRenderer } from './selectionLayers';
import { drawTerrainCell } from './terrainRenderer';
import { createTerrainCache } from './terrainCache';
import { bakeTerrainTexture } from './terrainBake';
import { createUnitRenderer, unitFacingRadians } from './unitRenderer';
import { computeOccludedUnits, depthKey } from './occlusionSilhouettes';
import { createWorldLayersRenderer } from './worldLayers';
import {
  CELL_SIZE,
  type BuildingVisualState,
  type DebugOverlayMode,
  type DisplayedEntityState,
  type EntityHealthBarState,
  type OccludedUnitState,
  type PlacementPreviewViewState,
  type PlacementPreviewVisualState,
  type SelectionBoxState,
  type WorldRendererMode,
} from './sceneViewTypes';

export interface GameSceneRendererDeps {
  // The Phaser scene handle. Used for `add.graphics` (layer creation),
  // `sys.isActive`, `time.now`, and `cameras.main` world-point projection.
  scene: Phaser.Scene;
  getBridge: () => SimulationBridge;
  getDebugOverlayMode: () => DebugOverlayMode;
  getCameraController: () => CameraController | undefined;
  // View queries owned by the scene / pointer controller, read fresh per
  // frame: the placement preview under the live pointer and the current
  // drag-selection marquee state + cache key.
  getPlacementPreviewState: () => PlacementPreviewViewState | null;
  getSelectionBoxState: () => SelectionBoxState | null;
  getSelectionBoxKey: () => string;
  worldRendererMode: WorldRendererMode;
  presentVoxelWorld?: (entities: readonly ProjectedEntityView[]) => void;
}

export interface GameSceneRenderer {
  syncFromBridge(force?: boolean): void;
  // FU5 bridge swap: reset the cached render/selection signatures and rebuild
  // the bridge-capturing sub-renderers so the very next syncFromBridge forces
  // a full re-render against the newly rehydrated world state.
  resetForBridgeSwap(): void;
  // The live interpolated entity array (same reference the render loop wrote;
  // hit-testing / marquee / selection read it in sim order).
  displayedEntities(): ProjectedEntityView[];
  getPlacementPreviewVisualState(): PlacementPreviewVisualState | null;
  getBuildingVisualStates(): BuildingVisualState[];
  getEntityHealthBarStates(): EntityHealthBarState[];
  getOccludedUnitStates(): OccludedUnitState[];
  getDisplayedEntities(): DisplayedEntityState[];
}

export function createGameSceneRenderer(deps: GameSceneRendererDeps): GameSceneRenderer {
  const {
    scene,
    getBridge,
    getDebugOverlayMode,
    getCameraController,
    getPlacementPreviewState,
    getSelectionBoxState,
    getSelectionBoxKey,
    worldRendererMode,
    presentVoxelWorld,
  } = deps;

  let lastRenderedTick = -1;
  let lastRenderedInterpolationAlpha = Number.NaN;
  let lastSelectionKey = '';
  let lastProjectedEntities: ProjectedEntityView[] = [];
  // Keyed by renderIdentityKey (id:generation), NOT raw id, so a recycled id
  // can't inherit a destroyed unit's previous position (see the helper's note).
  let previousUnitProjectedPositions = new Map<string, { x: number; y: number }>();
  // M7 feedback: selection pulse + hit-flash (render-only, time-based; owns the hp-delta tracker).
  const feedbackRenderer: FeedbackEffectsRenderer = createFeedbackEffectsRenderer();
  // v0.1.129: unit death collapse/dust, fed by the frame's fog-filtered death feed.
  const deathEffectsRenderer: DeathEffectsRenderer = createDeathEffectsRenderer();
  let displayedEntities: ProjectedEntityView[] = [];
  // Iso overhaul: the camera recentres on the player's base once, on the first
  // render frame that has one (the map is a large iso diamond, so a good initial
  // frame matters for both play and click/drag targeting in tests).
  let hasCenteredOnBase = false;
  let lastPlacementPreviewVisualState: PlacementPreviewVisualState | null = null;
  let lastBuildingVisualStates: BuildingVisualState[] = [];
  let lastEntityHealthBarStates: EntityHealthBarState[] = [];
  let lastOccludedUnitStates: OccludedUnitState[] = [];
  // Perf: the terrain layer is drawn once and repainted only when the terrain
  // set changes (see renderTerrainIfChanged). The cache holds the last-drawn
  // signature; resetForBridgeSwap forces a repaint against a swapped-in world.
  const terrainCache = createTerrainCache();

  // Perf: the terrain is BAKED to a RenderTexture (see renderTerrainIfChanged),
  // not left as a live Graphics. A Phaser Graphics re-walks its ENTIRE command
  // list to the GPU every frame even when nothing redraws it, so the ~24k static
  // iso-diamond terrain fills were the dominant per-frame cost (~200ms/frame
  // render, headless-measured). Baking them once makes the terrain a single
  // textured-quad draw. `terrainTexture` is the visible bottom layer; the
  // Graphics below is the hidden draw-source the bake renders from.
  const terrainTexture = scene.add.renderTexture(0, 0, 1, 1).setOrigin(0, 0);
  const terrainLayer = scene.add.graphics().setVisible(false);
  // Feedback stays on dedicated overlay layers so voxel mode can hide legacy
  // entity art without also hiding death collapse/dust or hit flashes.
  const deathFeedbackLayer = scene.add.graphics();
  const entityLayer = scene.add.graphics();
  const fogLayer = scene.add.graphics();
  const hitFeedbackLayer = scene.add.graphics();
  // v0.1.133: white silhouettes of units hidden behind buildings. Created here
  // (above fog, below the health-bar layer) so — z-order being Phaser
  // display-list insertion order, no setDepth anywhere — the outlines paint
  // ON TOP of every building and fog, grouped with the other above-building
  // unit indicators (health bars). Cleared every frame like healthBarLayer.
  const occlusionOutlineLayer = scene.add.graphics();
  const healthBarLayer = scene.add.graphics();
  const selectionLayer = scene.add.graphics();
  const placementLayer = scene.add.graphics();
  const selectionBoxLayer = scene.add.graphics();
  const debugLayer = scene.add.graphics();
  const renderLegacyWorld = worldRendererMode === 'phaser';
  terrainTexture.setVisible(renderLegacyWorld);
  entityLayer.setVisible(renderLegacyWorld);
  occlusionOutlineLayer.setVisible(renderLegacyWorld);

  function makeDebugOverlayRenderer() {
    return createDebugOverlayRenderer({
      debugLayer,
      bridge: getBridge(),
    });
  }

  function makeWorldLayersRenderer() {
    return createWorldLayersRenderer({
      healthBarLayer,
      fogLayer,
      cellSize: CELL_SIZE,
    });
  }

  function makeSelectionLayersRenderer() {
    return createSelectionLayersRenderer({
      selectionLayer,
      placementLayer,
      selectionBoxLayer,
      cellSize: CELL_SIZE,
      screenToWorldPoint: (screenX, screenY) => {
        const worldPoint = scene.cameras.main.getWorldPoint(screenX, screenY);
        return { x: worldPoint.x, y: worldPoint.y };
      },
      getDisplayedEntities: () => displayedEntities,
    });
  }

  let debugOverlayRenderer = makeDebugOverlayRenderer();
  let worldLayersRenderer = makeWorldLayersRenderer();
  const buildingRenderer = createBuildingRenderer({
    entityLayer,
    cellSize: CELL_SIZE,
  });
  const unitRenderer = createUnitRenderer({ graphics: entityLayer, cellSize: CELL_SIZE });
  // A second unit renderer bound to the occlusion layer, used only to stamp the
  // white silhouette of an occluded unit (drawUnit's silhouette mode).
  const occlusionUnitRenderer = createUnitRenderer({
    graphics: occlusionOutlineLayer,
    cellSize: CELL_SIZE,
  });
  let selectionLayersRenderer = makeSelectionLayersRenderer();

  function resetForBridgeSwap(): void {
    lastRenderedTick = -1;
    lastRenderedInterpolationAlpha = Number.NaN;
    lastSelectionKey = '';
    lastProjectedEntities = [];
    previousUnitProjectedPositions = new Map();
    feedbackRenderer.reset();
    deathEffectsRenderer.reset();
    displayedEntities = [];
    lastPlacementPreviewVisualState = null;
    lastBuildingVisualStates = [];
    lastEntityHealthBarStates = [];
    terrainCache.reset(); // force a terrain redraw against the rehydrated world
    debugOverlayRenderer = makeDebugOverlayRenderer();
    worldLayersRenderer = makeWorldLayersRenderer();
    selectionLayersRenderer = makeSelectionLayersRenderer();
    // Full-review L7: `hasCenteredOnBase` is DELIBERATELY not reset here. A
    // bridge swap includes replay fog-owner swaps (replayController.replace ->
    // setBridge -> here), and the replay spec requires a perspective swap to
    // leave the camera position untouched (spec §Replay fog perspective). Not
    // resetting also preserves the player's camera across a save-load rather
    // than yanking it back to the base. Re-centering happens once, on first
    // sight of the base after scene start.
  }

  function syncFromBridge(force = false): void {
    if (!scene.sys.isActive()) {
      return;
    }

    getCameraController()?.clampToWorld();

    const state = getBridge().getRenderState();
    const selectionState = getBridge().getSelectionState();
    const interpolationAlpha = getBridge().getRenderInterpolationAlpha();
    const selectionKey = getSelectionKey(selectionState);
    // M7 feedback: keep re-rendering every frame while a pulse/flash/death is live, else the cache freezes it.
    const isAnimating = feedbackRenderer.isAnimating(selectionState.selectedEntityIds.length, scene.time.now)
      || deathEffectsRenderer.isAnimating(scene.time.now);
    if (
      !force
      && !isAnimating
      && state.tick === lastRenderedTick
      && selectionKey === lastSelectionKey
      && Math.abs(interpolationAlpha - lastRenderedInterpolationAlpha) < 0.001
    ) {
      return;
    }

    if (state.tick !== lastRenderedTick) {
      previousUnitProjectedPositions = new Map(
        lastProjectedEntities
          .filter((entity) => entity.kind === 'unit')
          .map((entity) => [renderIdentityKey(entity), { x: entity.x, y: entity.y }]),
      );
      lastProjectedEntities = state.entities.map((entity) => ({ ...entity }));
      feedbackRenderer.recordTick(state.entities, scene.time.now); // hp delta → arms hit flashes (units only)
      deathEffectsRenderer.ingestFrame(state.frame, scene.time.now); // fog-filtered death feed → collapse/dust
    }

    lastRenderedTick = state.tick;
    lastRenderedInterpolationAlpha = interpolationAlpha;
    lastSelectionKey = selectionKey;
    renderState(state, selectionState, interpolationAlpha);
  }

  // Perf (v0.1.131): (re)draw the terrain layer only when the terrain set
  // changes (computeTerrainSignature). Terrain is immutable for a bridge's
  // life and the camera transform pans/zooms the layer for free, so the ~2160
  // iso-diamond fills happen once instead of every frame. drawTerrainCell's
  // kind-to-kind edge feathering scans its neighbour argument, so it receives
  // the full entity list (terrain neighbours only) exactly as the old inline
  // loop did.
  function renderTerrainIfChanged(entities: ProjectedEntityView[]): void {
    terrainCache.renderIfChanged(entities, (terrainCells) => {
      terrainLayer.clear();
      for (const cell of terrainCells) {
        drawTerrainCell(terrainLayer, entities, cell, CELL_SIZE);
      }
      bakeTerrainTexture(terrainTexture, terrainLayer, terrainCells, CELL_SIZE);
    });
  }

  // Per-entity rendering lives in dep-bag factories under `gameScene/`
  // (buildingRenderer / unitRenderer / terrainRenderer / worldLayers); this
  // module only holds the per-frame call-sites in `renderState`.
  function renderState(
    state: RenderState,
    selectionState: SelectionState,
    interpolationAlpha: number,
  ): void {
    // Perf (v0.1.131): the terrain layer is NOT cleared/redrawn per frame.
    // Terrain is a deterministic pure function of cell kind + coordinates
    // (terrainRenderer) and is immutable for a bridge's lifetime, while the
    // camera transform pans/zooms the already-drawn layer for free — so
    // redrawing ~2160 iso-diamond fills every frame was pure waste (the
    // dominant per-frame render cost). It is (re)drawn only when the terrain
    // set changes (first frame, or a bridge swap via resetForBridgeSwap).
    entityLayer.clear();
    deathFeedbackLayer.clear();
    hitFeedbackLayer.clear();
    occlusionOutlineLayer.clear();
    // Iter-3 V3-18: do NOT clear fogLayer here. `renderFog` below now
    // memoizes on the projected frame reference; clearing
    // unconditionally + re-rendering every RAF tick was the prior
    // perf hot path. renderFog clears the layer itself when the
    // frame has actually changed.
    healthBarLayer.clear();
    selectionLayer.clear();
    placementLayer.clear();
    selectionBoxLayer.clear();
    debugLayer.clear();
    lastBuildingVisualStates = [];
    lastEntityHealthBarStates = [];
    displayedEntities = interpolateProjectedEntities(
      state.entities,
      previousUnitProjectedPositions,
      interpolationAlpha,
    );

    centerOnPlayerBaseOnce();
    if (worldRendererMode === 'voxel') {
      presentVoxelWorld?.(displayedEntities);
    }
    renderTerrainIfChanged(displayedEntities);

    // v0.1.129: death effects draw FIRST on the entity layer so corpses lie
    // under every living unit and building (they are ground decals).
    deathEffectsRenderer.drawAll(deathFeedbackLayer, scene.time.now, CELL_SIZE);

    // Isometric depth order: draw back-to-front (increasing cellX+cellY) so a
    // nearer entity occludes a farther one. Sort a COPY — `displayedEntities`
    // keeps its sim order, which hit-testing / selection / the browser test API
    // depend on for stable overlap tie-breaking. Terrain is on its own cached
    // layer, so only the non-terrain entities take part in the per-frame sort.
    const drawOrder = displayedEntities
      .filter((entity) => entity.layer !== 'terrain')
      .sort((a, b) => depthKey(a) - depthKey(b));

    for (const entity of drawOrder) {
      // Isometric placement: the entity's iso screen CENTRE (the diamond centre
      // of its cell) minus the half-cell the renderers re-add, so the existing
      // renderer geometry (cx = px + cellSize/2) lands on the diamond centre.
      const isoCentre = worldToIso(entity.x + 0.5, entity.y + 0.5);
      const px = isoCentre.x - CELL_SIZE * 0.5;
      const py = isoCentre.y - CELL_SIZE * 0.5;
      const fillAlpha = entity.isMemory ? 0.5 : 1;

      if (entity.kind === 'resource') {
        drawResourceEntity(entityLayer, entity, px, py, CELL_SIZE, fillAlpha);
        continue;
      }

      if (entity.kind === 'building') {
        const visualState = buildingRenderer.renderBuildingEntity(entity, px, py);
        if (visualState) {
          lastBuildingVisualStates.push(visualState);
        }
        continue;
      }

      // Unit: a readable per-role procedural silhouette oriented toward its
      // movement facing — derived render-side from the prior-tick projected
      // position (the interpolated current lies on the prev→current segment, so
      // the heading angle is identical); idle units use a rest orientation.
      const facing = unitFacingRadians(
        previousUnitProjectedPositions.get(renderIdentityKey(entity)),
        entity,
        interpolationAlpha,
      );
      unitRenderer.drawUnit(entity, px, py, facing, fillAlpha, scene.time.now);
      feedbackRenderer.drawUnitFlash(hitFeedbackLayer, px + CELL_SIZE * 0.5, // M7 impact flash on hp drop
        py + CELL_SIZE * 0.5, CELL_SIZE * entity.size * 0.5, entity.id, scene.time.now);
    }

    // v0.1.133: every unit painted over by a building it stands behind gets a
    // white silhouette stamped on the occlusion layer (above the buildings), so
    // a hidden unit reads as a ghost of its own role shape rather than
    // vanishing. Pure detection (occlusionSilhouettes) over the same
    // fog-filtered displayedEntities; the depth key is shared with the draw
    // sort above so the cue can never disagree with what actually painted over.
    lastOccludedUnitStates = [];
    for (const unit of computeOccludedUnits(displayedEntities)) {
      const isoCentre = worldToIso(unit.x + 0.5, unit.y + 0.5);
      occlusionUnitRenderer.drawUnit(
        unit,
        isoCentre.x - CELL_SIZE * 0.5,
        isoCentre.y - CELL_SIZE * 0.5,
        null,
        1,
        scene.time.now,
        { fill: 0xffffff, outline: unit.tint, alpha: 0.85 },
      );
      lastOccludedUnitStates.push({ id: unit.id, x: unit.x, y: unit.y, entityType: unit.entityType });
    }

    if (state.frame) {
      worldLayersRenderer.renderFog(state.frame);
    }

    lastEntityHealthBarStates = worldLayersRenderer.renderEntityHealthBars(
      displayedEntities,
    );
    const pulse = feedbackRenderer.pulse(scene.time.now);
    selectionLayersRenderer.renderSelection(displayedEntities, selectionState, pulse);
    lastPlacementPreviewVisualState = selectionLayersRenderer.renderPlacementPreview(
      getPlacementPreviewState(),
    );
    selectionLayersRenderer.renderSelectionBox(getSelectionBoxState());
    renderDebugOverlay(displayedEntities, selectionState, state.frame);
  }

  // Slice 11: draw world-space overlays driven by the HUD's debug mode.
  // The shapes live on their own `debugLayer` above the placement layer so
  // they never get clipped by selection or fog. Actual drawing lives in
  // `gameScene/debugOverlay.ts`; this method just forwards the scene's
  // view data to the dep-bag renderer.
  function renderDebugOverlay(
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
    frame: ProjectedFrameView | null,
  ): void {
    debugOverlayRenderer.render(
      getDebugOverlayMode(),
      entities,
      selectionState,
      frame,
    );
  }

  function getSelectionKey(selectionState: SelectionState): string {
    const selectionIds = selectionState.selectedEntityIds.length > 0
      ? selectionState.selectedEntityIds.join(',')
      : 'none';
    const placementPreviewState = getPlacementPreviewState();
    const selectionBoxKey = getSelectionBoxKey();
    const placementPreviewKey = placementPreviewState
      ? [
        placementPreviewState.buildingType,
        placementPreviewState.cellX,
        placementPreviewState.cellY,
        placementPreviewState.width,
        placementPreviewState.height,
        placementPreviewState.isValid ? 'valid' : 'invalid',
      ].join(',')
      : 'none';
    // Slice 11: include the debug overlay mode so the cached render
    // invalidates when F2 cycles between modes (e.g. the selection-bounds
    // box should appear / disappear even if the selection is unchanged).
    const debugMode = getDebugOverlayMode();
    return `${selectionIds}:${selectionState.placementMode ?? 'none'}:${selectionBoxKey}:${placementPreviewKey}:${debugMode}`;
  }

  // Iso overhaul: on the first frame that has the human player's base, frame the
  // camera on it (Town Center centre, else the centroid of owned entities). The
  // map is a large iso diamond, so an un-framed default can leave the base jammed
  // against a screen edge — bad for play and for click/drag targeting.
  function centerOnPlayerBaseOnce(): void {
    const cameraController = getCameraController();
    if (hasCenteredOnBase || !cameraController) {
      return;
    }
    const focus = computeBaseFocusCell(displayedEntities, HUMAN_PLAYER_ID);
    if (!focus) {
      return; // nothing to frame yet — retry next frame
    }
    cameraController.centerOnWorldPosition(focus.cellX, focus.cellY);
    hasCenteredOnBase = true;
  }

  function getPlacementPreviewVisualState(): PlacementPreviewVisualState | null {
    return lastPlacementPreviewVisualState
      ? { ...lastPlacementPreviewVisualState }
      : null;
  }

  function getBuildingVisualStates(): BuildingVisualState[] {
    return lastBuildingVisualStates.map((state) => ({ ...state }));
  }

  function getEntityHealthBarStates(): EntityHealthBarState[] {
    return lastEntityHealthBarStates.map((state) => ({ ...state }));
  }

  function getOccludedUnitStates(): OccludedUnitState[] {
    return lastOccludedUnitStates.map((state) => ({ ...state }));
  }

  function getDisplayedEntities(): DisplayedEntityState[] {
    return displayedEntities.map((entity) => ({
      id: entity.id,
      kind: entity.kind,
      entityType: entity.entityType,
      owner: entity.owner,
      x: entity.x,
      y: entity.y,
    }));
  }

  return {
    syncFromBridge,
    resetForBridgeSwap,
    displayedEntities: () => displayedEntities,
    getPlacementPreviewVisualState,
    getBuildingVisualStates,
    getEntityHealthBarStates,
    getOccludedUnitStates,
    getDisplayedEntities,
  };
}
