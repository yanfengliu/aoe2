// Per-civilization ARCHITECTURE (spec §graphics, v0.3.105): AoE2 groups its
// thirty civilizations into building sets, and a town's skyline says which
// world it belongs to before a single flag resolves. This v1 maps every
// roster civilization onto six sets — the DE regional sets folded into their
// nearest neighbour where the roster is thin — and the renderer keys its roof
// palette off the style. The mapping is simulation-side because the projector
// stamps it onto building views (and fog memory snapshots it); the COLOURS
// live renderer-side.

export type ArchitectureStyle =
  | 'western-european'
  | 'central-european'
  | 'middle-eastern'
  | 'east-asian'
  | 'mediterranean'
  | 'mesoamerican';

const STYLE_BY_CIVILIZATION: Readonly<Record<string, ArchitectureStyle>> = {
  Britons: 'western-european',
  Celts: 'western-european',
  Franks: 'western-european',
  Teutons: 'central-european',
  Goths: 'central-european',
  Vikings: 'central-european',
  Huns: 'central-european',
  Magyars: 'central-european',
  Slavs: 'central-european',
  Saracens: 'middle-eastern',
  Persians: 'middle-eastern',
  Turks: 'middle-eastern',
  Berbers: 'middle-eastern',
  Malians: 'middle-eastern',
  Ethiopians: 'middle-eastern',
  Indians: 'middle-eastern',
  Chinese: 'east-asian',
  Japanese: 'east-asian',
  Koreans: 'east-asian',
  Mongols: 'east-asian',
  Vietnamese: 'east-asian',
  Khmer: 'east-asian',
  Burmese: 'east-asian',
  Byzantines: 'mediterranean',
  Italians: 'mediterranean',
  Portuguese: 'mediterranean',
  Spanish: 'mediterranean',
  Aztecs: 'mesoamerican',
  Mayans: 'mesoamerican',
  Incas: 'mesoamerican',
};

/** The building set a civilization's town wears; unknown/absent civilizations
 *  read the western-european default, which is also the pre-v0.3.105 look. */
export function architectureStyleFor(civilization: string | undefined): ArchitectureStyle {
  return (civilization && STYLE_BY_CIVILIZATION[civilization]) || 'western-european';
}
