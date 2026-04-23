import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

// Slice 5 fixture: Castle-Age human start with a completed Monastery and a
// nearby neutral relic. Used for Monastery train-menu, Monk build placement,
// pickup, and deposit tests without waiting for placement. Player 2 starts
// with a standard TC for containment and owns a wounded Spearman (heal
// target) and a Militia (convert target) close by.
export function createMonasteryFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monastery',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 6,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'relic',
        x: 14,
        y: 12,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk heal: player-1 Monk adjacent to a friendly
// Spearman with a neutral wolf close enough to auto-aggro the Spearman when
// the test walks the wolf into aggro range. The wolf applies damage over a
// few ticks, letting the test observe a wounded Spearman before issuing the
// heal order.
export function createMonkHealFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'spearman',
        x: 15,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Wolf auto-aggros on the nearest player unit within its aggro range;
        // placed at (17, 8) → range 2 from the Spearman at (15, 8). Wolf
        // attack 3 / reload 12, so HP accrues slowly and we can stop combat
        // by killing the wolf once it's done some damage.
        kind: 'wolf',
        x: 17,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk convert: player-1 Monk adjacent to an enemy
// Militia. After about 50 ticks the Militia flips to player 1.
export function createMonkConvertFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'militia',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for two Monks converting the same enemy Militia. The
// per-tick progress rate must stay fixed — each convert target can only
// receive one progress tick per simulation tick, no matter how many Monks
// are in range.
export function createMonkDoubleConvertFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 9,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'militia',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for post-conversion cleanup: player-1 Monk plus a
// player-1 Pikeman attacking an enemy Militia. When the Monk converts the
// Militia, the Pikeman's attack command must be cleared since the target
// is now a teammate.
export function createMonkConvertCleanupFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'pikeman',
        x: 14,
        y: 9,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Militia has a ton of HP relative to default so the Pikeman does
        // not kill it before conversion completes (~50 ticks).
        kind: 'militia',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for relic drop on Monastery destruction: a player-2
