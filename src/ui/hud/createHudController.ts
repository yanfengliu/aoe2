import type {
  ActionType,
  BuildableBuildingType,
  HudState,
  MarketActionType,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  RenderState,
  SelectionState,
  TrainableUnitType,
} from '../../game/simulation/types';

interface HudBridge {
  getHudState(): HudState;
  getRenderState(): RenderState;
  getSelectionState(): SelectionState;
  issueAction(actionType: ActionType): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
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
    default:
      return entityType;
  }
}

function formatTechnologyName(technologyType: ResearchableTechnologyType): string {
  switch (technologyType) {
    case 'feudal-age':
      return 'Feudal Age';
    case 'castle-age':
      return 'Castle Age';
    case 'fletching':
      return 'Fletching';
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
          <div class="hud-label">Age</div>
          <div class="hud-value" data-hud="age">Dark Age</div>
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
        <div class="hud-chip">
        <div class="hud-label">Outcome</div>
        <div class="hud-value" data-hud="match-outcome">Running</div>
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
      <div class="hud-footer" data-hud="match-summary">
        Current slice: run the Dark Age economy, reach Feudal and Castle
        Age, place Town Centers, Stables, Archery Ranges, Blacksmiths, and
        Markets, research ranged upgrades, exchange resources, and command
        Militia, Scout Cavalry, Archers, or Knights while panning with WASD
        or the arrow keys and zooming with the mouse wheel.
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
  const age = root.querySelector<HTMLElement>('[data-hud="age"]');
  const pop = root.querySelector<HTMLElement>('[data-hud="pop"]');
  const visibleCells = root.querySelector<HTMLElement>('[data-hud="visible-cells"]');
  const world = root.querySelector<HTMLElement>('[data-hud="world"]');
  const exploredCells = root.querySelector<HTMLElement>('[data-hud="explored-cells"]');
  const tickMs = root.querySelector<HTMLElement>('[data-hud="tick-ms"]');
  const seed = root.querySelector<HTMLElement>('[data-hud="seed"]');
  const matchOutcome = root.querySelector<HTMLElement>('[data-hud="match-outcome"]');
  const matchSummary = root.querySelector<HTMLElement>('[data-hud="match-summary"]');
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
              <div class="hud-queue-meta">${entry.remainingTicks} ticks remaining</div>
              <div class="hud-queue-progress">
                <div class="hud-queue-progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          `;
        })
        .join('')
      : '<div class="hud-selection-meta">No queued actions.</div>';
    const placementText = selectionState.placementMode
      ? `Placing: ${formatEntityName(selectionState.placementMode)}`
      : 'Placement: Off';

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
    const researchButtons = selectionState.researchOptions
      .map(
        (technologyType) => `
          <button
            class="hud-command-button"
            data-command="research-${technologyType}"
            type="button"
          >
            Research ${formatTechnologyName(technologyType)}
          </button>
        `,
      )
      .join('');

    selectionPanel.innerHTML = `
      <div class="hud-label">Selection</div>
      <div class="hud-selection-name" data-selection-name>${formatEntityName(selectionState.selectedEntityType)}</div>
      <div class="hud-selection-meta">
        ${selectionState.x === null || selectionState.y === null ? 'No active entity.' : `Tile ${selectionState.x}, ${selectionState.y}`}
      </div>
      <div class="hud-selection-meta" data-selection-queue>${queueText}</div>
      <div class="hud-queue-list" data-selection-queue-list>${queueItems}</div>
      <div class="hud-selection-meta" data-placement-mode>${placementText}</div>
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
    const selectionState = bridge.getSelectionState();

    if (tick) tick.textContent = String(hudState.tick);
    if (entities) entities.textContent = String(hudState.entityCount);
    if (projected) projected.textContent = String(hudState.visibleEntities);
    if (food) food.textContent = String(hudState.playerResources.food);
    if (wood) wood.textContent = String(hudState.playerResources.wood);
    if (gold) gold.textContent = String(hudState.playerResources.gold);
    if (stone) stone.textContent = String(hudState.playerResources.stone);
    if (age) age.textContent = formatAgeName(hudState.currentAge);
    if (pop) pop.textContent = `${hudState.population.current}/${hudState.population.cap}`;
    if (visibleCells) visibleCells.textContent = String(hudState.visibleCells);
    if (world) world.textContent = hudState.worldSize;
    if (exploredCells) exploredCells.textContent = String(hudState.exploredCells);
    if (tickMs) tickMs.textContent = hudState.tickDurationMs.toFixed(2);
    if (seed) seed.textContent = hudState.seed;
    if (matchOutcome) {
      matchOutcome.textContent =
        hudState.matchState.outcome === 'running'
          ? 'Running'
          : hudState.matchState.outcome === 'victory'
            ? 'Victory'
            : 'Defeat';
    }
    if (matchSummary) {
      matchSummary.textContent = hudState.matchState.summary;
    }
    renderSelectionPanel(selectionState);

    if (minimap && renderState.tick !== lastRenderedTick) {
      drawMinimap(minimap, renderState);
      lastRenderedTick = renderState.tick;
    }

    requestAnimationFrame(update);
  }

  update();
}
