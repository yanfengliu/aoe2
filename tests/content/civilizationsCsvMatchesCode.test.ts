// civilizations.csv says what the code does (work 120 M2; defect register
// 2026-10-11). The CSV is the spec of record for what a civilization IS, and
// the in-game Civilizations compendium shows its text through the embedded
// copy in civProfiles.ts. Where the code follows current Definitive Edition,
// a row that still states an older value tells the player something false.
// Work 120 M3 (defect register 2026-10-12) brought the code itself to DE on
// five more lines, and pairs them here the same way.
//
// SOURCE for every line below: the civilization help texts in
// SiegeEngineers/aoe2techtree data/locales/en/strings.json at 3bb43b14 (DE
// update 185872), and the code's own value, checked in the same case.
//
// THE CLASS: a CSV line and the code drifting apart. Each case pairs a CSV
// line with the code it describes, so editing either side alone fails here.
// The retired lines must not come back.
//
// BOUNDS: only the lines listed. A line not listed can still lag, and the
// lines where the code itself still departs from DE are spec §11.11's open
// list, not this file's. The text is compared exactly; the code is compared at the
// values each line names.

import { describe, expect, it } from 'vitest';

import { ageScaledUnitHpFactor } from '../../src/game/simulation/ageScaledHp';
import { playerAgesCodec, playerCivilizationsCodec, playerTeamsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import { ownerConstructionCost } from '../../src/game/simulation/bridge/ownerCosts';
import { teamTrainTimeMultiplier } from '../../src/game/simulation/bridge/teamProductionBonuses';
import { slavsTeamMilitaryPop } from '../../src/game/simulation/bridge/teamPopulation';
import {
  civArmorBonus,
  civBuildingAttackLadder,
  civCarryBonus,
  civImperialPopulationBonus,
  civPopulationProvidedBonus,
  civReloadMultiplier,
  civResourceDurationMultiplier,
  civSpeedMultiplier,
  civTrainTimeMultiplier,
  civUnitHpMultiplier,
  civVillagersTakeInfantryArmor,
  effectiveConstructionCost,
  effectiveResearchCost,
  effectiveTrainingCost,
} from '../../src/game/simulation/civBonusEffects';
import { teamBuildingVisionBonus } from '../../src/game/simulation/civBuildingBonuses';
import { CIV_PROFILES, civProfileFor } from '../../src/game/simulation/civProfiles';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { constructionCost, researchCost, trainingCost } from '../../src/game/simulation/prototypeEconomyRules';
import { teamBuildingAttackBonus } from '../../src/game/simulation/teamCombatBonuses';
import type { AgeType, ResearchableTechnologyType } from '../../src/game/simulation/types';

const NO_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();
const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const SOLO = new Map<number, number>();

/** The three state slots the team seams read, for owner 1 alone. */
function stateOf(civilization: string, age: AgeType = 'dark-age') {
  const slots = new Map<unknown, unknown>([
    [playerTeamsCodec, new Map()],
    [playerCivilizationsCodec, new Map([[1, civilization]])],
    [playerAgesCodec, new Map([[1, age]])],
  ]);
  return { get: (codec: unknown) => slots.get(codec) } as never;
}

interface Pair {
  readonly civilization: string;
  readonly column: 'civilizationBonuses' | 'teamBonuses';
  readonly line: string;
  readonly code: () => void;
}

const PAIRS: readonly Pair[] = [
  {
    civilization: 'Aztecs', column: 'civilizationBonuses', line: 'Military Units train +15% faster',
    code: () => {
      expect(civTrainTimeMultiplier('Aztecs', 'militia')).toBeCloseTo(1 / 1.15, 12);
      expect(civTrainTimeMultiplier('Aztecs', 'fishing-ship')).toBe(1);
    },
  },
  {
    civilization: 'Britons', column: 'teamBonuses', line: 'Archery Ranges work +10% faster',
    code: () => expect(teamTrainTimeMultiplier(stateOf('Britons'), 1, 'archery-range', 'archer')).toBeCloseTo(1 / 1.1, 12),
  },
  {
    civilization: 'Celts', column: 'civilizationBonuses', line: 'Siege Weapons attack +25% faster',
    code: () => expect(civReloadMultiplier('Celts', 'mangonel', 'castle-age')).toBeCloseTo(1 / 1.25, 12),
  },
  {
    civilization: 'Celts', column: 'civilizationBonuses', line: 'Infantry moves +5/10/15/20% faster in Dark/Feudal/Castle/Imperial Age',
    code: () => {
      const rates = [1.05, 1.1, 1.15, 1.2];
      AGES.forEach((age, i) => expect(civSpeedMultiplier('Celts', 'militia', age), age).toBeCloseTo(rates[i]!, 12));
    },
  },
  {
    civilization: 'Chinese', column: 'civilizationBonuses', line: 'Town Centers +7 line of sight and provide +15 population space',
    code: () => {
      expect(teamBuildingVisionBonus(SOLO, new Map([[1, 'Chinese']]), 1, 'town-center')).toBe(7);
      expect(civPopulationProvidedBonus('Chinese', 'town-center')).toBe(15);
    },
  },
  {
    civilization: 'Franks', column: 'civilizationBonuses', line: 'Castles cost -15/25% in Castle/Imperial Age',
    code: () => {
      const stone = constructionCost('castle').stone!;
      expect(effectiveConstructionCost('Franks', 'castle', 'castle-age').stone).toBe(Math.round(stone * 0.85));
      expect(effectiveConstructionCost('Franks', 'castle', 'imperial-age').stone).toBe(Math.round(stone * 0.75));
    },
  },
  {
    civilization: 'Goths', column: 'civilizationBonuses', line: 'Infantry cost -15/20/25/30% in Dark/Feudal/Castle/Imperial Age',
    code: () => {
      const food = trainingCost('militia').food!;
      const ladder = [0.85, 0.8, 0.75, 0.7];
      AGES.forEach((age, i) => expect(effectiveTrainingCost('Goths', age, 'militia', NO_TECHS).food, age).toBe(Math.round(food * ladder[i]!)));
    },
  },
  {
    civilization: 'Goths', column: 'civilizationBonuses', line: 'Infantry +1/+2/+3 attack vs. buildings in Feudal/Castle/Imperial Age',
    code: () => expect(AGES.map((age) => civBuildingAttackLadder('Goths', 'militia', age))).toEqual([0, 1, 2, 3]),
  },
  {
    civilization: 'Goths', column: 'civilizationBonuses', line: 'Hunters carry +15',
    code: () => expect([civCarryBonus('Goths', 'boar'), civCarryBonus('Goths', 'deer')]).toEqual([15, 15]),
  },
  {
    civilization: 'Goths', column: 'civilizationBonuses', line: 'Hunted animals last +20% longer',
    code: () => expect([civResourceDurationMultiplier('Goths', 'boar'), civResourceDurationMultiplier('Goths', 'deer')]).toEqual([1.2, 1.2]),
  },
  {
    civilization: 'Goths', column: 'civilizationBonuses', line: '+10 to population limit in Imperial Age',
    code: () => expect(civImperialPopulationBonus('Goths', 'imperial-age')).toBe(10),
  },
  {
    civilization: 'Incas', column: 'civilizationBonuses', line: 'Villagers affected by Infantry Blacksmith upgrades starting in Castle Age',
    code: () => {
      expect(civVillagersTakeInfantryArmor('Incas', 'feudal-age')).toBe(false);
      expect(civVillagersTakeInfantryArmor('Incas', 'castle-age')).toBe(true);
    },
  },
  {
    civilization: 'Italians', column: 'civilizationBonuses', line: 'Advancing to the next age costs -15%',
    code: () => {
      const food = researchCost('castle-age').food!;
      expect(effectiveResearchCost('Italians', 'feudal-age', 'castle-age').food).toBe(Math.round(food * 0.85));
    },
  },
  {
    civilization: 'Ethiopians', column: 'teamBonuses', line: 'Outposts +3 line of sight and cost no stone',
    code: () => {
      const ethiopians = new Map([[1, 'Ethiopians']]);
      expect(teamBuildingVisionBonus(SOLO, ethiopians, 1, 'outpost')).toBe(3);
      expect(teamBuildingVisionBonus(SOLO, ethiopians, 1, 'watch-tower')).toBe(0);
      const { stone: _stone, ...withoutStone } = constructionCost('outpost');
      expect(ownerConstructionCost(stateOf('Ethiopians'), 1, 'outpost')).toEqual(withoutStone);
    },
  },
  {
    civilization: 'Italians', column: 'civilizationBonuses', line: 'Fishing Ships cost -15%',
    code: () => {
      const wood = trainingCost('fishing-ship').wood!;
      expect(effectiveTrainingCost('Italians', 'dark-age', 'fishing-ship', NO_TECHS).wood).toBe(Math.round(wood * 0.85));
    },
  },
  {
    civilization: 'Italians', column: 'civilizationBonuses', line: 'Foot Archers and Condottieri +1 melee/+1 pierce armor',
    code: () => {
      expect(civArmorBonus('Italians', 'archer')).toBe(1);
      expect(civArmorBonus('Italians', 'skirmisher')).toBe(0);
    },
  },
  {
    civilization: 'Japanese', column: 'civilizationBonuses', line: 'Fishing Ships have 2x HP',
    code: () => {
      expect(civUnitHpMultiplier('Japanese', 'fishing-ship')).toBe(2);
      // No pierce armor beside the hit points, as in DE ("+100% HP").
      const ship = (civ: string) => createCombatStateFactory({ hasTechnology: () => false, getCivilization: () => civ, getAge: () => 'castle-age' })(1, 'fishing-ship');
      expect(ship('Japanese').pierceArmorBonus).toBe(ship('Britons').pierceArmorBonus);
      expect(ship('Japanese').armor).toBe(ship('Britons').armor);
    },
  },
  {
    civilization: 'Mayans', column: 'civilizationBonuses', line: 'Resources last +15% longer',
    code: () => expect(civResourceDurationMultiplier('Mayans', 'tree')).toBe(1.15),
  },
  {
    civilization: 'Persians', column: 'civilizationBonuses', line: 'Town Centers and Docks work +5/10/15/20% faster in Dark/Feudal/Castle/Imperial Age',
    code: () => {
      const rates = [1.05, 1.1, 1.15, 1.2];
      AGES.forEach((age, i) => expect(teamTrainTimeMultiplier(stateOf('Persians', age), 1, 'town-center', 'villager'), age).toBeCloseTo(1 / rates[i]!, 12));
    },
  },
  {
    civilization: 'Spanish', column: 'civilizationBonuses', line: 'Gunpowder Units attack +18% faster',
    code: () => {
      expect(civReloadMultiplier('Spanish', 'hand-cannoneer', 'imperial-age')).toBeCloseTo(1 / 1.18, 12);
      expect(civReloadMultiplier('Spanish', 'conquistador', 'castle-age')).toBeCloseTo(1 / 1.18, 12);
    },
  },
  {
    civilization: 'Saracens', column: 'teamBonuses', line: 'Foot Archers and Skirmishers +2 attack vs. buildings',
    code: () => {
      const saracen = new Map([[1, 'Saracens']]);
      expect(teamBuildingAttackBonus(SOLO, saracen, 1, 'archer')).toBe(2);
      expect(teamBuildingAttackBonus(SOLO, saracen, 1, 'skirmisher')).toBe(2);
    },
  },
  {
    civilization: 'Slavs', column: 'teamBonuses', line: 'Military buildings (except Castles) provide +5 population space',
    code: () => {
      expect(slavsTeamMilitaryPop(stateOf('Slavs'), 1, 'barracks')).toBe(5);
      expect(slavsTeamMilitaryPop(stateOf('Slavs'), 1, 'castle')).toBe(0);
    },
  },
  {
    civilization: 'Vietnamese', column: 'civilizationBonuses', line: 'Enemy Town Centers are revealed at the start of the game',
    code: () => {
      // The enemy Town Center boots as a fog-memory ghost for a Vietnamese
      // owner and stays unknown to anyone else (vietnameseReveal.ts).
      const ghostAt = (civilizations?: Map<number, string>) => {
        const bridge = createSimulationBridge('outpost-vision-fixture', civilizations ? { civilizationsByOwner: civilizations } : {});
        bridge.step(100);
        return bridge.getRenderState().entities.some((e) => e.entityType === 'town-center' && e.x === 40 && e.y === 26 && e.isMemory);
      };
      expect(ghostAt(new Map([[1, 'Vietnamese']]))).toBe(true);
      expect(ghostAt()).toBe(false);
    },
  },
  {
    civilization: 'Vietnamese', column: 'civilizationBonuses', line: 'Foot Archers and Skirmishers +20% HP',
    code: () => {
      expect(ageScaledUnitHpFactor('Vietnamese', 'archer', 'dark-age')).toBe(1.2);
      expect(ageScaledUnitHpFactor('Vietnamese', 'skirmisher', 'dark-age')).toBe(1.2);
      expect(ageScaledUnitHpFactor('Vietnamese', 'cavalry-archer', 'castle-age')).toBe(1);
    },
  },
];

// Lines the CSV carried before work 120 brought it in line; each said
// something the code no longer does.
const RETIRED_LINES: readonly string[] = [
  'Military units created 15% faster',
  'Archery Ranges work 20% faster',
  'Siege weapons reload 20% faster',
  'Castles are 25% cheaper',
  'Infantry cost 35% less (starting in Feudal Age)',
  'Infantry have +1 attack against buildings',
  'Villagers have +5 attack versus wild boar',
  'Hunters carry +15 meat',
  'Infantry +1/+2/+3 attack vs buildings by age',
  'Villagers affected by Blacksmith upgrades',
  'Advance to next age costs -15%',
  'Fishing Ships have 2x HP and +2 pierce armor',
  'Natural resources last 20% longer',
  'Town Centers and Docks operate +10% faster in Feudal Age/ +15% in Castle Age/ +20% in Imperial Age',
  'Town Centers and Docks work +5/10/15/20% faster by age',
  'Foot archers have +2 attack bonus against buildings',
  'Military buildings provide +5% population',
  'Reveals enemy positions at game start',
  // Work 120 M3 (vNEXT): the code itself departed from DE on these.
  'Infantry moves 15% faster',
  'Towers and Outposts +3 LOS',
  'Fishing ship cost -15 wood',
  'Archery Range units +20% HP',
  'Hand Cannoneers and Bombard Cannons reload 15% faster',
];

describe('civilizations.csv agrees with the code', () => {
  for (const pair of PAIRS) {
    it(`${pair.civilization}: "${pair.line}"`, () => {
      expect(civProfileFor(pair.civilization)?.[pair.column], `${pair.civilization} ${pair.column}`).toContain(pair.line);
      pair.code();
    });
  }

  it('carries none of the retired lines', () => {
    const everyLine = CIV_PROFILES.flatMap((profile) => [...profile.civilizationBonuses, ...profile.teamBonuses]);
    for (const retired of RETIRED_LINES) expect(everyLine, retired).not.toContain(retired);
  });
});
