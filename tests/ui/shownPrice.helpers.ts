// Shared rig for the shown-price gates (shownPriceIsChargedPrice.test.ts and
// shownPriceCensus.test.ts).
//
// The SHOWN end is the real selection panel, mounted over a real bridge with
// the HUD's own wiring (`selectionPanelDepsFor`) and fed the bridge's own
// selection state, exactly as one HUD frame feeds it. A price is read off what
// the panel drew — a tooltip, an accessible name, a cost chip, a refusal. The
// CHARGED end is the stockpile, read before and after the real command the
// drawn button pushes when it is clicked.
//
// A seat is stood from a boot blob with its civilization, age, researched set
// and purse written in — the same setup-through-the-save the content pipeline
// gates use (tests/simulation/contentPipeline.helpers.ts). Nothing under test
// is written directly: every price is read off the card, every charge is a
// click.

import { expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  playerAgesCodec,
  playerCivilizationsCodec,
  playerResourcesCodec,
  researchedTechnologiesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { AgeType, PlayerResources, SelectionState } from '../../src/game/simulation/types';
import { createSelectionPanel } from '../../src/ui/hud/selectionPanel';
import { selectionPanelDepsFor } from '../../src/ui/hud/createHudController';

export type Bridge = ReturnType<typeof createSimulationBridge>;
export type Cost = Partial<PlayerResources>;

export const RESOURCE_KINDS = ['food', 'wood', 'gold', 'stone'] as const;

/** Big enough that no batch of purchases runs it dry, small enough to stay an
 *  exact integer through every civilization multiplier. */
export const FULL_PURSE: PlayerResources = { food: 400_000, wood: 400_000, gold: 400_000, stone: 400_000 };

export interface MountedPanel {
  host: HTMLElement;
  /** Feed the panel the bridge's current selection, as one HUD frame does. */
  refresh(): void;
  /** One HUD frame with a selection state and purse already read. */
  show(state: SelectionState, resources: PlayerResources): void;
  destroy(): void;
}

export function mountSelectionPanel(bridge: Bridge): MountedPanel {
  const host = document.createElement('div');
  document.body.append(host);
  // The HUD's own wiring, so the panel under test is mounted as the HUD mounts it.
  const panel = createSelectionPanel(host, selectionPanelDepsFor(bridge));
  return {
    host,
    refresh: () => panel.update(bridge.getSelectionState(), bridge.getHudState().playerResources),
    show: (state, resources) => panel.update(state, resources),
    destroy: () => host.remove(),
  };
}

/** The first "Cost: …" (or "cost: …") list in a tooltip or label, as a cost
 *  object: "Cost: 60 food, 20 gold." → { food: 60, gold: 20 }. Null when the
 *  text quotes no price at all. */
export function shownCost(text: string): Cost | null {
  const match = /\bcosts?:?\s+([^.;()]+)/i.exec(text);
  if (!match) return null;
  const cost: Cost = {};
  for (const [, amount, kind] of match[1]!.matchAll(/(\d+)\s+(food|wood|gold|stone)\b/g)) {
    cost[kind as keyof PlayerResources] = Number(amount);
  }
  return cost;
}

/** A tribute button's price: "— costs 130 (30% fee)." or "— no fee." for the
 *  100 it sends, in the resource it sends. */
export function shownTributeCost(text: string, resource: keyof PlayerResources): Cost | null {
  const priced = /\bcosts (\d+)/.exec(text);
  if (priced) return { [resource]: Number(priced[1]) };
  const sent = /\bSend (\d+) /.exec(text);
  return /\bno fee\b/.test(text) && sent ? { [resource]: Number(sent[1]) } : null;
}

/** The figure a Market buy's refusal quotes: "this trade costs 130." */
export function shownMarketBuyCost(text: string): Cost | null {
  const match = /this trade costs (\d+)/.exec(text);
  return match ? { gold: Number(match[1]) } : null;
}

export function purseOf(bridge: Bridge): PlayerResources {
  return { ...bridge.getHudState().playerResources };
}

/** What the stockpile lost, as a cost object with the zeroes dropped. */
export function spentBetween(before: PlayerResources, after: PlayerResources): Cost {
  const spent: Cost = {};
  for (const kind of RESOURCE_KINDS) {
    const delta = before[kind] - after[kind];
    if (delta !== 0) spent[kind] = delta;
  }
  return spent;
}

export function addCosts(costs: readonly Cost[]): Cost {
  const total: Cost = {};
  for (const cost of costs) {
    for (const kind of RESOURCE_KINDS) {
      const value = (total[kind] ?? 0) + (cost[kind] ?? 0);
      if (value !== 0) total[kind] = value;
      else delete total[kind];
    }
  }
  return total;
}

export function sameCost(a: Cost, b: Cost): boolean {
  return RESOURCE_KINDS.every((kind) => (a[kind] ?? 0) === (b[kind] ?? 0));
}

export function formatCost(cost: Cost | null): string {
  if (cost === null) return 'no price';
  const parts = RESOURCE_KINDS.filter((kind) => (cost[kind] ?? 0) !== 0).map((kind) => `${String(cost[kind])} ${kind}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

export type DrawnKind = 'train' | 'research' | 'build' | 'tribute';

/** One priced control the card drew. */
export interface DrawnCommand {
  hook: string;
  kind: DrawnKind;
  id: string;
  /** The price the control states, or null when it states none. */
  shown: Cost | null;
  /** A build card states its price three ways; a description of any
   *  disagreement among them, or null when all three agree. */
  quotesDisagree: string | null;
  locked: boolean;
  button: HTMLButtonElement;
}

function buildCardChips(button: HTMLButtonElement): Cost {
  const cost: Cost = {};
  for (const chip of button.querySelectorAll<HTMLElement>('[data-build-cost-resource]')) {
    const kind = chip.dataset.buildCostResource as keyof PlayerResources;
    cost[kind] = Number(chip.querySelector('.hud-build-cost__value')?.textContent?.trim());
  }
  return cost;
}

/** Every train, research, build and tribute control the panel has drawn. */
export function drawnCommands(host: HTMLElement): DrawnCommand[] {
  const out: DrawnCommand[] = [];
  for (const button of host.querySelectorAll<HTMLButtonElement>('button[data-command]')) {
    const hook = button.dataset.command ?? '';
    const kind = hook.slice(0, hook.indexOf('-')) as DrawnKind;
    if (!['train', 'research', 'build', 'tribute'].includes(kind)) continue;
    const id = hook.slice(kind.length + 1);
    const tooltip = button.dataset.tooltip ?? '';
    let shown: Cost | null;
    let quotesDisagree: string | null = null;
    if (kind === 'tribute') {
      shown = shownTributeCost(tooltip, id.slice(id.indexOf('-') + 1) as keyof PlayerResources);
    } else {
      shown = shownCost(tooltip);
    }
    if (kind === 'build') {
      const label = shownCost(button.getAttribute('aria-label') ?? '');
      const chips = buildCardChips(button);
      if (!shown || !label || !sameCost(shown, label) || !sameCost(shown, chips)) {
        quotesDisagree = `tooltip ${formatCost(shown)}, accessible name ${formatCost(label)}, chips ${formatCost(chips)}`;
      }
    }
    out.push({ hook, kind, id, shown, quotesDisagree, locked: button.disabled, button });
  }
  return out;
}

/** A boot world's save, made once per key and shared by every seat stood
 *  from it. `prepare` may drive the boot bridge first (train a builder). */
const bootBlobs = new Map<string, string>();
export function bootBlob(key: string, seed: string, prepare?: (bridge: Bridge) => void): string {
  let blob = bootBlobs.get(key);
  if (blob === undefined) {
    const boot = createSimulationBridge(seed, { victory: 'conquest-only' });
    prepare?.(boot);
    blob = JSON.stringify(boot.saveGame());
    bootBlobs.set(key, blob);
  }
  return blob;
}

export interface SeatSpec {
  blob: string;
  civilization: string;
  age: AgeType;
  researched: readonly string[];
  purse?: PlayerResources;
  /** The second seat's purse; empty unless a test needs the enemy to spend. */
  enemyPurse?: PlayerResources;
}

/** A seat in `spec.blob`'s world as `spec.civilization` in `spec.age`, holding
 *  `spec.researched` and a purse; the second seat is the same civilization,
 *  empty-handed. Fails at once if the load did not take the civilization or
 *  the age, because a census of the wrong seat would pass for the wrong reason. */
export function standSeat(spec: SeatSpec): Bridge {
  const blob = JSON.parse(spec.blob) as ReturnType<Bridge['saveGame']>;
  const state = (blob.worldSnapshot as { state: Record<string, unknown> }).state;
  state[playerResourcesCodec.slot] = [
    [1, { ...(spec.purse ?? FULL_PURSE) }],
    [2, { ...(spec.enemyPurse ?? { food: 0, wood: 0, gold: 0, stone: 0 }) }],
  ];
  state[researchedTechnologiesCodec.slot] = [[1, [...spec.researched]]];
  state[playerAgesCodec.slot] = [[1, spec.age], [2, spec.age]];
  state[playerCivilizationsCodec.slot] = [[1, spec.civilization], [2, spec.civilization]];
  const bridge = createSimulationBridge(blob.seed, { victory: 'conquest-only', savedGame: blob });
  expect(bridge.getPlayerCivilization(1), 'the seat did not load as the civilization asked for').toBe(spec.civilization);
  expect(bridge.getEconomyState().ages[1], 'the seat did not load in the age asked for').toBe(spec.age);
  return bridge;
}

/** Select a completed building of the human's the way a click does — by cell. */
export function selectBuilding(bridge: Bridge, buildingType: string): boolean {
  const building = bridge.getEconomyState().buildings.find(
    (candidate) => candidate.owner === 1 && candidate.buildingType === buildingType && candidate.isComplete,
  );
  if (!building) return false;
  for (let dy = 0; dy < building.footprintHeight; dy += 1) {
    for (let dx = 0; dx < building.footprintWidth; dx += 1) {
      if (
        bridge.selectEntityAtCell(building.x + dx, building.y + dy)
        && bridge.getSelectionState().selectedEntityType === buildingType
      ) return true;
    }
  }
  return false;
}

/** Select the human's first unit of this type. */
export function selectUnit(bridge: Bridge, unitType: string): boolean {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.owner === 1 && candidate.unitType === unitType);
  return unit !== undefined && bridge.selectEntityById(unit.id) && bridge.getSelectionState().selectedEntityType === unitType;
}
