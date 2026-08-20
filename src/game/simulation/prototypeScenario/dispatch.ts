// Scenario seed -> factory dispatch. The table itself lives in
// ./scenarioRegistry.ts; this file is the lookup and its fallback.

import type { PrototypeScenario } from '../prototypeScenario';
import { createDefaultMap } from '../mapGeneration/defaultMap';
import { SCENARIO_FACTORIES } from './scenarioRegistry';

// Look up `seed` in the table; falls back to `createDefaultMap` for
// unrecognized seeds (matches the pre-extraction behavior — the original
// if-chain ended with the same fallback). The DEFAULT_SEED short-circuit
// stays in the parent file because it shouldn't even hit the lookup.
export function dispatchScenario(seed: string): PrototypeScenario {
  const factory = SCENARIO_FACTORIES.get(seed);
  return factory ? factory(seed) : createDefaultMap(seed);
}
