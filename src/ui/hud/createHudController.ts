import type {
  ActionType,
  BuildableBuildingType,
  EconomyState,
  HudState,
  MarketActionType,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  RenderState,
  ProjectedFrameView,
  SelectionState,
  TrainableUnitType,
  UnitType,
} from '../../game/simulation/types';
import type { SimulationDebugSnapshot } from '../../game/simulation/createSimulationBridge';

interface HudCameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
}

interface HudBridge {
  getHudState(): HudState;
  getRenderState(): RenderState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getCameraState(): HudCameraState | null;
  centerCameraOnWorldPosition(worldX: number, worldY: number): void;
  issueAction(actionType: ActionType): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
  // Slice 11: drain the oldest pending command rejection so the HUD can
  // show a toast. Returns null if no rejection is pending.
  consumeCommandRejection(): string | null;
  // Slice 11: snapshot for the F2 debug overlay. Every frame the HUD
  // requests this when the overlay is in anything other than 'off' mode.
  getDebugSnapshot(): SimulationDebugSnapshot;
}

// Slice 11: debug-overlay modes cycle in order via F2. The 'off' mode
// hides the overlay element entirely; every other mode requests a
// snapshot and renders a matching summary.
export type DebugOverlayMode =
  | 'off'
  | 'selection-bounds'
  | 'pathing'
  | 'fog-state'
  | 'ai-state'
  | 'perf'
  // Slice 12 Task D: visualize the delta between coarse (integer cell)
  // simulation position and the interpolated render transform so the
  // "unit simulating at A, rendering at B" class of bugs becomes easy
  // to spot live.
  | 'coarse-vs-fine';

const DEBUG_OVERLAY_CYCLE: DebugOverlayMode[] = [
  'off',
  'selection-bounds',
  'pathing',
  'fog-state',
  'ai-state',
  'perf',
  'coarse-vs-fine',
];

interface MinimapLayout {
  scale: number;
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
}

