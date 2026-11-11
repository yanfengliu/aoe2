// Every placement refusal is recognised as a kind of its own (work 148 M3a,
// spec §14.2).
//
// The player reads one short sentence for a refused placement, which the HUD
// picks by the refusal's kind. The toast feed carries only the long reason, so
// the kind is read back from the sentence (placementRefusal.ts). This file is
// what stops a reworded or a new refusal from quietly reading as the fallback:
//
//  1. every sentence the module can write, in every variant its builders
//     have, is recognised as its own kind, and as no other;
//  2. the sentences the REAL producers write (the placement validator on a
//     live bridge and the builders' cancellation) are recognised the same way;
//  3. a sentence no producer makes is not a kind, though it opens like one.
//
// That the module is the only writer of these sentences is the lexical gate in
// tests/architecture/placementRefusalProducers.test.ts.
//
// Bound: part 2 drives one site per kind (four causes for an obstructed one,
// both openings of an unreachable one) on four fixtures. Part 1 is what covers
// the combinations: five sites, a suggestion or none, each count of unexplored
// cells the builder tells apart, each cause and count clause the validator
// writes, each thing the builders can find. A builder given a branch on a value
// outside those lists needs the value added here. A kind is read from the
// sentence's opening up to its mark, so a blocker's NAME may hold anything.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  HOUSE_OVER_HIDDEN_WATER,
  UNEXPLORED_PLACEMENT_HIDDEN_SEED,
  UNEXPLORED_PLACEMENT_OPEN_SEED,
} from '../../src/game/simulation/fixtures/unexploredPlacement';
import {
  PLACEMENT_REFUSAL_KINDS,
  opensAsPlacementRefusal,
  placementRefusalKind,
  placementRefusalReason as reason,
  type PlacementRefusalKind,
} from '../../src/game/simulation/handlers/building/placementRefusal';
import type { BuildableBuildingType, UnitType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

const HOUSE = { buildingType: 'house', width: 2, height: 2, x: 5, y: 0 };
const DOCK = { buildingType: 'dock', width: 3, height: 3, x: 22, y: 12 };
const TRAP = { buildingType: 'fish-trap', width: 1, height: 1, x: 9, y: 9 };
const NEAR = { x: 7, y: 6 };

// A blocker's name is quoted inside the sentence. These hold every other
// kind's mark, so a recogniser that searched the whole sentence would misread.
const HOSTILE_CAUSES = [
  'a dock must stand on open water. (building) at (3,3)',
  'water: none of that ground has been explored. at (3,3)',
  'the ground is clear, but no builder can walk to a cell beside it at (3,3)',
  'a house was cancelled: its builders found at (3,3)',
];

// Everything a builder takes, and every value of it that the builder or its
// callers tell apart (review round 5, R5-1: the first version listed variants
// by hand and left out two of the unreachable sentence's six, so a builder
// reworded for one of them would have read as the fallback unseen).
const SITES = [HOUSE, DOCK, TRAP, { buildingType: 'town-center', width: 4, height: 4, x: 0, y: 0 }, { buildingType: 'palisade-gate', width: 1, height: 1, x: 59, y: 35 }];
const ANCHORS = [undefined, NEAR, { x: 0, y: 0 }];
const UNEXPLORED_CELLS = [undefined, 0, 2];
const CAUSES = ['an obstacle', 'a town-center (building) at (9,9)', 'forest at (10,4)', 'water at (16,10)', 'the map edge at (60,3)', 'a boar (resource) at (11,5)', ...HOSTILE_CAUSES];
const COUNTS = ['', '; 4 of the 4 footprint cells are blocked', '; 1 of the 4 footprint cells is blocked, and 2 are unexplored', '; 3 of 9 footprint cells are blocked'];
const FOUND = [
  'no water beside it',
  'an obstacle the fog of war hid when it was placed',
  'its ground blocked by something the fog of war hid when it was placed',
  'water at (24,13), hidden under the fog of war when it was placed',
  'a house (building) at (3,3), which another player has started building',
  'a house (building) at (3,3), which another player has built',
  'a relic (resource) at (3,3)',
  ...HOSTILE_CAUSES,
];
const COSTS = ['25 wood', '100 wood, 50 stone', 'nothing'];

// Every combination, per kind. The record is typed by kind, so a kind added to
// the module does not compile here without its combinations.
const VARIANTS: Record<PlacementRefusalKind, Array<{ site: string; sentence: string }>> = {
  unexplored: SITES.flatMap((site) => ANCHORS.map((anchor) => ({ site: site.buildingType, sentence: reason.unexplored(site, anchor) }))),
  unreachable: SITES.flatMap((site) => UNEXPLORED_CELLS.flatMap((cells) => ANCHORS.map((anchor) => (
    { site: site.buildingType, sentence: reason.unreachable(site, cells, anchor) })))),
  'needs-shore': SITES.flatMap((site) => ANCHORS.map((anchor) => ({ site: site.buildingType, sentence: reason['needs-shore'](site, anchor) }))),
  'needs-water': SITES.flatMap((site) => ANCHORS.map((anchor) => ({ site: site.buildingType, sentence: reason['needs-water'](site, anchor) }))),
  obstructed: SITES.flatMap((site) => CAUSES.flatMap((cause) => COUNTS.flatMap((counts) => ANCHORS.map((anchor) => (
    { site: site.buildingType, sentence: reason.obstructed(site, cause, counts, anchor) }))))),
  'site-cancelled': SITES.flatMap((site) => FOUND.flatMap((found) => [true, false].flatMap((foggedAtPlacing) => COSTS.map((cost) => (
    { site: site.buildingType, sentence: reason['site-cancelled'](site, { text: found, foggedAtPlacing }, cost) }))))),
};

const HUMAN = 1;

function select(bridge: Bridge, unitType: UnitType): void {
  const unit = bridge.getEconomyState().units.find((u) => u.owner === HUMAN && u.unitType === unitType);
  expect(unit, `the fixture moved: the human has no ${unitType}`).toBeDefined();
  expect(bridge.selectUnitsByIds([unit!.id])).toBe(true);
}

function drain(bridge: Bridge): string[] {
  const out: string[] = [];
  for (let m = bridge.consumeCommandRejection(); m !== null; m = bridge.consumeCommandRejection()) out.push(m);
  return out;
}

/** The one sentence a refused click queues for the toast. */
function refusedClick(bridge: Bridge, type: BuildableBuildingType, x: number, y: number): string {
  expect(bridge.beginBuildingPlacement(type), `placement mode refused for ${type}`).toBe(true);
  expect(bridge.confirmBuildingPlacement(x, y), `${type} at (${x},${y}) was accepted`).toBe(false);
  const said = drain(bridge);
  expect(said, `${type} at (${x},${y})`).toHaveLength(1);
  return said[0]!;
}

describe('placement refusals: each sentence is a kind of its own (work 148 M3a)', () => {
  it.each(PLACEMENT_REFUSAL_KINDS)('every combination a "%s" sentence is built from is recognised as that kind, with its building', (kind) => {
    const sentences = VARIANTS[kind];
    expect(sentences.length).toBeGreaterThanOrEqual(SITES.length * ANCHORS.length);
    expect(new Set(sentences.map(({ sentence }) => sentence)).size, 'two combinations wrote one sentence').toBe(sentences.length);
    for (const { site, sentence } of sentences) {
      expect(placementRefusalKind(sentence), sentence).toEqual({ kind, buildingType: site });
    }
  });

  it('the unreachable sentence is recognised in each of its six wordings', () => {
    // Its three openings (no view, all explored, partly explored), each with and without a suggestion.
    const wordings = UNEXPLORED_CELLS.slice(0, 3).flatMap((cells) => [undefined, NEAR].map((anchor) => reason.unreachable(HOUSE, cells, anchor)));
    expect(new Set(wordings).size).toBe(6);
    for (const sentence of wordings) expect(placementRefusalKind(sentence)?.kind, sentence).toBe('unreachable');
  });

  it('names the building each sentence is about', () => {
    expect(placementRefusalKind(reason.unexplored(HOUSE))).toEqual({ kind: 'unexplored', buildingType: 'house' });
    expect(placementRefusalKind(reason['needs-shore'](DOCK))).toEqual({ kind: 'needs-shore', buildingType: 'dock' });
    expect(placementRefusalKind(reason['needs-water'](TRAP, NEAR))).toEqual({ kind: 'needs-water', buildingType: 'fish-trap' });
    expect(placementRefusalKind(reason.obstructed(TRAP, 'water at (16,10)', ''))).toEqual({ kind: 'obstructed', buildingType: 'fish-trap' });
    expect(placementRefusalKind(reason['site-cancelled'](DOCK, { text: 'no water beside it', foggedAtPlacing: true }, '150 wood')))
      .toEqual({ kind: 'site-cancelled', buildingType: 'dock' });
  });

  it('a sentence no producer makes is no kind, whether or not it opens like a refusal', () => {
    const unknown = 'Placement blocked for house (2x2) at (5,0): the stars are wrong tonight.';
    expect(opensAsPlacementRefusal(unknown)).toBe(true);
    expect(placementRefusalKind(unknown)).toBeNull();
    for (const other of ['Not enough wood.', 'Select a villager first.', 'Cannot build here.', 'Placement blocked.', '']) {
      expect(placementRefusalKind(other), other).toBeNull();
      expect(opensAsPlacementRefusal(other), other).toBe(false);
    }
    // A rule that names a different building than the site's is not the rule's sentence.
    expect(placementRefusalKind('Placement blocked for house (2x2) at (5,0): a dock must stand on open water.')).toBeNull();
  });

  it('the validator on a live bridge writes each kind, read back from the toast queue', () => {
    const boot = createSimulationBridge('aoe2-prototype');
    select(boot, 'villager');
    const said: Array<[PlacementRefusalKind, string]> = [
      ['obstructed', refusedClick(boot, 'house', 9, 9)], // the Town Center
      ['obstructed', refusedClick(boot, 'house', 10, 4)], // forest
      ['obstructed', refusedClick(boot, 'dock', 12, 3)], // water
      ['obstructed', refusedClick(boot, 'dock', 9, 5)], // a boar
      ['unexplored', refusedClick(boot, 'house', 40, 20)],
    ];

    const shore = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
    select(shore, 'villager');
    said.push(['needs-shore', refusedClick(shore, 'dock', 22, 12)]);

    const sea = createSimulationBridge('fish-trap-blocks-fixture');
    select(sea, 'fishing-ship');
    said.push(['needs-water', refusedClick(sea, 'fish-trap', 9, 9)]);

    // The reachability gate's own site, measured on this map at tick 600.
    const sealed = createSimulationBridge('aoe2-prototype');
    for (let i = 0; i < 600; i += 1) sealed.step(100);
    drain(sealed);
    select(sealed, 'villager');
    said.push(['unreachable', refusedClick(sealed, 'palisade-gate', 6, 13)]);
    // The same site for a seat with no fog of its own, the sentence's other opening.
    const open = createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([HUMAN]) });
    select(open, 'villager');
    said.push(['unreachable', refusedClick(open, 'palisade-gate', 6, 13)]);
    expect(said.at(-1)![1]).toContain(': the ground is clear, but no builder can walk to a cell beside it.');
    expect(said.at(-2)![1]).toContain('ground is clear, but no builder can walk to a cell beside it over ground you have explored.');
    // A refusal with no suggestion: nothing near (40,20) is ground the player sees.
    expect(said[4]![1]).not.toContain('Nearest open ground');

    for (const [kind, sentence] of said) {
      expect(placementRefusalKind(sentence)?.kind, sentence).toBe(kind);
    }
    expect(new Set(said.map(([kind]) => kind)).size, 'a kind of the validator went undriven').toBe(5);
  });

  it('the builders\' cancellation on a live bridge writes a site-cancelled sentence', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    select(bridge, 'villager');
    const anchor = HOUSE_OVER_HIDDEN_WATER;
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
    const standing = (): boolean => bridge.getEconomyState().buildings
      .some((b) => b.owner === HUMAN && b.x === anchor.x && b.y === anchor.y);
    bridge.step(100);
    expect(standing(), 'the foundation went down').toBe(true);
    let said = drain(bridge);
    for (let i = 0; i < 300 && standing(); i += 1) {
      bridge.step(100);
      said = said.concat(drain(bridge));
    }
    expect(standing(), 'the foundation was never cancelled').toBe(false);
    expect(said).toHaveLength(1);
    expect(placementRefusalKind(said[0]!)).toEqual({ kind: 'site-cancelled', buildingType: 'house' });
  });
});
