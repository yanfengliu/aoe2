// Per-building-type tint palettes, split out of `prototypeBuildingRules` to keep
// that file inside the 500-line budget. Pure presentation data: four colours per
// building type (human/enemy x complete/under-construction), and nothing else.

import type { BuildingType } from './types';

export interface BuildingTintPalette {
  humanComplete: number;
  humanIncomplete: number;
  enemyComplete: number;
  enemyIncomplete: number;
}

export const BUILDING_TINTS: Record<BuildingType, BuildingTintPalette> = {
  'town-center': {
    humanComplete: 0xd8b36c,
    humanIncomplete: 0x7d6545,
    enemyComplete: 0xa15c5c,
    enemyIncomplete: 0x674040,
  },
  house: {
    humanComplete: 0xc8a15e,
    humanIncomplete: 0x6d593d,
    enemyComplete: 0xa66b6b,
    enemyIncomplete: 0x6a4747,
  },
  mill: {
    humanComplete: 0xb18f54,
    humanIncomplete: 0x625033,
    enemyComplete: 0x9e7161,
    enemyIncomplete: 0x654540,
  },
  'lumber-camp': {
    humanComplete: 0x6c9154,
    humanIncomplete: 0x43573a,
    enemyComplete: 0x826c63,
    enemyIncomplete: 0x564642,
  },
  'mining-camp': {
    humanComplete: 0x7f8f9f,
    humanIncomplete: 0x4c5661,
    enemyComplete: 0x8a7582,
    enemyIncomplete: 0x5b4b54,
  },
  barracks: {
    humanComplete: 0x9b7351,
    humanIncomplete: 0x5b4636,
    enemyComplete: 0x8e6257,
    enemyIncomplete: 0x5c403b,
  },
  'watch-tower': {
    humanComplete: 0x8d9aa7,
    humanIncomplete: 0x56606a,
    enemyComplete: 0xa3848f,
    enemyIncomplete: 0x654e58,
  },
  // Darker stone than a Watch Tower, so the two read apart in a base that has
  // both — the barrel is the other half of the difference.
  'bombard-tower': {
    humanComplete: 0x6f7c88,
    humanIncomplete: 0x454e56,
    enemyComplete: 0x846a74,
    enemyIncomplete: 0x513f47,
  },
  stable: {
    humanComplete: 0xa07b4f,
    humanIncomplete: 0x624b34,
    enemyComplete: 0x996763,
    enemyIncomplete: 0x604340,
  },
  'archery-range': {
    humanComplete: 0x7f6855,
    humanIncomplete: 0x4f4034,
    enemyComplete: 0x8b6660,
    enemyIncomplete: 0x5a433d,
  },
  dock: {
    humanComplete: 0x8d7a5c,
    humanIncomplete: 0x574c39,
    enemyComplete: 0x8a6a63,
    enemyIncomplete: 0x56423e,
  },
  // Bare timber, paler than a Watch Tower's stone so the eye reads "post, not
  // tower" at a glance — which is the whole difference between them.
  outpost: {
    humanComplete: 0xa08a63,
    humanIncomplete: 0x63563e,
    enemyComplete: 0xa07f74,
    enemyIncomplete: 0x634e47,
  },
  // Wet timber and net, dark against the water it stands in.
  'fish-trap': {
    humanComplete: 0x6f6a4b,
    humanIncomplete: 0x474430,
    enemyComplete: 0x74584f,
    enemyIncomplete: 0x483832,
  },
  university: {
    humanComplete: 0x8a8467,
    humanIncomplete: 0x565341,
    enemyComplete: 0x8b7566,
    enemyIncomplete: 0x594b42,
  },
  blacksmith: {
    humanComplete: 0x6f7682,
    humanIncomplete: 0x434a54,
    enemyComplete: 0x8b6670,
    enemyIncomplete: 0x5a434b,
  },
  market: {
    humanComplete: 0xb68f52,
    humanIncomplete: 0x6c5637,
    enemyComplete: 0xb07a66,
    enemyIncomplete: 0x6d4d43,
  },
  'siege-workshop': {
    humanComplete: 0x8e7352,
    humanIncomplete: 0x57462f,
    enemyComplete: 0x8b6a55,
    enemyIncomplete: 0x57413a,
  },
  monastery: {
    humanComplete: 0xcfc3a8,
    humanIncomplete: 0x6f6757,
    enemyComplete: 0xc3a8b6,
    enemyIncomplete: 0x6e5862,
  },
  castle: {
    humanComplete: 0xa09f9c,
    humanIncomplete: 0x605d59,
    enemyComplete: 0xaa7a7a,
    enemyIncomplete: 0x604545,
  },
  wonder: {
    humanComplete: 0xe6c36a,
    humanIncomplete: 0x8a7340,
    enemyComplete: 0xb9585f,
    enemyIncomplete: 0x6b3438,
  },
  'stone-wall': {
    humanComplete: 0x9aa0a8,
    humanIncomplete: 0x5d606a,
    enemyComplete: 0xa57272,
    enemyIncomplete: 0x5d4242,
  },
  'palisade-wall': {
    humanComplete: 0xa88555,
    humanIncomplete: 0x655138,
    enemyComplete: 0xa17066,
    enemyIncomplete: 0x604540,
  },
  // A gate is stone or timber like its wall, lifted a shade brighter so the
  // opening in a long wall line is findable at a glance.
  'stone-gate': {
    humanComplete: 0xb4bac2,
    humanIncomplete: 0x6b6e78,
    enemyComplete: 0xbc8484,
    enemyIncomplete: 0x6b4d4d,
  },
  'palisade-gate': {
    humanComplete: 0xc09a63,
    humanIncomplete: 0x746043,
    enemyComplete: 0xb58176,
    enemyIncomplete: 0x6b4c45,
  },
  // M1 Farms: golden wheat tones for a complete farm; muddy tilled-soil
  // tones while under construction.
  farm: {
    humanComplete: 0xd9b84a,
    humanIncomplete: 0x7a6a3a,
    enemyComplete: 0xc09a55,
    enemyIncomplete: 0x6f5a3a,
  },
};
