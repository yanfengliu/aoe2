import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findCastle(bridge: Bridge) {
  return bridge
    .getEconomyState()
    .buildings.find((b) => b.buildingType === 'castle' && b.owner === 2);
}

function findCastleInRender(bridge: Bridge) {
  return bridge
    .getRenderState()
    .entities.find(
      (e) => e.kind === 'building' && e.entityType === 'castle' && e.owner === 2,
    );
}

describe('iter-3 V3-1 + V3-2 — footprint visibility consistency for buildings', () => {
  it('renders the partially-visible enemy castle (projector contract)', () => {
    // Player-1 scout has radius-4 vision; its line-of-sight covers the
    // (18, 16) far corner of player-2's 4x4 castle anchored at (15, 13)
    // but does NOT cover the (15, 13) anchor (distance 8). The projector
    // already uses isFootprintVisible — confirm the castle is in the
    // live render frame.
    const bridge = createSimulationBridge('fog-memory-castle-edge-fixture');
    bridge.step(100);

    const renderCastle = findCastleInRender(bridge);
    expect(renderCastle).toBeDefined();
    expect(renderCastle!.isMemory).toBe(false);
  });

  it('writes the partially-visible enemy castle to fog memory', () => {
    // V3-1: prototypeFogMemory's anchor-only visibility check meant the
    // partially-visible castle was rendered (projector uses footprint
    // visibility) but never persisted to fog memory, so it disappeared
    // entirely once vision was lost. With the fix, fog-memory refresh
    // also uses footprint visibility and the castle survives as a
    // memory entity after the scout walks away.
    const bridge = createSimulationBridge('fog-memory-castle-edge-fixture');
    // A few ticks for visibility + fog memory to settle.
    for (let i = 0; i < 3; i += 1) {
      bridge.step(100);
    }

    // Scout walks away to a position from which no castle cell is in
    // vision. Move the scout north-east beyond radius 4 from any cell
    // of (15..18, 13..16). Target (40, 4) is far away in both axes.
    const scout = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'scout');
    expect(scout).toBeDefined();
    expect(bridge.selectEntityAtCell(scout!.x, scout!.y)).toBe(true);
    expect(bridge.issueMoveCommand(40, 4)).toBe(true);

    // Step long enough for the scout to walk far away and visibility to
    // stop overlapping any castle cell.
    for (let i = 0; i < 600; i += 1) {
      bridge.step(100);
    }

    const memoryCastle = findCastleInRender(bridge);
    expect(memoryCastle).toBeDefined();
    expect(memoryCastle!.isMemory).toBe(true);
    // Memory must store the castle at its true anchor + footprint.
    expect(memoryCastle!.x).toBe(15);
    expect(memoryCastle!.y).toBe(13);
  }, 30_000);

  it('selects the partially-visible enemy castle when clicking a visible non-anchor cell', () => {
    // V3-2: getSelectableEntitiesAtCell filtered buildings via
    // isVisibleToHuman (anchor only), so a click on the visible
    // (18, 16) corner returned no selectable building — even though
    // buildingOccupiesCell correctly reported the building is on that
    // cell. With the fix, the click-selection path uses
    // isEntityFootprintVisibleToHuman instead and the click works.
    const bridge = createSimulationBridge('fog-memory-castle-edge-fixture');
    bridge.step(100);

    const castle = findCastle(bridge);
    expect(castle).toBeDefined();

    // Click the visible far-corner cell. Selection state must report
    // the castle. Pre-fix, the anchor-only visibility filter dropped
    // the candidate before the buildingOccupiesCell match; the click
    // returned no selection at all.
    expect(bridge.selectEntityAtCell(18, 16)).toBe(true);
    const selection = bridge.getSelectionState();
    expect(selection.selectedKind).toBe('building');
    expect(selection.selectedEntityType).toBe('castle');
    expect(selection.selectedEntityId).toBe(castle!.id);

    // Sanity: clicking an empty cell well outside the castle returns
    // false. Confirms the test is exercising the cell-on-castle path.
    expect(bridge.selectEntityAtCell(40, 4)).toBe(false);
  });
});

describe('iter-4 V4-3 — fog-memory cleanup uses footprint visibility', () => {
  it('clears the destroyed-castle memory entry when only a non-anchor footprint cell is visible', () => {
    // Setup: scout at (20, 16) sees only (18, 16) of the 4x4 castle anchored at
    // (15, 13). A Siege Ram south of the castle with vision radius 1 destroys
    // it in a single hit (Ram +250 anti-building, castle startHp 200), but its
    // narrow vision keeps the castle anchor (15, 13) outside player-1 LOS even
    // while the ram is alive. After destruction, the only player-1 visibility
    // over the castle's old footprint is the scout's (18, 16) — a NON-anchor
    // cell. Pre-fix, the fog-memory cleanup checked the anchor only, so the
    // memory entry persisted forever. Post-fix, it checks the full footprint
    // and clears the memory.
    const bridge = createSimulationBridge('fog-memory-castle-destroy-edge-fixture');

    // Settle visibility + fog memory.
    for (let i = 0; i < 3; i += 1) {
      bridge.step(100);
    }

    const castle = findCastle(bridge);
    expect(castle).toBeDefined();

    // Castle is currently a live render entity, NOT a memory ghost.
    const liveCastle = findCastleInRender(bridge);
    expect(liveCastle).toBeDefined();
    expect(liveCastle!.isMemory).toBe(false);

    // Issue Siege Ram → Castle attack. Ram has +250 anti-building, castle
    // starts at 200 HP, so a single hit destroys it.
    expect(selectOwnedUnitDirect(bridge, 1, 'siege-ram')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(castle!.id)).toBe(true);

    // Wait until the castle is gone from the live world.
    expect(
      stepBridgeUntil(
        bridge,
        () => findCastle(bridge) === undefined,
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Extra ticks for the fog-memory cleanup pass to run after destruction.
    for (let i = 0; i < 3; i += 1) {
      bridge.step(100);
    }

    // Post-fix expectation: the castle is no longer in the render state at
    // all. Pre-fix, the memory entry would persist (anchor in fog) and the
    // castle would still appear with isMemory=true.
    const ghost = findCastleInRender(bridge);
    expect(ghost).toBeUndefined();
  }, 30_000);
});
