import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url);
const STATS_DIR = new URL('../design/stats/', import.meta.url);

function toNumber(value) {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRange(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (match) {
    return {
      min: Number(match[1]),
      max: Number(match[2]),
      raw: trimmed,
    };
  }

  const numeric = toNumber(trimmed);
  if (numeric !== null) {
    return {
      min: numeric,
      max: numeric,
      raw: trimmed,
    };
  }

  return { min: null, max: null, raw: trimmed };
}

function parseArmor(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (!match) {
    return { melee: null, pierce: null, raw: trimmed };
  }

  return {
    melee: Number(match[1]),
    pierce: Number(match[2]),
    raw: trimmed,
  };
}

function parsePercent(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.endsWith('%')) return toNumber(trimmed);
  return toNumber(trimmed.slice(0, -1));
}

const AGE_ORDER = {
  Dark: 0,
  Feudal: 1,
  Castle: 2,
  Imperial: 3,
};

function compareAges(leftAge, rightAge) {
  const leftRank = AGE_ORDER[leftAge] ?? Number.MAX_SAFE_INTEGER;
  const rightRank = AGE_ORDER[rightAge] ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return leftAge.localeCompare(rightAge);
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeJsonValue(nestedValue),
      ]),
    );
  }

  if (typeof value === 'string') {
    const numeric = toNumber(value);
    return numeric ?? value;
  }

  return value;
}

export function splitList(value) {
  if (!value) return [];
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseCostBlob(value) {
  if (!value) return {};
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return {};
  }

  try {
    return normalizeJsonValue(JSON.parse(trimmed.replaceAll(';', ',')));
  } catch {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return {};

    const result = {};
    for (const part of inner.split(';')) {
      const [rawKey, rawValue] = part.split(':');
      if (!rawKey || !rawValue) continue;
      const key = rawKey.replaceAll('"', '').trim();
      const cleanedValue = rawValue.replaceAll('"', '').trim();
      result[key] = toNumber(cleanedValue) ?? cleanedValue;
    }

    return result;
  }
}

export function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  function pushCell() {
    row.push(current);
    current = '';
  }

  function pushRow() {
    if (row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      pushCell();
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      pushCell();
      pushRow();
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());

  return dataRows.map((dataRow) => {
    const result = {};
    headers.forEach((header, columnIndex) => {
      result[header] = (dataRow[columnIndex] ?? '').trim();
    });
    return result;
  });
}

