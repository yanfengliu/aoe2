// Shared shapes for movement-plan results. Owned by createWorld's path
// helpers; consumed by the systems that walk units toward those plans.

import type { Position } from 'civ-engine';

export interface UnitMovementPlan {
  destination: Position;
  nextStep: Position;
}
