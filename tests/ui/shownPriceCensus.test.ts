// @vitest-environment jsdom

// THE SHOWN-PRICE CENSUS (spec §14.2, work 125): for every civilization, every
// age and every technology state a seat can climb to, every price the command
// card draws is the price its click charges.
//
// WHY. The train button's tooltip priced from the base table while the queue
// charged the owner's price, so an Italian Fishing Ship said 75 wood and cost
// 64 — and every unit discount, every research discount and the Market's
// Guilds fee had a second copy of its price that could drift the same way.
// The fix routes every quoted price through the seam the charge reads
// (bridge/ownerCosts.ts → SelectionState.commandCosts); this file is the gate
// that holds it for the whole content table, not the one example.
//
// WHAT IT ASSERTS, per seat: the real selection panel, mounted with the HUD's
// own wiring, is shown each producer (and a villager and a Fishing Ship for the
// build palette, both pages); every train, research, build and tribute control
// it draws states a price; a build card states the same price in its tooltip,
// its accessible name and its cost chips; then every unlocked control is
// CLICKED, each build card's placement confirmed on a free anchor, and one step
// later the stockpile must have lost exactly the sum of the stated prices. A
// seat that disagrees is replayed one purchase per step, so the failure names
// the control, what it said, and what it took. Every TRAINING_COSTS row, every
// RESEARCH_COSTS row and every buildable building must be quoted and charged by
// SOME seat, so a census that silently reads less than the table goes red.
//
// HOW THE STATES ARE WALKED. For each civilization and each age, a seat climbs:
// pass 0 holds nothing researched; each later pass holds everything the last
// one offered (age advances excepted — the age is its own axis). That reaches
// every prerequisite chain and every rung of every unit line (a line's menu
// shows its newest researched rung), and the last pass holds every technology
// the age offers, which is the Shipwright, Coinage/Banking and Atheism state.
// Building prices do not read technology, so each (civilization, age) prices
// its builds once, holding the climb's final set (which unlocks the Bombard
// Tower), and confirms the whole palette in one step on anchors found once and
// proved to take that batch (`anchors`, in shownPriceBuildAnchors.ts). The
// Market's quoted buy price appears only on a refusal, so it has seats of its
// own. Spies is priced per living enemy villager and the showcase holds none,
// so here it is charged at its 200-gold floor; its live figure is held by
// shownPriceIsChargedPrice.test.ts on a seat facing three villagers.
//
// BOUND — what a green run does NOT prove. Free-for-all seats only: the team
// discounts (Mayan walls, Viking Docks, Ethiopian Outposts) ride the same
// ownerConstructionCost the build cards read, and are driven by
// tests/simulation/teamBonuses.test.ts, not here. One map per kind of command
// (the showcase's buildings, the naval bay's builders). Research TIME, train
// time and every non-price word of a tooltip are unchecked. A control the card
// draws LOCKED is required to state a price but cannot be clicked, so its
// charge is not observed. A selection whose option lists are all empty is not
// rendered (it draws no priced control).
//
// COST: 55 s of test time for the file, measured 2026-10-14 on a 32-core
// machine (445 seats; each pays a ~40 ms load, one render per producer and two
// steps); a run beside a sibling's suite took 73 s. It is its own file so it
// runs beside the other suites rather than after them.

