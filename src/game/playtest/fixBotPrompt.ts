import type { OracleViolation } from './types';

const SOURCE_FILES_BY_ORACLE: Record<string, string[]> = {
  'no-pinned-or-oscillating-units': [
    'src/game/simulation/bridge/systems/playerCommandsSystem.ts',
    'src/game/simulation/worldOccupancy.ts',
    'src/game/simulation/worldOccupancyAllocators.ts',
  ],
  'no-tick-failures': [
    'src/game/simulation/createSimulationBridge.ts',
    'src/game/simulation/bridge/systems/aiSystem.ts',
    'src/game/simulation/bridge/systems/aiSystemGating.ts',
    'src/game/simulation/bridge/systems/aiSystemBuildingPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemProductionPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemAttackPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemTypes.ts',
  ],
  'no-perf-regression': [
    'src/game/simulation/createSimulationBridge.ts',
  ],
  'economy-progression': [
    'src/game/simulation/bridge/systems/aiSystem.ts',
    'src/game/simulation/bridge/systems/aiSystemGating.ts',
    'src/game/simulation/bridge/systems/aiSystemBuildingPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemProductionPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemAttackPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemTypes.ts',
    'src/game/simulation/ai.ts',
  ],
  'match-completes': [
    'src/game/simulation/createSimulationBridge.ts',
    'src/game/simulation/bridge/systems/aiSystem.ts',
    'src/game/simulation/bridge/systems/aiSystemGating.ts',
    'src/game/simulation/bridge/systems/aiSystemBuildingPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemProductionPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemAttackPhase.ts',
    'src/game/simulation/bridge/systems/aiSystemTypes.ts',
  ],
};

export function sourceFilesForOracle(oracle: string): string[] {
  return SOURCE_FILES_BY_ORACLE[oracle] ?? [];
}

export interface BuildFixPromptInput {
  violation: OracleViolation;
  envelopeJson: string;
  tickNeighborhoodJson: string;
  sourceFiles: Array<{ path: string; content: string }>;
}

export function buildFixPrompt(input: BuildFixPromptInput): string {
  const { violation, envelopeJson, tickNeighborhoodJson, sourceFiles } = input;
  const sourceBlock = sourceFiles
    .map((f) => `## ${f.path}\n\n\`\`\`ts\n${f.content}\n\`\`\``)
    .join('\n\n');

  const lines: string[] = [
    'You are a senior engineer producing a focused patch.',
    '',
    `## Oracle violation`,
    `- Oracle: ${violation.oracle}`,
    `- Severity: ${violation.severity}`,
    `- Tick: ${violation.tick ?? '(whole-bundle)'}`,
    `- Message: ${violation.message}`,
  ];
  if (violation.details) {
    lines.push(`- Details: ${JSON.stringify(violation.details)}`);
  }
  lines.push(
    '',
    `## Envelope`,
    '```json',
    envelopeJson,
    '```',
    '',
    `## Tick neighborhood`,
    '```json',
    tickNeighborhoodJson,
    '```',
    '',
    `## Source files`,
    '',
    sourceBlock,
    '',
    `## Output format`,
    '',
    'Produce a unified diff in a fenced ```diff block. Explain the fix in 3-5 sentences in a separate fenced ```why block. Do not include any prose outside those two blocks.',
  );
  return lines.join('\n');
}
