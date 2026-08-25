import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  DEFERRED_UNIQUE_TECHNOLOGIES,
  UNIQUE_TECHNOLOGIES,
} from '../../src/game/simulation/uniqueTechnologies';

// design/spec-final.md is authoritative, which cuts both ways: when the code
// ships something the spec still calls missing, the spec is the thing that is
// wrong. §9.2.2's unique-technology table drifted exactly that way — El Dorado
// shipped in v0.3.57 and the table did not gain its row until v0.3.65, eight
// versions later, while a sentence above it still said "sixteen of the
// nineteen". Both halves are prose a person has to remember to edit, so this
// reads them instead.

const SPEC = readFileSync(new URL('../../design/spec-final.md', import.meta.url), 'utf8');

const AGE_LABELS: Record<string, string> = {
  'castle-age': 'Castle',
  'imperial-age': 'Imperial',
};

const NUMBER_WORDS: Record<string, number> = {
  Fifteen: 15, Sixteen: 16, Seventeen: 17, Eighteen: 18, Nineteen: 19,
};

/** The `| Civilization | Technology | Age | Effect |` rows of §9.2.2. */
function specTableRows(): Array<{ civilization: string; name: string; age: string }> {
  const header = '| Civilization | Technology | Age | Effect |';
  const start = SPEC.indexOf(header);
  expect(start, 'the unique-technology table header should exist in §9.2.2').toBeGreaterThan(-1);
  const rows: Array<{ civilization: string; name: string; age: string }> = [];
  for (const line of SPEC.slice(start).split('\n').slice(2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').map((cell) => cell.trim());
    rows.push({ civilization: cells[1]!, name: cells[2]!, age: cells[3]! });
  }
  return rows;
}

describe('the spec\'s unique-technology table', () => {
  it('lists exactly the technologies the build implements', () => {
    const inSpec = specTableRows()
      .map((row) => `${row.civilization} | ${row.name} | ${row.age}`)
      .sort();
    const inCode = UNIQUE_TECHNOLOGIES
      .map((technology) => `${technology.civilization} | ${technology.name} | ${AGE_LABELS[technology.age]}`)
      .sort();
    // A failure here means one of the two is stale — decide which by asking
    // whether the technology is REACHABLE in a match, not by which file is
    // easier to edit.
    expect(inSpec).toEqual(inCode);
  });

  it('counts them correctly in the sentence above the table', () => {
    const match = /(\w+) of the nineteen in `design\/stats\/technologies\.csv` are implemented/.exec(SPEC);
    expect(match, 'the "N of the nineteen ... are implemented" sentence should exist').not.toBeNull();
    const claimed = NUMBER_WORDS[match![1]!];
    expect(claimed, `unknown number word "${match![1]}"`).toBeDefined();
    expect(claimed).toBe(UNIQUE_TECHNOLOGIES.length);
    // Nineteen exist in the CSV, so what is not implemented is deferred.
    expect(UNIQUE_TECHNOLOGIES.length + DEFERRED_UNIQUE_TECHNOLOGIES.length).toBe(19);
  });

  it('names every deferred technology in the paragraph below the table', () => {
    const deferredParagraph = /Not implemented, and why:[^\n]*/.exec(SPEC)?.[0] ?? '';
    for (const id of DEFERRED_UNIQUE_TECHNOLOGIES) {
      const name = id.charAt(0).toUpperCase() + id.slice(1);
      expect(deferredParagraph, `${id} is deferred in code but not explained in the spec`)
        .toContain(name);
    }
  });
});
