import type { ResearchableTechnologyType, TrainableUnitType } from './types';

// An ordered tiered unit chain (e.g., ['archer', ['crossbowman',
// 'crossbowman-upgrade'], ['arbalest', 'arbalest-upgrade']]). The head is
// the default fallback tier; each subsequent tier is paired with the
// technology that gates it.
export type UpgradeChainEntry = readonly [
  TrainableUnitType,
  ...Array<readonly [TrainableUnitType, ResearchableTechnologyType]>,
];

// Walks a tiered unit chain from head to tail and returns the newest tier
// whose gating upgrade is researched by `owner`. Returns the head tier
// when no gating tech is researched. Used by the Archery Range / Barracks
// / Stable / Castle train menus so only the latest-researched tier is
// exposed at any time.
export function latestResearchedInChain(
  owner: number,
  chain: UpgradeChainEntry,
  hasTechnology: (owner: number, technologyType: ResearchableTechnologyType) => boolean,
): TrainableUnitType {
  let current: TrainableUnitType = chain[0];
  for (let index = 1; index < chain.length; index += 1) {
    const [unitType, technologyType] = chain[index] as readonly [
      TrainableUnitType,
      ResearchableTechnologyType,
    ];
    if (hasTechnology(owner, technologyType)) {
      current = unitType;
    }
  }
  return current;
}
