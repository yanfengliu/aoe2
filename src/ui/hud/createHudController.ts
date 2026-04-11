import type {
  HudState,
  RenderState,
} from '../../game/simulation/types';

interface HudBridge {
  getHudState(): HudState;
  getRenderState(): RenderState;
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
          <div class="hud-label">Visible</div>
          <div class="hud-value" data-hud="visible-cells">0</div>
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
        Phase 2 slice: deterministic starts, nearby resources, player fog of war,
        and a minimap now ride the same civ-engine render frame. Use arrow keys or
        WASD to pan and the mouse wheel to zoom.
      </div>
    </div>
  `;

  const tick = root.querySelector<HTMLElement>('[data-hud="tick"]');
  const entities = root.querySelector<HTMLElement>('[data-hud="entities"]');
  const projected = root.querySelector<HTMLElement>('[data-hud="projected"]');
  const visibleCells = root.querySelector<HTMLElement>('[data-hud="visible-cells"]');
  const exploredCells = root.querySelector<HTMLElement>('[data-hud="explored-cells"]');
  const tickMs = root.querySelector<HTMLElement>('[data-hud="tick-ms"]');
  const seed = root.querySelector<HTMLElement>('[data-hud="seed"]');
  const minimap = root.querySelector<HTMLCanvasElement>('[data-hud="minimap"]');

  let lastRenderedTick = -1;

  function update(): void {
    const hudState = bridge.getHudState();
    const renderState = bridge.getRenderState();

    if (tick) tick.textContent = String(hudState.tick);
    if (entities) entities.textContent = String(hudState.entityCount);
    if (projected) projected.textContent = String(hudState.visibleEntities);
    if (visibleCells) visibleCells.textContent = String(hudState.visibleCells);
    if (exploredCells) exploredCells.textContent = String(hudState.exploredCells);
    if (tickMs) tickMs.textContent = hudState.tickDurationMs.toFixed(2);
    if (seed) seed.textContent = hudState.seed;

    if (minimap && renderState.tick !== lastRenderedTick) {
      drawMinimap(minimap, renderState);
      lastRenderedTick = renderState.tick;
    }

    requestAnimationFrame(update);
  }

  update();
}
