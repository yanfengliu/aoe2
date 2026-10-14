// Why a command the command card DRAWS cannot be used right now.
//
// The class this answers: a player looks at a control, it refuses, and
// nothing on screen says what is missing. Before this the reasons existed
// only at the moment of REJECTION — the queue.research / queue.train /
// market.action validators build good sentences and the HUD toasts them —
// which leaves two holes a player falls into:
//
//   (a) A DISABLED control cannot be clicked at all, so its rejection
//       never fires and its reason is unreachable. The Town Center's
//       "Research Feudal Age" is the whole game's most consequential
//       refusal and sat greyed out for 38 minutes of a real play session
//       with 1,295 food against a stated cost of 500, its tooltip saying
//       only "Research Feudal Age. Cost: 500 food; takes 130s."
//   (b) A control that LOOKS usable only says why after the click, so the
//       player learns the price of a mistake by paying it.
//
// So the reason is computed here, beside the option lists, and travels in
// the selection state to the tooltip — the place a player asks. This
// module states WHY, never WHETHER: the eligibility rules stay in
// optionsRules / the validators, and a command absent from this list is
// simply one nothing is currently wrong with.
//
// Ordering matches the validators' own: a structural rule (prerequisite,
// age, tech tree, already-in-flight) outranks affordability, so a Feudal
// Age the player cannot yet reach is never reported as merely expensive.
//
// The PRICE of each drawn command is computed here too, beside its reason and
// from the same per-owner seam the charge reads (ownerCosts.ts), and travels to
// the tooltip in `SelectionState.commandCosts`. The HUD prices nothing itself:
// a tooltip that read the base table said an Italian Fishing Ship cost 75 wood
// while the Dock charged 64 (spec §14.2, work 125).

import type {
  BuildableBuildingType,
  BuildingType,
  CommandCost,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnavailableCommand,
} from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { GameWorld } from './pureHelpers';
import { playerResourcesCodec } from './bridgeStateSerialize';
import {
  ownerConstructionCost,
  ownerMarketBuyCost,
  ownerResearchCost,
  ownerTrainingCost,
} from './ownerCosts';
import { isBuyMarketAction, marketCommodityForAction } from '../prototypeEconomyRules';

const COST_ORDER: readonly (keyof PlayerResources)[] = ['food', 'wood', 'gold', 'stone'];

/**
 * "Not enough food." / "Not enough food and gold." — the resources the
 * stockpile cannot cover, by NAME.
 *
 * Deliberately without the shortfall figure. The command card re-renders
 * off a signature over the whole selection state, so a reason carrying a
 * live number would redraw the bar on every gather tick; naming the
 * resource flips only when the player crosses the price, which is the
 * same cadence the build palette's own affordability signature already
 * runs at. The amount is not lost — it is in the same tooltip, in the
 * cost the button quotes.
 */
export function describeUnaffordable(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): string | null {
  const missing = COST_ORDER.filter((kind) => resources[kind] < (cost[kind] ?? 0));
  if (missing.length === 0) return null;
  const named = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return `Not enough ${named}.`;
}

export interface CommandAvailabilityDeps {
  /** For the one price that is a query of the world: Spies. */
  world: GameWorld;
  accessor: BridgeStateAccessor;
  researchUnavailableSummary: (
    owner: number,
    buildingType: BuildingType,
    tech: ResearchableTechnologyType,
  ) => string;
  /** Techs this owner is already paying for; a second click would be
   *  refused, so the button says so before the click. Read-only — must
   *  not create an entry for an owner that has none. */
  inFlightTechsFor: (owner: number) => ReadonlySet<ResearchableTechnologyType>;
  marketTransactionAmount: number;
}

/** The option lists the command card is about to draw, as the selection
 *  state has already computed them. Every list is optional because a
 *  selection only ever offers some of them. */
export interface CommandAvailabilityQuery {
  owner: number;
  /** The selected building, for the commands that hang off one. */
  buildingType: BuildingType | null;
  visibleResearchOptions?: readonly ResearchableTechnologyType[];
  researchOptions?: readonly ResearchableTechnologyType[];
  trainOptions?: readonly TrainableUnitType[];
  marketOptions?: readonly MarketActionType[];
  buildOptions?: readonly BuildableBuildingType[];
}

export interface CommandAvailability {
  unavailableCommands(query: CommandAvailabilityQuery): UnavailableCommand[];
  /** The price of every train, research and build command the card draws. */
  commandCosts(query: CommandAvailabilityQuery): CommandCost[];
}

