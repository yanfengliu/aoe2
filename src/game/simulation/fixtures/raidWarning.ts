import {
  DEFAULT_SEED,
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createDefaultMap } from '../mapGeneration/defaultMap';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// A raid that keeps hitting, for the attack warning's browser gate (v0.3.229,
// defect register 2026-09-24). The real opening's raid is three swings on one
// villager and then nothing, so it cannot show whether the minimap mark holds
// between horns: the mark's old 8 s wall-clock life fell dark only in the gap
// before the throttle's 200 ticks ran out, and that gap needs hits on both
// sides of it.
//
// The human (owner 1) has a Town Center in the north-west corner and a House
// in the south-east, far outside the Town Center's arrows, and no units — so
// nothing of the human's can end the raid. Owner 2's two Militia stand beside
// the House with the AI disabled, so nothing re-tasks them; the spec orders
// them onto the House through the command pipeline. A House holds out for a
// long time against two Militia, so the hits keep coming for far longer than
// the throttle window.
export const RAID_WARNING_HOUSE = { x: 44, y: 26 };
export const RAID_WARNING_MILITIA = [
  { x: 47, y: 26 },
  { x: 47, y: 27 },
] as const;

export function createRaidWarningFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 } },
      { owner: 2, townCenter: { x: 4, y: 28 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('house', 1, RAID_WARNING_HOUSE.x, RAID_WARNING_HOUSE.y),
      ownedSpawn('town-center', 2, 4, 28, { vision: 7 }),
      ...RAID_WARNING_MILITIA.map((cell) => ownedSpawn('militia', 2, cell.x, cell.y, { vision: 5 })),
    ],
  };
}

// The boot map with a raid the attack warning's specs order themselves (work
// 144 M2). Three HUD and input specs waited for the computer's own Dark Age
// raid on the idle human in `aoe2-prototype`, a Militia's at tick 3,312, and
// DE's Dark Age boom ended it: the computer's first blow on the idle human
// now lands near tick 21,000. A spec that needs an attack must not depend on
// the computer's opening strategy, so this is `aoe2-prototype` itself, the
// same terrain, starts and spawns (the view the minimap mark's pixel floor
// was sized on), with owner 2's AI off and one Militia of owner 2's standing
// out of reach of the human's Town Center, Scout and villagers, which a spec
// orders onto the human's nearest villager through the command pipeline.
export const BOOT_MAP_RAID_SEED = 'boot-map-raid-fixture';
export const BOOT_MAP_RAID_MILITIA = { x: 20, y: 11 } as const;

export function createBootMapRaidFixture(seed: string): PrototypeScenario {
  const map = createDefaultMap(DEFAULT_SEED, 2);
  return {
    ...map,
    seed,
    starts: map.starts.map((start) => (start.owner === 2 ? { ...start, disableAi: true } : start)),
    spawns: [
      ...map.spawns,
      ownedSpawn('militia', 2, BOOT_MAP_RAID_MILITIA.x, BOOT_MAP_RAID_MILITIA.y, { vision: 4 }),
    ],
  };
}

/** The seeds this module builds, for the scenario registry. */
export function raidWarningScenarios(): Array<readonly [string, (seed: string) => PrototypeScenario]> {
  return [
    ['raid-warning-fixture', createRaidWarningFixture],
    [BOOT_MAP_RAID_SEED, createBootMapRaidFixture],
  ];
}
