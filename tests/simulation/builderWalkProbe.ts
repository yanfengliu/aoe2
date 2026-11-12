// The test's own measure of a villager's walk to a building site, and a record
// of every builder a computer seat names while a match is stepped (work 152
// M1d). Read-only: it reads the bridge and writes nothing to the game.
//
// THE WALK is a breadth-first search outward from the villager's own cell,
// over the path search's grid as `bridge.isCellPassableForUnit` reads it, to
// the first open cell orthogonally beside the site's footprint. It shares no
// code with the game's choice (`siteBuilderWalk.ts`), which floods the other
// way, from the site: two searches that agree are worth more than one search
// agreeing with itself. `cellPassabilityAccessor.test.ts` holds the accessor
// to the path search.
//
// THE RECORD is taken at the instant the seat decides. The AI's phases push
// each order onto `bridge.pendingCommands` from inside the tick, before any
// unit has moved in it, so wrapping that queue's `push` sees the world exactly
// as the choice was made: a read after the tick would find walkers a cell
// further on. For each order it lists who else the seat could have sent: its
// villagers on the map that pass the game's own test (no command; when none is
// free, any that is not building), less those already sent to a site in this
// decision, and, for a building still to be placed, less those the placement
// validator would refuse as its builder (`world.precheckCommand`, which
// observes validation and submits nothing). A placement the validator refuses
// with the builder it names is recorded with the refusal's code: nothing is
// built, so there is no walk to judge, unless the game would have taken
// another villager, which is the fault of the choice.
//
// THE CLAIM IT JUDGES (`betterBuilders`, spec §13.2): the builder is the nearest
// by walk of the villagers the policy may take, the lowest id on a tie. The
// policy passes over a villager who is the only one its seat has on a resource
// while another available villager can be sent (one the walk reaches and, for
// a placement, the game accepts); when none can, the nearest of them all goes.
// Who is the last on a resource is counted here as the game's rebalance counts
// it: every villager of the seat with a gatherer's role, by the resource the
// role names, whatever the villager is doing.
//
// BOUND: an order is told from the queue alone. A placement is a
// `building.placeConfirm`; a crew order is a `unit.contextAtEntity` that sends
// a villager, not to garrison, to an unfinished building of its own side. A
// seat's nomad opening does not mark its builder as sent (it places one
// building and stops), so on a map with no Town Center the record would count
// that villager as taken where the game does not.

import { buildingFootprint } from '../../src/game/simulation/bridge/pureHelpers';
import type { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { BuildableBuildingType, BuildingComponent, GathererComponent, UnitComponent } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

export interface SiteRect { x: number; y: number; width: number; height: number }

export interface PassabilityGrid { width: number; height: number; open: Uint8Array }

/** The path search's grid for `unitId`, each cell read through the bridge's debug accessor. */
export function passabilityGrid(bridge: Bridge, unitId: number): PassabilityGrid {
  const { width, height } = bridge.getMapSize();
  const open = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) open[y * width + x] = bridge.isCellPassableForUnit(unitId, x, y) ? 1 : 0;
  }
  return { width, height, open };
}

/** The fewest orthogonal steps from `start` to an open cell beside the
 *  footprint. The cell the villager stands on counts as open, as the path
 *  search has it, and is itself the answer only when the grid reads it open.
 *  Infinity when no such cell is reached. */
export function walkToSite(grid: PassabilityGrid, start: { x: number; y: number }, site: SiteRect): number {
  const { width, height, open } = grid;
  const beside = (x: number, y: number): boolean => {
    const inColumns = x >= site.x && x < site.x + site.width;
    const inRows = y >= site.y && y < site.y + site.height;
    return (inColumns && (y === site.y - 1 || y === site.y + site.height))
      || (inRows && (x === site.x - 1 || x === site.x + site.width));
  };
  if (start.x < 0 || start.y < 0 || start.x >= width || start.y >= height) return Number.POSITIVE_INFINITY;
  const startIndex = start.y * width + start.x;
  if (open[startIndex] === 1 && beside(start.x, start.y)) return 0;
  const steps = new Int32Array(width * height).fill(-1);
  const queue = [startIndex];
  steps[startIndex] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const x = index % width;
    const y = (index - x) / width;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (steps[next] !== -1 || open[next] !== 1) continue;
      steps[next] = steps[index]! + 1;
      if (beside(nx, ny)) return steps[next]!;
      queue.push(next);
    }
  }
  return Number.POSITIVE_INFINITY;
}

