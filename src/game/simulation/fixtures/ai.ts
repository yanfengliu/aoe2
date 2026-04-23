import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

// Slice 10: AI-vs-inert-human match fixture. Both players start in
// Feudal Age with deep resource stockpiles so the AI opens the build
// phase immediately — tests can measure age-up, villager rebalancing,
// military production, and attack-group push without having to walk
// through the Dark-Age timing. The human side has no villagers so
// only the AI's behavior is exercised.
export function createAiPlannerFixture(seed: string): PrototypeScenario {
  const stockpile = { food: 2000, wood: 2000, gold: 1500, stone: 500 };
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, startingResources: stockpile },
      { owner: 2, townCenter: { x: 30, y: 20 }, startingResources: stockpile, difficulty: 'standard' },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // Human placeholder villager so the old rush behavior can still
      // kill one to match existing browser-test expectations. Position
      // the human villagers away from the AI base to avoid immediate
      // combat — the tests assert planner behavior rather than kill
      // counts.
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      // FU4: backup Town Centers in the far corner so the AI rush
      // cannot end the match via conquest before the AI reaches Castle
      // Age. 2400 HP each, placed far enough from the primary TC that
      // the AI's militia lock onto the primary TC first and don't path
      // back across the map until the primary dies. Two backups give
      // redundancy against a lucky rush. With the previous single-TC
      // human setup, conquest presence vanished around tick 2300 under
      // the new tuning's faster military production, which capped age
      // progression at Feudal.
      { kind: 'town-center', x: 2, y: 2, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 14, y: 14, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      // Four AI villagers — enough to drive a non-trivial rebalance
      // test (food/wood/gold/stone across multiple resources).
      { kind: 'villager', x: 28, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 28, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Resource patches near the AI base so it can actually gather.
      // Slice 12 Task B: TC at (30, 20) covers (30..33, 20..23). Sheep
      // moved below the TC to (32, 24) / (33, 24). Berry-bushes moved
      // above the TC (and below the TC rows (20..23)) keep the same
      // economy intent.
      // FU4: amounts upped so the AI can sustain Feudal + Castle-Age
      // production without depleting resources before the age-up test
      // completes. Previous amounts (100/125/100/200/150) only
      // supported ~2500 ticks of continuous gathering, which was fine
      // for the Slice 10 "reach Feudal" bar but bottlenecked the
      // FU4 "reach Castle Age" goal. The amounts are sized so the AI
      // can keep producing militias + age-up costs without starving
      // over the 8000-tick budget.
      { kind: 'sheep', x: 32, y: 25, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'sheep', x: 33, y: 25, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'berry-bush', x: 32, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'berry-bush', x: 33, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 26, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 27, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 26, y: 19, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 27, y: 19, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'gold-mine', x: 35, y: 21, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'gold-mine', x: 35, y: 22, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'stone-mine', x: 26, y: 21, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'stone-mine', x: 26, y: 22, owner: null, baseOwner: 2, amount: 1000 },
    ],
  };
}

// FU4: AI Monk fixture. AI starts in Castle Age with a stockpile of
// gold/food/wood, a completed Monastery + Barracks, a couple of
// villagers, and a small population of trained military so the
// "wounded military" Monk-heal path is exercised. Includes one
// neutral relic placed inside the AI's vision so the relic-pickup
// path also fires deterministically. The AI's TC has a backup Town
// Center on the human side so conquest doesn't end the match
// prematurely (matches the pattern in createAiPlannerFixture).
export function createAiMonkFixture(seed: string): PrototypeScenario {
  // Layout (anchored top-left of each footprint):
  //   AI TC      (30,20) 4x4 → (30..33, 20..23)
  //   blacksmith (24,12) 3x3 → (24..26, 12..14)
  //   archery    (28,12) 3x3 → (28..30, 12..14)
  //   stable     (32,12) 3x3 → (32..34, 12..14)
  //   market     (36,12) 4x4 → (36..39, 12..15)
  //   barracks   (24,16) 3x3 → (24..26, 16..18)
  //   lumber-cmp (37,17) 2x2 → (37..38, 17..18)
  //   mining-cmp (37,21) 2x2 → (37..38, 21..22)
  //   mill       (28,25) 2x2 → (28..29, 25..26)
  //   relic      (35,25) 1x1
  //   spearman   (28,16) 1x1 (inside barracks footprint? No, 28 is outside 24..26)
  //   archer     (29,16) 1x1
  //   sheep      (24,24..25)
  //   berry      (24,21..22)
  //   tree       (28,29..30) (28..29)
  //   gold       (36,17), (36,18)
  //   stone      (36,16)
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
        startingResources: { food: 1000, wood: 600, gold: 1500, stone: 200 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      // Backup TC so the AI's pre-existing military doesn't end the
      // match by destroying the human's primary base.
      { kind: 'town-center', x: 2, y: 2, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // AI villagers — enough to keep the economy alive while Monks
      // train and walk between targets.
      { kind: 'villager', x: 28, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 28, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Pre-built Castle-Age production so the Castle / Imperial Age
      // gates pass and the AI's Monastery build-order target activates
      // without waiting on Feudal-tier prereqs.
      { kind: 'blacksmith', x: 24, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'archery-range', x: 28, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'stable', x: 32, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'market', x: 36, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'barracks', x: 24, y: 16, owner: 2, baseOwner: 2 },
      { kind: 'lumber-camp', x: 37, y: 17, owner: 2, baseOwner: 2 },
      { kind: 'mining-camp', x: 37, y: 21, owner: 2, baseOwner: 2 },
      { kind: 'mill', x: 28, y: 25, owner: 2, baseOwner: 2 },
      // Small starting AI military — used to test the heal path. They
      // are given starting commands by the AI as soon as it ticks.
      { kind: 'spearman', x: 28, y: 16, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'archer', x: 29, y: 16, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Neutral relic just inside AI vision so the AI's Monk pickup
      // path activates within a few decision ticks.
      { kind: 'relic', x: 35, y: 25, owner: null, baseOwner: null, amount: 0 },
      // Resources around the AI base — generous amounts so the
      // economy never starves over the test budget. None overlap a
      // building footprint.
      { kind: 'sheep', x: 24, y: 24, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'sheep', x: 24, y: 25, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'berry-bush', x: 24, y: 21, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'berry-bush', x: 24, y: 22, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'tree', x: 28, y: 29, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'tree', x: 29, y: 29, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'gold-mine', x: 36, y: 17, owner: null, baseOwner: 2, amount: 1500 },
      { kind: 'gold-mine', x: 36, y: 18, owner: null, baseOwner: 2, amount: 1500 },
      { kind: 'stone-mine', x: 36, y: 16, owner: null, baseOwner: 2, amount: 800 },
    ],
  };
}

// FU4: AI Monk-heal fixture. The AI already owns a completed
// Monastery + a single trained Monk + a Pikeman whose HP is
// pre-damaged below the heal threshold via `startHp` on a starting
// combat state. Used by the heal-target test so the heal path fires
// without first running the Monk training pipeline.
export function createAiMonkHealFixture(seed: string): PrototypeScenario {
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
      { kind: 'monk', x: 28, y: 24, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 9 } },
      // Pikeman pre-damaged via startHp so the heal path fires on the
      // first AI decision tick. Pikeman max HP is 60; 30 is half — well
      // below the 70% heal threshold.
      { kind: 'pikeman', x: 29, y: 24, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 }, startHp: 30 },
    ],
  };
}

