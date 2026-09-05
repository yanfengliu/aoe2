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
  'battering-ram', 'mangonel', 'long-swordsman', 'capped-ram', 'throwing-axeman',
];
const TECHNOLOGIES_EXERCISED = [
  'feudal-age', 'castle-age', 'imperial-age',
  'fletching', 'bodkin-arrow', 'bracer',
  'forging', 'iron-casting', 'blast-furnace',
  'scale-mail-armor', 'chain-mail-armor', 'plate-mail-armor',
  'scale-barding-armor', 'chain-barding-armor', 'plate-barding',
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
