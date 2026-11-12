// A site with three villagers who could build it: the first in entity order is
// walled off from the site's side and has a long way round, the other two
// stand two cells from it (work 152 M1d).
//
// The computer sent its first villager in entity order to every building it
// placed, and to every site it crewed, wherever that villager stood. Traced in
// the lobby's default all-AI match (plan 152): a House at (46,24) went to a
// woodcutter 6 cells away in a straight line and 56 by foot while six
// villagers stood on the site's own approach cell, and work started 69 s after
// the House was placed.
//
// Six seeds, one layout (60x36, forest terrain everywhere but the cells named):
//
//   the town    x 34..48, y 2..33, with owner 2's Town Center at (36,15)
//   the lane    x 30..32, y 2..33, west of a forest wall on column 33
//   the gap     (33,2) and (33,3), the lane's only way into the town
//   the baffle  a forest wall on row 5 from x 34 to 46, so the town's north
//               strip (rows 2..4) joins the rest only at x 47..48
//
// The site is the 3x3 at (34,12): the first anchor the AI's ring search takes
// around the Town Center (ring 3; its first anchor, (33,12), stands on the
// wall). Its open approach cells are the three north of it, (34,15) and
// (35,15) south of it, and the three east of it; the west side is the wall.
//
//   A (32,15)  first in entity order, in the lane: two cells west of the site
//              in a straight line, and 46 by foot (12 north, through the gap,
//              13 east, 3 south past the baffle, 16 back)
//   B (39,13)  two cells east of the site's east side
//   C (36,9)   two cells north of the site's north side: B's walk, a higher id
//
//   ai-builder-walk-placement-fixture  175 wood and nothing else, in the Dark
//                                      Age with a House standing: the build
//                                      order's one affordable entry is the
//                                      barracks, so one decision places it.
//   ai-builder-walk-crew-fixture       no resources, and the barracks already
//                                      at (34,12) as a foundation nobody has
//                                      started: the crew phase adopts it.
//   ai-builder-walk-tower-fixture      the Feudal Age, a barracks standing, a
//                                      Watch Tower's price and an enemy scout
//                                      in sight of the Town Center: the
//                                      sighting places a tower.
//   ai-builder-walk-nomad-fixture      a nomad start: no Town Center, and its
//                                      price. The site is sought around the
//                                      first villager, whose lane is too
//                                      narrow for it, so it lands across the
//                                      wall.
//   ai-builder-walk-wonder-fixture     the Imperial Age, 40 villagers and a
//                                      Wonder's price: one decision places the
//                                      Wonder, and the next sends its crew.
//   ai-builder-walk-last-gatherer-fixture
//                                      the placement seed with the two free
//                                      villagers moved: the seat's one wood
//                                      villager a step from the site, a food
//                                      villager three steps from it. The wood
//                                      villager is passed over: it is the last
//                                      the seat has on its resource.
//
// Forest terrain, not tree entities, as corridorSeal.ts has it: nothing chops
// through it inside a test's window. Owner 1 is a scout shut in a pocket of its
// own, so the seat is not eliminated and nothing of its is ever sighted.

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import { createTerrainCell, type TerrainCellSpec } from '../mapGeneration/sharedTerrainHelpers';
import { ownedSpawn } from './common';

export const BUILDER_WALK_SEEDS = {
  placement: 'ai-builder-walk-placement-fixture',
  crew: 'ai-builder-walk-crew-fixture',
  tower: 'ai-builder-walk-tower-fixture',
  nomad: 'ai-builder-walk-nomad-fixture',
  wonder: 'ai-builder-walk-wonder-fixture',
  lastGatherer: 'ai-builder-walk-last-gatherer-fixture',
} as const;
export type BuilderWalkVariant = keyof typeof BUILDER_WALK_SEEDS;

/** Owner 2's Town Center anchor (4x4: 36..39 x 15..18). */
export const BUILDER_WALK_TOWN_CENTER = { x: 36, y: 15 };
/** The barracks' anchor (3x3: 34..36 x 12..14) in both variants. */
export const BUILDER_WALK_SITE = { x: 34, y: 12 };
/** Owner 2's villagers, in entity order. */
export const BUILDER_WALK_VILLAGERS = {
  walledOff: { x: 32, y: 15 },
  beside: { x: 39, y: 13 },
  besideToo: { x: 36, y: 9 },
} as const;
/** The last-gatherer variant's two free villagers, in entity order: a food
 *  villager three steps north of the site, and the seat's one wood villager a
 *  step east of it (a seat's third villager is its first on wood). */