// FU4: AI Wonder pursuit fixture. AI player 2 starts in Imperial Age
// with 40+ villagers, the full Wonder-cost stockpile (1000/1000/1000/
// 1000), and all the Castle-Age prereqs already built. The Wonder
// countdown is shrunk to 50 ticks via `wonderCountdownOverrideTicks`
// so the test can resolve the Wonder-victory path inside a 5000-tick
// budget. The human player has only a Town Center + villager (no
// military), so the AI's Wonder is unopposed.
export function createAiWonderFixture(seed: string): PrototypeScenario {
  // Anchor key buildings so the layout has no overlaps.
  //   AI TC at (30, 20) covers (30..33, 20..23)
  //   blacksmith (24,12) 3x3 → (24..26, 12..14)
  //   archery    (28,12) 3x3 → (28..30, 12..14)
  //   stable     (32,12) 3x3 → (32..34, 12..14)
  //   market     (36,12) 4x4 → (36..39, 12..15)
  //   barracks   (24,16) 3x3 → (24..26, 16..18)
  //   monastery  (28,16) 2x2 → (28..29, 16..17)
  //   siege-wks  (24,25) 3x3 → (24..26, 25..27)
  const villagerSpawns: ScenarioSpawnSpec[] = [];
  for (let i = 0; i < 42; i += 1) {
    // Pack villagers in two rows below the TC, well outside building
    // footprints. Cells (40..49, 20..27).
    villagerSpawns.push({
      kind: 'villager',
      x: 40 + (i % 10),
      y: 20 + Math.floor(i / 10),
      owner: 2,
      baseOwner: 2,
      vision: { playerId: 2, radius: 4 },
      requiresSafeSpawn: true,
    });
  }
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
        startingAge: 'imperial-age',
        startingResources: { food: 2000, wood: 2000, gold: 2000, stone: 2000 },
        difficulty: 'standard',
        // 50-tick countdown so the Wonder-victory path resolves inside
        // the test's 5000-tick budget.
        wonderCountdownOverrideTicks: 50,
      },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // Castle-Age + Imperial-Age production buildings already up so
      // pickNextBuildTarget has nothing left to pursue, leaving the
      // Wonder branch as the next build target.
      { kind: 'blacksmith', x: 24, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'archery-range', x: 28, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'stable', x: 32, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'market', x: 36, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'barracks', x: 24, y: 16, owner: 2, baseOwner: 2 },
      { kind: 'monastery', x: 28, y: 16, owner: 2, baseOwner: 2 },
      { kind: 'siege-workshop', x: 24, y: 25, owner: 2, baseOwner: 2 },
      // mill / lumber / mining-camps so the AI doesn't try to build
      // them as competing targets.
      { kind: 'mill', x: 28, y: 25, owner: 2, baseOwner: 2 },
      { kind: 'lumber-camp', x: 37, y: 17, owner: 2, baseOwner: 2 },
      { kind: 'mining-camp', x: 37, y: 21, owner: 2, baseOwner: 2 },
      ...villagerSpawns,
    ],
  };
}

// FU4: AI Monk-relic fixture. The AI starts with a Monastery + a
// single Monk, with a free neutral relic placed just inside the
// Monk's vision. Verifies the pickup-then-deposit chain.
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
      {
        kind: 'villager',
        x: 6,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 6,
        y: 9,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 7,
        y: 9,
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
