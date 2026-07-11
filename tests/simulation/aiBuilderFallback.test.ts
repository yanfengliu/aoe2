import { describe, expect, it } from 'vitest';

import { createOwnerProducerHelpers } from '../../src/game/simulation/bridge/systems/aiSystemGating';
import type { UnitCommand } from '../../src/game/simulation/bridge/sharedTypes';

// Full-review L3: the AI's builder-selection fallback used to return ANY owned
// unclaimed villager, including one already building a foundation. Combined with
// the uncapped watch-tower push, that could yank the SOLE builder off an
// in-progress foundation and leave it builderless. The fallback must skip
// `type: 'build'` villagers (reassigning a gatherer/mover is fine).
function stubWorld(units: Array<{ id: number; owner: number; unitType: string }>) {
  const byId = new Map(units.map((u) => [u.id, u]));
  return {
    query: (comp: string) => (comp === 'unit' ? byId.keys() : [].values()),
    getComponent: (id: number, comp: string) => (comp === 'unit' ? byId.get(id) : undefined),
  } as never;
}
const accessorStub = { get: () => new Map() } as never;
const buildCmd = { type: 'build' } as UnitCommand;
const moveCmd = { type: 'move' } as UnitCommand;

describe('findAvailableVillagerForBuild — never yanks a foundation builder (full-review L3)', () => {
  it('skips a building villager in the fallback even when it comes first', () => {
    // id 1 is BUILDING (iterated first), id 2 is MOVING. Both busy, so the first
    // loop finds nothing and the fallback runs.
    const world = stubWorld([
      { id: 1, owner: 2, unitType: 'villager' },
      { id: 2, owner: 2, unitType: 'villager' },
    ]);
    const unitCommands = new Map<number, UnitCommand>([
      [1, buildCmd],
      [2, moveCmd],
    ]);
    const { findAvailableVillagerForBuild } = createOwnerProducerHelpers(
      world,
      accessorStub,
      2,
      unitCommands,
      new Map(),
      new Map(),
    );
    // Pre-fix this returned 1 (the builder). It must skip the builder and pick
    // the mover (2) instead.
    expect(findAvailableVillagerForBuild(2)).toBe(2);
  });

  it('returns null rather than reassign the SOLE builder of a foundation', () => {
    const world = stubWorld([{ id: 2, owner: 2, unitType: 'villager' }]);
    const unitCommands = new Map<number, UnitCommand>([[2, buildCmd]]);
    const { findAvailableVillagerForBuild } = createOwnerProducerHelpers(
      world,
      accessorStub,
      2,
      unitCommands,
      new Map(),
      new Map(),
    );
    // The only villager is building; the uncapped watch-tower push must NOT yank
    // it — return null so the build is simply skipped this tick.
    expect(findAvailableVillagerForBuild(2)).toBeNull();
  });
});
