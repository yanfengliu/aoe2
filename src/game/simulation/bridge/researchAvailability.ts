// agent-affordances A1: the "why can't I research this" reason engine.
// Single source of truth for human-readable unavailability reasons,
// consumed by the queue.research validator (rejection messages) and by
// buildingOptionsOps (the agent snapshot's locked-research entries).
//
// Campaign-1 evidence: 8 bare "Cannot research that here." rejections
// cost the agent ~7 decisions (~$4) reverse-engineering the
// two-Dark-Age-buildings rule. Every reason produced here names the
// actual unmet rule so the next attempt can be correct.
//
// Deliberately NOT a refactor of optionsRules' hand-rolled if-chains
// into a declarative table (see thread DESIGN.md): age-up techs get
// precise reasons from the structured prerequisite tables; everything
// else falls back to already-researched or a generic explanation that
// always includes the currently-researchable list — which is actionable
// in itself.

import type {
  BuildingType,
  ResearchableTechnologyType,
} from '../types';
import {
  AGE_ADVANCE_REQUIRED_COUNT,
  agePrerequisiteBuildingTypes,
  buildingsThatResearch,
  canResearchAt,
  isAgeUpTechnology,
  type AgeUpTechnologyType,
} from '../prototypeBuildingRules';
import { researchPrerequisiteTechnology } from './losTechOptions';

type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';

const AGE_ORDER: Record<AgeType, number> = {
  'dark-age': 0,
  'feudal-age': 1,
  'castle-age': 2,
  'imperial-age': 3,
};

// The age you must currently be in to research each age-up tech, and
// the era label its prerequisite buildings belong to.
const AGE_UP_DEPARTS_FROM: Record<AgeUpTechnologyType, AgeType> = {
  'feudal-age': 'dark-age',
  'castle-age': 'feudal-age',
  'imperial-age': 'castle-age',
};

const ERA_LABEL: Record<AgeType, string> = {
  'dark-age': 'Dark Age',
  'feudal-age': 'Feudal Age',
  'castle-age': 'Castle Age',
  'imperial-age': 'Imperial Age',
};

export interface ResearchAvailabilityDeps {
  getPlayerAge: (owner: number) => AgeType;
  hasTechnology: (owner: number, tech: ResearchableTechnologyType) => boolean;
  countCompletedAgePrerequisites: (owner: number, forTech: AgeUpTechnologyType) => number;
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => readonly ResearchableTechnologyType[];
  /** The owner's civilization when its tech tree DENIES `tech`, else
   *  undefined — a permanent hole gets a permanent-sounding reason
   *  instead of the generic "not available yet" (spec §11.1). */
  civilizationDenying: (
    owner: number,
    tech: ResearchableTechnologyType,
  ) => string | undefined;
}

export interface ResearchAvailability {
  /** Why `tech` cannot be researched at `buildingType` by `owner` right
   *  now. Callers must already know it is unavailable (i.e. not in
   *  getResearchOptions); the answer is always a complete sentence the
   *  agent or HUD toast can act on. */
  researchUnavailableReason(
    owner: number,
    buildingType: BuildingType,
    tech: ResearchableTechnologyType,
  ): string;
  /** The same answer, short enough to sit at the end of a command
   *  tooltip and written in display names rather than option ids. The
   *  button beside it already carries the technology's own name and its
   *  price, so this says only what is MISSING. Same inputs, same rules,
   *  same file — the long form above is what the agent snapshot and the
   *  rejection toast read, this is what the player reads on hover. */
  researchUnavailableSummary(
    owner: number,
    buildingType: BuildingType,
    tech: ResearchableTechnologyType,
  ): string;
}

function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

/**
 * `lumber-camp` → `Lumber Camp`. Deliberately a generic humanizer rather
 * than a second copy of the HUD's per-id name tables: everything these
 * reasons NAME is a building type or an age, whose ids are already the
 * display name in kebab case, and a duplicated table is a table that
 * drifts. The technology's own name is never formatted here — the button
 * the tooltip hangs off already carries it.
 */
