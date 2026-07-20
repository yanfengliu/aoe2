import { shade, VOXEL_COLORS } from './aoeVoxelRecipeTypes';
import { addUnitPart as add, type UnitRecipeContext } from './aoeVoxelUnitRecipeContext';

export function addMonkUnitParts(context: UnitRecipeContext): void {
  add(context, 'monk-robe-base', 'matte', shade(context.team, 0.62), 0, 0, 0, 0.7, 0.3, 0.52);
  add(context, 'monk-robe', 'matte', context.team, 0, 0.28, 0, 0.58, 0.82, 0.44);
  add(context, 'monk-cowl', 'matte', shade(context.team, 0.72), 0, 1.08, 0, 0.46, 0.36, 0.4);
  add(context, 'monk-face', 'matte', VOXEL_COLORS.skin, 0, 1.18, 0.21, 0.25, 0.22, 0.08);
  add(context, 'monk-sleeve-left', 'matte', context.team, -0.35, 0.52, 0, 0.16, 0.62, 0.2, { roll: -0.25 });
  add(context, 'monk-sleeve-right', 'matte', context.team, 0.35, 0.52, 0, 0.16, 0.62, 0.2, { roll: 0.25 });
  add(context, 'monk-staff', 'matte', VOXEL_COLORS.timber, 0.48, 0.05, 0.02, 0.07, 1.62, 0.07, { roll: 0.08 });
  add(context, 'monk-staff-crossbar', 'metal', VOXEL_COLORS.gold, 0.5, 1.4, 0.02, 0.26, 0.06, 0.07, { roll: 0.08 });
  add(context, 'detail-monk-golden-cross', 'metal', VOXEL_COLORS.gold, 0, 0.87, 0.24, 0.13, 0.2, 0.07);
}