import { beforeAll, describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { deniedIdsFor } from '../../src/game/simulation/civTechTree';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { TRAINING_COSTS } from '../../src/game/simulation/trainingCosts';
import type { AgeType, BuildingType, PlayerResources } from '../../src/game/simulation/types';
import {
  addCosts,
  type Bridge,
  bootBlob,
  type Cost,
  type DrawnKind,
  drawnCommands,
  formatCost,
  FULL_PURSE,
  type MountedPanel,
  mountSelectionPanel,
  purseOf,
  sameCost,
  selectBuilding,
  selectUnit,
  shownMarketBuyCost,
  spentBetween,
  standSeat,
} from './shownPrice.helpers';
import { anchors, navalBlob } from './shownPriceBuildAnchors';

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const AGE_TECHS = new Set<string>(['feudal-age', 'castle-age', 'imperial-age']);
const MAX_PASSES = 10;
const MAX_REPORTED = 25;

// The showcase stands one completed building of every type, so every producer
// is there to select. Its Dock has no water, so a ship queued there is charged
// and never launched — the charge is all this census reads.
const showcaseBlob = (): string => bootBlob('showcase', 'building-showcase-fixture');

interface View { label: string; select: (bridge: Bridge) => boolean; militaryPage?: boolean }

interface Purchase { view: View; hook: string; shown: Cost }

type Coverage = Record<DrawnKind, Set<string>>;
const noCoverage = (): Coverage => ({ train: new Set(), research: new Set(), build: new Set(), tribute: new Set() });
// The findings and coverage of the civilization being walked.
let covered: Coverage = noCoverage();
let failures: string[] = [];
let seatsStood = 0;
let purchasesCharged = 0;

function fail(message: string): void {
  if (failures.length < MAX_REPORTED) failures.push(message);
}

/** Show the panel this view and click one drawn control (or all of them).
 *  Returns the purchases it made, in click order. A selection whose option
 *  lists are all empty draws no priced control, so it is not rendered. */
function buyFrom(
  bridge: Bridge,
  panel: MountedPanel,
  resources: PlayerResources,
  view: View,
  where: string,
  onlyHook?: string,
): Purchase[] {
  if (!view.select(bridge)) {
    fail(`${where}: could not select the ${view.label}`);
    return [];
  }
  const state = bridge.getSelectionState();
  const options = state.trainOptions.length + state.visibleResearchOptions.length
    + state.buildOptions.length + state.marketOptions.length;
  if (options === 0) return [];
  panel.show(state, resources);
  if (view.militaryPage) {
    panel.host.querySelector<HTMLButtonElement>('button[data-build-page="military"]')?.click();
  }
  const bought: Purchase[] = [];
  for (const command of drawnCommands(panel.host)) {
    if (onlyHook !== undefined && command.hook !== onlyHook) continue;
    const at = `${where} ${view.label} ${command.hook}`;
    if (command.shown === null) {
      fail(`${at}: the card draws it with no price`);
      continue;
    }
    if (command.quotesDisagree) {
      fail(`${at}: the card states three different prices — ${command.quotesDisagree}`);
      continue;
    }
    if (command.locked) continue;
    command.button.click();
    if (command.kind === 'build') {
      const anchor = anchors().get(command.id);
      if (!anchor || !bridge.confirmBuildingPlacement(anchor.x, anchor.y)) {
        fail(`${at}: the placement was not confirmed at ${JSON.stringify(anchor)}`);
        continue;
      }
    }
    const refusal = bridge.consumeCommandRejection();
    if (refusal !== null) {
      fail(`${at}: the card quoted ${formatCost(command.shown)} and the click was refused — ${refusal}`);
      continue;
    }
    covered[command.kind].add(command.kind === 'tribute' ? 'tribute' : command.id);
    bought.push({ view, hook: command.hook, shown: command.shown });
  }
  return bought;
}

/** One panel for a whole seat, as the HUD has one: buy from every view. */
function buyFromViews(bridge: Bridge, views: readonly View[], where: string, onlyHook?: string): Purchase[] {
  const panel = mountSelectionPanel(bridge);
  // The purse cannot move before the step, so one read serves every frame.
  const resources = purseOf(bridge);
  try {
    return views.flatMap((view) => buyFrom(bridge, panel, resources, view, where, onlyHook));
  } finally {
    panel.destroy();
  }
}

/** Stand a seat, buy everything every view draws, step once, and compare the
 *  stockpile's loss with the sum the card stated. A disagreement is replayed
 *  one purchase per step on a fresh seat, to name the control that lied. */
function census(spec: Parameters<typeof standSeat>[0], views: readonly View[], where: string): Purchase[] {
  const bridge = standSeat(spec);
  seatsStood += 1;
  bridge.step(100); // the boot-tick systems (free technologies) settle first
  const before = purseOf(bridge);
  const bought = buyFromViews(bridge, views, where);
  bridge.step(100);
  const spent = spentBetween(before, purseOf(bridge));
  const stated = addCosts(bought.map((purchase) => purchase.shown));
  purchasesCharged += bought.length;
  if (!sameCost(spent, stated)) {
    // Replays stop once the report is full: a red run names its first
    // offenders rather than replaying every seat of every civilization.
    for (const purchase of failures.length < MAX_REPORTED ? bought : []) {
      const alone = standSeat(spec);
      alone.step(100);
      const start = purseOf(alone);
      buyFromViews(alone, [purchase.view], where, purchase.hook);
      alone.step(100);
      const charged = spentBetween(start, purseOf(alone));
      if (!sameCost(charged, purchase.shown)) {
        fail(`${where} ${purchase.view.label} ${purchase.hook}: the card quoted ${formatCost(purchase.shown)}, the click charged ${formatCost(charged)}`);
      }
    }
    fail(`${where}: the card quoted ${formatCost(stated)} in all, the stockpile lost ${formatCost(spent)}`);
  }
  return bought;
}

// Every completed building type the showcase stands, each a view of its own,
// selected by a click on the cell found once to select it: every seat stands
// in the same boot world, so the cell is the same in all of them.
let showcaseViews: View[] | null = null;
function producerViews(): View[] {
  if (showcaseViews) return showcaseViews;
  const seat = standSeat({ blob: showcaseBlob(), civilization: 'Britons', age: 'imperial-age', researched: [] });
  const types = [...new Set(
    seat.getEconomyState().buildings.filter((b) => b.owner === 1 && b.isComplete).map((b) => b.buildingType),
  )].sort();
  showcaseViews = types.map((buildingType) => {
    expect(selectBuilding(seat, buildingType), `no cell of the showcase selects its ${buildingType}`).toBe(true);
    const { tileX, tileY } = seat.getSelectionState();
    return {
      label: buildingType,
      select: (bridge: Bridge) => bridge.selectEntityAtCell(tileX!, tileY!)
        && bridge.getSelectionState().selectedEntityType === buildingType,
    };
  });
  return showcaseViews;
}

const BUILDER_VIEWS: readonly View[] = [
  { label: 'villager (economic page)', select: (seat) => selectUnit(seat, 'villager') },
  { label: 'villager (military page)', select: (seat) => selectUnit(seat, 'villager'), militaryPage: true },
  { label: 'fishing ship', select: (seat) => selectUnit(seat, 'fishing-ship') },
];

/** Climb one (civilization, age): returns the final researched set. */
function climb(civilization: string, age: AgeType): string[] {
  let researched: string[] = [];
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const where = `${civilization} ${age} pass ${String(pass)}`;
    const bought = census({ blob: showcaseBlob(), civilization, age, researched }, producerViews(), where);
    const offered = bought
      .filter((purchase) => purchase.hook.startsWith('research-'))
      .map((purchase) => purchase.hook.slice('research-'.length))
      .filter((tech) => !AGE_TECHS.has(tech) && !researched.includes(tech));
    if (offered.length === 0) return researched;
    researched = [...researched, ...offered];
  }
  fail(`${civilization} ${age}: still offering new research after ${String(MAX_PASSES)} passes`);
  return researched;
}