export function titleCaseId(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function createResearchAvailability(
  deps: ResearchAvailabilityDeps,
): ResearchAvailability {
  const {
    getPlayerAge,
    hasTechnology,
    countCompletedAgePrerequisites,
    getResearchOptions,
    civilizationDenying,
  } = deps;

  function ageUpReason(owner: number, tech: AgeUpTechnologyType): string {
    const departsFrom = AGE_UP_DEPARTS_FROM[tech];
    const currentAge = getPlayerAge(owner);
    if (AGE_ORDER[currentAge] > AGE_ORDER[departsFrom]) {
      return `You are already ${currentAge} — ${tech} is behind you.`;
    }
    if (AGE_ORDER[currentAge] < AGE_ORDER[departsFrom]) {
      return `Advancing to ${tech} requires being in ${departsFrom} (you are ${currentAge}).`;
    }
    const have = countCompletedAgePrerequisites(owner, tech);
    const candidates = formatList(agePrerequisiteBuildingTypes(tech));
    // Spec §7.2 gives Imperial an ALTERNATIVE — two qualifying buildings or a
    // single Castle — and a message that names only the count tells a player
    // with a Castle nearly finished to go build something else. An error
    // message has to name what would satisfy it, so it names both routes.
    const alternative = tech === 'imperial-age' ? ' (or a single completed castle)' : '';
    return (
      `Advancing to ${tech} requires ${AGE_ADVANCE_REQUIRED_COUNT} completed `
      + `${ERA_LABEL[departsFrom]} buildings (${candidates})${alternative} — you have ${have}.`
    );
  }

  function researchUnavailableReason(
    owner: number,
    buildingType: BuildingType,
    tech: ResearchableTechnologyType,
  ): string {
    if (!canResearchAt(buildingType, tech)) {
      const where = buildingsThatResearch(tech);
      const at = where.length > 0
        ? ` It is researched at: ${where.join(', ')}.`
        : '';
      return `${tech} cannot be researched at a ${buildingType}.${at}`;
    }
    if (isAgeUpTechnology(tech)) {
      return ageUpReason(owner, tech);
    }
    if (hasTechnology(owner, tech)) {
      return `${tech} is already researched.`;
    }
    const denier = civilizationDenying(owner, tech);
    if (denier !== undefined) {
      return (
        `${tech} is not in the ${denier} technology tree — `
        + 'no age or research will ever unlock it for this civilization.'
      );
    }
    const available = getResearchOptions(owner, buildingType);
    const availableNote = available.length > 0
      ? `Currently researchable here: ${available.join(', ')}.`
      : 'Nothing is currently researchable at this building right now.';
    return (
      `${tech} is not available at this ${buildingType} yet `
      + `(age, civilization, or prerequisite upgrade not met). ${availableNote}`
    );
  }

  function ageUpSummary(owner: number, tech: AgeUpTechnologyType): string {
    const departsFrom = AGE_UP_DEPARTS_FROM[tech];
    const currentAge = getPlayerAge(owner);
    if (AGE_ORDER[currentAge] > AGE_ORDER[departsFrom]) {
      return `Already past it — you are in the ${ERA_LABEL[currentAge]}.`;
    }
    if (AGE_ORDER[currentAge] < AGE_ORDER[departsFrom]) {
      return `Needs the ${ERA_LABEL[departsFrom]} — you are in the ${ERA_LABEL[currentAge]}.`;
    }
    const have = countCompletedAgePrerequisites(owner, tech);
    const candidates = formatList(agePrerequisiteBuildingTypes(tech).map(titleCaseId));
    // §7.2 gives Imperial an ALTERNATIVE — two qualifying buildings or one
    // Castle — so a player with a Castle nearly finished is not sent off to
    // build something else.
    const alternative = tech === 'imperial-age' ? ', or one completed Castle' : '';
    return (
      `Needs ${AGE_ADVANCE_REQUIRED_COUNT} completed ${ERA_LABEL[departsFrom]} buildings `
      + `(${candidates})${alternative}. You have ${have}.`
    );
  }

  function researchUnavailableSummary(
    owner: number,
    buildingType: BuildingType,
    tech: ResearchableTechnologyType,
  ): string {
    if (!canResearchAt(buildingType, tech)) {
      const where = buildingsThatResearch(tech).map(titleCaseId);
      return where.length > 0
        ? `Researched at a ${formatList(where)}, not here.`
        : `Not researched at a ${titleCaseId(buildingType)}.`;
    }
    if (isAgeUpTechnology(tech)) {
      return ageUpSummary(owner, tech);
    }
    if (hasTechnology(owner, tech)) {
      return 'Already researched.';
    }
    const denier = civilizationDenying(owner, tech);
    if (denier !== undefined) {
      return `Not in the ${denier} technology tree — nothing will ever unlock it.`;
    }
    const prerequisite = researchPrerequisiteTechnology(tech);
    if (prerequisite !== undefined && !hasTechnology(owner, prerequisite)) {
      return `Needs ${titleCaseId(prerequisite)} researched here first.`;
    }
    // The last resort, and it stays vague because nothing more specific is
    // known: every other gate either keeps the option out of the menu (so
    // no button is drawn to explain) or is answered above.
    return 'Not available yet — needs a later age or an earlier upgrade.';
  }

  return { researchUnavailableReason, researchUnavailableSummary };
}
