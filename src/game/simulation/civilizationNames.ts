// The 30 AoE2 civilizations (design/stats/civilizations.csv) — the single
// source of truth for civ-selection validation (parseCivParam) and any future
// civ-picker UI. Kept separate from the civ BONUS logic (civBonusEffects) and
// the per-owner default (pureHelpers.defaultCivilizationName), which both refer
// to civs by name; this module owns the name set + its normalizer.

export const CIVILIZATION_NAMES: readonly string[] = [
  'Aztecs', 'Britons', 'Byzantines', 'Celts', 'Chinese', 'Franks', 'Goths',
  'Huns', 'Japanese', 'Koreans', 'Mayans', 'Mongols', 'Persians', 'Saracens',
  'Spanish', 'Teutons', 'Turks', 'Vikings', 'Berbers', 'Burmese', 'Ethiopians',
  'Incas', 'Indians', 'Italians', 'Khmer', 'Magyars', 'Malians', 'Portuguese',
  'Slavs', 'Vietnamese',
];

// Case-insensitive match of a raw civ string to its canonical name; null if the
// (trimmed) input is empty or not a known civilization.
export function normalizeCivilizationName(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === '') return null;
  return CIVILIZATION_NAMES.find((name) => name.toLowerCase() === trimmed) ?? null;
}