export const BUILDER_WALK_LAST_GATHERER = {
  onFood: { x: 36, y: 8 },
  onlyOneOnWood: { x: 38, y: 13 },
} as const;
/** Owner 1's scout, in a pocket nothing walks into or out of. */
const FAR_SCOUT = { x: 56, y: 30 };
/** The tower variant's sighting: an enemy scout the Town Center sees. */
export const BUILDER_WALK_SIGHTED_SCOUT = { x: 44, y: 16 };
/** The wonder variant's other 37 villagers, a block in the town's south-east. */
const WONDER_CROWD = { minX: 40, minY: 27, columns: 8, count: 37 };

/** A cell rectangle, inclusive on every side. */
type Rect = { minX: number; minY: number; maxX: number; maxY: number };

const OPEN: readonly Rect[] = [
  { minX: 34, minY: 2, maxX: 48, maxY: 33 }, // the town
  { minX: 30, minY: 2, maxX: 32, maxY: 33 }, // the lane
  { minX: 33, minY: 2, maxX: 33, maxY: 3 }, // the gap
  { minX: FAR_SCOUT.x, minY: FAR_SCOUT.y, maxX: FAR_SCOUT.x + 1, maxY: FAR_SCOUT.y },
];
const BAFFLE: Rect = { minX: 34, minY: 5, maxX: 46, maxY: 5 };

function terrain(): TerrainCellSpec[][] {
  const cells = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'forest')),
  );
  const paint = (rect: Rect, kind: 'grass' | 'forest'): void => {
    for (let y = rect.minY; y <= rect.maxY; y += 1) {
      for (let x = rect.minX; x <= rect.maxX; x += 1) cells[y]![x] = createTerrainCell(x, y, kind);
    }
  };
  for (const rect of OPEN) paint(rect, 'grass');
  paint(BAFFLE, 'forest');
  return cells;
}

function spawns(variant: BuilderWalkVariant): ScenarioSpawnSpec[] {
  const tc = BUILDER_WALK_TOWN_CENTER;
  const { walledOff, beside, besideToo } = BUILDER_WALK_VILLAGERS;
  const crowd = Array.from({ length: variant === 'wonder' ? WONDER_CROWD.count : 0 }, (_, index) => ownedSpawn(
    'villager', 2, WONDER_CROWD.minX + (index % WONDER_CROWD.columns), WONDER_CROWD.minY + Math.floor(index / WONDER_CROWD.columns),
    { vision: 4 },
  ));
  return [
    // A nomad start has no Town Center (spec §5.4).
    ...(variant === 'nomad' ? [] : [ownedSpawn('town-center', 2, tc.x, tc.y, { vision: 7 })]),
    // Population 3 of 10, so the Dark Age House rule (a House under 3 free
    // population, aiHousing.ts) asks for none and the build order's first
    // entry is the barracks.
    ownedSpawn('house', 2, 44, 24),
    ...(variant === 'crew'
      ? [ownedSpawn('barracks', 2, BUILDER_WALK_SITE.x, BUILDER_WALK_SITE.y, { unstartedFoundation: true })]
      : []),
    // A Watch Tower is offered only to a Feudal seat with a barracks standing.
    ...(variant === 'tower' ? [ownedSpawn('barracks', 2, 44, 8)] : []),
    // Entity order is spawn order: the walled-off villager first.
    ownedSpawn('villager', 2, walledOff.x, walledOff.y, { vision: 4 }),
    ...(variant === 'lastGatherer'
      ? [BUILDER_WALK_LAST_GATHERER.onFood, BUILDER_WALK_LAST_GATHERER.onlyOneOnWood]
      : [beside, besideToo]
    ).map((cell) => ownedSpawn('villager', 2, cell.x, cell.y, { vision: 4 })),
    ...crowd,
    ownedSpawn('scout', 1, FAR_SCOUT.x, FAR_SCOUT.y, { vision: 4 }),
    ...(variant === 'tower'
      ? [ownedSpawn('scout', 1, BUILDER_WALK_SIGHTED_SCOUT.x, BUILDER_WALK_SIGHTED_SCOUT.y, { vision: 4 })]
      : []),
  ];
}

/** What each variant's seat holds: its one purchase's price and nothing over. */
const RESOURCES: Record<BuilderWalkVariant, { food: number; wood: number; gold: number; stone: number }> = {
  placement: { food: 0, wood: 175, gold: 0, stone: 0 },
  crew: { food: 0, wood: 0, gold: 0, stone: 0 },
  tower: { food: 0, wood: 25, gold: 0, stone: 125 },
  nomad: { food: 0, wood: 275, gold: 0, stone: 100 },
  wonder: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
  lastGatherer: { food: 0, wood: 175, gold: 0, stone: 0 },
};

