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
// proved to take that batch (see \`anchors\`). The Market's quoted buy price
// appears only on a refusal, so it has seats of its own. Spies is priced per living enemy villager and the showcase
// holds none, so here it is charged at its 200-gold floor; its live figure is
// held by shownPriceIsChargedPrice.test.ts on a seat facing three villagers.
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

import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { deniedIdsFor } from '../../src/game/simulation/civTechTree';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { TRAINING_COSTS } from '../../src/game/simulation/trainingCosts';
import type { AgeType, BuildableBuildingType, BuildingType, PlayerResources } from '../../src/game/simulation/types';
import { partitionBuildOptions } from '../../src/ui/hud/selectionPanel/buildPages';
import {
  addCosts,
  type Bridge,
  bootBlob,
  type Cost,
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

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const AGE_TECHS = new Set<string>(['feudal-age', 'castle-age', 'imperial-age']);
const MAX_PASSES = 10;
const MAX_REPORTED = 25;

// The showcase stands one completed building of every type, so every producer
// is there to select. Its Dock has no water, so a ship queued there is charged
// and never launched — the charge is all this census reads.
const showcaseBlob = (): string => bootBlob('showcase', 'building-showcase-fixture');

// The naval bay gives the build palette its builders: the villager, a Fishing
// Ship launched from the Dock for the Fish Trap card, and a finished Barracks,
// which the Stable, Archery Range, Blacksmith, Market and Watch Tower require.
// A placement needs ground the player has explored, and a whole palette needs
// more of it than the base's own sight shows, so the Galley first sails the
// bay's south and east shores and lights the land beyond them.
const GALLEY_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [[14, 16], [22, 16], [22, 5]];

function navalBlob(): string {
  return bootBlob('naval-builders', 'naval-fixture', (boot) => {
    expect(selectBuilding(boot, 'dock'), 'the naval fixture has no Dock').toBe(true);
    expect(boot.queueTrainUnit('fishing-ship'), 'the Dock refused a Fishing Ship').toBe(true);
    expect(selectUnit(boot, 'villager'), 'the naval fixture has no villager').toBe(true);
    expect(boot.beginBuildingPlacement('barracks')).toBe(true);
    const site = findAnchor(boot);
    expect(site, 'no cell takes a Barracks').not.toBeNull();
    expect(boot.confirmBuildingPlacement(site!.x, site!.y)).toBe(true);
    const galley = boot.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'galley');
    expect(galley, 'the naval fixture has no Galley').toBeDefined();
    for (const [x, y] of GALLEY_WAYPOINTS) {
      expect(boot.selectEntityById(galley!.id)).toBe(true);
      expect(boot.issueMoveCommand(x, y), `the Galley refused to sail to (${x}, ${y})`).toBe(true);
      for (let tick = 0; tick < 600; tick += 1) {
        boot.step(100);
        const at = boot.getEconomyState().units.find((u) => u.id === galley!.id);
        if (at && Math.abs(at.x - x) <= 1 && Math.abs(at.y - y) <= 1) break;
      }
    }
    for (let tick = 0; tick < 3000; tick += 1) {
      boot.step(100);
      const economy = boot.getEconomyState();
      if (
        economy.buildings.some((b) => b.owner === 1 && b.buildingType === 'barracks' && b.isComplete)
        && economy.units.some((u) => u.owner === 1 && u.unitType === 'fishing-ship')
      ) return;
    }
    throw new Error('the naval builders never finished their Barracks and Fishing Ship');
  });
}

interface Anchor { x: number; y: number }

/** The first cell, in rings out from the Town Center, whose preview accepts the
 *  armed placement. */
function findAnchor(bridge: Bridge): Anchor | null {
  const centre = bridge.getEconomyState().buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
  const { width, height } = bridge.getMapSize();
  const ox = centre?.x ?? 0;
  const oy = centre?.y ?? 0;
  for (let radius = 1; radius < Math.max(width, height); radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        if (bridge.getPlacementPreview(ox + dx, oy + dy)?.isValid) return { x: ox + dx, y: oy + dy };
      }
    }
  }
  return null;
}

