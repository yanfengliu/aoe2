import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// GATE (register 2026-10-14, "the Train button said 75 wood and the Dock took
// 64"): the HUD prices nothing itself. Every price a command card quotes comes
// in `SelectionState.commandCosts` (or a refusal sentence), computed by the
// simulation from the per-owner seam the charge reads
// (src/game/simulation/bridge/ownerCosts.ts). The defect this retires was a
// tooltip module that imported the base cost tables and quoted them, beside a
// charge that read the owner's discounted price; a build palette fell back to
// a civilization-blind price the same way.
//
// So no file under src/ui may name a cost table, a pricing function or the
// bridge's price getter. The one price formula the HUD applies is the
// tribute's (`tributeRules.tributeCost`), and it applies it to the fee rate the
// bridge reads from the sender's own technologies — the charge's own seam.
//
// Bound: this is LEXICAL and covers src/ui only. It refuses the NAMES; a price
// rebuilt from scratch under another name in the UI is held behaviourally, by
// tests/ui/shownPriceCensus.test.ts (every quoted price against its click's
// charge) and tests/ui/shownPriceIsChargedPrice.test.ts. Comments are stripped
// before the scan, so prose may name what the code may not use.

const ROOT = join(__dirname, '..', '..');
const UI = join(ROOT, 'src', 'ui');

const PRICE_NAMES = [
  // The base tables and their readers.
  'trainingCost', 'researchCost', 'constructionCost', 'TRAINING_COSTS', 'RESEARCH_COSTS',
  // The civilization layer and the per-owner seams.
  'effectiveTrainingCost', 'effectiveResearchCost', 'effectiveConstructionCost',
  'ownerTrainingCost', 'ownerResearchCost', 'ownerConstructionCost',
  'ownerMarketBuyCost', 'ownerMarketFeeRate', 'marketFeeRateFor', 'spiesCost',
  // The bridge getter the build palette used to price from.
  'getConstructionCost',
] as const;
const PRICE_MODULES = ['civBonusEffects', 'ownerCosts', 'trainingCosts', 'researchTables', 'marketTechEffects'] as const;

const FORBIDDEN = new RegExp(
  String.raw`\b(?:${PRICE_NAMES.join('|')})\b|['"][^'"]*/(?:${PRICE_MODULES.join('|')})['"]`,
  'g',
);

// Verbatim from the unfixed tree (9e4a320b). Each must be refused, or the scan
// below proves nothing.
const KNOWN_BAD: readonly string[] = [
  "import { effectiveConstructionCost } from '../../game/simulation/civBonusEffects';",
  'return `Queue a ${unitDisplayName} at this building. Cost: ${formatResourceCost(trainingCost(unitType))}. Needs an open production queue slot.`;',
  'return `Research ${techDisplayName}. Cost: ${formatResourceCost(researchCost(technologyType))}; takes ${seconds}s.`;',
  'const shown = cost ?? effectiveConstructionCost(undefined, buildingType);',
  '= (buildingType) => effectiveConstructionCost(undefined, buildingType),',
  'getConstructionCost: (buildingType) => bridge.getConstructionCost(1, buildingType),',
];

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (path.endsWith('.ts')) found.push(path);
  }
  return found;
}

describe('the HUD quotes only the prices the simulation hands it', () => {
  it('refuses every shape the defect had', () => {
    for (const line of KNOWN_BAD) {
      expect(withoutComments(line).match(FORBIDDEN), `the scan does not refuse: ${line}`).not.toBeNull();
    }
  });

  it('finds no cost table, pricing function or price getter named under src/ui', () => {
    const files = sourceFiles(UI);
    const read = files.map((file) => relative(ROOT, file).split('\\').join('/'));
    // A scan that reads less than it claims passes for the wrong reason.
    expect(files.length, 'too few files under src/ui were read').toBeGreaterThanOrEqual(30);
    for (const priceQuoting of [
      'src/ui/hud/tooltips.ts',
      'src/ui/hud/selectionPanel.ts',
      'src/ui/hud/selectionPanel/buttons.ts',
      'src/ui/hud/selectionPanel/buildPalette.ts',
    ]) {
      expect(read, `the scan never read ${priceQuoting}`).toContain(priceQuoting);
    }
    const offences = files.flatMap((file) => [...withoutComments(readFileSync(file, 'utf8')).matchAll(FORBIDDEN)]
      .map((match) => `${relative(ROOT, file)}: ${match[0]}`));
    expect(
      offences,
      'the HUD names a price source of its own; quote the price in SelectionState.commandCosts instead '
      + '(spec §14.2: a shown price is the charged price)',
    ).toEqual([]);
  });
});
