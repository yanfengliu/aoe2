// Civilization free technologies (spec §9.2): "Loom free", "Chemistry free",
// "Farm upgrades free" and friends research THEMSELVES the moment the owner
// could legally research them — age reached, prerequisite chain satisfied,
// and a completed building standing whose menu offers the technology. The
// check IS the menu (getResearchOptions), so the free grant can never reach
// something a player could not, and every prerequisite rule lives once.
//
// Runs every 25 ticks: age-ups and building completions are the only events
// that open new menu entries, and a 2.5-second grant lag is invisible next to
// AoE2's own "arrives on age up" feel.

import type { BuildingComponent, ResearchableTechnologyType } from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  constructionStatesCodec,
  playerCivilizationsCodec,
  researchedTechnologiesCodec,
} from '../bridgeStateSerialize';
import { CIV_FREE_TECHNOLOGIES } from '../../civBonusTable';

const CHECK_INTERVAL_TICKS = 25;

export interface FreeTechnologySystemDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  getResearchOptions: (owner: number, buildingType: BuildingComponent['buildingType']) => ResearchableTechnologyType[];
  applyTechnology: (owner: number, technologyType: ResearchableTechnologyType) => void;
}

export function registerFreeTechnologySystem(deps: FreeTechnologySystemDeps): void {
  const { world, accessor, getResearchOptions, applyTechnology } = deps;

  world.registerSystem({
    name: 'prototypeFreeTechnologies',
    phase: 'update',
    execute(activeWorld) {
      if (activeWorld.tick % CHECK_INTERVAL_TICKS !== 0) return;
      const civilizations = accessor.get(playerCivilizationsCodec);
      if (civilizations.size === 0) return;

      // Which owners still WAIT on a free technology — most matches, nobody.
      const pending = new Map<number, ResearchableTechnologyType[]>();
      const researched = accessor.get(researchedTechnologiesCodec);
      for (const [owner, civilization] of civilizations) {
        const free = CIV_FREE_TECHNOLOGIES[civilization];
        if (!free) continue;
        const have = researched.get(owner);
        const waiting = free.filter((technology) => !have?.has(technology));
        if (waiting.length > 0) pending.set(owner, waiting);
      }
      if (pending.size === 0) return;

      // One building walk serves every owner: collect each owner's standing
      // completed building types, then ask the menu.
      const constructions = accessor.get(constructionStatesCodec);
      const buildingTypes = new Map<number, Set<BuildingComponent['buildingType']>>();
      for (const id of activeWorld.query('building')) {
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        if (!building || !pending.has(building.owner)) continue;
        const construction = constructions.get(id);
        if (construction && !construction.isComplete) continue;
        let set = buildingTypes.get(building.owner);
        if (!set) {
          set = new Set();
          buildingTypes.set(building.owner, set);
        }
        set.add(building.buildingType);
      }

      for (const [owner, waiting] of pending) {
        const types = buildingTypes.get(owner);
        if (!types) continue;
        for (const buildingType of types) {
          const offered = getResearchOptions(owner, buildingType);
          for (const technology of waiting) {
            if (offered.includes(technology)) {
              // applyTechnology is idempotent and marks the researched set,
              // so a technology offered at two buildings lands once.
              applyTechnology(owner, technology);
            }
          }
        }
      }
    },
  });
}
