// Per-civilization TECH-TREE DENIAL (spec §11.1, v0.3.138): AoE2's
// civilizations are defined as much by their HOLES as by their bonuses — the
// Franks have no Bracer, the Spanish no Crossbowman line, the Turks no Elite
// Skirmisher or Pikeman, the mesoamerican three no stables at all, and the
// Eagle line belongs to them alone. Until this module, every civilization
// here could research and train everything.
//
// design/stats/tech-tree.csv is the spec of record (correctable data, one
// line per civ); its embedded copy below is parsed once at module load, and
// `tests/content/techTreeDenials.test.ts` guards that every id it names is a
// real technology or unit. One namespace: tech and unit ids never collide.
// Every seeded player HAS a civilization (scenarioSeedOps backfills the
// per-seat defaults — Britons, Franks, then the classic AoK cast for seats
// 3+ since v0.3.142 — a civ-less player does not exist, as in DE), so real
// holes always apply. The undefined/unknown-name path returns the full tree
// only for unseeded owners in pure-unit tests — a last-resort fail-open,
// never a safety valve for real civilizations.

const DENIALS_BY_CIVILIZATION = new Map<string, ReadonlySet<string>>();

// The browser build cannot read design/stats at runtime, so the table is
// embedded verbatim; tests/content/techTreeDenials.test.ts asserts this copy
// and the CSV are IDENTICAL, so the two can never drift.
export const EMBEDDED_TABLE = `civilization, denied
Aztecs, architecture;bloodlines;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;cannon-galleon;cannon-galleon-unlock;cavalier;cavalier-upgrade;cavalry-archer;chain-barding-armor;dry-dock;elite-cannon-galleon;elite-cannon-galleon-upgrade;galleon;galleon-upgrade;guilds;halberdier;halberdier-upgrade;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heavy-scorpion;heavy-scorpion-upgrade;hoardings;husbandry;hussar;hussar-upgrade;keep;knight;light-cavalry;light-cavalry-upgrade;masonry;paladin;paladin-upgrade;parthian-tactics;plate-barding;ring-archer-armor;scale-barding-armor;scout;stable;thumb-ring;two-man-saw
Mayans, bloodlines;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;cannon-galleon;cannon-galleon-unlock;cavalier;cavalier-upgrade;cavalry-archer;chain-barding-armor;champion;champion-upgrade;dry-dock;elite-cannon-galleon;elite-cannon-galleon-upgrade;gold-shaft-mining;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;husbandry;hussar;hussar-upgrade;illumination;knight;light-cavalry;light-cavalry-upgrade;paladin;paladin-upgrade;parthian-tactics;plate-barding;redemption;scale-barding-armor;scout;siege-engineers;siege-onager;siege-onager-upgrade;stable
Incas, architecture;atonement;bloodlines;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;cannon-galleon;cannon-galleon-unlock;cavalier;cavalier-upgrade;cavalry-archer;chain-barding-armor;elite-cannon-galleon;elite-cannon-galleon-upgrade;fervor;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;husbandry;hussar;hussar-upgrade;knight;light-cavalry;light-cavalry-upgrade;paladin;paladin-upgrade;parthian-tactics;plate-barding;scale-barding-armor;scout;siege-onager;siege-onager-upgrade;stable;two-man-saw
Britons, atonement;bloodlines;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;crop-rotation;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heresy;hussar;hussar-upgrade;paladin;paladin-upgrade;parthian-tactics;redemption;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;stone-shaft-mining;thumb-ring
Franks, arbalest;arbalest-upgrade;atonement;bloodlines;bombard-tower;bombard-tower-unlock;bracer;camel;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;guilds;heated-shot;heavy-camel;heavy-camel-upgrade;hussar;hussar-upgrade;keep;parthian-tactics;redemption;ring-archer-armor;shipwright;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;stone-shaft-mining;thumb-ring;two-man-saw
Celts, arbalest;arbalest-upgrade;architecture;atonement;block-printing;bloodlines;bombard-cannon;bombard-tower;bombard-tower-unlock;bracer;camel;crop-rotation;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;hand-cannoneer;heavy-camel;heavy-camel-upgrade;illumination;parthian-tactics;plate-barding;redemption;squires;theocracy;thumb-ring;two-man-saw
Teutons, arbalest;arbalest-upgrade;architecture;bracer;camel;dry-dock;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;gold-shaft-mining;heavy-camel;heavy-camel-upgrade;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;husbandry;hussar;hussar-upgrade;light-cavalry;light-cavalry-upgrade;parthian-tactics;shipwright;siege-ram;siege-ram-upgrade;thumb-ring
Goths, arbalest;arbalest-upgrade;atonement;block-printing;bombard-tower;bombard-tower-unlock;camel;cannon-galleon;cannon-galleon-unlock;dry-dock;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;fortified-wall;gold-shaft-mining;guard-tower;heavy-camel;heavy-camel-upgrade;heresy;hoardings;keep;paladin;paladin-upgrade;parthian-tactics;plate-barding;plate-mail-armor;redemption;siege-engineers;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;stone-gate;stone-wall;thumb-ring
Vikings, bloodlines;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;demolition-ship;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;guilds;halberdier;halberdier-upgrade;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;herbal-medicine;husbandry;hussar;hussar-upgrade;illumination;keep;paladin;paladin-upgrade;parthian-tactics;plate-barding;redemption;sanctity;shipwright;siege-onager;siege-onager-upgrade;stone-shaft-mining;theocracy;thumb-ring
Huns, arbalest;arbalest-upgrade;architecture;block-printing;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;cannon-galleon;cannon-galleon-unlock;champion;champion-upgrade;crop-rotation;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;fortified-wall;guard-tower;hand-cannoneer;heated-shot;heavy-camel;heavy-camel-upgrade;heavy-scorpion;heavy-scorpion-upgrade;herbal-medicine;hoardings;keep;onager;onager-upgrade;plate-mail-armor;redemption;ring-archer-armor;shipwright;siege-engineers;siege-onager;siege-onager-upgrade;stone-shaft-mining;theocracy
Magyars, architecture;atonement;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;faith;fortified-wall;guilds;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;keep;plate-mail-armor;redemption;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;squires;stone-shaft-mining
Slavs, arbalest;arbalest-upgrade;architecture;bombard-cannon;bombard-tower;bombard-tower-unlock;bracer;camel;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;fervor;guilds;hand-cannoneer;heated-shot;heavy-camel;heavy-camel-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heresy;keep;paladin;paladin-upgrade;parthian-tactics;shipwright;stone-shaft-mining;thumb-ring
Saracens, architecture;bombard-tower;bombard-tower-unlock;cavalier;cavalier-upgrade;crop-rotation;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;guilds;halberdier;halberdier-upgrade;heated-shot;heavy-scorpion;heavy-scorpion-upgrade;paladin;paladin-upgrade;shipwright;stone-shaft-mining
Persians, arbalest;arbalest-upgrade;atonement;bombard-tower;bombard-tower-unlock;bracer;champion;champion-upgrade;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;fortified-wall;heresy;illumination;keep;redemption;sanctity;shipwright;siege-engineers;siege-onager;siege-onager-upgrade;two-handed-swordsman;two-handed-swordsman-upgrade
Turks, arbalest;arbalest-upgrade;block-printing;crop-rotation;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;elite-skirmisher;elite-skirmisher-upgrade;fast-fire-ship;fast-fire-ship-upgrade;halberdier;halberdier-upgrade;herbal-medicine;illumination;onager;onager-upgrade;paladin;paladin-upgrade;pikeman;pikeman-upgrade;siege-engineers;siege-onager;siege-onager-upgrade;stone-shaft-mining
Berbers, arbalest;arbalest-upgrade;architecture;block-printing;bombard-tower;bombard-tower-unlock;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;halberdier;halberdier-upgrade;keep;paladin;paladin-upgrade;parthian-tactics;sanctity;sappers;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;two-man-saw
Malians, blast-furnace;bombard-tower;bombard-tower-unlock;bracer;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;galleon;galleon-upgrade;halberdier;halberdier-upgrade;heavy-scorpion;heavy-scorpion-upgrade;hussar;hussar-upgrade;illumination;paladin;paladin-upgrade;parthian-tactics;shipwright;siege-engineers;siege-ram;siege-ram-upgrade;two-man-saw
Ethiopians, block-printing;bloodlines;bombard-tower;bombard-tower-unlock;champion;champion-upgrade;crop-rotation;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;hand-cannoneer;heavy-demolition-ship;heavy-demolition-ship-upgrade;hoardings;paladin;paladin-upgrade;parthian-tactics;plate-barding;redemption
Indians, arbalest;arbalest-upgrade;architecture;atonement;bombard-tower;bombard-tower-unlock;cavalier;cavalier-upgrade;crop-rotation;dry-dock;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;guilds;halberdier;halberdier-upgrade;heated-shot;heavy-demolition-ship;heavy-demolition-ship-upgrade;heavy-scorpion;heavy-scorpion-upgrade;heresy;keep;knight;paladin;paladin-upgrade;parthian-tactics;plate-mail-armor;sappers;shipwright;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade
Chinese, bombard-cannon;camel;cannon-galleon;cannon-galleon-unlock;crop-rotation;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;guilds;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heresy;hoardings;hussar;hussar-upgrade;mangonel;onager;onager-upgrade;paladin;paladin-upgrade;parthian-tactics;redemption;siege-engineers;siege-onager;siege-onager-upgrade
Japanese, architecture;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;crop-rotation;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;heated-shot;heavy-camel;heavy-camel-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heresy;hussar;hussar-upgrade;paladin;paladin-upgrade;plate-barding;sappers;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;stone-shaft-mining
Koreans, atonement;blast-furnace;bloodlines;camel;crop-rotation;demolition-ship;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;heavy-camel;heavy-camel-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heavy-scorpion;heavy-scorpion-upgrade;heresy;hoardings;illumination;mangonel;onager;onager-upgrade;paladin;paladin-upgrade;parthian-tactics;plate-barding;redemption;sappers;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade
Mongols, architecture;block-printing;bombard-cannon;bombard-tower;bombard-tower-unlock;crop-rotation;dry-dock;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;guilds;halberdier;halberdier-upgrade;hand-cannoneer;heated-shot;illumination;keep;paladin;paladin-upgrade;plate-barding;redemption;ring-archer-armor;sanctity;theocracy;two-man-saw
Vietnamese, architecture;blast-furnace;camel;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;fervor;gold-shaft-mining;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heavy-scorpion;heavy-scorpion-upgrade;heresy;hussar;hussar-upgrade;masonry;paladin;paladin-upgrade;parthian-tactics;redemption;shipwright;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade
Khmer, atonement;block-printing;bombard-cannon;bombard-tower;bombard-tower-unlock;camel;champion;champion-upgrade;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;guilds;heavy-camel;heavy-camel-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heresy;paladin;paladin-upgrade;plate-mail-armor;shipwright;siege-onager;siege-onager-upgrade;squires;thumb-ring;two-man-saw
Burmese, arbalest;arbalest-upgrade;bombard-tower;bombard-tower-unlock;camel;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;hand-cannoneer;heavy-camel;heavy-camel-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heresy;hoardings;leather-archer-armor;paladin;paladin-upgrade;ring-archer-armor;sappers;shipwright;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;stone-shaft-mining;thumb-ring
Byzantines, architecture;blast-furnace;bloodlines;cannon-galleon;cannon-galleon-unlock;eagle-warrior;elite-cannon-galleon;elite-cannon-galleon-upgrade;elite-eagle-warrior;elite-eagle-warrior-upgrade;heated-shot;heavy-scorpion;heavy-scorpion-upgrade;herbal-medicine;masonry;parthian-tactics;sappers;siege-engineers;siege-onager;siege-onager-upgrade
Italians, camel;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;gold-shaft-mining;halberdier;halberdier-upgrade;heavy-camel;heavy-camel-upgrade;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heavy-scorpion;heavy-scorpion-upgrade;heresy;paladin;paladin-upgrade;parthian-tactics;sappers;siege-engineers;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade
Portuguese, camel;demolition-ship;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;fast-fire-ship;fast-fire-ship-upgrade;gold-shaft-mining;heavy-camel;heavy-camel-upgrade;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;heavy-demolition-ship;heavy-demolition-ship-upgrade;heavy-scorpion;heavy-scorpion-upgrade;hoardings;hussar;hussar-upgrade;illumination;paladin;paladin-upgrade;parthian-tactics;shipwright;siege-onager;siege-onager-upgrade;siege-ram;siege-ram-upgrade;squires
Spanish, arbalest;arbalest-upgrade;camel;crop-rotation;crossbowman;crossbowman-upgrade;eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;gold-shaft-mining;heated-shot;heavy-camel;heavy-camel-upgrade;heavy-scorpion;heavy-scorpion-upgrade;parthian-tactics;siege-engineers;siege-onager;siege-onager-upgrade
`;

function loadTable(): void {
  // The embedded copy IS the runtime source — browser bundles cannot read
  // files, and the content gate asserts it and the CSV are identical.
  for (const line of EMBEDDED_TABLE.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('civilization')) continue;
    const comma = trimmed.indexOf(',');
    if (comma < 0) continue;
    const civilization = trimmed.slice(0, comma).trim();
    const denied = new Set(
      trimmed.slice(comma + 1).split(';').map((id) => id.trim()).filter(Boolean),
    );
    DENIALS_BY_CIVILIZATION.set(civilization, denied);
  }
}

/** Whether this civilization's tree DENIES the given technology or unit id. */
export function civDenies(civilization: string | undefined, id: string): boolean {
  if (!civilization) return false;
  return DENIALS_BY_CIVILIZATION.get(civilization)?.has(id) ?? false;
}

const EMPTY: ReadonlySet<string> = new Set();

export function deniedIdsFor(civilization: string | undefined): ReadonlySet<string> {
  return (civilization && DENIALS_BY_CIVILIZATION.get(civilization)) || EMPTY;
}



loadTable();
