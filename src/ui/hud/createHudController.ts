import type { HudState } from '../../game/simulation/types';

interface HudBridge {
  getHudState(): HudState;
}

export function createHudController(root: HTMLElement, bridge: HudBridge): void {
  root.innerHTML = `
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
        <div class="hud-label">Tick ms</div>
        <div class="hud-value" data-hud="tick-ms">0.00</div>
      </div>
      <div class="hud-chip">
        <div class="hud-label">World</div>
        <div class="hud-value" data-hud="world">0x0</div>
      </div>
    </div>
    <div class="hud-footer">
      Phase 0 bootstrap: Phaser scene renders a civ-engine world through a local
      render adapter and debugger boundary. Use arrow keys or WASD to pan and
      the mouse wheel to zoom.
    </div>
  `;

  const tick = root.querySelector<HTMLElement>('[data-hud="tick"]');
  const entities = root.querySelector<HTMLElement>('[data-hud="entities"]');
  const projected = root.querySelector<HTMLElement>('[data-hud="projected"]');
  const tickMs = root.querySelector<HTMLElement>('[data-hud="tick-ms"]');
  const world = root.querySelector<HTMLElement>('[data-hud="world"]');

  function update(): void {
    const state = bridge.getHudState();
    if (tick) tick.textContent = String(state.tick);
    if (entities) entities.textContent = String(state.entityCount);
    if (projected) projected.textContent = String(state.visibleEntities);
    if (tickMs) tickMs.textContent = state.tickDurationMs.toFixed(2);
    if (world) world.textContent = state.worldSize;
    requestAnimationFrame(update);
  }

  update();
}