export interface BuilderOrder {
  tick: number;
  owner: number;
  kind: 'placement' | 'crew';
  buildingType: string;
  site: SiteRect;
  builderId: number;
  /** The builder's walk in cells, by `walkToSite`. */
  builderWalk: number;
  /** Whether the builder passes the game's test of who may be sent. */
  builderAvailable: boolean;
  /** Whether the builder is the only villager its seat has on a resource. */
  builderLastOnItsResource: boolean;
  /** Why the game refuses this placement with this builder (the validator's
   *  code), or null when it accepts it. A crew order is never refused here. */
  refusal: string | null;
  /** Everyone else the seat could have sent, with the walk each had. */
  others: Array<{ id: number; walk: number; lastOnItsResource: boolean }>;
}

/** Who the seat should have sent instead: everyone the policy may take with a
 *  shorter walk than the builder's, or the same walk and a lower id; all of
 *  them when the builder is a resource's last gatherer and one of them is not;
 *  and every other, when the game refuses the builder and would have taken one
 *  of them. Empty when the choice was the policy's. */
export function betterBuilders(order: BuilderOrder): Array<{ id: number; walk: number }> {
  if (order.refusal !== null) return order.others;
  const builder = { id: order.builderId, walk: order.builderWalk, lastOnItsResource: order.builderLastOnItsResource };
  const everyone = [builder, ...order.others];
  const canBeSpared = (one: typeof builder): boolean => !one.lastOnItsResource && Number.isFinite(one.walk);
  const mayBeTaken = everyone.some(canBeSpared) ? everyone.filter(canBeSpared) : everyone;
  if (!mayBeTaken.includes(builder)) return mayBeTaken;
  return mayBeTaken.filter((other) => other !== builder && (
    other.walk < builder.walk || (other.walk === builder.walk && other.id < builder.id)
  ));
}

export function describeOrder(order: BuilderOrder): string {
  const time = `${String(Math.floor(order.tick / 600))}:${String(Math.floor(order.tick / 10) % 60).padStart(2, '0')}`;
  const better = betterBuilders(order).map((other) => `#${String(other.id)} at ${String(other.walk)}`).join(', ');
  return `${time} owner ${String(order.owner)} ${order.kind} of a ${order.buildingType} at (${String(order.site.x)},${String(order.site.y)}): `
    + `sent #${String(order.builderId)}${order.builderAvailable ? '' : ' (NOT available)'}${order.builderLastOnItsResource ? ' (the last on its resource)' : ''}, a walk of ${String(order.builderWalk)} cells`
    + (order.refusal === null ? '' : `, REFUSED (${order.refusal})`)
    + (better ? `, past ${better}` : '');
}

/** Records every builder a computer seat names from now on. The array fills as
 *  the bridge is stepped. */