function readCsvFile(fileName) {
  const filePath = new URL(fileName, STATS_DIR);
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function extractUpgradeSource(description) {
  if (!description) return null;
  const trimmed = description.trim();
  const match = /^Upgraded\s+(.+?)(?:[.,]|$)/i.exec(trimmed);
  return match?.[1]?.trim() ?? null;
}

function inferUnitSourceKind(row, parsedCost) {
  if (row.created_in === 'Gaia') {
    return 'gaia';
  }

  if (/\(packed\)/i.test(row.name)) {
    return 'derived-state';
  }

  if (/cannot be produced/i.test(row.description)) {
    return 'scenario-only';
  }

  if (
    row.build_time === '0' &&
    parsedCost &&
    typeof parsedCost === 'object' &&
    'info' in parsedCost
  ) {
    return 'starting-unit';
  }

  return 'trainable';
}

function deriveUnitId(row, duplicateCount, sourceKind) {
  const baseId = slugify(row.name);
  if (duplicateCount <= 1) {
    return baseId;
  }

  if (sourceKind === 'trainable') {
    return baseId;
  }

  if (sourceKind === 'starting-unit') {
    return `${baseId}-starting`;
  }

  return `${baseId}-${slugify(row.age || 'unknown')}-${slugify(
    row.created_in || 'unknown-source',
  )}`;
}

function normalizeStructures(rows) {
  return rows.map((row) => ({
    id: slugify(`${row.name}-${row.age}`),
    name: row.name,
    expansion: row.expansion,
    age: row.age,
    cost: parseCostBlob(row.cost),
    buildTime: toNumber(row.build_time),
    hitPoints: toNumber(row.hit_points),
    lineOfSight: toNumber(row.line_of_sight),
    armor: parseArmor(row.armor),
    range: parseRange(row.range),
    reloadTime: toNumber(row.reload_time),
    attack: toNumber(row.attack),
    special: row.special,
  }));
}

function normalizeUnits(rows) {
  const duplicateCounts = new Map();
  for (const row of rows) {
    duplicateCounts.set(row.name, (duplicateCounts.get(row.name) ?? 0) + 1);
  }

  const normalized = rows.map((row) => {
    const parsedCost = parseCostBlob(row.cost);
    const sourceKind = inferUnitSourceKind(row, parsedCost);

    return {
      id: deriveUnitId(row, duplicateCounts.get(row.name) ?? 0, sourceKind),
      name: row.name,
      description: row.description,
      expansion: row.expansion,
      age: row.age,
      sourceKind,
      trainable: sourceKind === 'trainable',
      startingUnit: sourceKind === 'starting-unit',
      createdIn: row.created_in,
      trainLocation: sourceKind === 'trainable' ? row.created_in : null,
      cost: parsedCost,
      buildTime: toNumber(row.build_time),
      reloadTime: toNumber(row.reload_time),
      attackDelay: toNumber(row.attack_delay),
      movementRate: toNumber(row.movement_rate),
      lineOfSight: toNumber(row.line_of_sight),
      hitPoints: toNumber(row.hit_points),
      range: parseRange(row.range),
      attack: toNumber(row.attack),
      armor: parseArmor(row.armor),
      attackBonus: splitList(row.attack_bonus),
      armorBonus: splitList(row.armor_bonus),
      searchRadius: toNumber(row.search_radius),
      accuracyPercent: parsePercent(row.accuracy),
      blastRadius: toNumber(row.blast_radius),
      upgradesFrom: null,
      upgradesTo: [],
    };
  });

  const unitsByName = new Map();
  for (const unit of normalized) {
    if (!unitsByName.has(unit.name)) {
      unitsByName.set(unit.name, []);
    }
    unitsByName.get(unit.name).push(unit);
  }

  function pickCanonicalUnit(name) {
    const candidates = unitsByName.get(name) ?? [];
    return candidates.find((candidate) => candidate.trainable) ?? candidates[0] ?? null;
  }

  for (const unit of normalized) {
    const predecessorName = extractUpgradeSource(unit.description);
    if (!predecessorName) {
      continue;
    }

    const predecessor = pickCanonicalUnit(predecessorName);
    if (!predecessor) {
      continue;
    }

    unit.upgradesFrom = predecessor.id;
    predecessor.upgradesTo.push(unit.id);
  }

  return normalized;
}

function normalizeTechnologies(rows) {
  return rows.map((row) => ({
    id: slugify(row.name),
    name: row.name,
    expansion: row.expansion,
    age: row.age,
    developsIn: row.develops_in,
    cost: parseCostBlob(row.cost),
    buildTime: toNumber(row.build_time),
    appliesTo: splitList(row.applies_to),
    description: row.description,
  }));
}

function normalizeCivilizations(rows) {
  return rows.map((row) => ({
    id: slugify(row.name),
    name: row.name,
    expansion: row.expansion,
    armyType: row.army_type,
    uniqueUnits: splitList(row.unique_unit),
    uniqueTechs: splitList(row.unique_tech),
    teamBonuses: splitList(row.team_bonus),
    civilizationBonuses: splitList(row.civilization_bonus),
  }));
}

function annotateCivilizations(civilizations, units, technologies) {
  const unitNames = new Set(units.map((entry) => entry.name));
  const technologyNames = new Set(technologies.map((entry) => entry.name));
  const supportedCivilizationIds = [];
  const unsupportedCivilizationIds = [];

  const annotatedCivilizations = civilizations.map((civ) => {
    const missingUniqueUnits = civ.uniqueUnits.filter((unitName) => !unitNames.has(unitName));
    const missingUniqueTechs = civ.uniqueTechs.filter(
      (techName) => !technologyNames.has(techName),
    );
    const playable =
      missingUniqueUnits.length === 0 && missingUniqueTechs.length === 0;

    if (playable) {
      supportedCivilizationIds.push(civ.id);
    } else {
      unsupportedCivilizationIds.push(civ.id);
    }

    return {
      ...civ,
      playable,
      supportStatus: playable ? 'complete' : 'unsupported',
      missingUniqueUnits,
      missingUniqueTechs,
    };
  });

  return {
    civilizations: annotatedCivilizations,
    coverage: {
      civilizationCount: annotatedCivilizations.length,
      supportedCivilizationCount: supportedCivilizationIds.length,
      unsupportedCivilizationCount: unsupportedCivilizationIds.length,
      supportedCivilizationIds: supportedCivilizationIds.sort(),
      unsupportedCivilizationIds: unsupportedCivilizationIds.sort(),
    },
  };
}

function duplicatesFor(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function buildProducerIndex(rows, fieldName) {
  const producerIndex = new Map();

  for (const row of rows) {
    const fieldValue = row[fieldName];
    if (!fieldValue) {
      continue;
    }

    if (!producerIndex.has(fieldValue)) {
      producerIndex.set(fieldValue, []);
    }
    producerIndex.get(fieldValue).push(row.id);
  }

  return Object.fromEntries(
    [...producerIndex.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, values.sort()]),
  );
}

function buildUnitLines(units) {
  const trainableUnits = units.filter((unit) => unit.trainable);
  const unitsById = new Map(trainableUnits.map((unit) => [unit.id, unit]));
  const lines = [];

  function walk(unitId, currentLine) {
    const unit = unitsById.get(unitId);
    if (!unit) {
      return;
    }

    const nextLine = [...currentLine, unit.id];
    const children = unit.upgradesTo
      .map((childId) => unitsById.get(childId))
      .filter(Boolean)
      .sort((left, right) => compareAges(left.age, right.age));

    if (children.length === 0) {
      lines.push(nextLine);
      return;
    }

    for (const child of children) {
      walk(child.id, nextLine);
    }
  }

  const roots = trainableUnits
    .filter((unit) => !unit.upgradesFrom)
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const root of roots) {
    walk(root.id, []);
  }

  return lines;
}

