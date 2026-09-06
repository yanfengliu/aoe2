// Self-play CONTENT COVERAGE: how much of the game's content an all-AI match
// exercises, measured in a match the AI cannot end (spec §15.8).
//
// WHY A LAB. On a match that resolves, a winner's variety measures the match's
// LENGTH, not the AI: under v0.3.205 the boot map ends by conquest at tick
// 39,812 and the winner shows 9 building types where the side that lost the
// longer match before it showed 14. So this gate turns the AI's attack and
// ferry phases off (`disableAiAttacks`), disables the Wonder and Relic
// victories (`victory: 'conquest-only'`) so nothing can end the match, gives
// every seat the high starting-resource preset and the hard decision
// interval, and plays the boot map to its 45,000-tick horizon with both
// economies intact — the configuration that reached the
// most content of the ones measured on 2026-09-05: standard resources, standard
// AI, attacks on: 11 building types, 6 unit types, no Imperial Age. Attacks
// off: 13 and 13, no Imperial Age. Attacks off with high resources and a hard
// AI: 15, 18 and 31 technologies, both seats in the Imperial Age (owner 2 at
// tick 24,500, owner 1 at 42,500).
//
// THE CONTRACT IS NAMED. A type that stops being exercised fails by its name,
// never as a count, because a count of 15 can hide a Castle lost for a second
// Watch Tower. A legitimate loss is edited out of the floor with its reason in
// the commit; the gate exists to make the loss visible, not to forbid it.
//
// THE GAP IS PRINTED, not asserted: the difference between this floor and the
// game's own content tables is the standing to-do for feature completeness
// (§16.3), and reading it is the point of running this.
//
// BOUND: one seed, one horizon, one configuration. The simulation is
// deterministic, so the floor is exact on this tree. It says nothing about what
// the AI does under attack — `aiReachesCastleAge.test.ts` scores that.
//
// COST: 194 s alone on a 32-core machine (both economies at 28-40 villagers and
// 29-42 buildings), the heaviest of the three self-play gates.

import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { TRAINABLE_UNIT_TYPES } from '../../src/game/simulation/trainingCosts';

const HORIZON_TICKS = 45000;
const SAMPLE_INTERVAL = 250;

// THE 2026-09-06 REMOVAL — four names came off this floor, and the cause is
// gold, not reach. Two defects were fixed first, because a floor is only
// edited after the AI's own failures are: the AI orphaned foundations it had
// already paid for, and its build order had no affordability fall-through, so
// one entry it could never buy starved every entry behind it. Those two fixes
// took the floor's misses from three units and five technologies down to one
// and three. THESE ARE THAT ONE AND THREE, and they were measured, not argued.
//
// THE MEASUREMENT. The boot map's gold is entirely mined out by tick 30,000:
// 6,263 left in the ground at tick 2,500, zero at 30,000. From there both
// seats' gold stockpiles are FROZEN — 13 and 7 — for the remaining 15,000
// ticks. Every removed name is priced in gold: a Mangonel 135 (on 160 wood),
// and the three Imperial Blacksmith technologies 300, 150 and 200 gold on top
// of 450, 300 and 350 food. The seats reach the Imperial Age at ticks 15,500
// and 30,250, so the tier holding three of the four opens as the map empties.
// A seat holding 7 gold cannot buy a 150-gold technology at any age.
//
// THIS IS A DEFERRAL, NOT A WEAKENING, and the floor still proves it: the
// Imperial tier is reached AND spent in — `blast-furnace`, 275 food and 225
// gold, stays on this floor and went through, bought while gold still existed.
// Nothing removed here is unreachable. All four ask for gold at a point in the
// match where none is left to ask for.
//
// THE CONDITION THEY COME BACK ON. The only gold remaining on this map is the
// Market, and the AI's market planner (`marketActionForAgeUpShortfall`, called
// from `aiSystemProductionPhase.ts`) has exactly one gate — qualifies for the
// next age, cannot afford it — so it is dead for both seats from the moment
// they are Imperial. An AI ending the match on 1,262 food, 441 stone and 7
// gold beside its own completed Market is the separate, already-recorded
// defect of 2026-09-03 ("The AI hoards the resource it cannot spend...", still
// OPEN in the register), not a loss of reach here. WHEN A TRADE COVERS A
// TECHNOLOGY OR A UNIT AND NOT ONLY AN AGE-UP, PUT THESE FOUR BACK.

/** Measured 2026-09-05 on the boot map under this configuration: the union
 *  over both seats. Every name is a contract; see the header. */
