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
}

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

function renderSelectionDetail(
  key: 'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
  label: string,
  value: string,
): string {
  return `
    <div class="hud-selection-detail" data-selection-detail="${key}">
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
    case 'fletching':
      return 'Fletching';
    case 'crossbowman-upgrade':
      return 'Crossbowman';
    case 'pikeman-upgrade':
      return 'Pikeman';
    case 'light-cavalry-upgrade':
      return 'Light Cavalry';
  }
}

function formatActionName(actionType: ActionType): string {
  switch (actionType) {
    case 'ungarrison':
      return 'Ungarrison';
  }
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

export function createHudController(root: HTMLElement, bridge: HudBridge): void {
  root.innerHTML = `
    <div class="hud-top">
      <div class="hud-bar">
        <div class="hud-chip" data-hud-chip="food">
          <div class="hud-label">Food</div>
          <div class="hud-value" data-hud="food">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="wood">
          <div class="hud-label">Wood</div>
          <div class="hud-value" data-hud="wood">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="gold">
          <div class="hud-label">Gold</div>
          <div class="hud-value" data-hud="gold">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="stone">
          <div class="hud-label">Stone</div>
          <div class="hud-value" data-hud="stone">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="age">
          <div class="hud-label">Age</div>
          <div class="hud-value" data-hud="age">Dark Age</div>
        </div>
        <div class="hud-chip" data-hud-chip="pop">
          <div class="hud-label">Pop</div>
          <div class="hud-value" data-hud="pop">0/0</div>
        </div>
        <div class="hud-chip" data-hud-chip="time">
          <div class="hud-label">Time</div>
          <div class="hud-value" data-hud="time">00:00</div>
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
  `;

  const food = root.querySelector<HTMLElement>('[data-hud="food"]');
  const wood = root.querySelector<HTMLElement>('[data-hud="wood"]');
  const gold = root.querySelector<HTMLElement>('[data-hud="gold"]');
  const stone = root.querySelector<HTMLElement>('[data-hud="stone"]');
  const age = root.querySelector<HTMLElement>('[data-hud="age"]');
  const pop = root.querySelector<HTMLElement>('[data-hud="pop"]');
  const time = root.querySelector<HTMLElement>('[data-hud="time"]');
  const matchSummary = root.querySelector<HTMLElement>('[data-hud="match-summary"]');
  const minimap = root.querySelector<HTMLCanvasElement>('[data-hud="minimap"]');
  const selectionPanel = root.querySelector<HTMLElement>('[data-hud="selection-panel"]');

  let lastRenderedTick = -1;
  let lastSelectionSignature = '';
  let lastMinimapCameraSignature = '';
  let latestRenderState: RenderState | null = null;
  let isMinimapDragActive = false;

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
      matchSummary.textContent = shouldShowSummary ? hudState.matchState.summary : '';
    }
    renderSelectionPanel(selectionState);

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

    requestAnimationFrame(update);
  }

  update();
}