/** Of every cell whose preview accepts the armed placement (free ground the
 *  builder can reach over explored ground, every foundation already standing
 *  taken into account), whose footprint lies on `explored` ground and touches
 *  no cell in `used`, the one FARTHEST from the builder; its footprint and a
 *  one-cell ring around it are then marked used. Filling the explored ground
 *  from its far ends inwards, with no two foundations touching, keeps the ways
 *  to it open. */
function farthestAnchor(
  bridge: Bridge,
  from: { x: number; y: number },
  used: Set<string>,
  explored: ReadonlySet<number>,
): Anchor | null {
  const { width, height } = bridge.getMapSize();
  let best: { anchor: Anchor; footprint: string[]; ring: string[]; distance: number } | null = null;
  for (let ay = 0; ay < height; ay += 1) {
    for (let ax = 0; ax < width; ax += 1) {
      const preview = bridge.getPlacementPreview(ax, ay);
      if (!preview?.isValid) continue;
      const distance = Math.abs(preview.cellX - from.x) + Math.abs(preview.cellY - from.y);
      if (best && distance <= best.distance) continue;
      const footprint: string[] = [];
      const ring: string[] = [];
      for (let y = preview.cellY - 1; y <= preview.cellY + preview.height; y += 1) {
        for (let x = preview.cellX - 1; x <= preview.cellX + preview.width; x += 1) {
          const inside = y >= preview.cellY && y < preview.cellY + preview.height
            && x >= preview.cellX && x < preview.cellX + preview.width;
          (inside ? footprint : ring).push(`${x},${y}`);
        }
      }
      if (footprint.some((cell) => used.has(cell))) continue;
      if (footprint.some((cell) => {
        const [x, y] = cell.split(',').map(Number);
        return !explored.has(y! * width + x!);
      })) continue;
      best = { anchor: { x: ax, y: ay }, footprint, ring, distance };
    }
  }
  if (!best) return null;
  for (const cell of [...best.footprint, ...best.ring]) used.add(cell);
  return best.anchor;
}

interface Placement { builder: 'villager' | 'fishing-ship'; buildingType: BuildableBuildingType }

/** Every build card in the order the census clicks them: the villager's
 *  Economic page, its Military page, then the Fishing Ship's card. */
function clickOrder(seat: Bridge): Placement[] {
  expect(selectUnit(seat, 'villager'), 'the naval seat has no villager').toBe(true);
  const pages = partitionBuildOptions(seat.getSelectionState().buildOptions);
  expect(selectUnit(seat, 'fishing-ship'), 'the naval seat has no Fishing Ship').toBe(true);
  const fromShip = seat.getSelectionState().buildOptions;
  return [
    ...[...pages.economic, ...pages.military].map((buildingType) => ({ builder: 'villager' as const, buildingType })),
    ...fromShip.map((buildingType) => ({ builder: 'fishing-ship' as const, buildingType })),
  ];
}

function placeInOrder(seat: Bridge, order: readonly Placement[], at: ReadonlyMap<string, Anchor>): void {
  for (const { builder, buildingType } of order) {
    expect(selectUnit(seat, builder)).toBe(true);
    expect(seat.beginBuildingPlacement(buildingType), `${buildingType} would not arm`).toBe(true);
    const anchor = at.get(buildingType)!;
    expect(seat.confirmBuildingPlacement(anchor.x, anchor.y), `${buildingType} refused at its anchor`).toBe(true);
  }
}

