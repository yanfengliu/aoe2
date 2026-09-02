import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';
export function createAiMonkRelicFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'castle-age',
        startingResources: { food: 200, wood: 200, gold: 200, stone: 200 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      ownedSpawn('monastery', 2, 27, 22),
      ownedSpawn('monk', 2, 28, 26, { vision: 9 }),
      // Neutral relic close to the Monk so the pickup path completes
      // within the test budget.
      gaiaSpawn('relic', 30, 26, { amount: 0 }),
    ],
  };
}

// Slice 10: AI scouting-response fixture. An enemy scout starts close
// to the AI base so the scouting-response path triggers quickly. The
// AI already owns a Blacksmith (Watch Tower prerequisite) and starts
// with enough stone to build one immediately.
export function createAiScoutingResponseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'feudal-age',
        startingResources: { food: 500, wood: 500, gold: 200, stone: 500 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      // AI villagers so the Watch Tower has a builder available.
      ownedSpawn('villager', 2, 28, 20, { vision: 4 }),
      ownedSpawn('villager', 2, 29, 20, { vision: 4 }),
      // Slice 12 Task B: TC at (30, 20) covers (30..33, 20..23), so
      // the old Blacksmith at (32, 20) and Barracks at (34, 20) both
      // collided with the TC footprint. Moved both buildings west of
      // the TC so they are adjacent but not overlapping.
      ownedSpawn('barracks', 2, 34, 24),
      ownedSpawn('blacksmith', 2, 26, 21),
      // Human scout positioned inside the AI's base vision but south
      // of the Town Center so the Watch Tower anchor ends up south as
      // well.
      ownedSpawn('scout', 1, 28, 24, { vision: 6 }),
    ],
  };
}

// Slice 10: Difficulty-gap fixture. Two AI players on opposite sides of
// the map with identical starting resources and villagers. Owner 1 is
// `'easy'` — wait, owner 1 is the human player slot. To keep both
// sides as AI (so the gather-multiplier applies to both), we use
// owners 2 and 3 and omit owner 1 from the scenario. The bridge skips
// the HUMAN_PLAYER_ID bootstrap for any start that doesn't list owner
// 1, so only the two AI players run.
export function createAiDifficultyFixture(seed: string): PrototypeScenario {
  // Measures gather-rate delta between an easy AI (owner 2) and a hard
  // AI (owner 3). Owner 1 (HUMAN_PLAYER_ID) gets a minimal TC + villager
  // purely to keep the conquest-outcome system alive — the test never
  // interacts with it. Villagers placed right next to the sheep so the
  // first drop-off happens within a few ticks. Lots of starting wood so
  // both AIs can afford their initial Barracks placement without
  // touching food.
  const spawns: ScenarioSpawnSpec[] = [
    // Minimal owner-1 presence — the `prototypeConquestOutcome` system
    // short-circuits to 'defeat' if the human has no presence, which
    // would halt simulation before the AIs have a chance to gather.
    ownedSpawn('town-center', 1, 28, 16, { vision: 7 }),
    ownedSpawn('villager', 1, 26, 16, { vision: 4 }),
    ownedSpawn('town-center', 2, 8, 8, { vision: 7 }),
    ownedSpawn('villager', 2, 7, 6, { vision: 4 }),
    ownedSpawn('villager', 2, 8, 6, { vision: 4 }),
    ownedSpawn('town-center', 3, 50, 28, { vision: 7 }),
    ownedSpawn('villager', 3, 49, 26, { vision: 4 }),
    ownedSpawn('villager', 3, 50, 26, { vision: 4 }),
    // Sheep directly adjacent to the villager cluster so the first
    // gather → drop-off cycle is only a couple of ticks long.
    gaiaSpawn('sheep', 7, 5, { baseOwner: 2, amount: 500 }),
    gaiaSpawn('sheep', 8, 5, { baseOwner: 2, amount: 500 }),
    gaiaSpawn('sheep', 49, 25, { baseOwner: 3, amount: 500 }),
    gaiaSpawn('sheep', 50, 25, { baseOwner: 3, amount: 500 }),
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 28, y: 16 } },
      {
        owner: 2,
        townCenter: { x: 8, y: 8 },
        difficulty: 'easy',
        // Plenty of wood so the Barracks build-order hit doesn't
        // starve the AI into an all-food focus. Lots of starting food
        // too so the test can cleanly measure GATHERED food without
        // it being masked by food SPENT on training / age-up.
        startingResources: { food: 100, wood: 1000, gold: 100, stone: 100 },
      },
      {
        owner: 3,
        townCenter: { x: 50, y: 28 },
        difficulty: 'hard',
        startingResources: { food: 100, wood: 1000, gold: 100, stone: 100 },
      },
    ],
    spawns,
  };
}

