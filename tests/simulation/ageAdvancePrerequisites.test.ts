// Spec §7.2's building requirements, as written rather than as drifted.
//
// Two of the three transitions did not match the table:
//
//   Dark → Feudal requires two of {Barracks, Dock, Lumber Camp, Mill, Mining
//   Camp}. The implemented set omitted the Dock, on the strength of a sentence
//   in §7.2 saying "This land-only slice has no Dock". That stopped being true
//   when the naval slice shipped — §7.3 lists the Dock as a Dark Age unlock in
//   the same document — so the spec contradicted itself and the code followed
//   the stale half. A water-map opening that builds a Dock and a Mill is a
//   normal AoE2 opening and it could not age up.
//
//   Castle → Imperial requires "2 qualifying Castle Age buildings OR 1 Castle".
//   Only the count was implemented, and a Castle merely counted as one of the
//   two — so a player who had built a Castle and nothing else from that tier
//   was blocked, which is neither the spec nor the game.
//
// These are checked through the age-advance options a player actually sees,
// not through the predicate in isolation, because the defect this class keeps
// producing in this repo is a rule that is right in one table and never
// reaches the surface that consults it.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedBuildingDirect } from './createSimulationBridge.helpers';
import {
  isCastleAgePrerequisiteBuilding,
  isDarkAgePrerequisiteBuilding,
} from '../../src/game/simulation/prototypeBuildingRules';

describe('spec §7.2 age prerequisites', () => {
  it('counts the Dock toward the Feudal advance', () => {
    // The whole qualifying set from the spec table, each asserted by name so a
    // regression says WHICH building stopped counting.
    for (const qualifying of ['barracks', 'dock', 'lumber-camp', 'mill', 'mining-camp'] as const) {
      expect(
        isDarkAgePrerequisiteBuilding(qualifying),
        `${qualifying} must count toward Dark → Feudal`,
      ).toBe(true);
    }
  });

  it('still refuses the buildings AoE2 does not count', () => {
    // The control. "Counts the Dock" must not decay into "counts everything" —
    // §7.2 is explicit that Houses, Farms and Walls do not qualify and the
    // Town Center never does.
    // `outpost` and `fish-trap` are the two that matter most here: both are
    // Dark-Age buildable, so they are the ones a widened set would actually
    // sweep up, and AoE2 counts neither. A control listing only houses and
    // walls would not have noticed.
    for (const excluded of [
      'house', 'farm', 'stone-wall', 'palisade-wall', 'town-center', 'outpost', 'fish-trap',
    ] as const) {
      expect(
        isDarkAgePrerequisiteBuilding(excluded),
        `${excluded} must NOT count toward Dark → Feudal`,
      ).toBe(false);
    }
  });

  it('keeps the Castle-Age qualifying set as the spec names it', () => {
    for (const qualifying of ['university', 'siege-workshop', 'monastery', 'castle'] as const) {
      expect(isCastleAgePrerequisiteBuilding(qualifying)).toBe(true);
    }
    for (const excluded of ['house', 'farm', 'town-center'] as const) {
      expect(isCastleAgePrerequisiteBuilding(excluded)).toBe(false);
    }
  });
});

describe('spec §7.2 "2 qualifying Castle Age buildings OR 1 Castle"', () => {
  // Asserted through the Town Center's research options — the list a player
  // actually clicks — rather than through the predicate, because this repo's
  // recurring defect is a rule that is correct in a table and never reaches
  // the surface that consults it.
  const imperialOffered = (seed: string): boolean => {
    const bridge = createSimulationBridge(seed);
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    return bridge.getSelectionState().researchOptions.includes('imperial-age');
  };

  it('offers the Imperial advance to a player holding one Castle', () => {
    expect(
      imperialOffered('lone-castle-fixture'),
      'a Castle-Age player with a Castle could not advance',
    ).toBe(true);
  });

  it('still refuses a player holding one non-Castle qualifying building', () => {
    // The control. Without it, "one Castle is enough" is indistinguishable
    // from "any one building is enough", which would delete the requirement.
    //
    // Paired with the positive case above in ONE assertion block, because on
    // its own a refusal is also satisfied by a predicate that always returns
    // false — review pointed out that this control passed under any broken
    // implementation at all.
    expect(
      imperialOffered('lone-university-fixture'),
      'one University was accepted — the two-building requirement is gone',
    ).toBe(false);
    expect(
      imperialOffered('lone-castle-fixture'),
      'nothing at all was offered — the refusal above proves nothing',
    ).toBe(true);
  });

  it('tells a blocked player that a single Castle would also do', () => {
    // Spec §7.2's alternative reached the predicate and not the message: a
    // player with one University was told to build a SECOND building, when
    // finishing a Castle alone suffices. The message is a product surface and
    // has to name what would satisfy it.
    const bridge = createSimulationBridge('lone-university-fixture');
    const locked = bridge
      .getAgentBuildingOptions(1)
      .byBuildingType.flatMap((option) => option.researchLocked)
      .find((entry) => entry.tech === 'imperial-age');
    expect(locked, 'imperial-age was not reported as locked').toBeDefined();
    // NOT `toContain('castle')` — the candidate list already ends "...,
    // monastery, or castle", so that assertion passes whether or not the
    // alternative is mentioned at all. Red-checked: with the alternative
    // removed the message still contains the word.
    expect(
      locked!.reason,
      `the reason does not offer the single-Castle route: "${locked!.reason}"`,
    ).toContain('or a single completed castle');
  });
});
