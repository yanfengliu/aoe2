// AI-vs-AI harness enablement (2026-07-01). The deterministic headless
// playtest is AI(owner 2) vs an INERT owner 1 — the human slot never gets an
// AI (scenarioSeedOps gates AI seeding on `owner !== humanPlayerId`), so a
// deterministic corpus run is not a competitive match and can't surface combat
// gaps. `forceAiForOwners` is a headless-only override that seeds an AI for the
// listed owners even if one is the human slot, WITHOUT changing the real game
// (which never passes the option). This is the plumbing the deterministic
// corpus uses to run a genuine AI-vs-AI match.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('AI-vs-AI: forceAiForOwners drives the human slot', () => {
  it('does not seed an AI for the human slot by default', () => {
    const bridge = createSimulationBridge('default-seed');
    for (let i = 0; i < 30; i += 1) bridge.step(100);
    const owners = bridge.getDebugSnapshot().aiSummaries.map((s) => s.owner);
    // Owner 2 (the enemy) is AI; owner 1 (the human slot) is NOT.
    expect(owners).toContain(2);
    expect(owners).not.toContain(1);
  });

  it('seeds an AI for the human slot when forceAiForOwners includes it, and that AI develops the economy', () => {
    const bridge = createSimulationBridge('default-seed', { forceAiForOwners: new Set([1]) });
    for (let i = 0; i < 30; i += 1) bridge.step(100);
    // Both owners now have an AI plan — a genuine AI-vs-AI match.
    const owners = bridge.getDebugSnapshot().aiSummaries.map((s) => s.owner);
    expect(owners).toContain(1);
    expect(owners).toContain(2);

    // And the forced AI actually drives owner 1: given time it trains villagers
    // and builds beyond its starting Town Center (the inert human slot would
    // stay at 3 villagers / 1 building forever).
    for (let i = 0; i < 800; i += 1) bridge.step(100);
    const eco = bridge.getEconomyState();
    const buildings = eco.buildings.filter((b) => b.owner === 1).length;
    const villagers = eco.units.filter((u) => u.owner === 1 && u.unitType === 'villager').length;
    expect(buildings).toBeGreaterThan(1);
    expect(villagers).toBeGreaterThan(3);
    // Generous margin: the 830 sim steps run ~8s isolated / ~30s under heavy
    // full-suite contention; 120s keeps a ~4x headroom for slow/loaded CI (the
    // step count is sim-ticks, not wall-clock — each tick computes in ms).
  }, 120_000);
});
