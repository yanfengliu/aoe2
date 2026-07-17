import {
  buildVisualPlaytestPrompt,
  minimalImprovementFindingSchemaVersion,
  improvementFindingToMarker,
  visualPlaytestFindingToMarker,
  type ImprovementFinding,
  type VisualPlaytestControl,
  type VisualPlaytestFinding,
  type VisualPlaytestFindingCategory,
  type VisualPlaytestObservation,
  type VisualPlaytestStateChannel,
} from 'civ-engine';

import type { AoeJsonValue } from '../annotations/markerSchema';
import type { ConformanceFinding } from './conformanceProbe';
import type { AgentStateSnapshot, LlmToolSchema } from './types';

export interface BuildTacticalVisualPlaytestHeaderInput {
  snapshot: AgentStateSnapshot;
  ownerId: number;
  hasScreenshot: boolean;
  tools: readonly LlmToolSchema[];
}

export function buildTacticalVisualPlaytestHeader(
  input: BuildTacticalVisualPlaytestHeaderInput,
): string {
  return [
    buildVisualPlaytestPrompt({
      observation: buildTacticalVisualPlaytestObservation(input),
      mode: 'playerBlind',
      objective: `Play as player ${input.ownerId} through the AoE2 command tools and player-visible evidence.`,
    }),
    '',
    'AoE2 tactical state JSON:',
  ].join('\n');
}

export function buildTacticalVisualPlaytestObservation(
  input: BuildTacticalVisualPlaytestHeaderInput,
): VisualPlaytestObservation {
  const { snapshot, ownerId, hasScreenshot, tools } = input;
  const screen = snapshot.screenMapping.pixelBbox;
  const player = snapshot.perPlayer.find((p) => p.ownerId === ownerId);
  const visibleText = [
    `Player ${ownerId} tick ${snapshot.tick} (${snapshot.elapsedMmSs})`,
    player
      ? `HUD resources: ${formatResources(player.resources)}; age ${player.age}; population ${player.populationCurrent}/${player.populationCap}`
      : 'HUD resources: player row unavailable in snapshot',
    `Visible counts: ${snapshot.ownUnits.length} own units; ${snapshot.ownBuildings.length} own buildings; ${snapshot.nearbyResources.length} nearby resources; ${snapshot.enemies.length} enemies`,
    `Selection: ${snapshot.selection.length}; queued production buildings: ${snapshot.queuedProduction.length}`,
  ];
  const controls = tools.map(toolToVisualPlaytestControl);
  const state: VisualPlaytestStateChannel[] = [
    {
      label: 'Structured AoE2 snapshot',
      audience: 'agent',
      summary: 'Full per-player, entity, resource, production, camera, and affordance JSON follows this shared header.',
      redaction: 'channel',
    },
  ];

  return {
    ...(hasScreenshot
      ? {
          screenshot: {
            path: '[attached image block]',
            mime: 'image/png',
            width: screen.width,
            height: screen.height,
            alt: `AoE2 tactical canvas for player ${ownerId} at tick ${snapshot.tick}`,
          },
        }
      : {}),
    visibleText,
    controls,
    state,
    metadata: {
      schemaVersion: 1,
      source: 'aoe2.llmPromptBuilder',
      ownerId,
      tick: snapshot.tick,
    },
  };
}

export interface ConformanceVisualPlaytestContext {
  anchorTick: number;
  findingIndex?: number;
}

const FINDING_CATEGORY_MAP: Record<ConformanceFinding['category'], VisualPlaytestFindingCategory> = {
  'missing-feature': 'opportunity',
  'spec-divergence': 'rules',
  'functional-bug': 'bug',
  'balance-divergence': 'rules',
  'ux-gap': 'usability',
};

export function conformanceFindingToVisualPlaytestFinding(
  finding: ConformanceFinding,
  ctx: ConformanceVisualPlaytestContext,
): VisualPlaytestFinding {
  return {
    title: `${finding.category} - ${finding.area}`,
    severity: finding.severity,
    category: FINDING_CATEGORY_MAP[finding.category],
    area: finding.area,
    observed: finding.observed,
    expected: finding.expected,
    suggestion: finding.suggestion,
    evidence: { tick: ctx.anchorTick },
    data: { aoe2FindingCategory: finding.category },
  };
}

export function conformanceFindingToImprovementFinding(
  finding: ConformanceFinding,
  ctx: ConformanceVisualPlaytestContext,
): ImprovementFinding {
  return {
    schemaVersion: minimalImprovementFindingSchemaVersion('proposalOnly'),
    id: [
      'aoe2-conformance',
      slugIdPart(finding.category),
      slugIdPart(finding.area),
      String(ctx.anchorTick),
      ...(ctx.findingIndex !== undefined ? [String(ctx.findingIndex)] : []),
    ].join('-'),
    title: `${finding.category} - ${finding.area}`,
    severity: finding.severity,
    category: FINDING_CATEGORY_MAP[finding.category],
    area: finding.area,
    observed: finding.observed,
    expected: finding.expected,
    suggestion: finding.suggestion,
    evidence: [{ kind: 'tick', tick: ctx.anchorTick }],
    verificationStatus: 'unverified',
    nextAction: 'proposalOnly',
    data: { aoe2FindingCategory: finding.category },
  };
}

export interface ConformanceFindingSharedPayloads {
  visualPlaytest?: AoeJsonValue;
  improvementLoop?: AoeJsonValue;
}

export function sharedPayloadsForConformanceFinding(
  finding: ConformanceFinding,
  ctx: ConformanceVisualPlaytestContext,
): ConformanceFindingSharedPayloads {
  const visualMarker = visualPlaytestFindingToMarker(
    conformanceFindingToVisualPlaytestFinding(finding, ctx),
  );
  const improvementMarker = improvementFindingToMarker(
    conformanceFindingToImprovementFinding(finding, ctx),
  );
  return {
    ...(payloadField(visualMarker.data, 'visualPlaytest') !== undefined
      ? { visualPlaytest: payloadField(visualMarker.data, 'visualPlaytest') }
      : {}),
    ...(payloadField(improvementMarker.data, 'improvementLoop') !== undefined
      ? { improvementLoop: payloadField(improvementMarker.data, 'improvementLoop') }
      : {}),
  };
}

function toolToVisualPlaytestControl(tool: LlmToolSchema): VisualPlaytestControl {
  return {
    id: tool.name,
    label: `Tool: ${tool.name}`,
    actionKinds: ['select'],
    target: `tool:${tool.name}`,
    enabled: true,
  };
}

function formatResources(resources: { wood: number; food: number; gold: number; stone: number }): string {
  return `wood ${resources.wood}, food ${resources.food}, gold ${resources.gold}, stone ${resources.stone}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function payloadField(value: unknown, key: string): AoeJsonValue | undefined {
  if (!isRecord(value)) return undefined;
  const payload = value[key];
  return isAoeJsonValue(payload) ? payload : undefined;
}

function slugIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function isAoeJsonValue(value: unknown): value is AoeJsonValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isAoeJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isAoeJsonValue);
}
