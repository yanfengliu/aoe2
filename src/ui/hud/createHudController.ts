import type {
  BuildingType,
  HudState,
  RenderState,
  SelectionState,
  UnitType,
} from '../../game/simulation/types';

interface HudBridge {
  getHudState(): HudState;
  getRenderState(): RenderState;
  getSelectionState(): SelectionState;
  queueTrainUnit(unitType: Extract<UnitType, 'villager'>): boolean;
  beginBuildingPlacement(buildingType: Extract<BuildingType, 'house'>): boolean;
}

function tintToCss(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}

function drawMinimap(canvas: HTMLCanvasElement, renderState: RenderState): void {
  const frame = renderState.frame;
  if (!frame) {
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const scale = Math.min(
    canvas.width / frame.mapWidth,
    canvas.height / frame.mapHeight,
  );
  const drawWidth = frame.mapWidth * scale;
  const drawHeight = frame.mapHeight * scale;
  const offsetX = (canvas.width - drawWidth) * 0.5;
  const offsetY = (canvas.height - drawHeight) * 0.5;
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
    case 'villager':
      return 'Villager';
    case 'scout':
      return 'Scout Cavalry';
    default:
      return entityType;
  }
}

export function createHudController(root: HTMLElement, bridge: HudBridge): void {
  root.innerHTML = `
    <div class="hud-top">
      <div class="hud-bar">
        <div class="hud-chip">
          <div class="hud-label">Tick</div>
          <div class="hud-value" data-hud="tick">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Entities</div>
          <div class="hud-value" data-hud="entities">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Projected</div>
          <div class="hud-value" data-hud="projected">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Food</div>
          <div class="hud-value" data-hud="food">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Wood</div>
          <div class="hud-value" data-hud="wood">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Gold</div>
          <div class="hud-value" data-hud="gold">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Stone</div>
          <div class="hud-value" data-hud="stone">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Pop</div>
          <div class="hud-value" data-hud="pop">0/0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Visible</div>
          <div class="hud-value" data-hud="visible-cells">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">World</div>
          <div class="hud-value" data-hud="world">0x0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Explored</div>
          <div class="hud-value" data-hud="explored-cells">0</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Tick ms</div>
          <div class="hud-value" data-hud="tick-ms">0.00</div>
        </div>
        <div class="hud-chip">
          <div class="hud-label">Seed</div>
          <div class="hud-value" data-hud="seed">-</div>
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
      <div class="hud-footer">
        Phase 3 slice: select units and buildings on the map, queue Villagers from
        the Town Center, place Houses with Villagers, pan with arrow keys or WASD,
        and use the mouse wheel to zoom.
      </div>
    </div>
  `;

  const tick = root.querySelector<HTMLElement>('[data-hud="tick"]');
  const entities = root.querySelector<HTMLElement>('[data-hud="entities"]');
  const projected = root.querySelector<HTMLElement>('[data-hud="projected"]');
  const food = root.querySelector<HTMLElement>('[data-hud="food"]');
  const wood = root.querySelector<HTMLElement>('[data-hud="wood"]');
  const gold = root.querySelector<HTMLElement>('[data-hud="gold"]');
  const stone = root.querySelector<HTMLElement>('[data-hud="stone"]');
  const pop = root.querySelector<HTMLElement>('[data-hud="pop"]');
  const visibleCells = root.querySelector<HTMLElement>('[data-hud="visible-cells"]');
  const world = root.querySelector<HTMLElement>('[data-hud="world"]');
  const exploredCells = root.querySelector<HTMLElement>('[data-hud="explored-cells"]');
  const tickMs = root.querySelector<HTMLElement>('[data-hud="tick-ms"]');
  const seed = root.querySelector<HTMLElement>('[data-hud="seed"]');
  const minimap = root.querySelector<HTMLCanvasElement>('[data-hud="minimap"]');
  const selectionPanel = root.querySelector<HTMLElement>('[data-hud="selection-panel"]');

  let lastRenderedTick = -1;
  let lastSelectionSignature = '';

  function renderSelectionPanel(selectionState: SelectionState): void {
    if (!selectionPanel) {
      return;
    }

    const signature = JSON.stringify(selectionState);
    if (signature === lastSelectionSignature) {
      return;
    }
    lastSelectionSignature = signature;

    const queueText = selectionState.queue.length > 0
      ? `${selectionState.queue.length} queued`
      : 'Queue empty';
    const placementText = selectionState.placementMode
      ? `Placing: ${formatEntityName(selectionState.placementMode)}`
      : 'Placement: Off';

    selectionPanel.innerHTML = `
      <div class="hud-label">Selection</div>
      <div class="hud-selection-name" data-selection-name>${formatEntityName(selectionState.selectedEntityType)}</div>
      <div class="hud-selection-meta">
        ${selectionState.x === null || selectionState.y === null ? 'No active entity.' : `Tile ${selectionState.x}, ${selectionState.y}`}
      </div>
      <div class="hud-selection-meta" data-selection-queue>${queueText}</div>
      <div class="hud-selection-meta" data-placement-mode>${placementText}</div>
      <div class="hud-command-list">
        ${selectionState.trainOptions.includes('villager')
          ? '<button class="hud-command-button" data-command="train-villager" type="button">Train Villager</button>'
          : ''}
        ${selectionState.buildOptions.includes('house')
          ? '<button class="hud-command-button" data-command="build-house" type="button">Build House</button>'
          : ''}
      </div>
    `;

    selectionPanel
      .querySelector<HTMLButtonElement>('[data-command="train-villager"]')
      ?.addEventListener('click', () => {
        bridge.queueTrainUnit('villager');
      });
    selectionPanel
      .querySelector<HTMLButtonElement>('[data-command="build-house"]')
      ?.addEventListener('click', () => {
        bridge.beginBuildingPlacement('house');
      });
  }

  function update(): void {
    const hudState = bridge.getHudState();
    const renderState = bridge.getRenderState();
    const selectionState = bridge.getSelectionState();

    if (tick) tick.textContent = String(hudState.tick);
    if (entities) entities.textContent = String(hudState.entityCount);
    if (projected) projected.textContent = String(hudState.visibleEntities);
    if (food) food.textContent = String(hudState.playerResources.food);
    if (wood) wood.textContent = String(hudState.playerResources.wood);
    if (gold) gold.textContent = String(hudState.playerResources.gold);
    if (stone) stone.textContent = String(hudState.playerResources.stone);
    if (pop) pop.textContent = `${hudState.population.current}/${hudState.population.cap}`;
    if (visibleCells) visibleCells.textContent = String(hudState.visibleCells);
    if (world) world.textContent = hudState.worldSize;
    if (exploredCells) exploredCells.textContent = String(hudState.exploredCells);
    if (tickMs) tickMs.textContent = hudState.tickDurationMs.toFixed(2);
    if (seed) seed.textContent = hudState.seed;
    renderSelectionPanel(selectionState);

    if (minimap && renderState.tick !== lastRenderedTick) {
      drawMinimap(minimap, renderState);
      lastRenderedTick = renderState.tick;
    }

    requestAnimationFrame(update);
  }

  update();
}
