// Placing a building on unexplored ground follows Definitive Edition's rules
// (work 122; defect register 2026-09-23; spec §12.1).
//
// The defect: the placement ghost took its colour from the true terrain,
// resources, buildings and units under it, so sweeping it across black ground
// drew the lakes, the forests and the enemy's base. On the boot map at tick 0 a
// house over wholly unexplored ground was red on 86 of 86 water footprints, 41
// of 41 forest and 10 of 10 enemy-building footprints, and green on 228 of 228
// open-grass ones (tmp/probes/122-ghostOverUnexplored.mts, bridge.getPlacementPreview).
//
// Definitive Edition's own notes settle the rule, and each is a case here:
//  * 44725 (2021-01-25): a blueprint over unexplored terrain no longer reveals
//    whether a building or unit occupies it; it can still be placed, and it is
//    not buildable if the ground is obstructed.
//  * 45185 (2021-02-11): a foundation may be placed over unexplored ground if
//    part of it is explored, never on ground wholly unexplored.
//  * 46295 (2021-03-24): a foundation placed over an obstacle the fog hid is
//    cancelled when villagers try to begin construction.
//
// The main case is NON-INTERFERENCE, the shape of the fog fairness gate
// (tests/rendering/aoeVoxelFogFairness.test.ts): two variants of one fixture
// differ only in what lies under the human's fog, and every footprint that
// touches unexplored ground must get the same verdict on both.
//
// WHAT A GREEN RUN DOES NOT PROVE:
//  * One fixture map at boot (tick 0) and the boot map at tick 0. The fog only
//    grows, and nothing here re-checks after units have explored more.
//  * The placing player's view is the human seat's. An AI seat places by the
//    true map, and that is asserted, not exercised in a match.
//  * Explored-but-not-visible ground is read as it is now, not as the player
//    last saw it: an enemy building raised in the fog after the player saw the
//    ground still turns the ghost red there. That is a different leak and is
//    not this gate's.
//  * Four building types: a 1x1 wall, a 2x2 house, a 3x3 barracks and the
//    3x3 dock with its water rule. Larger footprints share the code, not the sweep.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { buildingFootprint } from '../../src/game/simulation/bridge/pureHelpers';
import {
  ENEMY_HOUSE,
  HIDDEN_TREE_CELL,
  HIDDEN_WATER_CELL,
  HOUSE_ON_UNEXPLORED_GRASS,
  HOUSE_OVER_HIDDEN_FOREST,
  HOUSE_OVER_HIDDEN_HOUSE,
  HOUSE_OVER_HIDDEN_WATER,
  HOUSE_OVER_KNOWN_STONE,
  KNOWN_STONE_CELL,
  UNEXPLORED_PLACEMENT_HIDDEN_SEED,
  UNEXPLORED_PLACEMENT_OPEN_SEED,
  VILLAGER_CELL,
  hiddenObstacleCells,
  villagerSeesAtBoot,
} from '../../src/game/simulation/fixtures/unexploredPlacement';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };
const HUMAN = 1;
const SWEPT: readonly BuildableBuildingType[] = ['palisade-wall', 'house', 'barracks', 'dock'];

function exploredCells(bridge: Bridge): Set<number> {
  const frame = bridge.getRenderState().frame;
  if (!frame) throw new Error('the bridge projected no frame, so the fog cannot be read');
  return new Set(frame.exploredCells);
}

function selectHumanVillager(bridge: Bridge): number {
  const villager = bridge.getEconomyState().units
    .find((unit) => unit.owner === HUMAN && unit.unitType === 'villager');
  expect(villager, 'the fixture moved: the human has no villager').toBeDefined();
  expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
  return villager!.id;
}

