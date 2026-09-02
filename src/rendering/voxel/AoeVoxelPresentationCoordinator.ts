import { HUMAN_PLAYER_ID, TPS } from '../../game/simulation/prototypeScenario';
import type {
  ProjectedEntityView,
  RenderState,
} from '../../game/simulation/types';
import { createDisplayedPositionSmoother } from '../displayedPositionSmoother';
import { renderIdentityKey } from '../renderIdentityKey';
import { worldToIso } from '../isometricProjection';
import { computeBaseFocusCell } from '../isoViewHelpers';
import type {
  BuildingVisualState,
  DisplayedEntityState,
  EntityHealthBarState,
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from '../viewTypes';
import type { AoeVoxelOverlayInput } from './aoeVoxelOverlayParts';

export interface VoxelPresentationBridge {
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
}

export interface AoeVoxelPresentationCoordinatorDeps {
  readonly getBridge: () => VoxelPresentationBridge;
  readonly isActive: () => boolean;
  readonly getPlacementPreviewState: () => PlacementPreviewViewState | null;
  readonly getSelectionBoxState: () => SelectionBoxState | null;
  readonly screenToWorldPosition: (
    screenX: number,
    screenY: number,
  ) => { readonly x: number; readonly z: number };
  readonly centerCameraOnWorldPosition: (cellX: number, cellY: number) => void;
  readonly present: (
    entities: readonly ProjectedEntityView[],
    simulationDisplayTimeMs: number,
    overlays: AoeVoxelOverlayInput,
  ) => void;
}

export interface AoeVoxelPresentationCoordinator {
  syncFromBridge(force?: boolean): void;
  resetForBridgeSwap(): void;
  displayedEntities(): ProjectedEntityView[];
  getPlacementPreviewVisualState(): PlacementPreviewVisualState | null;
  getBuildingVisualStates(): BuildingVisualState[];
  getEntityHealthBarStates(): EntityHealthBarState[];
  getDisplayedEntities(): DisplayedEntityState[];
}

const CELL_SIZE = 24;

function placementVisual(
  preview: PlacementPreviewViewState | null,
): PlacementPreviewVisualState | null {
  if (!preview) return null;
  return {
    ...preview,
    strokeWidth: 2,
    cellOutlineCount: preview.width * preview.height,
    blockedMarkerCount: preview.isValid ? 0 : 1,
  };
}

function buildingStates(entities: readonly ProjectedEntityView[]): BuildingVisualState[] {
  return entities
    .filter((entity) => entity.kind === 'building' && !entity.isMemory)
    .map((entity) => {
      const isConstruction = entity.visualVariant === 'construction';
      return {
        id: entity.id,
        buildingType: entity.entityType,
        owner: entity.owner,
        cellX: entity.x,
        cellY: entity.y,
        footprintWidthCells: entity.footprintWidth,
        footprintHeightCells: entity.footprintHeight,
        widthPx: entity.footprintWidth * CELL_SIZE,
        heightPx: entity.footprintHeight * CELL_SIZE,
        visualVariant: entity.visualVariant,
        hasFoundationSlab: isConstruction,
        hasScaffoldPosts: isConstruction,
        hasStructureBody: !isConstruction,
        hasRoofAccent: !isConstruction,
        hasConstructionIndicator: isConstruction,
        hasCompletionAccent: !isConstruction,
      };
    });
}

function entityHeightPixels(entity: ProjectedEntityView): number {
  if (entity.kind === 'building') {
    return CELL_SIZE * (1.2 + Math.max(entity.footprintWidth, entity.footprintHeight) * 0.5);
  }
  if (entity.entityType === 'tree') return CELL_SIZE * 2;
  return CELL_SIZE * Math.max(1, entity.size * 1.5);
}

function healthStates(entities: readonly ProjectedEntityView[]): EntityHealthBarState[] {
  return entities.flatMap((entity) => {
    if (
      entity.kind === 'tile'
      || entity.isMemory
      || entity.currentHp === null
      || entity.maxHp === null
      || entity.maxHp <= 0
    ) return [];
    const center = worldToIso(
      entity.x + (entity.kind === 'building' ? entity.footprintWidth / 2 : 0.5),
      entity.y + (entity.kind === 'building' ? entity.footprintHeight / 2 : 0.5),
    );
    const width = entity.kind === 'building'
      ? Math.max(24, entity.footprintWidth * CELL_SIZE * 0.7)
      : Math.max(18, CELL_SIZE * entity.size);
    const entityTopPx = center.y - entityHeightPixels(entity);
    return [{
      id: entity.id,
      entityKind: entity.kind,
      entityType: entity.entityType,
      owner: entity.owner,
      currentHp: entity.currentHp,
      maxHp: entity.maxHp,
      fillRatio: Math.max(0, Math.min(1, entity.currentHp / entity.maxHp)),
      barX: center.x - width / 2,
      barY: entityTopPx - 8,
      barWidthPx: width,
      barHeightPx: 4,
      entityTopPx,
    }];
  });
}

export function createAoeVoxelPresentationCoordinator(
  deps: AoeVoxelPresentationCoordinatorDeps,
): AoeVoxelPresentationCoordinator {
  let lastRenderedTick = -1;
  let lastInterpolationAlpha = Number.NaN;
  let lastInteractionKey = '';
  let lastSelectionKey = '';
  // Where each live unit is DRAWN: the sim's sampled trajectory replayed a
  // step cadence behind, so a walk reads as continuous motion rather than the
  // move-and-stop pulse of blending only adjacent ticks (v0.3.182). The
  // smoother keeps its own per-unit history, under the rule the render
  // store's prior-position frame used to enforce: a unit absent from the
  // previously presented tick, or a presentation that skipped a tick, starts
  // fresh at the sim position.
  const smoother = createDisplayedPositionSmoother();
  let displayedEntities: ProjectedEntityView[] = [];
  let hasCenteredOnBase = false;
  let lastPlacementVisual: PlacementPreviewVisualState | null = null;
  let lastBuildings: BuildingVisualState[] = [];
  let lastHealth: EntityHealthBarState[] = [];

  function interactionKey(): string {
    const placement = deps.getPlacementPreviewState();
    const box = deps.getSelectionBoxState();
    return JSON.stringify({
      placement,
      box: box
        ? [box.startX, box.startY, box.currentX, box.currentY, box.previewEntityIds]
        : null,
    });
  }

  function syncFromBridge(force = false): void {
    if (!deps.isActive()) return;
    const bridge = deps.getBridge();
    const state = bridge.getRenderState();
    const alpha = bridge.getRenderInterpolationAlpha();
    const nextInteractionKey = interactionKey();
    const nextSelectionKey = state.entities
      .filter((entity) => entity.selected)
      .map(renderIdentityKey)
      .join(',');
    if (
      !force
      && state.tick === lastRenderedTick
      && Math.abs(alpha - lastInterpolationAlpha) < 0.001
      && nextInteractionKey === lastInteractionKey
      && nextSelectionKey === lastSelectionKey
    ) return;

    lastRenderedTick = state.tick;
    lastInterpolationAlpha = alpha;
    lastInteractionKey = nextInteractionKey;
    lastSelectionKey = nextSelectionKey;
    displayedEntities = smoother.apply(state.entities, state.tick, alpha);

    if (!hasCenteredOnBase) {
      const focus = computeBaseFocusCell(displayedEntities, HUMAN_PLAYER_ID);
      if (focus) {
        deps.centerCameraOnWorldPosition(focus.cellX, focus.cellY);
        hasCenteredOnBase = true;
      }
    }

    const placement = deps.getPlacementPreviewState();
    const selectionBox = deps.getSelectionBoxState();
    const selectionMarqueeWorldCorners = selectionBox
      ? [
          deps.screenToWorldPosition(selectionBox.startX, selectionBox.startY),
          deps.screenToWorldPosition(selectionBox.currentX, selectionBox.startY),
          deps.screenToWorldPosition(selectionBox.currentX, selectionBox.currentY),
          deps.screenToWorldPosition(selectionBox.startX, selectionBox.currentY),
        ]
      : null;
    deps.present(displayedEntities, (state.tick + alpha) * 1_000 / TPS, {
      frame: state.frame,
      placementPreview: placement,
      selectionPreviewEntityIds: selectionBox?.previewEntityIds ?? [],
      selectionMarqueeWorldCorners,
    });
    lastPlacementVisual = placementVisual(placement);
    lastBuildings = buildingStates(displayedEntities);
    lastHealth = healthStates(displayedEntities);
  }

  function resetForBridgeSwap(): void {
    lastRenderedTick = -1;
    lastInterpolationAlpha = Number.NaN;
    lastInteractionKey = '';
    lastSelectionKey = '';
    smoother.reset();
    displayedEntities = [];
    lastPlacementVisual = null;
    lastBuildings = [];
    lastHealth = [];
  }

  return {
    syncFromBridge,
    resetForBridgeSwap,
    displayedEntities: () => displayedEntities,
    getPlacementPreviewVisualState: () => lastPlacementVisual
      ? { ...lastPlacementVisual }
      : null,
    getBuildingVisualStates: () => lastBuildings.map((state) => ({ ...state })),
    getEntityHealthBarStates: () => lastHealth.map((state) => ({ ...state })),
    getDisplayedEntities: () => displayedEntities.map((entity) => ({
      id: entity.id,
      kind: entity.kind,
      entityType: entity.entityType,
      owner: entity.owner,
      x: entity.x,
      y: entity.y,
    })),
  };
}