// One anchor per building type, so a whole palette is confirmed in ONE step and
// charged together. A site the player must reach over explored ground can be
// cut off by the foundations placed before it in the same step (work 122's
// rule), and that would read here as a price the click never took. So each
// anchor is found with the foundations before it in click order standing, and
// the set is then proved the way the census uses it: all confirmed, one step,
// every foundation down. Fewer buildings in an earlier age only open ground.
let anchorsByType: Map<string, Anchor> | null = null;
function anchors(): Map<string, Anchor> {
  if (anchorsByType) return anchorsByType;
  // Every building is offered in the Imperial Age once the Bombard Tower is
  // unlocked. Nothing else is researched, and only ground the boot world had
  // already explored is taken, because a census seat in another age, of
  // another civilization, sees exactly that ground and no more (Spies, for
  // one, would light the enemy's base).
  const spec = {
    blob: navalBlob(), civilization: 'Byzantines', age: 'imperial-age' as const, researched: ['bombard-tower-unlock'],
  };
  const search = standSeat(spec);
  const explored = new Set(search.getRenderState().frame?.exploredCells ?? []);
  expect(explored.size, 'the naval seat reports no explored ground').toBeGreaterThan(0);
  search.step(100);
  const order = clickOrder(search);
  const used = new Set<string>();
  const found = new Map<string, Anchor>();
  for (const placement of order) {
    expect(selectUnit(search, placement.builder)).toBe(true);
    expect(search.beginBuildingPlacement(placement.buildingType)).toBe(true);
    const builder = search.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === placement.builder)!;
    const anchor = farthestAnchor(search, builder, used, explored);
    expect(anchor, `no free cell takes a ${placement.buildingType} beside the others`).not.toBeNull();
    found.set(placement.buildingType, anchor!);
    placeInOrder(search, [placement], found);
    search.step(100);
  }
  const proof = standSeat(spec);
  proof.step(100);
  const standing = new Set(proof.getEconomyState().buildings.map((building) => building.id));
  placeInOrder(proof, order, found);
  proof.step(100);
  const landed = proof.getEconomyState().buildings.filter((building) => !standing.has(building.id));
  expect(
    order.map((placement) => placement.buildingType).filter((type) => !landed.some((b) => b.buildingType === type)),
    'anchors a one-step batch refuses',
  ).toEqual([]);
  anchorsByType = found;
  return found;
}

interface View { label: string; select: (bridge: Bridge) => boolean; militaryPage?: boolean }

interface Purchase { view: View; hook: string; shown: Cost }

const covered = { train: new Set<string>(), research: new Set<string>(), build: new Set<string>(), tribute: new Set<string>() };
// The current test's findings; each test starts its own list.
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

describe('the shown-price census: every price the card states is the price its click charges', () => {
  it.each(CIVILIZATION_NAMES)('%s — every age, every technology state, every train, research, build and tribute control', (civilization) => {
    failures = [];
    for (const age of AGES) {
      const finalSet = climb(civilization, age);
      census({ blob: navalBlob(), civilization, age, researched: finalSet }, BUILDER_VIEWS, `${civilization} ${age} builders`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  }, 180_000);

  it.each(CIVILIZATION_NAMES)('%s — the Market quotes the buy price it charges, with and without Guilds', (civilization) => {
    failures = [];
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
  }, 60_000);

  it('quoted and charged every unit, technology and building in the tables', () => {
    const units = Object.keys(TRAINING_COSTS).filter((unit) => !covered.train.has(unit));
    const technologies = Object.keys(RESEARCH_COSTS).filter((tech) => !covered.research.has(tech));
    const buildable = (Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[]).filter((type) => !covered.build.has(type));
    console.log(
      `SHOWN-PRICE census: ${String(seatsStood)} seats, ${String(purchasesCharged)} purchases; covered `
      + `${String(covered.train.size)} units, ${String(covered.research.size)} technologies, `
      + `${String(covered.build.size)} buildings, tribute ${String(covered.tribute.size > 0)}`,
    );
    expect({ units, technologies, buildable }, 'never quoted and charged by any seat').toEqual({ units: [], technologies: [], buildable: [] });
    expect(covered.tribute.size, 'no tribute button was quoted and charged').toBe(1);
  });
});