interface CivilizationCensus { failures: string[]; covered: Coverage }
const censusByCivilization = new Map<string, CivilizationCensus>();

/** Walk one civilization through every age once, and keep what it found, so the
 *  coverage case reads every civilization's walk without depending on the order
 *  the cases run in (run alone, it walks them itself). */
function censusOf(civilization: string): CivilizationCensus {
  const done = censusByCivilization.get(civilization);
  if (done) return done;
  failures = [];
  covered = noCoverage();
  for (const age of AGES) {
    const finalSet = climb(civilization, age);
    census({ blob: navalBlob(), civilization, age, researched: finalSet }, BUILDER_VIEWS, `${civilization} ${age} builders`);
  }
  const walked = { failures, covered };
  censusByCivilization.set(civilization, walked);
  return walked;
}

// A case that hangs fails at work 123's 30-second convention; the slowest
// civilization measured 4.4 s. The one-time setup runs before them, under the
// hook limit.
const CASE_LIMIT_MS = 30_000;

describe('the shown-price census: every price the card states is the price its click charges', () => {
  beforeAll(() => {
    producerViews();
    anchors();
  });

  it.each(CIVILIZATION_NAMES)('%s — every age, every technology state, every train, research, build and tribute control', (civilization) => {
    const { failures: found } = censusOf(civilization);
    expect(found, found.join('\n')).toEqual([]);
  }, CASE_LIMIT_MS);

  it.each(CIVILIZATION_NAMES)('%s — the Market quotes the buy price it charges, with and without Guilds', (civilization) => {
    const states = deniedIdsFor(civilization).has('guilds') ? [[]] : [[], ['guilds']];
    for (const researched of states) {
      const where = `${civilization} Market ${researched.length > 0 ? 'with' : 'without'} Guilds`;
      // Refused for want of gold, each buy states its price…
      const broke = standSeat({ blob: showcaseBlob(), civilization, age: 'imperial-age', researched, purse: { ...FULL_PURSE, gold: 0 } });
      const panel = mountSelectionPanel(broke);
      expect(selectBuilding(broke, 'market'), `${where}: no Market to select`).toBe(true);
      panel.refresh();
      const quoted = new Map<string, Cost>();
      for (const button of panel.host.querySelectorAll<HTMLButtonElement>('button[data-command^="market-buy-"]')) {
        const price = shownMarketBuyCost(button.dataset.commandReason ?? '');
        expect(price, `${where}: ${String(button.dataset.command)} is refused without stating its price`).not.toBeNull();
        quoted.set(button.dataset.command!, price!);
      }
      panel.destroy();
      expect(quoted.size, `${where}: no buy button was drawn`).toBe(3);
      // …and a rich seat in the same state pays exactly that for each.
      const rich = standSeat({ blob: showcaseBlob(), civilization, age: 'imperial-age', researched });
      const richPanel = mountSelectionPanel(rich);
      expect(selectBuilding(rich, 'market')).toBe(true);
      richPanel.refresh();
      for (const hook of quoted.keys()) {
        const before = purseOf(rich).gold;
        richPanel.host.querySelector<HTMLButtonElement>(`button[data-command="${hook}"]`)!.click();
        expect(rich.consumeCommandRejection(), `${where}: ${hook} was refused`).toBeNull();
        rich.step(100);
        expect({ gold: before - purseOf(rich).gold }, `${where}: ${hook} quoted ${formatCost(quoted.get(hook)!)}`).toEqual(quoted.get(hook));
      }
      richPanel.destroy();
    }
  }, CASE_LIMIT_MS);

  // Reads every civilization's walk; in a whole-file run each is already done,
  // and run alone it walks them all, which is what its larger limit is for.
  it('quoted and charged every unit, technology and building in the tables', () => {
    const all = noCoverage();
    for (const civilization of CIVILIZATION_NAMES) {
      const walked = censusOf(civilization).covered;
      for (const kind of Object.keys(all) as DrawnKind[]) for (const id of walked[kind]) all[kind].add(id);
    }
    const units = Object.keys(TRAINING_COSTS).filter((unit) => !all.train.has(unit));
    const technologies = Object.keys(RESEARCH_COSTS).filter((tech) => !all.research.has(tech));
    const buildable = (Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[]).filter((type) => !all.build.has(type));
    console.log(
      `SHOWN-PRICE census: ${String(seatsStood)} seats, ${String(purchasesCharged)} purchases; covered `
      + `${String(all.train.size)} units, ${String(all.research.size)} technologies, `
      + `${String(all.build.size)} buildings, tribute ${String(all.tribute.size > 0)}`,
    );
    expect({ units, technologies, buildable }, 'never quoted and charged by any seat').toEqual({ units: [], technologies: [], buildable: [] });
    expect(all.tribute.size, 'no tribute button was quoted and charged').toBe(1);
  }, 600_000);
});
