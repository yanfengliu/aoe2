// The Dock's research menu (technologies.csv, `develops_in: Dock`): the ship
// upgrade lines. Extracted from optionsRules.ts to keep that file under the
// 500-LOC budget, following the projectileTechOptions precedent. Pure: the age
// and tech predicates are passed in (the bridge owns the underlying maps).
//
// Each entry is offered once its age is reached and disappears once researched.
// Every upgrade also requires the tech BEFORE it in its line, so a player
// cannot buy a Galleon without first having a War Galley — the same
// prerequisite shape the Archery Range and Stable lines use.

import type { ResearchableTechnologyType } from '../types';

type AgePredicate = (
  owner: number,
  minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
) => boolean;
type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

interface DockTech {
  readonly tech: ResearchableTechnologyType;
  readonly age: 'castle-age' | 'imperial-age';
  /** Must be researched first, where the line has a predecessor. */
  readonly requires?: ResearchableTechnologyType;
}

const DOCK_TECHS: readonly DockTech[] = [
  // The three that act on every ship rather than on one line. AoE2 DE chains
  // them - Dry Dock needs Careening, Shipwright needs Dry Dock - which
  // technologies.csv does not state but the game does.
  { tech: 'careening', age: 'castle-age' },
  { tech: 'dry-dock', age: 'imperial-age', requires: 'careening' },
  { tech: 'shipwright', age: 'imperial-age', requires: 'dry-dock' },
  { tech: 'war-galley-upgrade', age: 'castle-age' },
  { tech: 'galleon-upgrade', age: 'imperial-age', requires: 'war-galley-upgrade' },
  { tech: 'fast-fire-ship-upgrade', age: 'imperial-age' },
  { tech: 'heavy-demolition-ship-upgrade', age: 'imperial-age' },
  { tech: 'cannon-galleon-unlock', age: 'imperial-age' },
  {
    tech: 'elite-cannon-galleon-upgrade',
    age: 'imperial-age',
    requires: 'cannon-galleon-unlock',
  },
];

/** The ship technologies this Dock can currently research. */
export function dockResearchOptions(
  owner: number,
  isAtLeastAge: AgePredicate,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  const options: ResearchableTechnologyType[] = [];
  for (const entry of DOCK_TECHS) {
    if (!isAtLeastAge(owner, entry.age)) continue;
    if (hasTechnology(owner, entry.tech)) continue;
    if (entry.requires && !hasTechnology(owner, entry.requires)) continue;
    options.push(entry.tech);
  }
  return options;
}