export function createAiRushFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // FU: human villagers relocated to open ground (16,16 cluster), well
      // clear of the human Town Center at (8,8) (footprint-Manhattan ≥ 10).
      // The AI's attack group targets a human villager directly, so it still
      // hunts and kills one here — but now away from the TC's base defensive
      // fire, which (after the empty-TC-fires-1 rule) would otherwise shield
      // the villagers and break the "AI kills a villager" assertion.
      ownedSpawn('villager', 1, 16, 16, { vision: 4 }),
      ownedSpawn('villager', 1, 16, 17, { vision: 4 }),
      ownedSpawn('villager', 1, 17, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('villager', 2, 22, 8, { vision: 4 }),
      ownedSpawn('villager', 2, 22, 9, { vision: 4 }),
      ownedSpawn('villager', 2, 23, 9, { vision: 4 }),
      // Food for the rusher (2026-09-02). This map is bare grass, so before
      // these the AI ran the whole rush off its 200 starting food and the
      // test measured opening-spend arithmetic rather than rush behaviour:
      // once DE build times landed (Barracks 240 -> 500 ticks) the AI spent
      // its food on villagers while the Barracks went up and could never
      // afford the 60-food Militia at all. A gathering economy makes the
      // rush depend on the AI's PLAN, which is what the test is named for.
      // Clear of the AI Town Center's 4x4 footprint (anchor 24,8 spans 24-27).
      gaiaSpawn('sheep', 29, 10, { baseOwner: 2, amount: 100 }),
      gaiaSpawn('sheep', 29, 11, { baseOwner: 2, amount: 100 }),
      gaiaSpawn('sheep', 30, 10, { baseOwner: 2, amount: 100 }),
      gaiaSpawn('sheep', 30, 11, { baseOwner: 2, amount: 100 }),
    ],
  };
}

export function createAiEconomyFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('house', 1, 4, 8),
      ownedSpawn('mill', 2, 20, 8),
      ownedSpawn('villager', 2, 22, 8, { vision: 4 }),
      ownedSpawn('villager', 2, 22, 9, { vision: 4 }),
      gaiaSpawn('sheep', 24, 8, { baseOwner: 2, amount: 100 }),
      gaiaSpawn('sheep', 24, 9, { baseOwner: 2, amount: 100 }),
    ],
  };
}

// campaign-11 finding (c) regression fixture. AI owner 2 starts in the Dark
// Age sitting on 520 food (just over the 500-food Feudal cost) with a
// COMPLETE Town Center + Barracks + Mill (the two Feudal building
// prerequisites) and 6 villagers (the Dark-Age villager cap, so the TC stays
// idle to accept the age-up research). Gold is deep (2000) so Militia (60
// food + 20 gold) is always affordable, and there is NO food income — so
// without the age-up-priority fix the AI trains a Militia the moment food
// crosses 500 (pushed BEFORE the age-up research in the same decision tick
// and run FIFO-first by the handler), drains food below 500, the feudal-age
// research silently no-ops, and the AI is permanently stuck in the Dark Age
// (ground-truth campaign-11: owner 2 sat at 510 food for 3000 ticks). The fix
// RESERVES the age-up cost so Militia trains only from the surplus above it —
// here (520 food, no surplus over the 500 reserve) nothing is left for a
// Militia, so the age-up commits and the AI reaches Feudal. The human (owner
// 1) is inert scaffolding
// — no Town Center; corner Houses well outside the AI's vision for conquest
// presence — so the match neither ends early nor grinds the AI's military.
export function createAiAgeUpPriorityFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 2, y: 2 } },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingResources: { food: 520, wood: 0, gold: 2000, stone: 0 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      // AI base: complete TC + the two Feudal prerequisites (barracks + mill).
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('barracks', 2, 18, 8),
      ownedSpawn('mill', 2, 30, 8),
      // Houses for population headroom (TC 5 + 2x house 10 = 15 cap) so the AI
      // is never pop-blocked (which would divert it to House builds).
      ownedSpawn('house', 2, 18, 14),
      ownedSpawn('house', 2, 21, 14),
      // 6 villagers = the Dark-Age villager cap, so the TC trains no more and
      // stays idle to accept the age-up research.
      ownedSpawn('villager', 2, 24, 13, { vision: 4 }),
      ownedSpawn('villager', 2, 25, 13, { vision: 4 }),
      ownedSpawn('villager', 2, 26, 13, { vision: 4 }),
      ownedSpawn('villager', 2, 24, 14, { vision: 4 }),
      ownedSpawn('villager', 2, 25, 14, { vision: 4 }),
      ownedSpawn('villager', 2, 26, 14, { vision: 4 }),
      // Human (owner 1) conquest presence only — corner Houses far outside the
      // AI's vision so they are never attacked and the match cannot end by
      // conquest before the AI ages up.
      ownedSpawn('house', 1, 2, 2),
      ownedSpawn('house', 1, 2, 5),
      ownedSpawn('house', 1, 5, 2),
    ],
  };
}

