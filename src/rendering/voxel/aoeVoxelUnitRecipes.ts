import type { ProjectedEntityView, UnitType } from '../../game/simulation/types';
import { castShadowParts } from './aoeVoxelCastShadows';
import { type VoxelPart } from './aoeVoxelRecipeTypes';
import {
  animateUnitParts,
  phaseForUnitIdentity,
  type AoeUnitAnimationState,
} from './aoeVoxelUnitAnimation';
import { addHumanoidUnitParts } from './aoeVoxelUnitHumanoidRecipes';
import { addMonkUnitParts } from './aoeVoxelUnitMonkRecipe';
import { addMountedUnitParts } from './aoeVoxelUnitMountedRecipes';
import { type UnitRecipeContext } from './aoeVoxelUnitRecipeContext';
import { addShipUnitParts } from './aoeVoxelUnitShipRecipes';
import { addSiegeUnitParts } from './aoeVoxelUnitSiegeRecipes';
import { unitVisualProfile } from './aoeVoxelUnitVisualProfiles';

const DEFAULT_ANIMATION_STATE = (identity: string): AoeUnitAnimationState => ({
  mode: 'idle',
  phaseRadians: phaseForUnitIdentity(identity),
  gaitPhaseRadians: phaseForUnitIdentity(identity),
  locomotionWeight: 0,
  speedWorldUnitsPerSecond: 0,
  directionX: 1,
  directionZ: 0,
  attackPhase: 0,
  attackWeight: 0,
  ambientSuppressionWeight: 0,
  workPhase: 0,
  workWeight: 0,
  targetDistance: 0,
});

export function createUnitParts(
  entity: ProjectedEntityView,
  identity: string,
  ground: number,
  animationState: AoeUnitAnimationState = DEFAULT_ANIMATION_STATE(identity),
): VoxelPart[] {
  const unitType = entity.entityType as UnitType;
  const profile = unitVisualProfile(unitType);
  const scale = Math.max(0.48, entity.size);
  const context: UnitRecipeContext = {
    entity,
    identity,
    ground,
    centerX: entity.x + 0.5,
    centerZ: entity.y + 0.5,
    scale,
    team: entity.tint,
    parts: [],
  };
  const shadow = (): VoxelPart[] => castShadowParts(
    entity,
    identity,
    'unit-shadow',
    ground,
    context.parts,
    // The slab a body-less fallback keeps, so it still touches the ground.
    {
      centerX: entity.x + 0.5,
      centerZ: entity.y + 0.5,
      width: scale * 0.78,
      depth: scale * 0.58,
    },
  );
  // Adapter characterization intentionally permits a unit-layer fallback
  // whose entityType is not a UnitType. Preserve the old shadow-only result
  // instead of inventing an archetype for malformed/legacy projections.
  if (!profile) return shadow();
  if (profile.role === 'villager' || profile.role === 'infantry' || profile.role === 'archer') {
    addHumanoidUnitParts(context, unitType, profile);
  } else if (profile.role === 'cavalry' || profile.role === 'cavalry-archer') {
    addMountedUnitParts(context, unitType, profile);
  } else if (profile.role === 'siege') {
    addSiegeUnitParts(context, unitType, profile);
  } else if (profile.role === 'ship') {
    addShipUnitParts(context, unitType, profile);
  } else {
    addMonkUnitParts(context);
  }
  // The shadow is cast from the REST pose, before the gait and attack poses
  // move limbs: a swinging arm must not make the shadow flicker.
  context.parts.push(...shadow());
  return animateUnitParts(context.parts, entity, animationState);
}
