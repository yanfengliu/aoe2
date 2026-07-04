// Line-of-sight techs (v0.1.80): Town Watch (Feudal TC, 75f — +4 building
// LoS), Town Patrol (Castle TC, 300f/200g, requires Town Watch — +4 more), and
// Tracking (Feudal Barracks, 75f — +2 infantry LoS). Effects are applied
// imperatively to existing entities' `visionSource.radius` on research (the
// visibility system fingerprints radius per tick, so a bump re-stamps the fog
// automatically) and derived at creation for future entities.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { researchCost, researchTimeTicks } from '../../src/game/simulation/prototypeEconomyRules';
import {
  buildingVisionBonus,
  unitVisionBonus,
} from '../../src/game/simulation/visionTechEffects';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { MAP_WIDTH } from '../../src/game/simulation/prototypeScenario';

const set = (...techs: ResearchableTechnologyType[]) => new Set(techs);

describe('LoS techs — costs and research times (technologies.csv rows 9/88/92)', () => {
  it('Town Watch: 75 food, 25 s × 10 TPS', () => {
    expect(researchCost('town-watch')).toEqual({ food: 75 });
    expect(researchTimeTicks('town-watch')).toBe(250);
  });
  it('Town Patrol: 300 food + 200 gold, 40 s × 10 TPS', () => {
    expect(researchCost('town-patrol')).toEqual({ food: 300, gold: 200 });
    expect(researchTimeTicks('town-patrol')).toBe(400);
  });
  it('Tracking: 75 food, 35 s × 10 TPS', () => {
    expect(researchCost('tracking')).toEqual({ food: 75 });
    expect(researchTimeTicks('tracking')).toBe(350);
  });
});

describe('LoS techs — pure vision bonuses', () => {
  it('buildingVisionBonus stacks Town Watch (+4) and Town Patrol (+4)', () => {
    expect(buildingVisionBonus(set())).toBe(0);
    expect(buildingVisionBonus(set('town-watch'))).toBe(4);
    expect(buildingVisionBonus(set('town-watch', 'town-patrol'))).toBe(8);
    // Town Patrol without Town Watch never occurs live (gated), but the pure
    // helper still counts only what is researched.
    expect(buildingVisionBonus(set('town-patrol'))).toBe(4);
    // Unrelated techs contribute nothing.
    expect(buildingVisionBonus(set('loom', 'husbandry'))).toBe(0);
  });

  it('unitVisionBonus grants +2 to INFANTRY only, with Tracking', () => {
    expect(unitVisionBonus(set('tracking'), 'militia')).toBe(2);
    expect(unitVisionBonus(set('tracking'), 'pikeman')).toBe(2);
    expect(unitVisionBonus(set(), 'militia')).toBe(0);
    expect(unitVisionBonus(set('tracking'), 'archer')).toBe(0);
    expect(unitVisionBonus(set('tracking'), 'villager')).toBe(0);
    expect(unitVisionBonus(set('tracking'), 'knight')).toBe(0);
  });
});

describe('LoS techs — offer gating', () => {
  it('the Dark-Age Town Center does not offer Town Watch; Feudal+ does (age gate)', () => {
    const dark = createSimulationBridge('aoe2-prototype');
    expect(dark.selectEntityAtCell(8, 8)).toBe(true);
    expect(dark.getSelectionState().selectedEntityType).toBe('town-center');
    expect(dark.getSelectionState().researchOptions).not.toContain('town-watch');
    expect(dark.getSelectionState().researchOptions).not.toContain('town-patrol');
  });

  it('Town Patrol is offered only after Town Watch is researched (prereq chain)', () => {
    const bridge = createSimulationBridge('los-techs-fixture');
    expect(bridge.selectEntityAtCell(4, 4)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('town-center');
    const before = bridge.getSelectionState();
    expect(before.researchOptions).toContain('town-watch');
    expect(before.researchOptions).not.toContain('town-patrol');
    // Visible-but-locked: town-patrol shows greyed from Castle Age onward.
    expect(before.visibleResearchOptions).toContain('town-patrol');

    expect(bridge.queueResearch('town-watch')).toBe(true);
    for (let i = 0; i < 260; i += 1) bridge.step(100);

    expect(bridge.selectEntityAtCell(4, 4)).toBe(true);
    const after = bridge.getSelectionState();
    expect(after.researchOptions).not.toContain('town-watch');
    expect(after.researchOptions).toContain('town-patrol');
  });

  it('the Barracks offers Tracking from Feudal on', () => {
    const bridge = createSimulationBridge('los-techs-fixture');
    expect(bridge.selectEntityAtCell(4, 10)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('barracks');
    expect(bridge.getSelectionState().researchOptions).toContain('tracking');
  });
});

describe('LoS techs — live fog effect (visionSource.radius bumps re-stamp visibility)', () => {
  const cellIndex = (x: number, y: number) => y * MAP_WIDTH + x;
  const isVisible = (bridge: ReturnType<typeof createSimulationBridge>, x: number, y: number) => {
    const frame = bridge.getRenderState().frame;
    return frame !== null && frame.visibleCells.includes(cellIndex(x, y));
  };

  it('Town Watch then Town Patrol each widen the Town Center fog reveal by +4', () => {
    const bridge = createSimulationBridge('los-techs-fixture');
    for (let i = 0; i < 5; i += 1) bridge.step(100);

    // TC at (4,4) with base vision 7: probe (13,4) is 9 out — dark. After Town
    // Watch (radius 11) it lights up; probe (17,4) at 13 out stays dark until
    // Town Patrol (radius 15).
    expect(isVisible(bridge, 13, 4)).toBe(false);
    expect(isVisible(bridge, 17, 4)).toBe(false);

    expect(bridge.selectEntityAtCell(4, 4)).toBe(true);
    expect(bridge.queueResearch('town-watch')).toBe(true);
    for (let i = 0; i < 260; i += 1) bridge.step(100);
    expect(isVisible(bridge, 13, 4)).toBe(true);
    expect(isVisible(bridge, 17, 4)).toBe(false);

    expect(bridge.selectEntityAtCell(4, 4)).toBe(true);
    expect(bridge.queueResearch('town-patrol')).toBe(true);
    for (let i = 0; i < 410; i += 1) bridge.step(100);
    expect(isVisible(bridge, 17, 4)).toBe(true);
  }, 60_000);

  it('Tracking widens a standing Militia fog reveal by +2', () => {
    const bridge = createSimulationBridge('los-techs-fixture');
    for (let i = 0; i < 5; i += 1) bridge.step(100);

    // Militia parked at (30,4) with base vision 3 (canonical): probe (34,4) is
    // 4 out — dark (16 > 9) until Tracking lifts the radius to 5 (16 <= 25).
    expect(isVisible(bridge, 34, 4)).toBe(false);

    expect(bridge.selectEntityAtCell(4, 10)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('barracks');
    expect(bridge.queueResearch('tracking')).toBe(true);
    for (let i = 0; i < 360; i += 1) bridge.step(100);
    expect(isVisible(bridge, 34, 4)).toBe(true);
  }, 60_000);
});