// savingForAgeUp latch fixture (v0.1.96): isolates the age-up food-banking
// mechanism. The AI (owner 2) sits in the Dark Age with the two Feudal
// prerequisites (barracks + mill) so `canAdvanceToFeudalAge` is true and the
// next-age cost is {food:500}. Its food (320) is chosen deliberately: 64% of the
// 500-food Feudal cost, i.e. AT/ABOVE the 60% `savingForAgeUp` hard-latch, so the
// latch suppresses ALL production (military AND villagers, ~628) and the food is
// HELD toward the age-up. There is NO food resource on the map, so villagers
// cannot gather (zero income) and any food change is purely production spend.
// This is the mechanism that banks the age-up food now that villager training is
// no longer reserve-gated (v0.1.96 removed that coupling — it deadlocked the
// economic engine when the AI qualified while villager-poor). 3 villagers start
// below the Dark cap (10) so the AI would train more if the latch were not held.
export function createAiVillagerReserveFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 2, y: 2 } },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingResources: { food: 320, wood: 0, gold: 2000, stone: 0 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      // AI base: complete TC + the two Feudal prerequisites (barracks + mill).
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('barracks', 2, 18, 8),
      ownedSpawn('mill', 2, 30, 8),
      // Houses for population headroom (TC 5 + 2x house 10 = 15 cap) so the AI
      // is never pop-blocked and trains villagers freely (the behavior we gate).
      ownedSpawn('house', 2, 18, 14),
      ownedSpawn('house', 2, 21, 14),
      // 3 villagers — below the Dark-Age villager cap (10) so the AI keeps
      // trying to train more (which the reserve fix must suppress). No food
      // resource exists on the grass map, so these villagers gather nothing:
      // food income is zero and any food change is purely villager-training.
      ownedSpawn('villager', 2, 24, 13, { vision: 4 }),
      ownedSpawn('villager', 2, 25, 13, { vision: 4 }),
      ownedSpawn('villager', 2, 26, 13, { vision: 4 }),
      // Human (owner 1) conquest presence only — corner Houses far outside the
      // AI's vision so they are never attacked and the match cannot end by
      // conquest before the test window closes.
      ownedSpawn('house', 1, 2, 2),
      ownedSpawn('house', 1, 2, 5),
      ownedSpawn('house', 1, 5, 2),
    ],
  };
}

// v0.1.91 market-for-age-up regression: the AI covers an age-up RESOURCE
// IMBALANCE via the Market. Markets can only trade from the Feudal Age up, so
// this exercises the real stall — Feudal → Castle. Owner 2 starts in the Dark
// Age with 520 food (enough to age to Feudal on its own) plus the buildings for
// BOTH age-ups pre-placed (barracks + mill = Dark→Feudal prereqs; blacksmith +
// Market = Feudal→Castle prereqs) and a big gold pile. There is NO food resource
// on the map, so once it reaches Feudal it can never GATHER the 800 food a Castle
// costs. WITHOUT the market-trade fix it is stranded in Feudal forever (the
// v0.1.90 reserve even blocks it from spending its food); WITH the fix it buys
// food with its spare gold each decision tick until it can afford Castle, then
// advances. The Market doubles as the Feudal→Castle prerequisite AND the venue.
export function createAiMarketAgeUpFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 2, y: 2 } },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingResources: { food: 520, wood: 0, gold: 3000, stone: 0 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('barracks', 2, 18, 8),
      ownedSpawn('mill', 2, 30, 8),
      // Feudal→Castle prerequisites: blacksmith + the Market (also the trade venue).
      ownedSpawn('blacksmith', 2, 18, 11),
      ownedSpawn('market', 2, 30, 12),
      ownedSpawn('house', 2, 18, 14),
      ownedSpawn('house', 2, 21, 14),
      // A few villagers — idle (no food resource exists) so food only moves via
      // the market trade, isolating the fix.
      ownedSpawn('villager', 2, 24, 13, { vision: 4 }),
      ownedSpawn('villager', 2, 25, 13, { vision: 4 }),
      ownedSpawn('villager', 2, 26, 13, { vision: 4 }),
      // Human (owner 1) conquest presence only, far outside the AI's vision.
      ownedSpawn('house', 1, 2, 2),
      ownedSpawn('house', 1, 2, 5),
      ownedSpawn('house', 1, 5, 2),
    ],
  };
}
