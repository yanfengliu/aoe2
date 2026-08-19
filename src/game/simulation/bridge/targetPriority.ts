// Defensive-fire target priority: which enemy a tower / Town Center / Castle
// shoots when several are in range. Extracted from targetFindingOps.ts, which
// the naval roster pushed past its 500-LOC budget. Pure classification over
// UnitType, exhaustive so a new unit forces a decision.

import type { UnitType } from '../types';

// Per-unitType targeting priority for AI / unit-vs-unit target
// selection. Lower numbers are picked first (after the priority sort,
// ties break by Manhattan distance). Siege units sit at the top of
// priority because they disable defensive fire (tower, castle, stone
// wall) before chewing on infantry that will still be there after the
// siege is gone. Monks follow because they convert and heal and also
// need to be silenced early. Ranged units sit above melee / cavalry
// since hitting the archer line usually wins the engagement, and
// villagers / scouts sit last — low-value next to losing the tower to siege.
export function targetPriority(unitType: UnitType): number {
  switch (unitType) {
    case 'fishing-ship': return 0; // M5 naval: lowest-value kill.
    // M5 naval: warships out-range everything afloat; kill them first.
    case 'galley': case 'war-galley': case 'galleon':
    case 'fire-ship': case 'fast-fire-ship':
    case 'demolition-ship': case 'heavy-demolition-ship':
    case 'cannon-galleon': case 'elite-cannon-galleon':
      return 4;
    // Slice 7A: the Imperial-tier siege units slot into the same top-of-
    // target-priority bucket as their Castle-Age predecessors. Bombard
    // Cannon and Trebuchet are Imperial-only newcomers but still count
    // as siege and get the same priority.
    case 'mangonel':
    case 'scorpion':
    case 'battering-ram':
    case 'onager':
    case 'heavy-scorpion':
    case 'siege-ram':
    case 'bombard-cannon':
    case 'trebuchet':
      return 0;
    case 'monk':
      return 1;
    case 'archer':
    case 'crossbowman':
    case 'cavalry-archer':
    case 'skirmisher':
    case 'longbowman':
    case 'arbalest':
    case 'heavy-cavalry-archer':
    case 'elite-longbowman':
      return 2;
    case 'militia':
    case 'spearman':
    case 'pikeman':
    case 'knight':
    case 'camel':
    case 'scout':
    case 'light-cavalry':
    case 'halberdier':
    case 'hussar':
    case 'cavalier':
    case 'champion':
    case 'man-at-arms':
    case 'long-swordsman':
    case 'two-handed-swordsman':
    case 'paladin':
    case 'heavy-camel':
      return 3;
    case 'villager':
      return 4;
  }
}
