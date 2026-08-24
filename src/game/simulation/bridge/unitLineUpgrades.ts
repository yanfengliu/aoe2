// The unit-upgrade technologies, as data.
//
// Each of these did the same two things in technologyOps' switch — mutate the
// owner's existing units of the predecessor type, and rewrite anything of that
// type still in a production queue — which made 23 near-identical cases and
// pushed the file past its 500-LOC budget. As a table, a new upgrade line is
// one row, and it is obvious at a glance which lines exist.
//
// `from` is a LIST because the militia line can be upgraded to Champion from
// any tier the owner happens to hold.

import type { ResearchableTechnologyType } from '../technologyTypes';
import type { UnitType } from '../unitTypes';

export interface UnitLineUpgrade {
  readonly from: readonly UnitType[];
  readonly to: UnitType;
}

export const UNIT_LINE_UPGRADES: Partial<
  Record<ResearchableTechnologyType, UnitLineUpgrade>
> = {
  'arbalest-upgrade': { from: ['crossbowman'], to: 'arbalest' },
  'cavalier-upgrade': { from: ['knight'], to: 'cavalier' },
  'champion-upgrade': { from: ['militia', 'man-at-arms', 'long-swordsman', 'two-handed-swordsman'], to: 'champion' },
  'crossbowman-upgrade': { from: ['archer'], to: 'crossbowman' },
  'elite-cannon-galleon-upgrade': { from: ['cannon-galleon'], to: 'elite-cannon-galleon' },
  'elite-longbowman-upgrade': { from: ['longbowman'], to: 'elite-longbowman' },
  'fast-fire-ship-upgrade': { from: ['fire-ship'], to: 'fast-fire-ship' },
  'galleon-upgrade': { from: ['war-galley'], to: 'galleon' },
  'halberdier-upgrade': { from: ['pikeman'], to: 'halberdier' },
  'heavy-camel-upgrade': { from: ['camel'], to: 'heavy-camel' },
  'heavy-cavalry-archer-upgrade': { from: ['cavalry-archer'], to: 'heavy-cavalry-archer' },
  'heavy-demolition-ship-upgrade': { from: ['demolition-ship'], to: 'heavy-demolition-ship' },
  'heavy-scorpion-upgrade': { from: ['scorpion'], to: 'heavy-scorpion' },
  'hussar-upgrade': { from: ['light-cavalry'], to: 'hussar' },
  'light-cavalry-upgrade': { from: ['scout'], to: 'light-cavalry' },
  'long-swordsman-upgrade': { from: ['man-at-arms'], to: 'long-swordsman' },
  'man-at-arms-upgrade': { from: ['militia'], to: 'man-at-arms' },
  'onager-upgrade': { from: ['mangonel'], to: 'onager' },
  'siege-onager-upgrade': { from: ['onager'], to: 'siege-onager' },
  'paladin-upgrade': { from: ['cavalier'], to: 'paladin' },
  'pikeman-upgrade': { from: ['spearman'], to: 'pikeman' },
  'elite-skirmisher-upgrade': { from: ['skirmisher'], to: 'elite-skirmisher' },
  // The line is Battering -> Capped -> Siege (units.csv: "Siege Ram: Upgraded
  // Capped Ram"), so the Siege upgrade now takes the middle tier as its input.
  'capped-ram-upgrade': { from: ['battering-ram'], to: 'capped-ram' },
  'siege-ram-upgrade': { from: ['capped-ram'], to: 'siege-ram' },
  'two-handed-swordsman-upgrade': { from: ['long-swordsman'], to: 'two-handed-swordsman' },
  'war-galley-upgrade': { from: ['galley'], to: 'war-galley' },
  'elite-berserk-upgrade': { from: ['berserk'], to: 'elite-berserk' },
  'elite-cataphract-upgrade': { from: ['cataphract'], to: 'elite-cataphract' },
  'elite-chu-ko-nu-upgrade': { from: ['chu-ko-nu'], to: 'elite-chu-ko-nu' },
  'elite-conquistador-upgrade': { from: ['conquistador'], to: 'elite-conquistador' },
  'elite-huskarl-upgrade': { from: ['huskarl'], to: 'elite-huskarl' },
  'elite-jaguar-warrior-upgrade': { from: ['jaguar-warrior'], to: 'elite-jaguar-warrior' },
  'elite-janissary-upgrade': { from: ['janissary'], to: 'elite-janissary' },
  'elite-longboat-upgrade': { from: ['longboat'], to: 'elite-longboat' },
  'elite-mameluke-upgrade': { from: ['mameluke'], to: 'elite-mameluke' },
  'elite-mangudai-upgrade': { from: ['mangudai'], to: 'elite-mangudai' },
  'elite-plumed-archer-upgrade': { from: ['plumed-archer'], to: 'elite-plumed-archer' },
  'elite-samurai-upgrade': { from: ['samurai'], to: 'elite-samurai' },
  'elite-tarkan-upgrade': { from: ['tarkan'], to: 'elite-tarkan' },
  'elite-teutonic-knight-upgrade': { from: ['teutonic-knight'], to: 'elite-teutonic-knight' },
  'elite-throwing-axeman-upgrade': { from: ['throwing-axeman'], to: 'elite-throwing-axeman' },
  'elite-turtle-ship-upgrade': { from: ['turtle-ship'], to: 'elite-turtle-ship' },
  'elite-war-elephant-upgrade': { from: ['war-elephant'], to: 'elite-war-elephant' },
  'elite-war-wagon-upgrade': { from: ['war-wagon'], to: 'elite-war-wagon' },
  'elite-woad-raider-upgrade': { from: ['woad-raider'], to: 'elite-woad-raider' },
};
