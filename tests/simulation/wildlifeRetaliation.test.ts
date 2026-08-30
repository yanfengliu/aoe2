// A unit attacked by wildlife fights back.
//
// Without this a wolf is an unopposable killer: wildlife are `resource`
// entities, not `unit` entities, so nothing in the auto-aggression path can
// even see one, and a bitten villager stood still and died. Measured on
// `wolf-aggro-fixture` before the fix — one villager, one wolf, 1200 ticks:
// the villager was gone and the wolf was at full health, untouched.
//
// The assertions are on the MECHANISM — the wolf takes damage — rather than on
// who wins. A 25 HP villager against a 25 HP wolf is close enough that an
// outcome assertion would be pinning an arithmetic coincidence.
//
// The scope of the retaliation is deliberately narrow, and the third test is
// why. Issuing an attack REPLACES the victim's whole command, discarding
// shift-queued waypoints and build refs, trade-route state, and — through
// `clearGathererOrder` — gather progress and the explicit assignment. A first
// version retaliated for any unit that was not already attacking, and review
// measured the cost: a house foundation frozen at 0/120 that otherwise reached
// 43/120, and the spec-mandated boar lure made unplayable because the retreat
// order that defines it was overwritten by the boar's next bite. Only a unit
// with NO order retaliates.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

function wolfHealth(bridge: Bridge): { id: number; currentHp: number; maxHp: number } | null {
  const wolf = bridge
    .getEconomyState()
    .resources.find((resource) => resource.resourceType === 'wolf');
  if (!wolf) return null;
  const health = bridge.getEntityHealth(wolf.id);
  return health ? { id: wolf.id, ...health } : null;
}

/** Lowest HP the wolf reaches over `ticks`; 0 if it dies (it leaves the set). */
function lowestWolfHealthOver(bridge: Bridge, ticks: number): number {
  const start = wolfHealth(bridge);
  expect(start, 'fixture must start with a living wolf').not.toBeNull();
  let lowest = start!.currentHp;
  for (let tick = 0; tick < ticks; tick += 1) {
    bridge.step(100);
    const now = wolfHealth(bridge);
    if (!now) return 0;
    lowest = Math.min(lowest, now.currentHp);
  }
  return lowest;
}

describe('wildlife retaliation', () => {
  it('an idle villager bitten by a wolf fights back', () => {
    const bridge = createSimulationBridge('wolf-aggro-fixture');
    const maxHp = wolfHealth(bridge)!.maxHp;
    expect(
      lowestWolfHealthOver(bridge, 1200),
      'the wolf was never damaged — nothing fought back',
    ).toBeLessThan(maxHp);
  }, 60_000);

  it('a wolf that fights nobody is never damaged', () => {
    // The control, and it STEPS — the first version of this asserted a wolf
    // was at full health at tick 0, which no implementation could fail. With
    // 1200 ticks actually run, ambient damage of any kind would show up here
    // and disqualify the reading above.
    const bridge = createSimulationBridge('wolf-idle-fixture');
    const maxHp = wolfHealth(bridge)!.maxHp;
    expect(
      lowestWolfHealthOver(bridge, 1200),
      'a wolf that attacked nobody lost health — the retaliation reading is not trustworthy',
    ).toBe(maxHp);
  }, 60_000);

  it('does not throw away an order the player gave', () => {
    // The regression this narrow scope exists to prevent, asserted on the
    // MECHANISM — does the build command survive the bite — rather than on an
    // outcome. Two earlier versions of this test did not red-check: "the
    // villager moved at least one cell" passed because the wide guard froze it
    // one cell out, and "the foundation advanced" passed because on
    // `wolf-aggro-fixture` the house completed before the wolf ever mattered,
    // under BOTH behaviours. The fixture here puts the wolf at the villager's
    // shoulder so the bite lands on tick one and the question is decided.
    const bridge = createSimulationBridge('wolf-at-shoulder-fixture');
    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.unitType === 'villager')!;

    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(24, 24)).toBe(true);

    // `activeVerb` is 'building' exactly while a build/repair command is live
    // — the same `unitCommands` read the HUD uses. If the retaliation replaced
    // the command, the villager never reaches that state at all.
    let sawBuilding = false;
    for (let tick = 0; tick < 600 && !sawBuilding; tick += 1) {
      bridge.step(100);
      sawBuilding = bridge
        .getRenderState()
        .entities.some((entity) => entity.entityType === 'villager' && entity.activeVerb === 'building');
    }

    expect(sawBuilding, 'the villager never started building — its order was overwritten')
      .toBe(true);
  }, 60_000);
});
