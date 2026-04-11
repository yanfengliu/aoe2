export interface ParsedRange {
  min: number | null;
  max: number | null;
  raw: string;
}

export interface ParsedArmor {
  melee: number | null;
  pierce: number | null;
  raw: string;
}

export type CostValue =
  | string
  | number
  | null
  | CostObject
  | CostValue[];

export interface CostObject {
  [key: string]: CostValue;
}

export interface ValidationIssue {
  severity: 'error' | 'warn';
  code: string;
  message: string;
}

export interface NormalizedStructure {
  id: string;
  name: string;
  expansion: string;
  age: string;
  cost: CostObject;
  buildTime: number | null;
  hitPoints: number | null;
  lineOfSight: number | null;
  armor: ParsedArmor | null;
  range: ParsedRange | null;
  reloadTime: number | null;
  attack: number | null;
  special: string;
}

export interface NormalizedUnit {
  id: string;
  name: string;
  description: string;
  expansion: string;
  age: string;
  sourceKind:
    | 'trainable'
    | 'starting-unit'
    | 'gaia'
    | 'scenario-only'
    | 'derived-state';
  trainable: boolean;
  startingUnit: boolean;
  createdIn: string;
  trainLocation: string | null;
  cost: CostObject;
  buildTime: number | null;
  reloadTime: number | null;
  attackDelay: number | null;
  movementRate: number | null;
  lineOfSight: number | null;
  hitPoints: number | null;
  range: ParsedRange | null;
  attack: number | null;
  armor: ParsedArmor | null;
  attackBonus: string[];
  armorBonus: string[];
  searchRadius: number | null;
  accuracyPercent: number | null;
  blastRadius: number | null;
  upgradesFrom: string | null;
  upgradesTo: string[];
}

export interface NormalizedTechnology {
  id: string;
  name: string;
  expansion: string;
  age: string;
  developsIn: string;
  cost: CostObject;
  buildTime: number | null;
  appliesTo: string[];
  description: string;
}

export interface NormalizedCivilization {
  id: string;
  name: string;
  expansion: string;
  armyType: string;
  uniqueUnits: string[];
  uniqueTechs: string[];
  teamBonuses: string[];
  civilizationBonuses: string[];
}

export interface ContentBundle {
  generatedAt: string;
  sourceDir: string;
  structures: NormalizedStructure[];
  units: NormalizedUnit[];
  technologies: NormalizedTechnology[];
  civilizations: NormalizedCivilization[];
  indexes: {
    unitsByStructure: Record<string, string[]>;
    technologiesByStructure: Record<string, string[]>;
    unitLines: string[][];
  };
}

export function splitList(value: string): string[];
export function slugify(value: string): string;
export function parseCostBlob(value: string): CostObject;
export function parseCsv(text: string): Array<Record<string, string>>;
export function buildContentBundle(): ContentBundle;
export function collectValidationIssues(bundle: ContentBundle): ValidationIssue[];
export function writeGeneratedContent(bundle: ContentBundle): void;