export function buildContentBundle() {
  const structures = normalizeStructures(readCsvFile('structures.csv'));
  const units = normalizeUnits(readCsvFile('units.csv'));
  const technologies = normalizeTechnologies(readCsvFile('technologies.csv'));
  const normalizedCivilizations = normalizeCivilizations(
    readCsvFile('civilizations.csv'),
  );
  const { civilizations, coverage } = annotateCivilizations(
    normalizedCivilizations,
    units,
    technologies,
  );

  return {
    generatedAt: new Date().toISOString(),
    sourceDir: path.resolve(fileURLToPathSafe(STATS_DIR)),
    structures,
    units,
    technologies,
    civilizations,
    coverage,
    indexes: {
      unitsByStructure: buildProducerIndex(
        units.filter((unit) => unit.trainable),
        'trainLocation',
      ),
      technologiesByStructure: buildProducerIndex(technologies, 'developsIn'),
      unitLines: buildUnitLines(units),
    },
  };
}

function fileURLToPathSafe(fileUrl) {
  return decodeURIComponent(fileUrl.pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

export function collectValidationIssues(bundle) {
  const issues = [];
  const structureNames = new Set(bundle.structures.map((entry) => entry.name));

  for (const duplicate of duplicatesFor(bundle.civilizations, 'name')) {
    issues.push({
      severity: 'error',
      code: 'duplicate-civilization',
      message: `Duplicate civilization row: ${duplicate.value} (${duplicate.count})`,
    });
  }

  for (const duplicate of duplicatesFor(bundle.units, 'id')) {
    issues.push({
      severity: 'error',
      code: 'duplicate-unit-id',
      message: `Duplicate normalized unit id: ${duplicate.value} (${duplicate.count})`,
    });
  }

  for (const duplicate of duplicatesFor(bundle.technologies, 'name')) {
    issues.push({
      severity: 'error',
      code: 'duplicate-technology',
      message: `Duplicate technology row: ${duplicate.value} (${duplicate.count})`,
    });
  }

  for (const duplicate of duplicatesFor(bundle.units, 'name')) {
    const matchingUnits = bundle.units.filter((entry) => entry.name === duplicate.value);
    const trainableCount = matchingUnits.filter((entry) => entry.trainable).length;
    if (trainableCount > 1) {
      issues.push({
        severity: 'warn',
        code: 'duplicate-trainable-unit-name',
        message: `Multiple trainable unit rows share the name "${duplicate.value}"`,
      });
    }
  }

  for (const entry of bundle.units) {
    if (entry.trainLocation && !structureNames.has(entry.trainLocation)) {
      issues.push({
        severity: 'warn',
        code: 'unknown-unit-producer',
        message: `Unit "${entry.name}" references missing producer "${entry.trainLocation}"`,
      });
    }
  }

  for (const entry of bundle.technologies) {
    if (entry.developsIn && !structureNames.has(entry.developsIn)) {
      issues.push({
        severity: 'warn',
        code: 'unknown-tech-producer',
        message: `Technology "${entry.name}" references missing building "${entry.developsIn}"`,
      });
    }
  }

  for (const civ of bundle.civilizations) {
    if (
      civ.playable &&
      (civ.missingUniqueUnits.length > 0 || civ.missingUniqueTechs.length > 0)
    ) {
      issues.push({
        severity: 'error',
        code: 'playable-civ-has-missing-unique-content',
        message: `Civilization "${civ.name}" is marked playable but still has missing unique content.`,
      });
    }
  }

  return issues;
}

export function writeGeneratedContent(bundle) {
  const outputDir = new URL('./generated/content/', ROOT);
  fs.mkdirSync(outputDir, { recursive: true });
  const payload = {
    ...bundle,
    issues: collectValidationIssues(bundle),
  };
  fs.writeFileSync(
    new URL('content.json', outputDir),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
}