function footprintCells(anchor: Cell, type: BuildableBuildingType): Cell[] {
  const { width, height } = buildingFootprint(type);
  const cells: Cell[] = [];
  for (let y = anchor.y; y < anchor.y + height; y += 1) {
    for (let x = anchor.x; x < anchor.x + width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function placeableAt(bridge: Bridge, type: BuildableBuildingType, anchor: Cell): boolean {
  expect(bridge.beginBuildingPlacement(type), `placement mode refused for ${type}`).toBe(true);
  return bridge.getPlacementPreview(anchor.x, anchor.y)?.isValid === true;
}

function wood(bridge: Bridge): number {
  return bridge.getHudState().playerResources.wood;
}

function humanBuildingAt(bridge: Bridge, anchor: Cell) {
  return bridge.getEconomyState().buildings
    .find((building) => building.owner === HUMAN && building.x === anchor.x && building.y === anchor.y);
}

function drainMessages(bridge: Bridge): string[] {
  const messages: string[] = [];
  for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
    messages.push(message);
  }
  return messages;
}

describe('placement over unexplored ground (work 122)', () => {
  it('the two fixture variants differ only under the fog', () => {
    const open = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
    const hidden = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    const { width, height } = open.getMapSize();
    const openExplored = exploredCells(open);
    expect([...exploredCells(hidden)].sort((a, b) => a - b)).toEqual([...openExplored].sort((a, b) => a - b));
    // The villager's disc is exactly what the fixture says it is.
    for (let y = VILLAGER_CELL.y - 8; y <= VILLAGER_CELL.y + 8; y += 1) {
      for (let x = VILLAGER_CELL.x - 8; x <= VILLAGER_CELL.x + 8; x += 1) {
        expect(openExplored.has(y * width + x), `(${x},${y})`).toBe(villagerSeesAtBoot(x, y));
      }
    }
    const obstacles = hiddenObstacleCells();
    expect(obstacles.length).toBeGreaterThan(60);
    for (const cell of obstacles) {
      expect(openExplored.has(cell.y * width + cell.x), `hidden ${cell.kind} at (${cell.x},${cell.y}) is explored`).toBe(false);
    }
    for (const kind of ['water', 'forest', 'gold', 'enemy-house', 'enemy-unit']) {
      expect(obstacles.some((cell) => cell.kind === kind), `no hidden ${kind}`).toBe(true);
    }
    expect(width * height).toBe(60 * 36);
  });

  // 44725 and spec §12.1: nothing about an unexplored cell reaches the ghost.
  it('every footprint touching unexplored ground gets the same verdict whatever the fog hides', () => {
    const open = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
    const hidden = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    selectHumanVillager(open);
    selectHumanVillager(hidden);
    const { width, height } = open.getMapSize();
    const explored = exploredCells(open);
    const obstacleAt = new Map(hiddenObstacleCells().map((cell) => [cell.y * width + cell.x, cell.kind]));
    const differences: string[] = [];
    let compared = 0;
    let placeableOverHiddenObstacle = 0;
    let partlyExploredPlaceable = 0;
    for (const type of SWEPT) {
      expect(open.beginBuildingPlacement(type)).toBe(true);
      expect(hidden.beginBuildingPlacement(type)).toBe(true);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const inMap = footprintCells({ x, y }, type).filter((c) => c.x < width && c.y < height);
          const unexplored = inMap.filter((c) => !explored.has(c.y * width + c.x));
          if (unexplored.length === 0) continue;
          compared += 1;
          const openVerdict = open.getPlacementPreview(x, y)?.isValid;
          const hiddenVerdict = hidden.getPlacementPreview(x, y)?.isValid;
          const hiddenUnder = unexplored
            .map((c) => obstacleAt.get(c.y * width + c.x))
            .filter((kind) => kind !== undefined);
          if (openVerdict !== hiddenVerdict) {
            differences.push(
              `${type} at (${x},${y}): ${String(openVerdict)} over open ground, ${String(hiddenVerdict)} `
              + `over ${hiddenUnder.join(', ') || 'the same ground'}`,
            );
          }
          if (hiddenVerdict === true && hiddenUnder.length > 0) placeableOverHiddenObstacle += 1;
          if (hiddenVerdict === true && unexplored.length < inMap.length) partlyExploredPlaceable += 1;
        }
      }
    }
    expect(differences.slice(0, 12), `${differences.length} footprints read the fog`).toEqual([]);
    // Non-vacuous: thousands of footprints compared, and the rule is not "refuse
    // everything near the fog" — many are placeable, and many of those sit on
    // something the fog hides (44725: placed, then found when building starts).
    expect(compared).toBeGreaterThan(6000);
    expect(partlyExploredPlaceable).toBeGreaterThan(40);
    expect(placeableOverHiddenObstacle).toBeGreaterThan(20);
  });

  // 45185: never on ground wholly unexplored.
  it('refuses a footprint none of which has been explored, and says so', () => {
    for (const seed of [UNEXPLORED_PLACEMENT_OPEN_SEED, UNEXPLORED_PLACEMENT_HIDDEN_SEED]) {
      const bridge = createSimulationBridge(seed);
      selectHumanVillager(bridge);
      const { width, height } = bridge.getMapSize();
      const explored = exploredCells(bridge);
      const accepted: string[] = [];
      for (const type of SWEPT) {
        expect(bridge.beginBuildingPlacement(type)).toBe(true);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const cells = footprintCells({ x, y }, type);
            if (cells.some((c) => c.x >= width || c.y >= height)) continue;
            if (cells.some((c) => explored.has(c.y * width + c.x))) continue;
            if (bridge.getPlacementPreview(x, y)?.isValid === true) accepted.push(`${type} at (${x},${y})`);
          }
        }
      }
      expect(accepted.slice(0, 12), `${seed}: ${accepted.length} wholly unexplored footprints accepted`).toEqual([]);

      const woodBefore = wood(bridge);
      expect(bridge.beginBuildingPlacement('house')).toBe(true);
      expect(bridge.confirmBuildingPlacement(HOUSE_ON_UNEXPLORED_GRASS.x, HOUSE_ON_UNEXPLORED_GRASS.y)).toBe(false);
      bridge.step(100);
      expect(wood(bridge)).toBe(woodBefore);
      expect(humanBuildingAt(bridge, HOUSE_ON_UNEXPLORED_GRASS)).toBeUndefined();
      const message = drainMessages(bridge).join(' | ');
      expect(message).toContain(`house (2x2) at (${HOUSE_ON_UNEXPLORED_GRASS.x},${HOUSE_ON_UNEXPLORED_GRASS.y})`);
      expect(message).toContain('none of that ground has been explored');
      expect(message).toContain('at least one of its cells');
    }
  });

  // 45185 and 44725: allowed when part is explored, whatever the rest hides.
  it('places a house that is partly on explored ground, though the fog hides water under it', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    selectHumanVillager(bridge);
    const woodBefore = wood(bridge);
    expect(placeableAt(bridge, 'house', HOUSE_OVER_HIDDEN_WATER)).toBe(true);
    expect(bridge.confirmBuildingPlacement(HOUSE_OVER_HIDDEN_WATER.x, HOUSE_OVER_HIDDEN_WATER.y)).toBe(true);
    bridge.step(100);
    expect(humanBuildingAt(bridge, HOUSE_OVER_HIDDEN_WATER)?.isComplete).toBe(false);
    expect(wood(bridge)).toBeLessThan(woodBefore);
  });

  // 46295, one case per kind of hidden obstacle, each against the open variant,
  // where the same placement must start and grow. A hidden unit is no longer
  // one of them (work 126): units walk over a foundation nobody has started,
  // and a unit never cancels the start. The Militia under HOUSE_OVER_HIDDEN_UNIT
  // leaves when ordered and the House starts once it has gone
  // (hiddenUnderFoundation.test.ts); an enemy's unit on a site holds the start
  // until it has gone (foundationStartUnits.test.ts).
  const cancelCases: Array<{ name: string; anchor: Cell; cell: Cell; cause: string }> = [
    { name: 'water', anchor: HOUSE_OVER_HIDDEN_WATER, cell: HIDDEN_WATER_CELL, cause: 'water' },
    { name: 'forest', anchor: HOUSE_OVER_HIDDEN_FOREST, cell: HIDDEN_TREE_CELL, cause: 'forest' },
    { name: 'an enemy house', anchor: HOUSE_OVER_HIDDEN_HOUSE, cell: ENEMY_HOUSE, cause: 'a house (building)' },
  ];
  for (const { name, anchor, cell, cause } of cancelCases) {
    it(`cancels a house over hidden ${name} when the villager comes to start it, refunds it and says why`, () => {
      const hidden = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
      const villagerId = selectHumanVillager(hidden);
      const woodBefore = wood(hidden);
      expect(placeableAt(hidden, 'house', anchor), 'the ghost must not reveal it').toBe(true);
      expect(hidden.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
      hidden.step(100);
      expect(humanBuildingAt(hidden, anchor), 'the foundation went down').toBeDefined();
      expect(wood(hidden)).toBeLessThan(woodBefore);
      drainMessages(hidden);
      let messages: string[] = [];
      for (let i = 0; i < 300 && humanBuildingAt(hidden, anchor) !== undefined; i += 1) {
        hidden.step(100);
        messages = messages.concat(drainMessages(hidden));
      }
      expect(humanBuildingAt(hidden, anchor), 'the foundation was never cancelled').toBeUndefined();
      expect(wood(hidden), 'the cost was not refunded').toBe(woodBefore);
      const villager = hidden.getEconomyState().units.find((unit) => unit.id === villagerId);
      expect(villager?.task).not.toBe('building');
      const message = messages.join(' | ');
      expect(message).toContain(`house at (${anchor.x},${anchor.y}) was cancelled`);
      expect(message).toContain(`${cause} at (${cell.x},${cell.y})`);
      expect(message).toContain('fog of war');
      expect(message).toContain('refunded');

      // The control: the same placement on the open variant starts and grows.
      const open = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
      selectHumanVillager(open);
      expect(placeableAt(open, 'house', anchor)).toBe(true);
      expect(open.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
      for (let i = 0; i < 300 && (humanBuildingAt(open, anchor)?.buildProgressTicks ?? 0) === 0; i += 1) {
        open.step(100);
      }
      expect(humanBuildingAt(open, anchor)?.buildProgressTicks ?? 0).toBeGreaterThan(0);
    });
  }

  // A Farm is walkable ground and one cell, so the start check leaves it alone:
  // a villager or a sheep standing on its foundation is not something the fog
  // hid, and must not cancel it.
  it('a villager standing on a Farm foundation does not cancel it when the builder arrives', () => {
    const bridge = createSimulationBridge('multi-villager-construction-fixture');
    const villagers = bridge.getEconomyState().units
      .filter((unit) => unit.owner === HUMAN && unit.unitType === 'villager')
      .sort((a, b) => a.x - b.x);
    const builder = villagers[0]!;
    const stander = villagers[villagers.length - 1]!;
    const site = { x: 14, y: 10 };
    expect(bridge.selectUnitsByIds([builder.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('farm')).toBe(true);
    expect(bridge.confirmBuildingPlacement(site.x, site.y)).toBe(true);
    expect(bridge.selectUnitsByIds([stander.id])).toBe(true);
    expect(bridge.issueMoveCommand(site.x, site.y)).toBe(true);
    const standerOnSite = (): boolean => bridge.getEconomyState().units
      .some((unit) => unit.id === stander.id && unit.x === site.x && unit.y === site.y);
    const farm = () => humanBuildingAt(bridge, site);
    for (let i = 0; i < 300 && !standerOnSite(); i += 1) bridge.step(100);
    expect(standerOnSite(), 'the second villager never reached the farm').toBe(true);
    expect(farm()?.buildProgressTicks ?? 0, 'the builder started before the premise held').toBe(0);
    for (let i = 0; i < 300 && (farm()?.buildProgressTicks ?? 0) === 0; i += 1) bridge.step(100);
    expect(farm(), 'the farm was cancelled').toBeDefined();
    expect(farm()!.buildProgressTicks).toBeGreaterThan(0);
    expect(standerOnSite(), 'the second villager left before the builder started').toBe(true);
  });

  // The refusal is a picture too: it names only what the player has explored,
  // and counts the unexplored cells apart rather than as clear or blocked.
  it('a refusal names the explored blocker and counts the unexplored cells apart, the same over either variant', () => {
    const messages = [UNEXPLORED_PLACEMENT_OPEN_SEED, UNEXPLORED_PLACEMENT_HIDDEN_SEED].map((seed) => {
      const bridge = createSimulationBridge(seed);
      selectHumanVillager(bridge);
      expect(placeableAt(bridge, 'house', HOUSE_OVER_KNOWN_STONE)).toBe(false);
      expect(bridge.confirmBuildingPlacement(HOUSE_OVER_KNOWN_STONE.x, HOUSE_OVER_KNOWN_STONE.y)).toBe(false);
      return drainMessages(bridge).join(' | ');
    });
    expect(messages[0]).toContain(`a stone-mine (resource) at (${KNOWN_STONE_CELL.x},${KNOWN_STONE_CELL.y})`);
    expect(messages[0]).toContain('; 1 of the 4 footprint cells is blocked, and 3 are unexplored.');
    expect(messages[1]).toBe(messages[0]);
  });

  // Review finding, work 122: the player is always shown its own foundations,
  // so one reaching into the fog still refuses another over it. Read as fog,
  // its cell let a second house stack on the first, and the start check then
  // cancelled the first for "a house hidden under the fog of war".
  it('a foundation over the player\'s own earlier one is refused, though both reach into the fog', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
    selectHumanVillager(bridge);
    const first = { x: 19, y: 9 };
    const second = { x: 18, y: 10 };
    const shared = { x: 19, y: 10 };
    const { width } = bridge.getMapSize();
    const explored = exploredCells(bridge);
    const isExplored = (cell: Cell): boolean => explored.has(cell.y * width + cell.x);
    expect(isExplored(shared), 'the cell the two share must be unexplored').toBe(false);
    for (const anchor of [first, second]) {
      expect(footprintCells(anchor, 'house').some(isExplored), `(${anchor.x},${anchor.y}) must touch explored ground`).toBe(true);
    }
    expect(placeableAt(bridge, 'house', first)).toBe(true);
    expect(bridge.confirmBuildingPlacement(first.x, first.y, { queue: true })).toBe(true);
    bridge.step(100);
    expect(humanBuildingAt(bridge, first), 'the first foundation went down').toBeDefined();
    expect(bridge.getPlacementPreview(second.x, second.y)?.isValid).toBe(false);
    expect(bridge.confirmBuildingPlacement(second.x, second.y, { queue: true })).toBe(false);
    expect(drainMessages(bridge).join(' | ')).toContain(`blocked by a house (building) at (${shared.x},${shared.y})`);
    // Nothing lies hidden under the first, so it goes up.
    let messages: string[] = [];
    for (let i = 0; i < 300 && (humanBuildingAt(bridge, first)?.buildProgressTicks ?? 0) === 0; i += 1) {
      bridge.step(100);
      messages = messages.concat(drainMessages(bridge));
    }
    expect(humanBuildingAt(bridge, first)?.buildProgressTicks ?? 0).toBeGreaterThan(0);
    expect(messages.join(' | ')).not.toContain('cancelled');
  });

  // Beside the footprint the fog meets no requirement: a Dock needs water the
  // player has seen, and the refusal says so rather than blame an obstacle.
  it('a Dock beside water nobody has explored is refused, and says why, the same over either variant', () => {
    const anchor = { x: 22, y: 12 };
    const messages = [UNEXPLORED_PLACEMENT_OPEN_SEED, UNEXPLORED_PLACEMENT_HIDDEN_SEED].map((seed) => {
      const bridge = createSimulationBridge(seed);
      selectHumanVillager(bridge);
      expect(placeableAt(bridge, 'dock', anchor)).toBe(false);
      expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(false);
      return drainMessages(bridge).join(' | ');
    });
    expect(messages[0]).toContain('dock (3x3) at (22,12): a dock must stand on land and touch water you have explored');
    expect(messages[1]).toBe(messages[0]);
  });

  // The AI's site search and its commands read the true map (spec §12.1): the
  // notes are about the player's blueprint, and no note asks the AI to change.
  it('an AI seat still places by the true map', () => {
    const verdict = (seed: string): boolean => {
      const bridge = createSimulationBridge(seed, { forceAiForOwners: new Set([HUMAN]) });
      selectHumanVillager(bridge);
      return placeableAt(bridge, 'house', HOUSE_OVER_HIDDEN_WATER);
    };
    expect(verdict(UNEXPLORED_PLACEMENT_OPEN_SEED)).toBe(true);
    expect(verdict(UNEXPLORED_PLACEMENT_HIDDEN_SEED)).toBe(false);
  });
});

describe('placement over unexplored ground on the boot map (work 122)', () => {
  it('every wholly unexplored house footprint is refused, whatever lies under it', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    selectHumanVillager(bridge);
    const { width, height } = bridge.getMapSize();
    const explored = exploredCells(bridge);
    const economy = bridge.getEconomyState();
    const occupiedBy = new Map<number, string>();
    for (const building of economy.buildings) {
      for (const cell of footprintCells({ x: building.x, y: building.y }, building.buildingType as BuildableBuildingType)) {
        occupiedBy.set(cell.y * width + cell.x, 'building');
      }
    }
    for (const resource of economy.resources) {
      if (!occupiedBy.has(resource.y * width + resource.x)) {
        occupiedBy.set(resource.y * width + resource.x, resource.resourceType === 'tree' ? 'forest' : 'resource');
      }
    }
    const terrainKind = new Map<number, string>();
    for (const id of bridge.world.query('position', 'terrain')) {
      const position = bridge.world.getComponent<Cell>(id, 'position')!;
      const terrain = bridge.world.getComponent<{ kind: string }>(id, 'terrain')!;
      terrainKind.set(position.y * width + position.x, terrain.kind);
    }
    const tally = new Map<string, { valid: number; invalid: number }>();
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    for (let y = 0; y + 2 <= height; y += 1) {
      for (let x = 0; x + 2 <= width; x += 1) {
        const cells = footprintCells({ x, y }, 'house').map((c) => c.y * width + c.x);
        if (cells.some((cell) => explored.has(cell))) continue;
        const kinds = new Set(cells.map((cell) => occupiedBy.get(cell)
          ?? (terrainKind.get(cell) === 'water' ? 'water' : terrainKind.get(cell) === 'forest' ? 'forest' : 'open')));
        if (kinds.size !== 1) continue;
        const kind = [...kinds][0]!;
        const entry = tally.get(kind) ?? { valid: 0, invalid: 0 };
        if (bridge.getPlacementPreview(x, y)?.isValid === true) entry.valid += 1;
        else entry.invalid += 1;
        tally.set(kind, entry);
      }
    }
    // Before work 122: water 0/86, forest 0/41, building 0/10 and open 228/228 valid.
    for (const kind of ['water', 'forest', 'building', 'open']) {
      const entry = tally.get(kind) ?? { valid: 0, invalid: 0 };
      expect(entry.valid + entry.invalid, `too few ${kind} footprints to say anything`).toBeGreaterThan(kind === 'building' ? 4 : 30);
      expect(entry.valid, `${kind}: wholly unexplored footprints the ghost accepts`).toBe(0);
    }
  });
});
