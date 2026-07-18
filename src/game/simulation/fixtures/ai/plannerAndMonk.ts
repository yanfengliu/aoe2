import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';
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
      { owner: 1, townCenter: { x: 2, y: 2 }, startingResources: stockpile },
      { owner: 2, townCenter: { x: 30, y: 20 }, startingResources: stockpile, difficulty: 'standard' },
    ],
    spawns: [
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      // Human (owner 1) is inert scaffolding for these AI-behavior tests and
      // deliberately has NO Town Center. Under the empty-TC-fires-1 rule
      // (spec §10.8) a human TC would shoot the AI's attack group — the AI
      // targets the human TC (via townCenterRefs) once the lone villager
      // dies — killing militia faster than they mass and stalling the AI's
      // age-up research. With no human TC, the AI's `humanTownCenterId` stays
      // null, so after the villager dies the AI has no target and its
      // military survives, letting the "ages up to Castle" and "5+ military"
      // assertions hold. Conquest presence comes from houses parked in the
      // far NW corner, outside the AI's vision so they are never attacked and
      // the match cannot end by conquest before the AI reaches Castle Age.
      ownedSpawn('house', 1, 2, 2),
      ownedSpawn('house', 1, 2, 5),
      ownedSpawn('house', 1, 5, 2),
      // Lone villager as a soft target for the AI's attack group. The age-up /
      // 5-military assertions do NOT depend on it dying — it just gives the AI
      // something to chase SE, away from the human base, so its military isn't
      // thrown at a TC and ground down. (The browser "AI kills a villager" test
      // uses ai-rush-fixture, not this one.)
      ownedSpawn('villager', 1, 45, 30, { vision: 4 }),
      // Four AI villagers — enough to drive a non-trivial rebalance
      // test (food/wood/gold/stone across multiple resources).
      ownedSpawn('villager', 2, 28, 20, { vision: 4 }),
      ownedSpawn('villager', 2, 29, 20, { vision: 4 }),
      ownedSpawn('villager', 2, 28, 21, { vision: 4 }),
      ownedSpawn('villager', 2, 29, 21, { vision: 4 }),
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
      gaiaSpawn('sheep', 32, 25, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('sheep', 33, 25, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('berry-bush', 32, 18, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('berry-bush', 33, 18, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('tree', 26, 18, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('tree', 27, 18, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('tree', 26, 19, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('tree', 27, 19, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('gold-mine', 35, 21, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('gold-mine', 35, 22, { baseOwner: 2, amount: 2000 }),
      gaiaSpawn('stone-mine', 26, 21, { baseOwner: 2, amount: 1000 }),
      gaiaSpawn('stone-mine', 26, 22, { baseOwner: 2, amount: 1000 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      // Backup TC so the AI's pre-existing military doesn't end the
      // match by destroying the human's primary base.
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      // AI villagers — enough to keep the economy alive while Monks
      // train and walk between targets.
      ownedSpawn('villager', 2, 28, 20, { vision: 4 }),
      ownedSpawn('villager', 2, 29, 20, { vision: 4 }),
      ownedSpawn('villager', 2, 28, 21, { vision: 4 }),
      ownedSpawn('villager', 2, 29, 21, { vision: 4 }),
      // Pre-built Castle-Age production so the Castle / Imperial Age
      // gates pass and the AI's Monastery build-order target activates
      // without waiting on Feudal-tier prereqs.
      ownedSpawn('blacksmith', 2, 24, 12),
      ownedSpawn('archery-range', 2, 28, 12),
      ownedSpawn('stable', 2, 32, 12),
      ownedSpawn('market', 2, 36, 12),
      ownedSpawn('barracks', 2, 24, 16),
      ownedSpawn('lumber-camp', 2, 37, 17),
      ownedSpawn('mining-camp', 2, 37, 21),
      ownedSpawn('mill', 2, 28, 25),
      // Small starting AI military — used to test the heal path. They
      // are given starting commands by the AI as soon as it ticks.
      ownedSpawn('spearman', 2, 28, 16, { vision: 4 }),
      ownedSpawn('archer', 2, 29, 16, { vision: 4 }),
      // Neutral relic just inside AI vision so the AI's Monk pickup
      // path activates within a few decision ticks.
      gaiaSpawn('relic', 35, 25, { amount: 0 }),
      // Resources around the AI base — generous amounts so the
      // economy never starves over the test budget. None overlap a
      // building footprint.
      gaiaSpawn('sheep', 24, 24, { baseOwner: 2, amount: 1000 }),
      gaiaSpawn('sheep', 24, 25, { baseOwner: 2, amount: 1000 }),
      gaiaSpawn('berry-bush', 24, 21, { baseOwner: 2, amount: 1000 }),
      gaiaSpawn('berry-bush', 24, 22, { baseOwner: 2, amount: 1000 }),
      gaiaSpawn('tree', 28, 29, { baseOwner: 2, amount: 1000 }),
      gaiaSpawn('tree', 29, 29, { baseOwner: 2, amount: 1000 }),
      gaiaSpawn('gold-mine', 36, 17, { baseOwner: 2, amount: 1500 }),
      gaiaSpawn('gold-mine', 36, 18, { baseOwner: 2, amount: 1500 }),
      gaiaSpawn('stone-mine', 36, 16, { baseOwner: 2, amount: 800 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      ownedSpawn('monastery', 2, 27, 22),
      ownedSpawn('monk', 2, 28, 24, { vision: 9 }),
      // Pikeman pre-damaged via startHp so the heal path fires on the
      // first AI decision tick. Pikeman max HP is 60; 30 is half — well
      // below the 70% heal threshold.
      ownedSpawn('pikeman', 2, 29, 24, { vision: 4, startHp: 30 }),
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
    villagerSpawns.push(ownedSpawn('villager', 2, 40 + (i % 10), 20 + Math.floor(i / 10), {
      vision: 4,
      requiresSafeSpawn: true,
    }));
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      // Castle-Age + Imperial-Age production buildings already up so
      // pickNextBuildTarget has nothing left to pursue, leaving the
      // Wonder branch as the next build target.
      ownedSpawn('blacksmith', 2, 24, 12),
      ownedSpawn('archery-range', 2, 28, 12),
      ownedSpawn('stable', 2, 32, 12),
      ownedSpawn('market', 2, 36, 12),
      ownedSpawn('barracks', 2, 24, 16),
      ownedSpawn('monastery', 2, 28, 16),
      ownedSpawn('siege-workshop', 2, 24, 25),
      // mill / lumber / mining-camps so the AI doesn't try to build
      // them as competing targets.
      ownedSpawn('mill', 2, 28, 25),
      ownedSpawn('lumber-camp', 2, 37, 17),
      ownedSpawn('mining-camp', 2, 37, 21),
      ...villagerSpawns,
    ],
  };
}

// FU4: AI Monk-relic fixture. The AI starts with a Monastery + a
// single Monk, with a free neutral relic placed just inside the
// Monk's vision. Verifies the pickup-then-deposit chain.