function createBuilderWalkFixture(variant: BuilderWalkVariant, seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: terrain(),
    starts: [
      { owner: 1, townCenter: { ...FAR_SCOUT } },
      {
        owner: 2,
        townCenter: { ...BUILDER_WALK_TOWN_CENTER },
        startingResources: { ...RESOURCES[variant] },
        difficulty: 'standard',
        ...(variant === 'tower' ? { startingAge: 'feudal-age' as const } : {}),
        ...(variant === 'wonder' ? { startingAge: 'imperial-age' as const } : {}),
      },
    ],
    spawns: spawns(variant),
    ...(variant === 'nomad' ? { nomadStart: true } : {}),
  };
}

// THE GROUND THE WALK IS MEASURED OVER (`builder-walk-ground-fixture`).
//
// Seven lanes, one cell wide, in forest: columns 10, 13, ... 28, rows 10..20,
// joined by an open strip along row 9 and another along row 21. Each lane
// holds one thing on its middle cell (row 15), and one of owner 2's villagers
// stands at its north end, on row 11. A villager ordered to its lane's row 19
// walks 8 cells if it may pass that thing, and otherwise goes round by the
// nearest lane it may pass: 16 cells and twice the columns between.
// Nobody's AI plays: the villagers move only when a test orders them.
export const BUILDER_WALK_GROUND_SEED = 'builder-walk-ground-fixture';
/** What stands on each lane's middle cell, and whether owner 2's villagers pass it. */
export const BUILDER_WALK_GROUND_LANES = [
  { x: 10, holds: 'nothing', open: true },
  { x: 13, holds: 'a finished gate of their own', open: true },
  { x: 16, holds: 'a finished gate of an enemy', open: false },
  { x: 19, holds: 'a farm of their own', open: true },
  { x: 22, holds: 'a wall of their own nobody has started', open: true },
  { x: 25, holds: 'a finished wall of their own', open: false },
  { x: 28, holds: 'a tree', open: false },
] as const;
export const BUILDER_WALK_GROUND_ROWS = { strip: 9, start: 11, middle: 15, goal: 19, farStrip: 21 } as const;

function createBuilderWalkGroundFixture(seed: string): PrototypeScenario {
  const rows = BUILDER_WALK_GROUND_ROWS;
  const lanes = BUILDER_WALK_GROUND_LANES;
  const cells = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'forest')),
  );
  const open = (x: number, y: number): void => { cells[y]![x] = createTerrainCell(x, y, 'grass'); };
  for (let x = lanes[0].x; x <= lanes[lanes.length - 1]!.x; x += 1) {
    open(x, rows.strip);
    open(x, rows.farStrip);
  }
  for (const lane of lanes) for (let y = rows.strip; y <= rows.farStrip; y += 1) open(lane.x, y);
  open(FAR_SCOUT.x, FAR_SCOUT.y);
  open(FAR_SCOUT.x + 1, FAR_SCOUT.y);
  const middle = rows.middle;
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: cells,
    starts: [
      { owner: 1, townCenter: { ...FAR_SCOUT }, startingAge: 'feudal-age', disableAi: true },
      { owner: 2, townCenter: { x: lanes[0].x, y: rows.strip }, startingAge: 'feudal-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('palisade-gate', 2, lanes[1].x, middle),
      ownedSpawn('palisade-gate', 1, lanes[2].x, middle),
      ownedSpawn('farm', 2, lanes[3].x, middle),
      ownedSpawn('palisade-wall', 2, lanes[4].x, middle, { unstartedFoundation: true }),
      ownedSpawn('palisade-wall', 2, lanes[5].x, middle),
      { kind: 'tree', x: lanes[6].x, y: middle, owner: null, baseOwner: null, amount: 100 },
      ...lanes.map((lane) => ownedSpawn('villager', 2, lane.x, rows.start, { vision: 4 })),
      ownedSpawn('scout', 1, FAR_SCOUT.x, FAR_SCOUT.y, { vision: 4 }),
    ],
  };
}

/** The builder-walk cases, by seed (`tests/simulation/aiBuilderWalk.test.ts`, `cellPassabilityAccessor.test.ts`). */
export const AI_BUILDER_WALK_SCENARIOS: ReadonlyArray<readonly [string, (seed: string) => PrototypeScenario]> = [
  [BUILDER_WALK_SEEDS.placement, (seed) => createBuilderWalkFixture('placement', seed)],
  [BUILDER_WALK_SEEDS.crew, (seed) => createBuilderWalkFixture('crew', seed)],
  [BUILDER_WALK_SEEDS.tower, (seed) => createBuilderWalkFixture('tower', seed)],
  [BUILDER_WALK_SEEDS.nomad, (seed) => createBuilderWalkFixture('nomad', seed)],
  [BUILDER_WALK_SEEDS.wonder, (seed) => createBuilderWalkFixture('wonder', seed)],
  [BUILDER_WALK_SEEDS.lastGatherer, (seed) => createBuilderWalkFixture('lastGatherer', seed)],
  [BUILDER_WALK_GROUND_SEED, createBuilderWalkGroundFixture],
];
