// Regression for full-review iter-1 Gemini MAJOR: `pruneOrphanEntityKeys`
// only validates map KEYS. Maps that store entity IDs in their VALUES
// (`garrisonedByBuilding` arrays, `garrisonedUnitToBuilding` value,
// `monkCarriedRelic` value) had dead-id orphans survive load.
//
// The cross-reference invariant doesn't catch the dead-id case because
// when both ends of the relationship reference dead entities, the maps
// "look consistent" with each other (`garrisonedByBuilding[B] = [U]`,
// `garrisonedUnitToBuilding[U] = B`, both live as values, but the underlying
// world entity table has no U or B). So the load passes the invariant,
// silently leaves orphans in `garrisonedByBuilding`'s value array, and the
// NEXT save serializes them — wedging the next load when the invariant
// finally fires (because key-side prune ran but value-side didn't).
//
// Fix: value-side pruning runs AFTER the cross-ref invariant so the
// load is internally consistent post-prune. Tests below construct a save
// blob with dead-id entities and verify they're silently cleaned.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  monkCarriedRelicCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';
import {
  legacySchema1FromBridge,
  stateSlot,
} from './saveBlobTestUtils';

describe('Save-load value-side pruning (Gemini MAJOR R2-G1)', () => {
  // Find an alive building entity in the bootstrap fixture so we can
  // construct a half-dead case (live key, dead value). Pre-fix, the
  // key-side `pruneOrphanEntityKeys` would keep the entry (key alive)
  // but the value array would still contain the dead unit id, sneaking
  // into the next save and breaking the cross-ref invariant on the next
  // load.
  function pickLiveBuildingId(): number {
    const bridge = createSimulationBridge();
    for (const id of bridge.world.query('position', 'building')) {
      return id;
    }
    throw new Error('no building in bootstrap fixture');
  }

  it('garrisonedByBuilding silently filters dead unit IDs out of LIVE building value arrays (half-dead case — fix-specific regression)', () => {
    const liveBuildingId = pickLiveBuildingId();
    const bridge = createSimulationBridge();
    const blob = legacySchema1FromBridge(bridge);
    // Live-key + dead-value: pre-fix, the live building key survives
    // `pruneOrphanEntityKeys`, but the dead unit value would survive
    // too (value-side pruning didn't exist). The cross-ref invariant
    // checks `garrisonedUnitToBuilding[deadUnit]` which doesn't exist
    // after the key-side prune deleted it — but the FIRST load above
    // hasn't done that prune yet, so the invariant sees the consistent
    // state (paired in both maps). Result: live key with stale dead
    // value would pollute the next save.
    const corrupt: SaveBlob = {
      ...blob,
      sideMaps: {
        ...blob.sideMaps,
        garrisonedByBuilding: [[liveBuildingId, [9999]]],
        garrisonedUnitToBuilding: [[9999, liveBuildingId]],
      },
    };
    const reloaded = createSimulationBridge('aoe2-prototype', { savedGame: corrupt });
    const next = reloaded.saveGame();
    // Post-fix: dead unit 9999 is filtered from the live building's
    // garrisoned-by list. The list is now empty, so the entry is
    // removed entirely (matches the empty-list-cleanup path).
    const saved = stateSlot<Array<[number, number[]]>>(next, garrisonedByBuildingCodec.slot).find(
      ([id]) => id === liveBuildingId,
    );
    if (saved !== undefined) {
      expect(saved[1]).toEqual([]);
    }
    // The reverse map's dead-key entry is cleaned by the existing
    // key-side `pruneOrphanEntityKeys` — verify just to anchor the
    // round-trip is consistent post-fix.
    expect(
      stateSlot<Array<[number, number]>>(next, garrisonedUnitToBuildingCodec.slot).some(
        ([uId]) => uId === 9999,
      ),
    ).toBe(false);
  });

  it('garrisonedByBuilding silently drops dead-pair entries (full dead-pair case)', () => {
    const bridge = createSimulationBridge();
    const blob = legacySchema1FromBridge(bridge);
    const corrupt: SaveBlob = {
      ...blob,
      sideMaps: {
        ...blob.sideMaps,
        garrisonedByBuilding: [[9001, [9002]]],
        garrisonedUnitToBuilding: [[9002, 9001]],
      },
    };
    const reloaded = createSimulationBridge('aoe2-prototype', { savedGame: corrupt });
    const next = reloaded.saveGame();
    expect(stateSlot(next, garrisonedByBuildingCodec.slot)).toEqual([]);
    expect(stateSlot(next, garrisonedUnitToBuildingCodec.slot)).toEqual([]);
  });

  it('monkCarriedRelic silently drops entries whose relic value is dead', () => {
    const bridge = createSimulationBridge();
    const blob = legacySchema1FromBridge(bridge);
    const corrupt: SaveBlob = {
      ...blob,
      sideMaps: {
        ...blob.sideMaps,
        monkCarriedRelic: [[9001, 9002]],
      },
    };
    const reloaded = createSimulationBridge('aoe2-prototype', { savedGame: corrupt });
    const next = reloaded.saveGame();
    expect(stateSlot(next, monkCarriedRelicCodec.slot)).toEqual([]);
  });
});
