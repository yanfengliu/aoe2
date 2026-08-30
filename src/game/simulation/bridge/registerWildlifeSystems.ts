// Everything that makes the world's animals behave: predator combat, the deer
// flight response, and the herdable ownership/movement pair.
//
// Grouped out of `registerAllSystems` because they are one subject and because
// that file is at its size ceiling — a ceiling it hit while the deer were
// being added, which is the honest reason this module exists. The registration
// order is preserved exactly; these systems declare their own phase ordering.
//
// The dependency type is the INTERSECTION of what the four systems ask for
// rather than a hand-listed `Pick` from the bridge's dependency bag: a Pick
// has to be kept in step with four other files by hand, and it silently stops
// compiling when one of them wants something the bag does not name.

import {
  registerWildlifeCombatSystem,
  type WildlifeCombatSystemDeps,
} from './systems/wildlifeCombatSystem';
import { registerDeerFleeSystem, type DeerFleeSystemDeps } from './systems/deerFleeSystem';
import {
  registerHerdableOwnershipSystem,
  type HerdableOwnershipSystemDeps,
} from './systems/herdableOwnershipSystem';
import {
  registerHerdableMovementSystem,
  type HerdableMovementSystemDeps,
} from './systems/herdableMovementSystem';

export type WildlifeSystemsDeps =
  & WildlifeCombatSystemDeps
  & DeerFleeSystemDeps
  & HerdableOwnershipSystemDeps
  & HerdableMovementSystemDeps;

export function registerWildlifeSystems(deps: WildlifeSystemsDeps): void {
  registerWildlifeCombatSystem(deps);
  registerDeerFleeSystem(deps);
  registerHerdableOwnershipSystem(deps);
  registerHerdableMovementSystem(deps);
}
