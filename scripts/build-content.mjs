import { buildContentBundle, writeGeneratedContent } from './content-lib.mjs';

const bundle = buildContentBundle();
writeGeneratedContent(bundle);

console.log(
  `Built normalized content bundle: ${bundle.civilizations.length} civs, ${bundle.units.length} units, ${bundle.technologies.length} technologies, ${bundle.structures.length} structures.`,
);
console.log(
  `Coverage: ${bundle.coverage.supportedCivilizationCount} supported civs, ${bundle.coverage.unsupportedCivilizationCount} unsupported civs.`,
);