interface MinimapViewportState {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CELL_SIZE = 24;

function tintToCss(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}

function getMinimapLayout(canvas: HTMLCanvasElement, frame: RenderState['frame']): MinimapLayout | null {
  if (!frame) {
    return null;
  }

  const scale = Math.min(
    canvas.width / frame.mapWidth,
    canvas.height / frame.mapHeight,
  );
  const drawWidth = frame.mapWidth * scale;
  const drawHeight = frame.mapHeight * scale;
  const offsetX = (canvas.width - drawWidth) * 0.5;
  const offsetY = (canvas.height - drawHeight) * 0.5;

  return {
    scale,
    drawWidth,
    drawHeight,
    offsetX,
    offsetY,
  };
}

function getMinimapViewportState(
  layout: MinimapLayout,
  frame: ProjectedFrameView,
  cameraState: HudCameraState | null,
): MinimapViewportState | null {
  if (!cameraState) {
    return null;
  }

  const worldWidth = frame.mapWidth * CELL_SIZE;
  const worldHeight = frame.mapHeight * CELL_SIZE;
  const minimapScaleX = layout.drawWidth / worldWidth;
  const minimapScaleY = layout.drawHeight / worldHeight;

  return {
    x: layout.offsetX + cameraState.viewX * minimapScaleX,
    y: layout.offsetY + cameraState.viewY * minimapScaleY,
    width: cameraState.viewWidth * minimapScaleX,
    height: cameraState.viewHeight * minimapScaleY,
  };
}

function setMinimapViewportDataset(
  canvas: HTMLCanvasElement,
  viewportState: MinimapViewportState | null,
): void {
  canvas.dataset.viewportActive = viewportState ? 'true' : 'false';
  canvas.dataset.viewportX = viewportState ? viewportState.x.toFixed(2) : '';
  canvas.dataset.viewportY = viewportState ? viewportState.y.toFixed(2) : '';
  canvas.dataset.viewportWidth = viewportState ? viewportState.width.toFixed(2) : '';
  canvas.dataset.viewportHeight = viewportState ? viewportState.height.toFixed(2) : '';
}

function drawMinimap(
  canvas: HTMLCanvasElement,
  renderState: RenderState,
  cameraState: HudCameraState | null,
): void {
  const frame = renderState.frame;
  if (!frame) {
    setMinimapViewportDataset(canvas, null);
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const layout = getMinimapLayout(canvas, frame);
  if (!layout) {
    setMinimapViewportDataset(canvas, null);
    return;
  }

  const { scale, drawWidth, drawHeight, offsetX, offsetY } = layout;
  const visible = new Set(frame.visibleCells);
  const explored = new Set(frame.exploredCells);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#081012';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const entity of renderState.entities) {
    const x = offsetX + entity.x * scale;
    const y = offsetY + entity.y * scale;

    context.fillStyle = tintToCss(entity.tint);

    if (entity.layer === 'terrain') {
      context.fillRect(x, y, Math.ceil(scale), Math.ceil(scale));
      continue;
    }

    const markerSize =
      entity.kind === 'building'
        ? Math.max(scale * 1.4, 2)
        : Math.max(scale * 0.8, 1.5);

    context.fillRect(
      x + (scale - markerSize) * 0.5,
      y + (scale - markerSize) * 0.5,
      markerSize,
      markerSize,
    );
  }

  for (let y = 0; y < frame.mapHeight; y += 1) {
    for (let x = 0; x < frame.mapWidth; x += 1) {
      const index = y * frame.mapWidth + x;
      const drawX = offsetX + x * scale;
      const drawY = offsetY + y * scale;

      if (!explored.has(index)) {
        context.fillStyle = 'rgba(8, 16, 18, 0.94)';
        context.fillRect(drawX, drawY, Math.ceil(scale), Math.ceil(scale));
        continue;
      }

      if (!visible.has(index)) {
        context.fillStyle = 'rgba(10, 16, 18, 0.58)';
        context.fillRect(drawX, drawY, Math.ceil(scale), Math.ceil(scale));
      }
    }
  }

  const viewportState = getMinimapViewportState(layout, frame, cameraState);
  setMinimapViewportDataset(canvas, viewportState);
  if (viewportState) {
    context.fillStyle = 'rgba(247, 229, 165, 0.08)';
    context.fillRect(
      viewportState.x,
      viewportState.y,
      viewportState.width,
      viewportState.height,
    );
    context.strokeStyle = 'rgba(247, 229, 165, 0.95)';
    context.lineWidth = 1.5;
    context.strokeRect(
      viewportState.x,
      viewportState.y,
      viewportState.width,
      viewportState.height,
    );
  }
}

function formatEntityName(entityType: SelectionState['selectedEntityType']): string {
  if (!entityType) {
    return 'No selection';
  }

  switch (entityType) {
    case 'town-center':
      return 'Town Center';
    case 'house':
      return 'House';
    case 'mill':
      return 'Mill';
    case 'lumber-camp':
      return 'Lumber Camp';
    case 'mining-camp':
      return 'Mining Camp';
    case 'barracks':
      return 'Barracks';
    case 'watch-tower':
      return 'Watch Tower';
    case 'stable':
      return 'Stable';
    case 'archery-range':
      return 'Archery Range';
    case 'blacksmith':
      return 'Blacksmith';
    case 'market':
      return 'Market';
    case 'berry-bush':
      return 'Berry Bush';
    case 'gold-mine':
      return 'Gold Mine';
    case 'stone-mine':
      return 'Stone Mine';
    case 'boar':
      return 'Boar';
    case 'fish':
      return 'Fish';
    case 'sheep':
      return 'Sheep';
    case 'wolf':
      return 'Wolf';
    case 'tree':
      return 'Tree';
    case 'villager':
      return 'Villager';
    case 'militia':
      return 'Militia';
    case 'spearman':
      return 'Spearman';
    case 'archer':
      return 'Archer';
    case 'skirmisher':
      return 'Skirmisher';
    case 'knight':
      return 'Knight';
    case 'scout':
      return 'Scout Cavalry';
    case 'crossbowman':
      return 'Crossbowman';
    case 'pikeman':
      return 'Pikeman';
    case 'light-cavalry':
      return 'Light Cavalry';
    case 'camel':
      return 'Camel';
    case 'cavalry-archer':
      return 'Cavalry Archer';
    case 'mangonel':
      return 'Mangonel';
    case 'scorpion':
      return 'Scorpion';
    case 'battering-ram':
      return 'Battering Ram';
    case 'siege-workshop':
      return 'Siege Workshop';
    case 'monastery':
      return 'Monastery';
    case 'monk':
      return 'Monk';
    case 'relic':
      return 'Relic';
    case 'castle':
      return 'Castle';
    case 'longbowman':
      return 'Longbowman';
    case 'arbalest':
      return 'Arbalest';
    case 'halberdier':
      return 'Halberdier';
    case 'hussar':
      return 'Hussar';
    case 'heavy-cavalry-archer':
      return 'Heavy Cavalry Archer';
    case 'cavalier':
      return 'Cavalier';
    case 'champion':
      return 'Champion';
    case 'elite-longbowman':
      return 'Elite Longbowman';
    case 'onager':
      return 'Onager';
    case 'heavy-scorpion':
      return 'Heavy Scorpion';
    case 'siege-ram':
      return 'Siege Ram';
    case 'bombard-cannon':
      return 'Bombard Cannon';
    case 'trebuchet':
      return 'Trebuchet';
    // FU2: militia-line intermediates + Paladin + Heavy Camel.
    case 'man-at-arms':
      return 'Man-at-Arms';
    case 'long-swordsman':
      return 'Long Swordsman';
    case 'two-handed-swordsman':
      return 'Two-Handed Swordsman';
    case 'paladin':
      return 'Paladin';
    case 'heavy-camel':
      return 'Heavy Camel';
    // FU3: real wall buildings.
    case 'stone-wall':
      return 'Stone Wall';
    case 'palisade-wall':
      return 'Palisade Wall';
    default:
      return entityType;
  }
}

function formatEntityPluralName(entityType: SelectionState['selectedEntityType']): string {
  if (!entityType) {
    return 'Units';
  }

  switch (entityType) {
    case 'town-center':
      return 'Town Centers';
    case 'house':
      return 'Houses';
    case 'mill':
      return 'Mills';
    case 'lumber-camp':
      return 'Lumber Camps';
    case 'mining-camp':
      return 'Mining Camps';
    case 'barracks':
      return 'Barracks';
    case 'watch-tower':
      return 'Watch Towers';
    case 'stable':
      return 'Stables';
    case 'archery-range':
      return 'Archery Ranges';
    case 'blacksmith':
      return 'Blacksmiths';
    case 'market':
      return 'Markets';
    case 'berry-bush':
      return 'Berry Bushes';
    case 'gold-mine':
      return 'Gold Mines';
    case 'stone-mine':
      return 'Stone Mines';
    case 'boar':
      return 'Boars';
    case 'fish':
      return 'Fish';
    case 'sheep':
      return 'Sheep';
    case 'wolf':
      return 'Wolves';
    case 'tree':
      return 'Trees';
    case 'villager':
      return 'Villagers';
    case 'militia':
      return 'Militia';
    case 'spearman':
      return 'Spearmen';
    case 'archer':
      return 'Archers';
    case 'skirmisher':
      return 'Skirmishers';
    case 'knight':
      return 'Knights';
    case 'scout':
      return 'Scout Cavalry';
    case 'crossbowman':
      return 'Crossbowmen';
    case 'pikeman':
      return 'Pikemen';
    case 'light-cavalry':
      return 'Light Cavalry';
    case 'camel':
      return 'Camels';
    case 'cavalry-archer':
      return 'Cavalry Archers';
    case 'mangonel':
      return 'Mangonels';
    case 'scorpion':
      return 'Scorpions';
    case 'battering-ram':
      return 'Battering Rams';
    case 'siege-workshop':
      return 'Siege Workshops';
    case 'monastery':
      return 'Monasteries';
    case 'monk':
      return 'Monks';
    case 'relic':
      return 'Relics';
    case 'castle':
      return 'Castles';
    case 'longbowman':
      return 'Longbowmen';
    case 'arbalest':
      return 'Arbalests';
    case 'halberdier':
      return 'Halberdiers';
    case 'hussar':
      return 'Hussars';
    case 'heavy-cavalry-archer':
      return 'Heavy Cavalry Archers';
    case 'cavalier':
      return 'Cavaliers';
    case 'champion':
      return 'Champions';
    case 'elite-longbowman':
      return 'Elite Longbowmen';
    case 'onager':
      return 'Onagers';
    case 'heavy-scorpion':
      return 'Heavy Scorpions';
    case 'siege-ram':
      return 'Siege Rams';
    case 'bombard-cannon':
      return 'Bombard Cannons';
    case 'trebuchet':
      return 'Trebuchets';
    // FU2: militia-line intermediate tiers + Paladin + Heavy Camel.
    case 'man-at-arms':
      return 'Men-at-Arms';
    case 'long-swordsman':
      return 'Long Swordsmen';
    case 'two-handed-swordsman':
      return 'Two-Handed Swordsmen';
    case 'paladin':
      return 'Paladins';
    case 'heavy-camel':
      return 'Heavy Camels';
    // FU3: real wall buildings.
    case 'stone-wall':
      return 'Stone Walls';
    case 'palisade-wall':
      return 'Palisade Walls';
    default:
      return `${entityType}s`;
  }
}

function formatSelectionName(selectionState: SelectionState): string {
  if (selectionState.selectedCount <= 1) {
    return formatEntityName(selectionState.selectedEntityType);
  }

  const label =
    selectionState.selectedEntityType === null
      ? 'Units'
      : formatEntityPluralName(selectionState.selectedEntityType);
  return `${selectionState.selectedCount} ${label} Selected`;
}

function isUnitType(entityType: SelectionState['selectedEntityType']): entityType is UnitType {
  return (
    entityType === 'villager'
    || entityType === 'scout'
    || entityType === 'militia'
    || entityType === 'spearman'
    || entityType === 'archer'
    || entityType === 'skirmisher'
    || entityType === 'knight'
    || entityType === 'crossbowman'
    || entityType === 'pikeman'
    || entityType === 'light-cavalry'
    || entityType === 'camel'
    || entityType === 'cavalry-archer'
    || entityType === 'mangonel'
    || entityType === 'scorpion'
    || entityType === 'battering-ram'
    || entityType === 'monk'
    || entityType === 'longbowman'
    || entityType === 'arbalest'
    || entityType === 'halberdier'
    || entityType === 'hussar'
    || entityType === 'heavy-cavalry-archer'
    || entityType === 'cavalier'
    || entityType === 'champion'
    || entityType === 'elite-longbowman'
    || entityType === 'onager'
    || entityType === 'heavy-scorpion'
    || entityType === 'siege-ram'
    || entityType === 'bombard-cannon'
    || entityType === 'trebuchet'
    // FU2: militia-line intermediate tiers + Paladin + Heavy Camel.
    || entityType === 'man-at-arms'
    || entityType === 'long-swordsman'
    || entityType === 'two-handed-swordsman'
    || entityType === 'paladin'
    || entityType === 'heavy-camel'
  );
}

function formatUnitIcon(unitType: UnitType): string {
  switch (unitType) {
    case 'villager':
      return 'V';
    case 'scout':
      return 'SC';
    case 'militia':
      return 'M';
    case 'spearman':
      return 'SP';
    case 'archer':
      return 'A';
    case 'skirmisher':
      return 'SK';
    case 'knight':
      return 'K';
    case 'crossbowman':
      return 'CB';
    case 'pikeman':
      return 'PK';
    case 'light-cavalry':
      return 'LC';
    case 'camel':
      return 'Cm';
    case 'cavalry-archer':
      return 'CA';
    case 'mangonel':
      return 'Mg';
    case 'scorpion':
      return 'Sc';
    case 'battering-ram':
      return 'Rm';
    case 'monk':
      return 'Mn';
    case 'longbowman':
      return 'LB';
    // Slice 7A Imperial icons.
    case 'arbalest':
      return 'Ab';
    case 'halberdier':
      return 'Hb';
    case 'hussar':
      return 'Hs';
    case 'heavy-cavalry-archer':
      return 'HC';
    case 'cavalier':
      return 'Cv';
    case 'champion':
      return 'Ch';
    case 'elite-longbowman':
      return 'EL';
    case 'onager':
      return 'On';
    case 'heavy-scorpion':
      return 'HS';
    case 'siege-ram':
      return 'SR';
    case 'bombard-cannon':
      return 'BC';
    case 'trebuchet':
      return 'Tr';
    // FU2: short icons that don't collide with Slice 7A codes. `HC` is
    // already taken by Heavy Cavalry Archer, so Heavy Camel uses `HCm`.
    case 'man-at-arms':
      return 'MA';
    case 'long-swordsman':
      return 'LS';
    case 'two-handed-swordsman':
      return 'TH';
    case 'paladin':
      return 'Pl';
    case 'heavy-camel':
      return 'HCm';
  }
}

function formatUnitIconAccent(unitType: UnitType): string {
  switch (unitType) {
    case 'villager':
      return '#8fc6a3';
    case 'scout':
      return '#c9a160';
    case 'militia':
      return '#d07a66';
    case 'spearman':
      return '#d2b16a';
    case 'archer':
      return '#7fb3d5';
    case 'skirmisher':
      return '#7ec7c0';
    case 'knight':
      return '#c4b0dc';
    case 'crossbowman':
      return '#6ba0cc';
    case 'pikeman':
      return '#a7c98a';
    case 'light-cavalry':
      return '#d7b87c';
    case 'camel':
      return '#d8c18a';
    case 'cavalry-archer':
      return '#8ca6c8';
    case 'mangonel':
      return '#a0805a';
    case 'scorpion':
      return '#b09862';
    case 'battering-ram':
      return '#8f6a4a';
    case 'monk':
      return '#e3d9b5';
    case 'longbowman':
      return '#6fa070';
    // Slice 7A Imperial accents — one step deeper than the predecessor so
    // the Imperial unit reads as the same family on the HUD.
    case 'arbalest':
      return '#4f8cc2';
    case 'halberdier':
      return '#8cba6f';
    case 'hussar':
      return '#c09960';
    case 'heavy-cavalry-archer':
      return '#7188b0';
    case 'cavalier':
      return '#ae9fcc';
    case 'champion':
      return '#cf8b52';
    case 'elite-longbowman':
      return '#4f8652';
    case 'onager':
      return '#7a5d3f';
    case 'heavy-scorpion':
      return '#957848';
    case 'siege-ram':
      return '#6e4e33';
    case 'bombard-cannon':
      return '#3a3a42';
    case 'trebuchet':
      return '#6a4f2e';
    // FU2: accent colors sit between their predecessor and successor.
    case 'man-at-arms':
      return '#c78a5e';
    case 'long-swordsman':
      return '#b87548';
    case 'two-handed-swordsman':
      return '#b66b48';
    case 'paladin':
      return '#b8a78c';
    case 'heavy-camel':
      return '#ccb37d';
  }
}

function formatEntityIcon(entityType: SelectionState['selectedEntityType']): string {
  switch (entityType) {
    case 'town-center':
      return 'TC';
    case 'house':
      return 'H';
    case 'mill':
      return 'ML';
    case 'lumber-camp':
      return 'LC';
    case 'mining-camp':
      return 'MC';
    case 'barracks':
      return 'BA';
    case 'watch-tower':
      return 'WT';
    case 'stable':
      return 'ST';
    case 'archery-range':
      return 'AR';
    case 'blacksmith':
      return 'BS';
    case 'market':
      return 'MK';
    case 'siege-workshop':
      return 'SW';
    case 'monastery':
      return 'My';
    case 'castle':
      return 'Ct';
    case 'wonder':
      return 'Wn';
    case 'stone-wall':
      return 'Wl';
    case 'palisade-wall':
      return 'Pl';
    case 'relic':
      return 'Rl';
    case 'berry-bush':
      return 'BB';
    case 'gold-mine':
      return 'G';
    case 'stone-mine':
      return 'S';
    case 'boar':
      return 'BO';
    case 'fish':
      return 'F';
    case 'sheep':
      return 'SH';
    case 'wolf':
      return 'WO';
    case 'tree':
      return 'T';
    default:
      return entityType ? formatUnitIcon(entityType) : '?';
  }
}

function formatEntityIconAccent(entityType: SelectionState['selectedEntityType']): string {
  switch (entityType) {
    case 'town-center':
      return '#cfb56f';
    case 'house':
      return '#c39355';
    case 'mill':
      return '#b79a5f';
    case 'lumber-camp':
      return '#7ca46a';
    case 'mining-camp':
      return '#9daabd';
    case 'barracks':
      return '#b78363';
    case 'watch-tower':
      return '#b6a7be';
    case 'stable':
      return '#bf9463';
    case 'archery-range':
      return '#a6866f';
    case 'blacksmith':
      return '#8f98aa';
    case 'market':
      return '#c4a166';
    case 'siege-workshop':
      return '#98856a';
    case 'monastery':
      return '#cfc3a8';
    case 'castle':
      return '#a09f9c';
    case 'wonder':
      return '#e6c36a';
    case 'stone-wall':
      return '#9aa0a8';
    case 'palisade-wall':
      return '#a88555';
    case 'relic':
      return '#f5d680';
    case 'berry-bush':
      return '#a16a89';
    case 'gold-mine':
      return '#d7c46a';
    case 'stone-mine':
      return '#b8c0cf';
    case 'boar':
      return '#bf7d68';
    case 'fish':
      return '#73b9d6';
    case 'sheep':
      return '#d9e0e5';
    case 'wolf':
      return '#9ca6b2';
    case 'tree':
      return '#7fb07a';
    default:
      return entityType && isUnitType(entityType)
        ? formatUnitIconAccent(entityType)
        : '#c4ae7a';
  }
}

function renderSingleSelectionIcon(
  entityType: SelectionState['selectedEntityType'],
): string {
  if (!entityType) {
    return '';
  }

  return `
    <div
      class="hud-selection-unit-list"
      data-selection-unit-icons
      style="--unit-icon-accent: ${formatEntityIconAccent(entityType)}"
    >
      <div class="hud-selection-unit-chip">
        <div class="hud-selection-unit-badge" data-selection-entity-icon="${entityType}">
          ${formatEntityIcon(entityType)}
        </div>
        <div class="hud-selection-unit-meta">
          <div class="hud-selection-unit-label">${formatEntityName(entityType)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderSelectionIcons(
  selectionState: SelectionState,
  economyState: EconomyState,
): string {
  if (selectionState.selectedEntityIds.length === 0) {
    return '';
  }

  const unitsById = new Map(economyState.units.map((unit) => [unit.id, unit]));
  const counts = new Map<UnitType, number>();
  const orderedUnitTypes: UnitType[] = [];

  for (const id of selectionState.selectedEntityIds) {
    const unit = unitsById.get(id);
    if (!unit) {
      continue;
    }

    if (!counts.has(unit.unitType)) {
      orderedUnitTypes.push(unit.unitType);
      counts.set(unit.unitType, 0);
    }

    counts.set(unit.unitType, (counts.get(unit.unitType) ?? 0) + 1);
  }

  if (orderedUnitTypes.length === 0) {
    if (selectionState.selectedCount === 1) {
      return renderSingleSelectionIcon(selectionState.selectedEntityType);
    }

    if (!isUnitType(selectionState.selectedEntityType)) {
      return '';
    }

    orderedUnitTypes.push(selectionState.selectedEntityType);
    counts.set(selectionState.selectedEntityType, Math.max(selectionState.selectedCount, 1));
  }

  const chips = orderedUnitTypes
    .map((unitType) => {
      const count = counts.get(unitType) ?? 1;
      const countMarkup =
        count > 1
          ? `<div class="hud-selection-unit-count" data-selection-unit-count="${unitType}">x${count}</div>`
          : '';
      return `
        <div
          class="hud-selection-unit-chip"
          data-selection-unit-chip="${unitType}"
          style="--unit-icon-accent: ${formatUnitIconAccent(unitType)}"
        >
          <div class="hud-selection-unit-badge" data-selection-unit-icon="${unitType}">
            ${formatUnitIcon(unitType)}
          </div>
          <div class="hud-selection-unit-meta">
            <div class="hud-selection-unit-label" data-selection-unit-label="${unitType}">
              ${formatEntityName(unitType)}
            </div>
            ${countMarkup}
          </div>
        </div>
      `;
    })
    .join('');

  return `<div class="hud-selection-unit-list" data-selection-unit-icons>${chips}</div>`;
}

const SELECTION_DETAIL_TOOLTIPS: Record<
  'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
  string
> = {
  health: 'Current hit points and maximum hit points.',
  attack: 'Attack damage per strike before bonuses and armor.',
  armor: 'Damage reduction from incoming attacks.',
  faction: 'Group the entity belongs to (player, enemy, neutral).',
  civ: 'Civilization bonuses and unique units that apply.',
  inventory: 'Resources currently carried by the unit.',
};

function renderSelectionDetail(
  key: 'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
  label: string,
  value: string,
): string {
  const tooltip = SELECTION_DETAIL_TOOLTIPS[key];
  return `
    <div class="hud-selection-detail" data-selection-detail="${key}" data-tooltip="${tooltip}">
      <div class="hud-selection-detail-label">${label}</div>
      <div class="hud-selection-detail-value" data-selection-detail-value="${key}">${value}</div>
    </div>
  `;
}

function renderSelectionDetails(selectionState: SelectionState): string {
  const details: string[] = [];

  if (selectionState.health) {
    details.push(
      renderSelectionDetail(
        'health',
        'Health',
        `${selectionState.health.current} / ${selectionState.health.max}`,
      ),
    );
  }

  if (selectionState.attack !== null) {
    details.push(renderSelectionDetail('attack', 'Attack', String(selectionState.attack)));
  }

  if (selectionState.armor !== null) {
    details.push(renderSelectionDetail('armor', 'Armor', String(selectionState.armor)));
  }

  if (selectionState.faction) {
    details.push(renderSelectionDetail('faction', 'Faction', selectionState.faction));
  }

  if (selectionState.civ) {
    details.push(renderSelectionDetail('civ', 'Civ', selectionState.civ));
  }

  if (selectionState.inventory) {
    details.push(renderSelectionDetail('inventory', 'Inventory', selectionState.inventory));
  }

  if (details.length === 0) {
    return '';
  }

  return `<div class="hud-selection-details" data-selection-details>${details.join('')}</div>`;
}

function formatTechnologyName(technologyType: ResearchableTechnologyType): string {
  switch (technologyType) {
    case 'feudal-age':
      return 'Feudal Age';
    case 'castle-age':
      return 'Castle Age';
    case 'imperial-age':
      return 'Imperial Age';
    case 'fletching':
      return 'Fletching';
    case 'crossbowman-upgrade':
      return 'Crossbowman';
    case 'pikeman-upgrade':
      return 'Pikeman';
    case 'light-cavalry-upgrade':
      return 'Light Cavalry';
    case 'arbalest-upgrade':
      return 'Arbalest';
    case 'halberdier-upgrade':
      return 'Halberdier';
    case 'hussar-upgrade':
      return 'Hussar';
    case 'heavy-cavalry-archer-upgrade':
      return 'Heavy Cavalry Archer';
    case 'cavalier-upgrade':
      return 'Cavalier';
    case 'champion-upgrade':
      return 'Champion';
    case 'elite-longbowman-upgrade':
      return 'Elite Longbowman';
    case 'onager-upgrade':
      return 'Onager';
    case 'heavy-scorpion-upgrade':
      return 'Heavy Scorpion';
    case 'siege-ram-upgrade':
      return 'Siege Ram';
    case 'bracer':
      return 'Bracer';
    case 'blast-furnace':
      return 'Blast Furnace';
    case 'plate-mail-armor':
      return 'Plate Mail Armor';
    case 'plate-barding':
      return 'Plate Barding';
    // FU1: Feudal / Castle / Imperial Blacksmith tier names.
    case 'forging':
      return 'Forging';
    case 'scale-mail-armor':
      return 'Scale Mail Armor';
    case 'scale-barding-armor':
      return 'Scale Barding Armor';
    case 'padded-archer-armor':
      return 'Padded Archer Armor';
    case 'iron-casting':
      return 'Iron Casting';
    case 'chain-mail-armor':
      return 'Chain Mail Armor';
    case 'chain-barding-armor':
      return 'Chain Barding Armor';
    case 'leather-archer-armor':
      return 'Leather Archer Armor';
    case 'bodkin-arrow':
      return 'Bodkin Arrow';
    case 'ring-archer-armor':
      return 'Ring Archer Armor';
    case 'chemistry':
      return 'Chemistry';
    // FU2: militia-line intermediate tiers + Paladin + Heavy Camel.
    case 'man-at-arms-upgrade':
      return 'Man-at-Arms';
    case 'long-swordsman-upgrade':
      return 'Long Swordsman';
    case 'two-handed-swordsman-upgrade':
      return 'Two-Handed Swordsman';
    case 'paladin-upgrade':
      return 'Paladin';
    case 'heavy-camel-upgrade':
      return 'Heavy Camel';
  }
}

function formatActionName(actionType: ActionType): string {
  switch (actionType) {
    case 'ungarrison':
      return 'Ungarrison';
  }
}

// Slice 11: tooltip helpers return short hover blurbs so the HUD can annotate
// every command button. Strings are rendered via data-tooltip and surfaced
// in the shared tooltip element on hover.
function formatActionTooltip(actionType: ActionType): string {
  switch (actionType) {
    case 'ungarrison':
      return 'Empty the building of all garrisoned units.';
  }
}

function formatMarketActionTooltip(actionType: MarketActionType): string {
  switch (actionType) {
    case 'buy-food':
      return 'Buy food with gold at the current market rate.';
    case 'sell-food':
      return 'Sell food for gold at the current market rate.';
    case 'buy-wood':
      return 'Buy wood with gold at the current market rate.';
    case 'sell-wood':
      return 'Sell wood for gold at the current market rate.';
    case 'buy-stone':
      return 'Buy stone with gold at the current market rate.';
    case 'sell-stone':
      return 'Sell stone for gold at the current market rate.';
  }
}

function formatTrainTooltip(unitType: TrainableUnitType): string {
  return `Queue a ${formatEntityName(unitType)} at this building. Requires the unit's cost and an open production queue slot.`;
}

function formatResearchTooltip(technologyType: ResearchableTechnologyType): string {
  return `Research ${formatTechnologyName(technologyType)}. Consumes its resource cost while the research ticks down.`;
}

function formatBuildTooltip(buildingType: BuildableBuildingType): string {
  return `Place a ${formatEntityName(buildingType)} foundation. The selected villager walks to the site and begins construction.`;
}

function formatMarketActionName(actionType: MarketActionType): string {
  switch (actionType) {
    case 'buy-food':
      return 'Buy Food';
    case 'sell-food':
      return 'Sell Food';
    case 'buy-wood':
      return 'Buy Wood';
    case 'sell-wood':
      return 'Sell Wood';
    case 'buy-stone':
      return 'Buy Stone';
    case 'sell-stone':
      return 'Sell Stone';
  }
}

function formatQueueEntryName(entry: ProductionQueueEntry): string {
  if (entry.kind === 'unit' && entry.unitType) {
    return `Training: ${formatEntityName(entry.unitType)}`;
  }

  if (entry.kind === 'technology' && entry.technologyType) {
    return `Researching: ${formatTechnologyName(entry.technologyType)}`;
  }

  return entry.label;
}

function formatQueueProgress(progressPercent: number): string {
  return `${progressPercent}% complete`;
}

function formatAgeName(age: HudState['currentAge']): string {
  switch (age) {
    case 'dark-age':
      return 'Dark Age';
    case 'feudal-age':
      return 'Feudal Age';
    case 'castle-age':
      return 'Castle Age';
    case 'imperial-age':
      return 'Imperial Age';
  }
}

function formatMatchTime(tick: number, ticksPerSecond: number): string {
  if (ticksPerSecond <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.floor(tick / ticksPerSecond));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Slice 8: MM:SS countdown format shared by the Wonder and Relic chip.
// Mirrors formatMatchTime but expects a ticks-remaining value, not a
// cumulative tick count.
function formatCountdownTicks(ticks: number, ticksPerSecond: number): string {
  if (ticksPerSecond <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.ceil(ticks / ticksPerSecond));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Slice 8: post-game summary card content. Summary text drives the
// existing browser-test assertions; adding winCondition + scores below
// it keeps the textContent backward-compatible in tests that only look
// for the leading status string via text match.
function formatWinConditionLabel(
  winCondition: 'conquest' | 'wonder' | 'relic' | null,
): string {
  switch (winCondition) {
    case 'wonder':
      return 'Wonder Victory';
    case 'relic':
      return 'Relic Victory';
    case 'conquest':
      return 'Conquest Victory';
    case null:
    default:
      return '';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMatchSummary(
  summary: string,
  winCondition: 'conquest' | 'wonder' | 'relic' | null,
  scores: Record<number, number> | null,
): string {
  const parts: string[] = [];
  parts.push(`<div data-hud="match-summary-text">${escapeHtml(summary)}</div>`);
  const label = formatWinConditionLabel(winCondition);
  if (label) {
    parts.push(
      `<div data-hud="match-summary-win-condition">${escapeHtml(label)}</div>`,
    );
  }
  if (scores) {
    const rows = Object.entries(scores)
      .sort(([leftOwner], [rightOwner]) => Number(leftOwner) - Number(rightOwner))
      .map(([owner, score]) =>
        `<div data-hud="match-summary-score">Player ${escapeHtml(owner)}: ${score}</div>`,
      )
      .join('');
    parts.push(rows);
  }
  return parts.join('');
}

// Slice 11: tooltip copy lives next to the chip definition so the HUD renders
// a single source of truth. The data-tooltip attribute is read on hover and
// reflected into the single shared tooltip element below.
const HUD_CHIP_TOOLTIPS: Record<string, string> = {
  food: 'Food stockpile. Farms, hunting, sheep, and berries feed villagers and soldiers.',
  wood: 'Wood stockpile. Cut by villagers at forests and returned to Lumber Camps.',
  gold: 'Gold stockpile. Mined from gold deposits and earned through trade and relics.',
  stone: 'Stone stockpile. Mined from stone deposits; required for Town Centers, walls, and Castles.',
  age: 'Current age. Research the next age at a Town Center to unlock new units and buildings.',
  pop: 'Population used out of the current cap. Build Houses or Town Centers to raise the cap.',
  time: 'Elapsed match time (minutes:seconds).',
  countdown: 'A victory countdown is active. If it finishes without interruption the holder wins.',
};

export interface HudController {
  // Slice 11: GameScene reads the active overlay mode so it can draw
  // world-space debug shapes (selection bounds, pathing lines). The HUD
  // itself renders the text overlay for ai-state / perf.
  getDebugOverlayMode(): DebugOverlayMode;
  cycleDebugOverlayMode(): DebugOverlayMode;
}

export function createHudController(root: HTMLElement, bridge: HudBridge): HudController {
  root.innerHTML = `
    <div class="hud-top">
      <div class="hud-bar">
        <div class="hud-chip" data-hud-chip="food" data-tooltip="${HUD_CHIP_TOOLTIPS.food}">
          <div class="hud-label">Food</div>
          <div class="hud-value" data-hud="food">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="wood" data-tooltip="${HUD_CHIP_TOOLTIPS.wood}">
          <div class="hud-label">Wood</div>
          <div class="hud-value" data-hud="wood">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="gold" data-tooltip="${HUD_CHIP_TOOLTIPS.gold}">
          <div class="hud-label">Gold</div>
          <div class="hud-value" data-hud="gold">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="stone" data-tooltip="${HUD_CHIP_TOOLTIPS.stone}">
          <div class="hud-label">Stone</div>
          <div class="hud-value" data-hud="stone">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="age" data-tooltip="${HUD_CHIP_TOOLTIPS.age}">
          <div class="hud-label">Age</div>
          <div class="hud-value" data-hud="age">Dark Age</div>
        </div>
        <div class="hud-chip" data-hud-chip="pop" data-tooltip="${HUD_CHIP_TOOLTIPS.pop}">
          <div class="hud-label">Pop</div>
          <div class="hud-value" data-hud="pop">0/0</div>
        </div>
        <div class="hud-chip" data-hud-chip="time" data-tooltip="${HUD_CHIP_TOOLTIPS.time}">
          <div class="hud-label">Time</div>
          <div class="hud-value" data-hud="time">00:00</div>
        </div>
        <div class="hud-chip" data-hud-chip="countdown" data-hud="countdown-chip" data-tooltip="${HUD_CHIP_TOOLTIPS.countdown}" hidden>
          <div class="hud-label" data-hud="countdown-label">Countdown</div>
          <div class="hud-value" data-hud="countdown-value">00:00</div>
        </div>
      </div>
    </div>
    <div class="hud-bottom">
      <div
        class="hud-panel hud-panel--selection"
        data-hud="selection-panel"
      ></div>
      <div class="hud-panel hud-panel--map">
        <div class="hud-label">Minimap</div>
        <canvas
          class="hud-minimap"
          width="220"
          height="160"
          data-hud="minimap"
        ></canvas>
      </div>
      <div class="hud-footer" data-hud="match-summary" hidden></div>
    </div>
    <div class="hud-tooltip" data-hud="tooltip" data-hud-tooltip-active="false" role="tooltip" aria-hidden="true"></div>
    <div class="hud-toasts" data-hud="toast-container" aria-live="polite"></div>
    <div
      class="hud-debug-overlay"
      data-hud="debug-overlay"
      data-hud-debug-mode="off"
    ></div>
  `;

  const food = root.querySelector<HTMLElement>('[data-hud="food"]');
  const wood = root.querySelector<HTMLElement>('[data-hud="wood"]');
  const gold = root.querySelector<HTMLElement>('[data-hud="gold"]');
  const stone = root.querySelector<HTMLElement>('[data-hud="stone"]');
  const age = root.querySelector<HTMLElement>('[data-hud="age"]');
  const pop = root.querySelector<HTMLElement>('[data-hud="pop"]');
  const time = root.querySelector<HTMLElement>('[data-hud="time"]');
  const matchSummary = root.querySelector<HTMLElement>('[data-hud="match-summary"]');
  const countdownChip = root.querySelector<HTMLElement>('[data-hud="countdown-chip"]');
  const countdownLabel = root.querySelector<HTMLElement>('[data-hud="countdown-label"]');
  const countdownValue = root.querySelector<HTMLElement>('[data-hud="countdown-value"]');
  const minimap = root.querySelector<HTMLCanvasElement>('[data-hud="minimap"]');
  const selectionPanel = root.querySelector<HTMLElement>('[data-hud="selection-panel"]');

  const tooltip = root.querySelector<HTMLElement>('[data-hud="tooltip"]');
  const toastContainer = root.querySelector<HTMLElement>('[data-hud="toast-container"]');
  const debugOverlay = root.querySelector<HTMLElement>('[data-hud="debug-overlay"]');
  let debugOverlayMode: DebugOverlayMode = 'off';

  function applyDebugOverlayMode(): void {
    if (!debugOverlay) {
      return;
    }
    debugOverlay.dataset.hudDebugMode = debugOverlayMode;
  }

  function cycleDebugOverlayMode(): DebugOverlayMode {
    const currentIndex = DEBUG_OVERLAY_CYCLE.indexOf(debugOverlayMode);
    const next = DEBUG_OVERLAY_CYCLE[(currentIndex + 1) % DEBUG_OVERLAY_CYCLE.length];
    debugOverlayMode = next;
    applyDebugOverlayMode();
    return debugOverlayMode;
  }

  // Slice 11: F2 toggles the debug overlay through its cycle. The listener
  // attaches to window so it fires whether or not the canvas has focus.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'F2') {
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    cycleDebugOverlayMode();
  });

  let lastRenderedTick = -1;
  let lastSelectionSignature = '';
  let lastMinimapCameraSignature = '';
  let latestRenderState: RenderState | null = null;
  let isMinimapDragActive = false;

  // Slice 11: lightweight tooltip mechanism. Any descendant of `root` with a
  // `data-tooltip` attribute surfaces its copy in the shared tooltip element
  // on pointerenter and hides it on pointerleave. Event delegation on the
  // root keeps us cheap even when the selection panel re-renders.
  function positionTooltip(target: Element): void {
    if (!tooltip) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    let left = rect.left + rect.width * 0.5 - tooltipRect.width * 0.5;
    let top = rect.top - tooltipRect.height - margin;
    if (top < margin) {
      top = rect.bottom + margin;
    }
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function showTooltipFor(target: Element, text: string): void {
    if (!tooltip || text.trim().length === 0) {
      return;
    }

    tooltip.textContent = text;
    tooltip.dataset.hudTooltipActive = 'true';
    tooltip.setAttribute('aria-hidden', 'false');
    positionTooltip(target);
  }

  function hideTooltip(): void {
    if (!tooltip) {
      return;
    }
    tooltip.dataset.hudTooltipActive = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.textContent = '';
  }

  if (tooltip) {
    root.addEventListener('pointerover', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const host = target?.closest('[data-tooltip]');
      if (!host) {
        return;
      }
      const text = host.getAttribute('data-tooltip') ?? '';
      showTooltipFor(host, text);
    });
    root.addEventListener('pointerout', (event) => {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      const target = event.target instanceof Element ? event.target : null;
      const host = target?.closest('[data-tooltip]');
      if (!host) {
        return;
      }
      if (related && host.contains(related)) {
        return;
      }
      hideTooltip();
    });
    root.addEventListener('focusout', () => {
      hideTooltip();
    });
  }

  // Slice 11: lightweight toast stream. The simulation bridge exposes
  // consumeCommandRejection() which drains the newest rejection reason; the
  // HUD polls it on every update tick and pushes a DOM toast that fades
  // itself out after a short interval.
  const TOAST_LIFETIME_MS = 2400;
  function showToast(text: string): void {
    if (!toastContainer || text.trim().length === 0) {
      return;
    }
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.dataset.hud = 'toast';
    el.textContent = text;
    toastContainer.appendChild(el);
    // Flush layout so the enter transition has an initial state to animate from.
    void el.offsetWidth;
    el.dataset.hudToastActive = 'true';
    window.setTimeout(() => {
      el.dataset.hudToastActive = 'false';
      window.setTimeout(() => {
        el.remove();
      }, 240);
    }, TOAST_LIFETIME_MS);
  }

  if (minimap) {
    const handleMinimapPointer = (clientX: number, clientY: number): void => {
      const frame = latestRenderState?.frame;
      if (!frame) {
        return;
      }

      const layout = getMinimapLayout(minimap, frame);
      if (!layout) {
        return;
      }

      const bounds = minimap.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }
      const canvasScaleX = minimap.width / bounds.width;
      const canvasScaleY = minimap.height / bounds.height;
      const localX = (clientX - bounds.left) * canvasScaleX;
      const localY = (clientY - bounds.top) * canvasScaleY;
      if (
        localX < layout.offsetX
        || localX > layout.offsetX + layout.drawWidth
        || localY < layout.offsetY
        || localY > layout.offsetY + layout.drawHeight
      ) {
        return;
      }

      const normalizedX = (localX - layout.offsetX) / layout.drawWidth;
      const normalizedY = (localY - layout.offsetY) / layout.drawHeight;
      bridge.centerCameraOnWorldPosition(
        normalizedX * frame.mapWidth * CELL_SIZE,
        normalizedY * frame.mapHeight * CELL_SIZE,
      );
    };

    const handleTrackedMinimapMouseMove = (event: MouseEvent): void => {
      if (!isMinimapDragActive) {
        return;
      }

      if ((event.buttons & 1) === 0) {
        isMinimapDragActive = false;
        return;
      }

      handleMinimapPointer(event.clientX, event.clientY);
    };

    const handleTrackedMinimapMouseEnd = (): void => {
      isMinimapDragActive = false;
    };

    minimap.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }

      isMinimapDragActive = true;
      event.preventDefault();
      handleMinimapPointer(event.clientX, event.clientY);
    });
    minimap.addEventListener('mousemove', handleTrackedMinimapMouseMove);
    window.addEventListener('mousemove', handleTrackedMinimapMouseMove);
    window.addEventListener('mouseup', handleTrackedMinimapMouseEnd);
  }

  function renderSelectionPanel(selectionState: SelectionState): void {
    if (!selectionPanel) {
      return;
    }

    const signature = JSON.stringify(selectionState);
    if (signature === lastSelectionSignature) {
      return;
    }
    lastSelectionSignature = signature;

    const economyState = bridge.getEconomyState();
    const selectionIcons = renderSelectionIcons(selectionState, economyState);
    const selectionDetails = renderSelectionDetails(selectionState);

    const queueItems = selectionState.queue.length > 0
      ? selectionState.queue
        .map((entry, index) => {
          const progress = entry.totalTicks <= 0
            ? 100
            : Math.max(
              0,
              Math.min(100, Math.round(((entry.totalTicks - entry.remainingTicks) / entry.totalTicks) * 100)),
            );
          return `
            <div class="hud-queue-item" data-selection-queue-item="${index}">
              <div class="hud-queue-name">${formatQueueEntryName(entry)}</div>
              <div class="hud-queue-meta">${formatQueueProgress(progress)}</div>
              <div class="hud-queue-progress">
                <div class="hud-queue-progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          `;
        })
        .join('')
      : '';
    const placementMarkup = selectionState.placementMode
      ? `<div class="hud-selection-meta" data-placement-mode>Placing: ${formatEntityName(selectionState.placementMode)}</div>`
      : '';

    const buildButtons = selectionState.buildOptions
      .map(
        (buildingType) => `
          <button
            class="hud-command-button"
            data-command="build-${buildingType}"
            data-tooltip="${formatBuildTooltip(buildingType)}"
            type="button"
          >
            Build ${formatEntityName(buildingType)}
          </button>
        `,
      )
      .join('');
    const actionButtons = selectionState.actionOptions
      .map(
        (actionType) => `
          <button
            class="hud-command-button"
            data-command="action-${actionType}"
            data-tooltip="${formatActionTooltip(actionType)}"
            type="button"
          >
            ${formatActionName(actionType)}
          </button>
        `,
      )
      .join('');
    const trainButtons = selectionState.trainOptions
      .map(
        (unitType) => `
          <button
            class="hud-command-button"
            data-command="train-${unitType}"
            data-tooltip="${formatTrainTooltip(unitType)}"
            type="button"
          >
            Train ${formatEntityName(unitType)}
          </button>
        `,
      )
      .join('');
    const marketButtons = selectionState.marketOptions
      .map(
        (actionType) => `
          <button
            class="hud-command-button"
            data-command="market-${actionType}"
            data-tooltip="${formatMarketActionTooltip(actionType)}"
            type="button"
          >
            ${formatMarketActionName(actionType)}
          </button>
        `,
      )
      .join('');
    const researchButtons = selectionState.visibleResearchOptions
      .map((technologyType) => {
        const isAvailable = selectionState.researchOptions.includes(technologyType);
        return `
          <button
            class="hud-command-button"
            data-command="research-${technologyType}"
            data-tooltip="${formatResearchTooltip(technologyType)}"
            type="button"
            ${isAvailable ? '' : 'disabled aria-disabled="true" data-command-locked="true"'}
          >
            Research ${formatTechnologyName(technologyType)}
          </button>
        `;
      })
      .join('');

    selectionPanel.innerHTML = `
      <div class="hud-label">Selection</div>
      <div class="hud-selection-name" data-selection-name>${formatSelectionName(selectionState)}</div>
      ${selectionIcons}
      ${selectionDetails}
      ${queueItems ? `<div class="hud-queue-list" data-selection-queue-list>${queueItems}</div>` : ''}
      ${placementMarkup}
      <div class="hud-command-list">
        ${actionButtons}
        ${trainButtons}
        ${marketButtons}
        ${researchButtons}
        ${buildButtons}
      </div>
    `;

    selectionPanel
      .querySelectorAll<HTMLButtonElement>('[data-command^="train-"]')
      .forEach((button) => {
        const unitType = button.dataset.command?.replace('train-', '') as TrainableUnitType | undefined;
        if (!unitType) {
          return;
        }

        button.addEventListener('click', () => {
          bridge.queueTrainUnit(unitType);
        });
      });
    selectionPanel
      .querySelectorAll<HTMLButtonElement>('[data-command^="action-"]')
      .forEach((button) => {
        const actionType = button.dataset.command?.replace('action-', '') as ActionType | undefined;
        if (!actionType) {
          return;
        }

        button.addEventListener('click', () => {
          bridge.issueAction(actionType);
        });
      });
    selectionPanel
      .querySelectorAll<HTMLButtonElement>('[data-command^="market-"]')
      .forEach((button) => {
        const actionType = button.dataset.command?.replace('market-', '') as MarketActionType | undefined;
        if (!actionType) {
          return;
        }

        button.addEventListener('click', () => {
          bridge.issueMarketAction(actionType);
        });
      });
    selectionPanel
      .querySelectorAll<HTMLButtonElement>('[data-command^="research-"]')
      .forEach((button) => {
        const technologyType = button.dataset.command?.replace(
          'research-',
          '',
        ) as ResearchableTechnologyType | undefined;
        if (!technologyType) {
          return;
        }

        button.addEventListener('click', () => {
          bridge.queueResearch(technologyType);
        });
      });
    selectionPanel
      .querySelectorAll<HTMLButtonElement>('[data-command^="build-"]')
      .forEach((button) => {
        const buildingType = button.dataset.command?.replace('build-', '') as BuildableBuildingType | undefined;
        if (!buildingType) {
          return;
        }

        button.addEventListener('click', () => {
          bridge.beginBuildingPlacement(buildingType);
        });
      });
  }

  function update(): void {
    const hudState = bridge.getHudState();
    const renderState = bridge.getRenderState();
    latestRenderState = renderState;
    const selectionState = bridge.getSelectionState();
    const cameraState = bridge.getCameraState();

    if (food) food.textContent = String(hudState.playerResources.food);
    if (wood) wood.textContent = String(hudState.playerResources.wood);
    if (gold) gold.textContent = String(hudState.playerResources.gold);
    if (stone) stone.textContent = String(hudState.playerResources.stone);
    if (age) age.textContent = formatAgeName(hudState.currentAge);
    if (pop) pop.textContent = `${hudState.population.current}/${hudState.population.cap}`;
    if (time) time.textContent = formatMatchTime(hudState.tick, hudState.fpsTarget);
    if (matchSummary) {
      const shouldShowSummary =
        hudState.matchState.outcome !== 'running'
        && hudState.matchState.summary.trim().length > 0;
      matchSummary.hidden = !shouldShowSummary;
      if (shouldShowSummary) {
        // Slice 8: extended post-game card. First line: summary text.
        // Second: win condition label. Subsequent rows: per-owner score.
        // The HUD pattern keeps everything inside the single footer element
        // so the existing `[data-hud="match-summary"]` selector in browser
        // tests still finds the status text.
        matchSummary.innerHTML = renderMatchSummary(
          hudState.matchState.summary,
          hudState.matchState.winCondition,
          hudState.matchState.scores,
        );
      } else {
        matchSummary.innerHTML = '';
      }
    }

    if (countdownChip && countdownLabel && countdownValue) {
      // Slice 8: surface the human player's active countdown (Wonder or
      // Relic) in the top bar so the player sees the timer drop live.
      // Wonder takes precedence when both are active (rare; the first
      // countdown to start wins per the deterministic tie-break rule).
      const wonderTicks = hudState.matchState.wonderCountdownTicks;
      const relicTicks = hudState.matchState.relicCountdownTicks;
      const activeKind: 'wonder' | 'relic' | null =
        wonderTicks !== null
          ? 'wonder'
          : relicTicks !== null
            ? 'relic'
            : null;
      if (activeKind === null) {
        countdownChip.hidden = true;
      } else {
        countdownChip.hidden = false;
        const ticks = activeKind === 'wonder' ? wonderTicks! : relicTicks!;
        countdownLabel.textContent = activeKind === 'wonder' ? 'Wonder' : 'Relic';
        countdownValue.textContent = formatCountdownTicks(ticks, hudState.fpsTarget);
      }
    }
    renderSelectionPanel(selectionState);

    // Slice 11: drain any command-rejection reasons the bridge collected
    // since the last frame. `consumeCommandRejection()` pops one at a time
    // so multiple rejections in the same frame still show as individual
    // toasts without losing any of them.
    let rejection = bridge.consumeCommandRejection();
    while (rejection !== null) {
      showToast(rejection);
      rejection = bridge.consumeCommandRejection();
    }

    const minimapCameraSignature = cameraState
      ? `${cameraState.scrollX.toFixed(2)},${cameraState.scrollY.toFixed(2)},${cameraState.zoom.toFixed(3)}`
      : 'none';
    if (
      minimap
      && (renderState.tick !== lastRenderedTick || minimapCameraSignature !== lastMinimapCameraSignature)
    ) {
      drawMinimap(minimap, renderState, cameraState);
      lastRenderedTick = renderState.tick;
      lastMinimapCameraSignature = minimapCameraSignature;
    }

    renderDebugOverlay(hudState, selectionState);

    requestAnimationFrame(update);
  }

  // Slice 11: render a short text summary inside the debug overlay. The
  // off and selection-bounds modes leave the text empty; pathing /
  // fog-state modes show a single line with counts; ai-state and perf
  // modes show a small table. GameScene reads the mode separately for its
  // world-space drawing.
  function renderDebugOverlay(hudState: HudState, selectionState: SelectionState): void {
    if (!debugOverlay) {
      return;
    }

    if (debugOverlayMode === 'off') {
      debugOverlay.textContent = '';
      return;
    }

    if (debugOverlayMode === 'selection-bounds') {
      const count = selectionState.selectedEntityIds.length;
      debugOverlay.textContent = `Debug: selection-bounds (F2)\nSelected: ${count}`;
      return;
    }

    const snapshot = bridge.getDebugSnapshot();

    if (debugOverlayMode === 'pathing') {
      debugOverlay.textContent =
        `Debug: pathing (F2)\n`
        + `Active commands: ${snapshot.unitPaths.length}`;
      return;
    }

    if (debugOverlayMode === 'fog-state') {
      const frame = latestRenderState?.frame;
      const visible = frame?.visibleCells.length ?? 0;
      const explored = frame?.exploredCells.length ?? 0;
      const total = frame ? frame.mapWidth * frame.mapHeight : 0;
      const neverSeen = Math.max(0, total - explored);
      debugOverlay.textContent =
        `Debug: fog-state (F2)\n`
        + `Visible: ${visible}\n`
        + `Explored (not visible): ${Math.max(0, explored - visible)}\n`
        + `Never seen: ${neverSeen}`;
      return;
    }

    if (debugOverlayMode === 'ai-state') {
      const lines = ['Debug: ai-state (F2)'];
      for (const entry of snapshot.aiSummaries) {
        const targets = Object.entries(entry.villagerTargets)
          .map(([resource, count]) => `${resource}:${count}`)
          .join(' ');
        lines.push(
          `P${entry.owner} [${entry.difficulty}] ${entry.plan} attack=${entry.attackGroupSize} ${targets}`,
        );
      }
      debugOverlay.textContent = lines.join('\n');
      return;
    }

    if (debugOverlayMode === 'coarse-vs-fine') {
      // Slice 12 Task D: the scene draws the per-unit coarse → fine
      // line; the HUD pane just reports the unit count so the player
      // can confirm the overlay is actually on.
      debugOverlay.textContent =
        `Debug: coarse-vs-fine (F2)\n`
        + `Units tracked: ${snapshot.coarseVsFine?.length ?? 0}`;
      return;
    }

    // perf
    const tickMs = hudState.tickDurationMs.toFixed(2);
    debugOverlay.textContent =
      `Debug: perf (F2)\n`
      + `Tick: ${hudState.tick} (${tickMs}ms)\n`
      + `Entities: ${hudState.entityCount}\n`
      + `Visible entities: ${hudState.visibleEntities}`;
  }

  update();

  return {
    getDebugOverlayMode: () => debugOverlayMode,
    cycleDebugOverlayMode,
  };
}
