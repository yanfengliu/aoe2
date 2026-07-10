// Render/sync pipeline factored out of GameScene. Same dep-bag factory shape
// as the other gameScene/ extractions. The renderer owns the eight graphics
// layers (created here in the scene's original depth order), the per-role
// sub-renderer factories, and every render-side cache the scene used to carry
// (tick/selection/interpolation signatures, projected-entity snapshots, the
// per-frame visual-state records the browser test API reads, and the
// center-on-base-once latch). Move-only: the syncFromBridge / renderState /
// getSelectionKey bodies mirror the prior private methods on GameScene. The
// layer/sub-renderer existence guards those methods carried are gone because
// the factory constructs all of them up front — the optionality was an
// artifact of the scene's two-phase (constructor vs create) initialization.

import type { SimulationBridge } from '../../../game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../../game/simulation/prototypeScenario';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
  RenderState,
  SelectionState,
} from '../../../game/simulation/types';
import { interpolateProjectedEntities } from '../interpolateProjectedEntities';
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
import { createUnitRenderer, unitFacingRadians } from './unitRenderer';
import { createWorldLayersRenderer } from './worldLayers';
import {
  CELL_SIZE,
  type BuildingVisualState,
  type DebugOverlayMode,
  type DisplayedEntityState,
  type EntityHealthBarState,
  type PlacementPreviewViewState,
  type PlacementPreviewVisualState,
  type SelectionBoxState,
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
  } = deps;

  let lastRenderedTick = -1;
  let lastRenderedInterpolationAlpha = Number.NaN;
  let lastSelectionKey = '';
  let lastProjectedEntities: ProjectedEntityView[] = [];
  let previousUnitProjectedPositions = new Map<number, { x: number; y: number }>();
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

  const terrainLayer = scene.add.graphics();
  const entityLayer = scene.add.graphics();
  const fogLayer = scene.add.graphics();
  const healthBarLayer = scene.add.graphics();
  const selectionLayer = scene.add.graphics();
  const placementLayer = scene.add.graphics();
  const selectionBoxLayer = scene.add.graphics();
  const debugLayer = scene.add.graphics();

  function makeDebugOverlayRenderer() {
    return createDebugOverlayRenderer({
      debugLayer,
      bridge: getBridge(),
      cellSize: CELL_SIZE,
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
    debugOverlayRenderer = makeDebugOverlayRenderer();
    worldLayersRenderer = makeWorldLayersRenderer();
    selectionLayersRenderer = makeSelectionLayersRenderer();
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
          .map((entity) => [entity.id, { x: entity.x, y: entity.y }]),
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

  // Per-entity rendering lives in dep-bag factories under `gameScene/`
  // (buildingRenderer / unitRenderer / terrainRenderer / worldLayers); this
  // module only holds the per-frame call-sites in `renderState`.
  function renderState(
    state: RenderState,
    selectionState: SelectionState,
    interpolationAlpha: number,
  ): void {
    terrainLayer.clear();
    entityLayer.clear();
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

    // v0.1.129: death effects draw FIRST on the entity layer so corpses lie
    // under every living unit and building (they are ground decals).
    deathEffectsRenderer.drawAll(entityLayer, scene.time.now, CELL_SIZE);

    // Isometric depth order: draw back-to-front (increasing cellX+cellY) so a
    // nearer entity occludes a farther one. Sort a COPY — `displayedEntities`
    // keeps its sim order, which hit-testing / selection / the browser test API
    // depend on for stable overlap tie-breaking.
    const drawOrder = [...displayedEntities].sort((a, b) => a.x + a.y - (b.x + b.y));

    for (const entity of drawOrder) {
      // Isometric placement: the entity's iso screen CENTRE (the diamond centre
      // of its cell) minus the half-cell the renderers re-add, so the existing
      // renderer geometry (cx = px + cellSize/2) lands on the diamond centre.
      const isoCentre = worldToIso(entity.x + 0.5, entity.y + 0.5);
      const px = isoCentre.x - CELL_SIZE * 0.5;
      const py = isoCentre.y - CELL_SIZE * 0.5;
      const fillAlpha = entity.isMemory ? 0.5 : 1;

      if (entity.layer === 'terrain') {
        drawTerrainCell(terrainLayer, displayedEntities, entity, CELL_SIZE);
        continue;
      }

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
      const facing = unitFacingRadians(previousUnitProjectedPositions.get(entity.id), entity, interpolationAlpha);
      unitRenderer.drawUnit(entity, px, py, facing, fillAlpha, scene.time.now);
      feedbackRenderer.drawUnitFlash(entityLayer, px + CELL_SIZE * 0.5, // M7 impact flash on hp drop
        py + CELL_SIZE * 0.5, CELL_SIZE * entity.size * 0.5, entity.id, scene.time.now);
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
    getDisplayedEntities,
  };
}
