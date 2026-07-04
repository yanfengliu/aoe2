import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';
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
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'town-center', x: 2, y: 2, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      { kind: 'monastery', x: 27, y: 22, owner: 2, baseOwner: 2 },
      { kind: 'monk', x: 28, y: 26, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 9 } },
      // Neutral relic close to the Monk so the pickup path completes
      // within the test budget.
      { kind: 'relic', x: 30, y: 26, owner: null, baseOwner: null, amount: 0 },
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
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // AI villagers so the Watch Tower has a builder available.
      { kind: 'villager', x: 28, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Slice 12 Task B: TC at (30, 20) covers (30..33, 20..23), so
      // the old Blacksmith at (32, 20) and Barracks at (34, 20) both
      // collided with the TC footprint. Moved both buildings west of
      // the TC so they are adjacent but not overlapping.
      { kind: 'barracks', x: 34, y: 24, owner: 2, baseOwner: 2 },
      { kind: 'blacksmith', x: 26, y: 21, owner: 2, baseOwner: 2 },
      // Human scout positioned inside the AI's base vision but south
      // of the Town Center so the Watch Tower anchor ends up south as
      // well.
      { kind: 'scout', x: 28, y: 24, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
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
    { kind: 'town-center', x: 28, y: 16, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
    { kind: 'villager', x: 26, y: 16, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
    { kind: 'town-center', x: 8, y: 8, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
    { kind: 'villager', x: 7, y: 6, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
    { kind: 'villager', x: 8, y: 6, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
    { kind: 'town-center', x: 50, y: 28, owner: 3, baseOwner: 3, vision: { playerId: 3, radius: 7 } },
    { kind: 'villager', x: 49, y: 26, owner: 3, baseOwner: 3, vision: { playerId: 3, radius: 4 } },
    { kind: 'villager', x: 50, y: 26, owner: 3, baseOwner: 3, vision: { playerId: 3, radius: 4 } },
    // Sheep directly adjacent to the villager cluster so the first
    // gather → drop-off cycle is only a couple of ticks long.
    { kind: 'sheep', x: 7, y: 5, owner: null, baseOwner: 2, amount: 500 },
    { kind: 'sheep', x: 8, y: 5, owner: null, baseOwner: 2, amount: 500 },
    { kind: 'sheep', x: 49, y: 25, owner: null, baseOwner: 3, amount: 500 },
    { kind: 'sheep', x: 50, y: 25, owner: null, baseOwner: 3, amount: 500 },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      // FU: human villagers relocated to open ground (16,16 cluster), well
      // clear of the human Town Center at (8,8) (footprint-Manhattan ≥ 10).
      // The AI's attack group targets a human villager directly, so it still
      // hunts and kills one here — but now away from the TC's base defensive
      // fire, which (after the empty-TC-fires-1 rule) would otherwise shield
      // the villagers and break the "AI kills a villager" assertion.
      {
        kind: 'villager',
        x: 16,
        y: 16,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 16,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 17,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'villager',
        x: 22,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 22,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 23,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
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
      {
        kind: 'house',
        x: 4,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'mill',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'villager',
        x: 22,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 22,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 24,
        y: 8,
        owner: null,
        baseOwner: 2,
        amount: 100,
      },
      {
        kind: 'sheep',
        x: 24,
        y: 9,
        owner: null,
        baseOwner: 2,
        amount: 100,
      },
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
      { kind: 'town-center', x: 24, y: 8, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      { kind: 'barracks', x: 18, y: 8, owner: 2, baseOwner: 2 },
      { kind: 'mill', x: 30, y: 8, owner: 2, baseOwner: 2 },
      // Houses for population headroom (TC 5 + 2x house 10 = 15 cap) so the AI
      // is never pop-blocked (which would divert it to House builds).
      { kind: 'house', x: 18, y: 14, owner: 2, baseOwner: 2 },
      { kind: 'house', x: 21, y: 14, owner: 2, baseOwner: 2 },
      // 6 villagers = the Dark-Age villager cap, so the TC trains no more and
      // stays idle to accept the age-up research.
      { kind: 'villager', x: 24, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 25, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 26, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 24, y: 14, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 25, y: 14, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 26, y: 14, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Human (owner 1) conquest presence only — corner Houses far outside the
      // AI's vision so they are never attacked and the match cannot end by
      // conquest before the AI ages up.
      { kind: 'house', x: 2, y: 2, owner: 1, baseOwner: 1 },
      { kind: 'house', x: 2, y: 5, owner: 1, baseOwner: 1 },
      { kind: 'house', x: 5, y: 2, owner: 1, baseOwner: 1 },
    ],
  };
}

// v0.1.90 villager-reserve regression: isolates the demand-side age-up hole.
// The AI (owner 2) sits in the Dark Age with the two Feudal prerequisites
// (barracks + mill) so `canAdvanceToFeudalAge` is true and the age-up reserve
// is {food:500}. Its food (250) is chosen deliberately: it is above the
// villager cost (50) so a villager is trainable, but only 50% of the 500-food
// Feudal cost — below the 60% `savingForAgeUp` hard-latch — so that latch does
// NOT already suppress training; the ONLY thing that can hold the food is the
// villager gate respecting the reserve. There is NO food resource on the map,
// so villagers cannot gather (zero income) and any food change is purely
// villager-training. With the pre-fix gate (plain `canAfford`), the AI trains a
// villager every time food >= 50, draining the 250 reserved food toward zero;
// with the fix (`canAffordWithReserve(..., ageUpReserve)`) villager training is
// suppressed exactly like military, so the 250 food is HELD intact. Militia
// (60 food) is already reserve-gated so it never drains here; only the villager
// gate is under test. 3 villagers start below the Dark cap (10) so the AI still
// wants more — the drain is real without the fix.
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
        startingResources: { food: 250, wood: 0, gold: 2000, stone: 0 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      // AI base: complete TC + the two Feudal prerequisites (barracks + mill).
      { kind: 'town-center', x: 24, y: 8, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      { kind: 'barracks', x: 18, y: 8, owner: 2, baseOwner: 2 },
      { kind: 'mill', x: 30, y: 8, owner: 2, baseOwner: 2 },
      // Houses for population headroom (TC 5 + 2x house 10 = 15 cap) so the AI
      // is never pop-blocked and trains villagers freely (the behavior we gate).
      { kind: 'house', x: 18, y: 14, owner: 2, baseOwner: 2 },
      { kind: 'house', x: 21, y: 14, owner: 2, baseOwner: 2 },
      // 3 villagers — below the Dark-Age villager cap (10) so the AI keeps
      // trying to train more (which the reserve fix must suppress). No food
      // resource exists on the grass map, so these villagers gather nothing:
      // food income is zero and any food change is purely villager-training.
      { kind: 'villager', x: 24, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 25, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 26, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Human (owner 1) conquest presence only — corner Houses far outside the
      // AI's vision so they are never attacked and the match cannot end by
      // conquest before the test window closes.
      { kind: 'house', x: 2, y: 2, owner: 1, baseOwner: 1 },
      { kind: 'house', x: 2, y: 5, owner: 1, baseOwner: 1 },
      { kind: 'house', x: 5, y: 2, owner: 1, baseOwner: 1 },
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
      { kind: 'town-center', x: 24, y: 8, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      { kind: 'barracks', x: 18, y: 8, owner: 2, baseOwner: 2 },
      { kind: 'mill', x: 30, y: 8, owner: 2, baseOwner: 2 },
      // Feudal→Castle prerequisites: blacksmith + the Market (also the trade venue).
      { kind: 'blacksmith', x: 18, y: 11, owner: 2, baseOwner: 2 },
      { kind: 'market', x: 30, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'house', x: 18, y: 14, owner: 2, baseOwner: 2 },
      { kind: 'house', x: 21, y: 14, owner: 2, baseOwner: 2 },
      // A few villagers — idle (no food resource exists) so food only moves via
      // the market trade, isolating the fix.
      { kind: 'villager', x: 24, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 25, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 26, y: 13, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Human (owner 1) conquest presence only, far outside the AI's vision.
      { kind: 'house', x: 2, y: 2, owner: 1, baseOwner: 1 },
      { kind: 'house', x: 2, y: 5, owner: 1, baseOwner: 1 },
      { kind: 'house', x: 5, y: 2, owner: 1, baseOwner: 1 },
    ],
  };
}