export function createCommandAvailability(
  deps: CommandAvailabilityDeps,
): CommandAvailability {
  const { accessor, world } = deps;

  function resourcesOf(owner: number): PlayerResources | undefined {
    return accessor.get(playerResourcesCodec).get(owner);
  }

  function researchEntries(
    owner: number,
    buildingType: BuildingType,
    visible: readonly ResearchableTechnologyType[],
    available: readonly ResearchableTechnologyType[],
    resources: PlayerResources,
  ): UnavailableCommand[] {
    const inFlight = deps.inFlightTechsFor(owner);
    const out: UnavailableCommand[] = [];
    for (const tech of visible) {
      if (!available.includes(tech)) {
        // The locked case: a rule, not a price. This is the age-up button.
        out.push({
          kind: 'research',
          id: tech,
          reason: deps.researchUnavailableSummary(owner, buildingType, tech),
        });
        continue;
      }
      if (inFlight.has(tech)) {
        out.push({ kind: 'research', id: tech, reason: 'Already being researched.' });
        continue;
      }
      const short = describeUnaffordable(resources, ownerResearchCost(world, accessor, owner, tech));
      if (short) {
        out.push({ kind: 'research', id: tech, reason: short });
      }
    }
    return out;
  }

  function trainEntries(
    owner: number,
    options: readonly TrainableUnitType[],
    resources: PlayerResources,
  ): UnavailableCommand[] {
    const out: UnavailableCommand[] = [];
    for (const unitType of options) {
      const short = describeUnaffordable(resources, ownerTrainingCost(accessor, owner, unitType));
      if (short) {
        out.push({ kind: 'train', id: unitType, reason: short });
      }
    }
    return out;
  }

  function buildEntries(
    owner: number,
    options: readonly BuildableBuildingType[],
    resources: PlayerResources,
  ): UnavailableCommand[] {
    const out: UnavailableCommand[] = [];
    for (const buildingType of options) {
      const short = describeUnaffordable(
        resources,
        ownerConstructionCost(accessor, owner, buildingType),
      );
      if (short) {
        out.push({ kind: 'build', id: buildingType, reason: short });
      }
    }
    return out;
  }

  function marketEntries(
    owner: number,
    options: readonly MarketActionType[],
    resources: PlayerResources,
  ): UnavailableCommand[] {
    const out: UnavailableCommand[] = [];
    for (const actionType of options) {
      const commodity = marketCommodityForAction(actionType);
      // The owner's price, which the trade and its validator also read, so
      // the quoted figure is the one the click pays (Guilds included).
      if (isBuyMarketAction(actionType)) {
        const goldCost = ownerMarketBuyCost(accessor, owner, commodity);
        if (resources.gold < goldCost) {
          out.push({
            kind: 'market',
            id: actionType,
            reason: `Not enough gold — this trade costs ${goldCost}.`,
          });
        }
      } else if (resources[commodity] < deps.marketTransactionAmount) {
        out.push({
          kind: 'market',
          id: actionType,
          reason: `Not enough ${commodity} to sell — a sale is ${deps.marketTransactionAmount}.`,
        });
      }
    }
    return out;
  }

  function unavailableCommands(query: CommandAvailabilityQuery): UnavailableCommand[] {
    const resources = resourcesOf(query.owner);
    if (!resources) {
      return [];
    }
    const out: UnavailableCommand[] = [];
    if (query.buildingType !== null && query.visibleResearchOptions) {
      out.push(...researchEntries(
        query.owner,
        query.buildingType,
        query.visibleResearchOptions,
        query.researchOptions ?? [],
        resources,
      ));
    }
    if (query.trainOptions && query.trainOptions.length > 0) {
      out.push(...trainEntries(query.owner, query.trainOptions, resources));
    }
    if (query.marketOptions && query.marketOptions.length > 0) {
      out.push(...marketEntries(query.owner, query.marketOptions, resources));
    }
    if (query.buildOptions && query.buildOptions.length > 0) {
      out.push(...buildEntries(query.owner, query.buildOptions, resources));
    }
    return out;
  }

  // Copies, because a seam may hand back the shared table row itself and the
  // selection state leaves the bridge.
  function commandCosts(query: CommandAvailabilityQuery): CommandCost[] {
    const { owner } = query;
    const out: CommandCost[] = [];
    // Locked research is priced too: its tooltip states a price, and that
    // price is what the click will take once the rule that locks it is met.
    if (query.buildingType !== null) {
      for (const tech of query.visibleResearchOptions ?? []) {
        out.push({ kind: 'research', id: tech, cost: { ...ownerResearchCost(world, accessor, owner, tech) } });
      }
    }
    for (const unitType of query.trainOptions ?? []) {
      out.push({ kind: 'train', id: unitType, cost: { ...ownerTrainingCost(accessor, owner, unitType) } });
    }
    for (const buildingType of query.buildOptions ?? []) {
      out.push({ kind: 'build', id: buildingType, cost: { ...ownerConstructionCost(accessor, owner, buildingType) } });
    }
    return out;
  }

  return { unavailableCommands, commandCosts };
}
