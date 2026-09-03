// The walls and gates: the two buildings that are a LINE rather than a place.
//
// Split out of `aoeVoxelBuildingRecipes.ts` at the 500-LOC ceiling, and they
// belong together because they share the constraint that shapes both. A
// segment is a per-entity recipe with NO KNOWLEDGE OF ITS NEIGHBOURS, so
// everything here has to work for a line running in any direction, joined at
// both ends, without asking what stands next to it. That is why the crest sits
// on the corners, why the base fills its own tile, and why the faces that
// carry detail are +x and +z — the camera is a fixed isometric, so those are
// the only two faces anything ever sees.
import { architectureMerlonRing } from './aoeVoxelArchitecture';
import { add, setDoor, type BuildingContext } from './aoeVoxelBuildingContext';
import { mixTint, VOXEL_COLORS } from './aoeVoxelRecipeTypes';

export function wall(context: BuildingContext): void {
  if (context.entity.entityType === 'palisade-wall') {
    // A palisade KEEPS the gaps between its stakes — that is what makes it read
    // as a stockade rather than a wall, and it is the one thing not to "fix".
    // The defect was the DEPTH: at 0.28 in a 1.0 tile, a north-south run left
    // 0.72 of bare ground between every segment. Each stake now spans its
    // tile's depth, so a run joins whichever way it goes, and the gaps across
    // the run survive.
    //
    // Two richer shapes were tried and both read worse than this: stakes wide
    // enough to touch, and stakes with pointed heads, each turned the segment
    // into a solid crate with black slots where neighbours shaded each other.
    // With air between the stakes there is nothing to cast those slots.
    for (let index = 0; index < 5; index += 1) {
      add(
        context,
        `palisade-stake-${String(index)}`,
        'matte',
        // The LIGHTER pair: `timberDark` against a backlit sun read as
        // charcoal, and a palisade of five near-black posts looked burnt.
        index % 2 ? VOXEL_COLORS.timber : mixTint(VOXEL_COLORS.timber, VOXEL_COLORS.plaster, 0.26),
        0.1 + index * 0.2,
        0,
        0.5,
        0.13,
        1.02 + (index % 2) * 0.12,
        1.0,
      );
    }
    // Lashing and knot on the two faces the fixed isometric camera can see.
    for (const [suffix, cx, cz, w, d] of [
      ['x', 0.995, 0.5, 0.045, 0.96],
      ['z', 0.5, 0.995, 0.96, 0.045],
    ] as const) {
      add(context, `palisade-lashing-${suffix}`, 'matte', VOXEL_COLORS.thatch, cx, 0.66, cz, w, 0.06, d);
    }
    add(context, 'palisade-team-knot', 'matte', context.team, 0.5, 0.44, 0.995, 0.4, 0.1, 0.045);
    return;
  }
  // The base FILLS its cell, and then some. A wall segment is a per-entity
  // recipe with no knowledge of its neighbours, so the only way a line of them
  // reads as one wall is for each to span its whole tile: at 0.92 x 0.50 a
  // north-south run left half a tile of bare grass between every segment and
  // the line read as a row of filing cabinets. The 0.04 of overhang makes
  // neighbours INTERPENETRATE rather than abut, because two abutting cubes
  // meet on coplanar faces and z-fight along the seam.
  add(context, 'wall-base', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 1.0, 0.72, 1.0);
  // Per-set merlon forms (v0.3.154): the set shapes the wall's crest.
  for (const [sfx, tint, ...box] of architectureMerlonRing(context.architecture, VOXEL_COLORS.stoneLight, VOXEL_COLORS.stoneDark)) add(context, `wall-${sfx}`, 'matte', tint, ...box);
  // The camera is a FIXED isometric, so +x and +z are the two faces anything
  // ever sees. A wall that fills its tile has no single "front", so the shield
  // goes on both — one of them is always the outward face of the run.
  add(context, 'wall-team-shield-x', 'matte', context.team, 0.995, 0.34, 0.5, 0.045, 0.28, 0.18);
  add(context, 'wall-team-shield-z', 'matte', context.team, 0.5, 0.34, 0.995, 0.18, 0.28, 0.045);
}

// A gate reads as a wall with a way through it: two piers carrying a lintel,
// with the road left open between them. The piers are taller and heavier than
// the wall's own mass so a long line's opening is findable at a glance, which is
// the whole point of building one.
export function gate(context: BuildingContext): void {
  const timber = context.entity.entityType === 'palisade-gate';
  const pier = timber ? VOXEL_COLORS.timberDark : VOXEL_COLORS.stone;
  const cap = timber ? VOXEL_COLORS.timber : VOXEL_COLORS.stoneLight;
  // Two piers carrying a lintel, with one door hung between them. The piers
  // stand taller than the wall they interrupt and the lintel bridges them, so
  // the opening in a long line reads as a portal from across the map — which is
  // the only reason to look for a gate in the first place. A first attempt hung
  // two half-doors and read as two dark slots instead of one way through.
  // Every part stays inside the 1x1 footprint: the caps are the widest thing
  // here, so they set the pier centres rather than the other way round.
  for (const [side, centerX] of [['left', 0.15], ['right', 0.85]] as const) {
    add(context, `gate-pier-${side}`, 'matte', pier, centerX, 0, 0.5, 0.26, 1.12, 0.62);
    add(context, `gate-pier-cap-${side}`, 'matte', cap, centerX, 1.12, 0.5, 0.3, 0.14, 0.68);
  }
  add(context, 'gate-lintel', 'matte', cap, 0.5, 1.0, 0.5, 0.78, 0.16, 0.56);
  // The door sits back from the piers' faces so the opening keeps a visible
  // depth rather than reading as one flat wall.
  setDoor(context, 'gate', 0.5, 0.04, 0.5, 0.5, 0.96, 0.2);
  add(context, 'gate-door-band', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.62, 0.5, 0.52, 0.08, 0.24);
  add(context, 'gate-team-banner', 'matte', context.team, 0.5, 1.02, 0.79, 0.26, 0.22, 0.04);
}
