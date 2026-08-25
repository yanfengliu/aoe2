// Atheism delays every victory clock in the MATCH, not just its researcher's:
// any owner holding it adds +100 years (1000 ticks) to each Wonder/Relic
// countdown that starts, and the research application extends the ones already
// running. Both creation sites read this one rule.

import { ATHEISM_COUNTDOWN_EXTENSION_TICKS } from '../uniqueTechnologies';
import { researchedTechnologiesCodec } from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';

export function atheismCountdownExtension(accessor: BridgeStateAccessor): number {
  for (const techs of accessor.get(researchedTechnologiesCodec).values()) {
    if (techs.has('atheism')) return ATHEISM_COUNTDOWN_EXTENSION_TICKS;
  }
  return 0;
}
