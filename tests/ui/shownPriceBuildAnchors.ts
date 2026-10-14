// The build anchors of the shown-price census (shownPriceCensus.test.ts): the
// naval bay's builders, and one place per building type where a whole palette,
// confirmed in one step, lands and is charged together.

import { expect } from 'vitest';

import type { BuildableBuildingType } from '../../src/game/simulation/types';
import { partitionBuildOptions } from '../../src/ui/hud/selectionPanel/buildPages';
import { type Bridge, bootBlob, selectBuilding, selectUnit, standSeat } from './shownPrice.helpers';

// The naval bay gives the build palette its builders: the villager, a Fishing
// Ship launched from the Dock for the Fish Trap card, and a finished Barracks,
// which the Stable, Archery Range, Blacksmith, Market and Watch Tower require.
// A placement needs ground the player has explored, and a whole palette needs
// more of it than the base's own sight shows, so the Galley first sails the
// bay's south and east shores and lights the land beyond them.
const GALLEY_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [[14, 16], [22, 16], [22, 5]];

export function navalBlob(): string {
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

export interface Anchor { x: number; y: number }

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
export function anchors(): Map<string, Anchor> {
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