// Monastery at (18, 8) pre-seeded with one deposited relic, its HP
// knocked down to 10 so a single-hit destroy is deterministic, and a
// player-1 Pikeman adjacent for the human test to command into an
// attack. When the Monastery dies, the relic should drop back onto
// the map near the footprint.
// Slice 6 review fix: a Monastery with 2 stored relics, completely
// surrounded by trees on every cell at manhattan distance 1 and 2 of
// the footprint. The existing radius-capped drop search (range 2)
// finds zero free approach cells in this scenario, so pre-fix the
// stored relics vanish on destruction. A Mangonel sits beyond the
// tree ring and shells the Monastery into the ground from range, so
// the destruction itself does not require an open approach.
export function createMonkRelicDropCrampedFixture(seed: string): PrototypeScenario {
  const monasteryAnchor = { x: 10, y: 10 };
  const footprintMinX = monasteryAnchor.x;
  const footprintMaxX = monasteryAnchor.x + 1;
  const footprintMinY = monasteryAnchor.y;
  const footprintMaxY = monasteryAnchor.y + 1;
  const blockerRange = 2;
  const blockerSpawns: ScenarioSpawnSpec[] = [];
  for (let y = footprintMinY - blockerRange; y <= footprintMaxY + blockerRange; y += 1) {
    for (let x = footprintMinX - blockerRange; x <= footprintMaxX + blockerRange; x += 1) {
      const insideFootprint = x >= footprintMinX && x <= footprintMaxX
        && y >= footprintMinY && y <= footprintMaxY;
      if (insideFootprint) {
        continue;
      }
      const dx =
        x < footprintMinX ? footprintMinX - x
        : x > footprintMaxX ? x - footprintMaxX
        : 0;
      const dy =
        y < footprintMinY ? footprintMinY - y
        : y > footprintMaxY ? y - footprintMaxY
        : 0;
      const distance = dx + dy;
      if (distance === 0 || distance > blockerRange) {
        continue;
      }
      blockerSpawns.push({
        kind: 'tree',
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: 100,
      });
    }
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 20 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        // Wide vision so the Mangonel sees its target without having
        // to drive its own LOS forward through the tree ring.
        vision: { playerId: 1, radius: 18 },
      },
      // Hostile Monastery — owns 2 relics deposited ahead of time;
      // extremely low HP so the Mangonel one-shots it.
      {
        kind: 'monastery',
        x: monasteryAnchor.x,
        y: monasteryAnchor.y,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startingRelicsInMonastery: 2,
        startHp: 10,
      },
      ...blockerSpawns,
      // Mangonel parked beyond the tree ring at manhattan distance 5
      // from the nearest Monastery cell (well within range 7 and
      // outside min range 3).
      {
        kind: 'mangonel',
        x: 10,
        y: 16,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 20,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

export function createMonkRelicDropFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monastery',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startingRelicsInMonastery: 1,
        startHp: 10,
      },
      {
        kind: 'pikeman',
        x: 17,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fix: a healthy friendly Militia and an enemy Militia share one
// coarse cell. The Monk should fall through to convert the enemy because
// pass-1 heal targeting must skip a friendly with full HP. Pre-fix the
// Monk picked up the healthy friendly in pass-1, fell into the
// move-fallback inside issueMonkContextCommandAtEntity, and never
// converted anything.
export function createMonkHealthyFriendlyWithEnemyFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      // Friendly Militia at full HP — the heal pass must skip it.
      {
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      // Enemy Militia stacked on the same cell — the convert pass should
      // pick this up.
      {
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk heal-over-convert target preference: a friendly
// (damaged) Spearman and an enemy Militia share the same coarse cell. The
// test right-clicks that cell and expects the Monk to heal the Spearman,
// not convert the Militia.
export function createMonkHealOverConvertFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'spearman',
        x: 16,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk convert + vision handoff: player-1 Monk with a
// small vision radius positioned far from the player's TC, adjacent to an
// enemy Scout whose own vision radius is large enough to cover cells the
// player cannot otherwise see. Used to verify that a successful conversion
// reassigns the target's visionSource.playerId to the Monk's owner.
export function createMonkConvertVisionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        // Keep TC vision short so it does not overlap the Monk/Scout area.
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'monk',
        x: 20,
        y: 20,
        owner: 1,
        baseOwner: 1,
        // Small vision so only the Monk's immediate cells are visible —
        // cells 3+ away around the Scout are fog-hidden until vision flips.
        vision: { playerId: 1, radius: 2 },
      },
      {
        kind: 'scout',
        x: 21,
        y: 20,
        owner: 2,
        baseOwner: 2,
        // Radius 6 so (scoutX + 3) is inside the Scout's vision but
        // outside the Monk's radius-2 vision. After conversion, player 1
        // should see that cell iff the Scout's visionSource playerId was
        // flipped.
        vision: { playerId: 2, radius: 6 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk-in-fog: player-1 Monk at home with short Town
// Center and Monk vision. Enemy Militia spawns just outside Monk vision but
// inside the Monk's conversion range. Used to verify the cell-based context
// resolver rejects fog-hidden enemy targets so the fallback is a plain move,
// not a convert.
export function createMonkFogFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Slice 12 Task B: moved from (8, 10) (inside TC footprint at
        // 8..11, 8..11). (8, 12) keeps the Monk just south of the TC
        // and still within MONK_ACTION_RANGE = 4 of the enemy militia.
        kind: 'monk',
        x: 8,
        y: 12,
        owner: 1,
        baseOwner: 1,
        // Small vision so the adjacent enemy Militia is in fog.
        vision: { playerId: 1, radius: 1 },
      },
      {
        // Distance 3 from the Monk at (8, 12) (manhattan, to (11, 12))
        // → within MONK_ACTION_RANGE = 4 but outside Monk's radius-1
        // vision; the TC's radius-3 vision from (8, 8) also does not
        // reach. Fog hides the unit from the human.
        kind: 'militia',
        x: 11,
        y: 12,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk relic pickup + deposit: player-1 Monk, a neutral
// relic adjacent, and a player-1 Monastery 4 cells away. Used for pickup,
// follow, deposit, and gold-income tests.
export function createMonkRelicFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'monastery',
        x: 18,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'relic',
        x: 15,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