export function observeBuilderOrders(bridge: Bridge): BuilderOrder[] {
  const orders: BuilderOrder[] = [];
  const world = bridge.world;
  const aiSeats = new Set(bridge.getDebugSnapshot().aiSummaries.map((seat) => seat.owner));
  // Villagers a seat has already sent to a site in the decision under way.
  let sentAtTick = -1;
  const sentBySeat = new Map<number, Set<number>>();

  /** The placement validator's verdict on this builder: observed, never submitted. */
  const refusalOf = (
    builderId: number,
    placement: { buildingType: BuildableBuildingType; position: { x: number; y: number } },
  ): string | null => {
    const verdict = world.precheckCommand('building.placeConfirm', { builderId, ...placement });
    return verdict.accepted ? null : verdict.code;
  };

  const note = (command: Bridge['pendingCommands'][number]): void => {
    let builderId: number;
    let kind: BuilderOrder['kind'];
    let buildingType: string;
    let site: SiteRect;
    let placement: { buildingType: BuildableBuildingType; position: { x: number; y: number } } | null = null;
    if (command.type === 'building.placeConfirm') {
      const data = command.data as { builderId: number; buildingType: BuildableBuildingType; position: { x: number; y: number } };
      builderId = data.builderId;
      kind = 'placement';
      buildingType = data.buildingType;
      site = { ...data.position, ...buildingFootprint(data.buildingType) };
      placement = { buildingType: data.buildingType, position: { ...data.position } };
    } else if (command.type === 'unit.contextAtEntity') {
      const data = command.data as { unitId: number; targetEntityId: number; garrison?: boolean };
      if (data.garrison === true) return;
      const target = bridge.getEconomyState().buildings.find((building) => building.id === data.targetEntityId);
      const villager = world.getComponent<UnitComponent>(data.unitId, 'unit');
      const building = world.getComponent<BuildingComponent>(data.targetEntityId, 'building');
      if (!target || target.isComplete || !building || villager?.unitType !== 'villager' || building.owner !== villager.owner) return;
      builderId = data.unitId;
      kind = 'crew';
      buildingType = target.buildingType;
      site = { x: target.x, y: target.y, width: target.footprintWidth, height: target.footprintHeight };
    } else {
      return;
    }
    const owner = world.getComponent<UnitComponent>(builderId, 'unit')?.owner;
    if (owner === undefined || !aiSeats.has(owner)) return;

    if (world.tick !== sentAtTick) {
      sentAtTick = world.tick;
      sentBySeat.clear();
    }
    const sent = sentBySeat.get(owner) ?? new Set<number>();
    sentBySeat.set(owner, sent);

    const commands = new Map(bridge.getDebugSnapshot().unitPaths.map((path) => [path.id, path.commandType]));
    const seat = bridge.getEconomyState().units
      .filter((unit) => unit.owner === owner && unit.unitType === 'villager' && !sent.has(unit.id));
    const free = seat.filter((unit) => !commands.has(unit.id));
    const available = free.length > 0 ? free : seat.filter((unit) => commands.get(unit.id) !== 'build');
    // The seat's villagers that are the only one it has on a resource.
    const sharing = new Map<string, number[]>();
    for (const id of world.query('unit', 'gatherer')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
      if (!gatherer || unit?.owner !== owner || unit.unitType !== 'villager') continue;
      sharing.set(gatherer.desiredResource, [...(sharing.get(gatherer.desiredResource) ?? []), id]);
    }
    const last = new Set([...sharing.values()].filter((ids) => ids.length === 1).map((ids) => ids[0]!));
    const grid = passabilityGrid(bridge, builderId);
    const cellOf = new Map(bridge.getEconomyState().units.map((unit) => [unit.id, { x: unit.x, y: unit.y }]));
    const builderCell = cellOf.get(builderId);
    orders.push({
      tick: world.tick,
      owner,
      kind,
      buildingType,
      site,
      builderId,
      builderWalk: builderCell ? walkToSite(grid, builderCell, site) : Number.POSITIVE_INFINITY,
      builderAvailable: available.some((unit) => unit.id === builderId),
      builderLastOnItsResource: last.has(builderId),
      refusal: placement === null ? null : refusalOf(builderId, placement),
      others: available
        .filter((unit) => unit.id !== builderId)
        .filter((unit) => placement === null
          || refusalOf(unit.id, placement) === null)
        .map((unit) => ({ id: unit.id, walk: walkToSite(grid, unit, site), lastOnItsResource: last.has(unit.id) })),
    });
    sent.add(builderId);
  };

  const queue = bridge.pendingCommands;
  const push = queue.push.bind(queue);
  // Not enumerable: the queue is an array the bridge clones entry by entry.
  Object.defineProperty(queue, 'push', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: (...commands: Array<Bridge['pendingCommands'][number]>): number => {
      for (const command of commands) note(command);
      return push(...commands);
    },
  });
  return orders;
}

/** The fewest orthogonal steps from one cell to another over the grid, the
 *  first cell counted as open; Infinity when the second is closed or cut off. */
export function stepsBetween(grid: PassabilityGrid, from: { x: number; y: number }, to: { x: number; y: number }): number {
  const { width, height, open } = grid;
  const goal = to.y * width + to.x;
  if (open[goal] !== 1) return Number.POSITIVE_INFINITY;
  const start = from.y * width + from.x;
  if (start === goal) return 0;
  const steps = new Int32Array(width * height).fill(-1);
  const queue = [start];
  steps[start] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const x = index % width;
    const y = (index - x) / width;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (steps[next] !== -1 || open[next] !== 1) continue;
      steps[next] = steps[index]! + 1;
      if (next === goal) return steps[next]!;
      queue.push(next);
    }
  }
  return Number.POSITIVE_INFINITY;
}