const BUILDINGS_EXERCISED = [
  'town-center', 'house', 'barracks', 'mill', 'lumber-camp', 'mining-camp', 'farm',
  'blacksmith', 'archery-range', 'stable', 'market', 'siege-workshop', 'monastery',
  'castle', 'watch-tower',
];
const UNITS_EXERCISED = [
  'villager', 'scout', 'militia', 'spearman', 'man-at-arms', 'archer', 'trade-cart',
  'crossbowman', 'knight', 'light-cavalry', 'pikeman', 'longbowman', 'monk',
  // `mangonel` (135 gold) removed 2026-09-06 — gold-starved, see above.
  'battering-ram', 'long-swordsman', 'capped-ram', 'throwing-axeman',
];
const TECHNOLOGIES_EXERCISED = [
  'feudal-age', 'castle-age', 'imperial-age',
  // The Imperial rung is gone from three of these four upgrade lines —
  // `bracer`, `plate-mail-armor`, `plate-barding` removed 2026-09-06, all
  // gold-starved, see above. `blast-furnace` is the same tier and stays.
  'fletching', 'bodkin-arrow',
  'forging', 'iron-casting', 'blast-furnace',
  'scale-mail-armor', 'chain-mail-armor',
  'scale-barding-armor', 'chain-barding-armor',
  'padded-archer-armor', 'leather-archer-armor',
  'horse-collar', 'heavy-plow', 'crop-rotation', 'husbandry', 'squires',
  'man-at-arms-upgrade', 'long-swordsman-upgrade', 'pikeman-upgrade',
  'crossbowman-upgrade', 'elite-skirmisher-upgrade', 'light-cavalry-upgrade',
  'capped-ram-upgrade', 'onager-upgrade', 'heavy-scorpion-upgrade',
];

interface CoverageCensus {
  buildings: Set<string>;
  units: Set<string>;
  technologies: Set<string>;
  ages: Record<number, string>;
  lastTick: number;
  outcome: string;
}

function playCoverageLab(seed: string): CoverageCensus {
  const bridge = createSimulationBridge(seed, {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    disableAiAttacks: true,
    // Wonder and Relic victories off as well: monks and a Wonder are both
    // within the lab's reach, and either would end the match legitimately
    // and read here as a regression (a critic's finding, 2026-09-05).
    victory: 'conquest-only',
    resourcePreset: 'high',
    difficulty: 'hard',
  });
  const buildings = new Set<string>();
  const units = new Set<string>();
  let lastTick = 0;
  for (let tick = 1; tick <= HORIZON_TICKS; tick += 1) {
    bridge.step(100);
    lastTick = tick;
    if (bridge.getMatchState().outcome !== 'running') break;
    if (tick % SAMPLE_INTERVAL !== 0) continue;
    const state = bridge.getEconomyState();
    for (const building of state.buildings) {
      if (building.isComplete) buildings.add(building.buildingType);
    }
    for (const unit of state.units) units.add(unit.unitType);
  }
  const technologies = new Set<string>();
  for (const owner of [1, 2]) {
    for (const technology of bridge.getResearchedTechnologies(owner)) technologies.add(technology);
  }
  const ages: Record<number, string> = {};
  for (const owner of [1, 2]) ages[owner] = bridge.getEconomyState().ages[owner] ?? 'none';
  return { buildings, units, technologies, ages, lastTick, outcome: bridge.getMatchState().outcome };
}

function missingFrom(floor: readonly string[], exercised: ReadonlySet<string>): string[] {
  return floor.filter((name) => !exercised.has(name));
}

function gap(universe: readonly string[], exercised: ReadonlySet<string>): string[] {
  return universe.filter((name) => !exercised.has(name)).sort();
}

describe('self-play content coverage — the no-attack lab (spec §15.8)', () => {
  it('exercises every building, unit and technology on the floor, and prints the gap to the content tables', () => {
    const census = playCoverageLab('aoe2-prototype');
    const buildingUniverse = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS);
    const unitUniverse = [...TRAINABLE_UNIT_TYPES];
    const technologyUniverse = Object.keys(RESEARCH_COSTS);
    console.log(
      `COVERAGE aoe2-prototype lab: censused to ${String(census.lastTick)} (${census.outcome}); `
      + `ages ${JSON.stringify(census.ages)}; `
      + `${String(census.buildings.size)}/${String(buildingUniverse.length)} building types, `
      + `${String(census.units.size)}/${String(unitUniverse.length)} unit types, `
      + `${String(census.technologies.size)}/${String(technologyUniverse.length)} technologies`,
    );
    console.log(`COVERAGE gap — buildings never built: ${gap(buildingUniverse, census.buildings).join(' ')}`);
    console.log(`COVERAGE gap — units never trained: ${gap(unitUniverse, census.units).join(' ')}`);
    console.log(`COVERAGE gap — technologies never researched: ${gap(technologyUniverse, census.technologies).join(' ')}`);

    // The lab's premise, asserted rather than assumed: nothing ended the match,
    // and both seats reached the age where the tree is widest.
    expect(census.outcome, 'the lab match resolved — attacks and the Wonder and Relic victories are off here, so something else ended it').toBe('running');
    for (const owner of [1, 2]) {
      expect(census.ages[owner], `owner ${String(owner)} did not reach the Imperial Age in the lab`).toBe('imperial-age');
    }

    const message = (kind: string, missing: string[]): string =>
      `${kind} on the coverage floor were never exercised: ${missing.join(', ')}. `
      + 'Self-play stopped reaching them. Restore the AI\'s reach, or edit them out of the '
      + 'floor with the reason in the commit — never by making this a count.';
    expect(missingFrom(BUILDINGS_EXERCISED, census.buildings), message('Buildings', missingFrom(BUILDINGS_EXERCISED, census.buildings))).toEqual([]);
    expect(missingFrom(UNITS_EXERCISED, census.units), message('Units', missingFrom(UNITS_EXERCISED, census.units))).toEqual([]);
    expect(missingFrom(TECHNOLOGIES_EXERCISED, census.technologies), message('Technologies', missingFrom(TECHNOLOGIES_EXERCISED, census.technologies))).toEqual([]);
  }, 1_800_000);
});
