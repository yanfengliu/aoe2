import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createAiIntentionPushers } from '../../src/game/simulation/bridge/aiIntentionPushers';
import type { BridgeState } from '../../src/game/simulation/bridge/bridgeState';
import { AI_PURCHASE_COMMANDS, AiPurchases, splitPurchaseCommands } from '../../src/game/simulation/bridge/systems/aiPurchases';

// GATE (work 141 M2a-2a, plan 141): every purchase the computer asks for goes
// through one function, `AiPurchases.buy` (src/game/simulation/bridge/systems/
// aiPurchases.ts), which checks it against the decision's budget once DE's
// escrow opens one, and counts it. The class this retires: M2a-1's budget was a
// check each purchase path had to remember to consult, and review rounds 6 to 9
// each found one that skipped it (the Trade Cart; the tribute and the Town
// Center's next age, Market trade and villager; an in-flight age-up and a
// refused trade counted as spent; a trade asked for uncounted).
//
// Three checks. (1) No file under src/ names one of the five purchase commands
// (the pushers that queue a unit, a technology, a building, a Market trade or a
// tribute) outside the choke point and the bridge wiring that hands them to it;
// and no AI file but the bridge's pusher factory pushes onto the pending queue,
// submits a command to the world itself, or names a purchase command's type
// anywhere but in a comparison (review round 11 found both of the last two
// unrefused); no other file names a purchase command type but those listed,
// which define, handle, describe or submit it for the human (rounds 14 and 15:
// a shared helper an AI phase calls); and none but the escrow phase opens the
// decision's budget. (2)
// Every pusher the bridge makes that queues a purchase command is in the choke
// point's list, so a sixth cannot be added beside the five unseen. (3) The
// dependencies the phases get hold none of the five, and not the pending queue,
// whose commands could be rewritten in place; and the purchase point shows the
// phases `buy` and `openBudget` and nothing else, its commands and budget in ES
// private members (review round 12 reached them with `purchases['ask']`, which
// TypeScript allows for a `private` member, with no cast), and is frozen, so
// no phase can put its own method in place of either (round 13).
//
// Bound: these checks are aimed at a purchase path that does not know of the
// point, which is how the budget leaked in rounds 6 to 9, and they do not
// close that class: a listed file is exempt whole, so a helper extracted
// inside one, or exported beside the pushers in aiIntentionPushers.ts, and
// called from an AI phase still passes (review round 16, R16-1, open with the
// coordinator past the repair cap). They are no defence against code written
// to defeat the point either, and none is claimed: a patched
// `DecisionBudget.prototype`, a command type built at run time ('queue' +
// '.train'), a submission reached under another name, or state written in
// place through the world or the accessor, which is no purchase command at all.
// (1) is LEXICAL, comments stripped. (2) knows the five purchase command types
// below; a new KIND of purchase command must be added to them.

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const PURCHASE_COMMAND_TYPES = ['queue.train', 'queue.research', 'building.placeConfirm', 'market.action', 'tribute.send'];
const FACTORY = 'src/game/simulation/bridge/aiIntentionPushers.ts';

// Where the five may be named: the choke point, the factory that makes them,
// and the wiring that hands them to the AI system.
const ALLOWED = new Set([
  'src/game/simulation/bridge/systems/aiPurchases.ts',
  FACTORY,
  'src/game/simulation/bridge/registerBridgeSystems.ts',
  'src/game/simulation/bridge/registerAllSystems.ts',
  'src/game/simulation/bridge/registerAllSystemsTypes.ts',
]);

const TYPES = PURCHASE_COMMAND_TYPES.join('|').replaceAll('.', String.raw`\.`);
const NAMED = new RegExp(String.raw`\b(?:${AI_PURCHASE_COMMANDS.join('|')})\b`, 'g');
const QUEUED = new RegExp(
  [
    String.raw`\bpendingCommands\b[^;\n]*?\.\s*push\s*\(`,
    String.raw`\.\s*submit(?:WithResult)?\s*\(`,
    String.raw`(?<![=!]==\s*)['"\x60](?:${TYPES})['"\x60]`,
  ].join('|'),
  'g',
);

// Verbatim from main before the choke point (c103f8f3), the Trade Cart of
// review round 6 and the tribute and Town Center purchases of round 7 among
// them, then the shapes a new bypass would take, review round 11's two among
// them. Each must be refused.
const KNOWN_BAD_NAMED: readonly string[] = [
  'const { world, accessor, pushQueueTrainIntention, pushUnitContextAtEntityIntention, getTrainOptions, countQueuedUnits } = deps;',
  "  pushQueueTrainIntention(marketId, 'trade-cart');",
  '  const { world, accessor, pushTributeIntention } = deps;',
  '      pushTributeIntention(owner, other, resource, AI_TRIBUTE_CHUNK);',
  '    pushQueueResearchIntention(ownerTownCenterId, nextAge);',
  '      pushMarketActionIntention(owner, trade);',
  "    pushQueueTrainIntention(ownerTownCenterId, 'villager');",
  "        pushBuildingPlaceConfirmIntention(builderId, 'wonder', anchor);",
  "(deps as unknown as AiSystemDeps).pushQueueTrainIntention(castleId, 'trebuchet');",
];
const KNOWN_BAD_QUEUED: readonly string[] = [
  "deps.pendingCommands.push({ type: 'queue.train', data: { buildingId, unitType: 'monk' } });",
  '(deps.pendingCommands as Array<unknown>).push(command);',
  "const command = { type: 'market.action', data: { playerId: owner, actionType } };",
  "deps.world.submitWithResult('queue.train', {\n    buildingId: marketId, unitType: 'trade-cart',\n  });",
  'activeWorld.submit(command.type, command.data);',
  "const last = queue[queue.length - 1]!;\n  last.type = 'tribute.send';",
  "Object.assign(pending, { type: `queue.research`, data: { buildingId, technologyType: 'conscription' } });",
];
// The shapes the AI uses and must keep: the purchase point, a read of the queue
// by type, and a non-purchase intention.
const KNOWN_GOOD: readonly string[] = [
  "purchases.buy({ kind: 'train', buildingId: marketId, unit: 'trade-cart', price: cost });",
  "if (cmd.type === 'queue.train') {",
  "if (command.type !== 'building.placeConfirm') continue;",
  'pushUnitContextAtEntityIntention(id, nearest.id, false);',
  'submitUnitAttackIntention(id, targetTownCenterId, ' + "'building');",
];

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx|mjs|js)$/.test(entry)) found.push(path);
  }
  return found;
}

const repoPath = (file: string): string => relative(ROOT, file).split('\\').join('/');
const isAiFile = (file: string): boolean => repoPath(file).startsWith('src/game/simulation/') && basename(file).startsWith('ai');
const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;
const refused = (pattern: RegExp, line: string): boolean => withoutComments(line).match(pattern) !== null;

describe('every AI purchase goes through the purchase point (work 141 M2a-2a)', () => {
  it('scans a real tree that holds the purchase point (non-vacuous)', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(200);
    expect(files.filter(isAiFile).length).toBeGreaterThan(20);
    const point = readFileSync(join(SRC, 'game/simulation/bridge/systems/aiPurchases.ts'), 'utf8');
    expect(point).toContain('buy(purchase: AiPurchase');
    expect(withoutComments(point).match(NAMED)?.length).toBeGreaterThanOrEqual(AI_PURCHASE_COMMANDS.length);
  });

  it('refuses every known shape of a bypass, and none of the shapes the AI uses', () => {
    expect(KNOWN_BAD_NAMED.filter((line) => !refused(NAMED, line))).toEqual([]);
    expect(KNOWN_BAD_QUEUED.filter((line) => !refused(QUEUED, line))).toEqual([]);
    expect(KNOWN_GOOD.filter((line) => refused(NAMED, line) || refused(QUEUED, line))).toEqual([]);
  });

  it('names no purchase command outside the purchase point and the bridge wiring', () => {
    const offences: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (ALLOWED.has(repoPath(file))) continue;
      const text = withoutComments(readFileSync(file, 'utf8'));
      for (const match of text.matchAll(NAMED)) {
        offences.push(`${repoPath(file)}:${lineOf(text, match.index ?? 0)} names ${match[0]}: buy through ctx.purchases (aiPurchases.ts)`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('queues, submits or names no purchase command from an AI file but the bridge factory', () => {
    const offences: string[] = [];
    for (const file of sourceFiles(SRC).filter(isAiFile)) {
      if (repoPath(file) === FACTORY) continue;
      const text = withoutComments(readFileSync(file, 'utf8'));
      for (const match of text.matchAll(QUEUED)) {
        offences.push(`${repoPath(file)}:${lineOf(text, match.index ?? 0)} "${match[0]}": buy through ctx.purchases (aiPurchases.ts)`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('names a purchase command type outside the AI only where it is defined, handled, submitted for the human or described', () => {
    // Any file, not only an AI one: a shared helper an AI phase calls is an
    // ordinary way to buy without knowing of the point, and it names the type
    // it submits however it builds the command (review rounds 14 and 15). The
    // list is exact both ways, so a new file that names a purchase command must
    // be looked at, and one that stops naming it leaves the list.
    const NAMES_TYPE = new RegExp(String.raw`['"\x60](?:${TYPES})['"\x60]`, 'g');
    const known = new Set([
      // The command types and their handlers and validators.
      'src/game/simulation/commands.ts',
      'src/game/simulation/bridge/registerCommandHandlers.ts',
      'src/game/simulation/bridge/pendingCommandQuery.ts',
      'src/game/simulation/handlers/building/buildingPlaceConfirmHandler.ts',
      'src/game/simulation/handlers/building/buildingPlaceConfirmValidator.ts',
      'src/game/simulation/handlers/market/marketActionHandler.ts',
      'src/game/simulation/handlers/market/marketActionValidator.ts',
      'src/game/simulation/handlers/queue/queueResearchHandler.ts',
      'src/game/simulation/handlers/queue/queueResearchValidator.ts',
      'src/game/simulation/handlers/queue/queueTrainHandler.ts',
      'src/game/simulation/handlers/queue/queueTrainValidator.ts',
      // The human's own purchases.
      'src/game/simulation/bridge/humanInputOps.ts',
      'src/game/simulation/bridge/placementOps.ts',
      'src/game/simulation/bridge/tributeOps.ts',
      // The LLM playtest agent's command vocabulary and its oracle.
      'src/app/bootstrap/agentCommandValidator.ts',
      'src/game/playtest/llmPromptBuilder.ts',
      'src/game/playtest/pinnedUnitsOracle.ts',
    ]);
    const helpers = [
      "  world.submitWithResult('queue.train', { buildingId, unitType });",
      "  const command = {\n    type: 'queue.train' as const,\n    data: { buildingId, unitType },\n  };\n  world.submitWithResult(command.type, command.data);",
    ];
    expect(helpers.filter((line) => !refused(NAMES_TYPE, line))).toEqual([]);
    expect(refused(NAMES_TYPE, 'const result = world.submitWithResult(cmd.type, cmd.data);')).toBe(false);
    const namers = new Set<string>();
    const offences: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (isAiFile(file)) continue; // held by the AI files' own check above
      const text = withoutComments(readFileSync(file, 'utf8'));
      for (const match of text.matchAll(NAMES_TYPE)) {
        if (known.has(repoPath(file))) namers.add(repoPath(file));
        else offences.push(`${repoPath(file)}:${lineOf(text, match.index ?? 0)} names ${match[0]}: the computer buys through ctx.purchases (aiPurchases.ts)`);
      }
    }
    expect(offences).toEqual([]);
    expect(namers, 'a listed file no longer names a purchase command: take it off the list').toEqual(known);
  });

  it('opens the decision budget from the escrow phase alone', () => {
    // The name anywhere, so `purchases['openBudget']` counts too (review round 13).
    const OPENS = /\bopenBudget\b/g;
    const allowed = new Set(['src/game/simulation/bridge/systems/aiEscrowPhase.ts', 'src/game/simulation/bridge/systems/aiPurchases.ts']);
    expect(refused(OPENS, 'purchases.openBudget({ holding: false } as never);')).toBe(true);
    expect(refused(OPENS, "purchases['openBudget']({ holding: false } as never);")).toBe(true);
    expect(refused(OPENS, 'const open = ctx.purchases.openBudget.bind(ctx.purchases);')).toBe(true);
    const opened: string[] = [];
    const offences: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = withoutComments(readFileSync(file, 'utf8'));
      for (const match of text.matchAll(OPENS)) {
        if (allowed.has(repoPath(file))) opened.push(repoPath(file));
        else offences.push(`${repoPath(file)}:${lineOf(text, match.index ?? 0)} opens the decision budget: only the escrow phase does`);
      }
    }
    expect(offences).toEqual([]);
    expect(opened, 'the escrow phase opens no budget').toContain('src/game/simulation/bridge/systems/aiEscrowPhase.ts');
  });

  it('shows the phases buy and openBudget, and nothing else of the purchase point, and lets none replace them', () => {
    // Reflect.ownKeys, so a method under a symbol shows too (review round 13).
    expect(Reflect.ownKeys(AiPurchases.prototype).map(String).sort()).toEqual(['buy', 'constructor', 'openBudget']);
    const point = new AiPurchases({} as never, {} as never, 2, undefined);
    expect(Reflect.ownKeys(point).map(String), 'an own property a phase can reach by name').toEqual([]);
    expect(Object.isFrozen(point), 'a phase can put its own openBudget on the point').toBe(true);
    expect(Object.isFrozen(AiPurchases.prototype), 'a phase can replace buy for every decision').toBe(true);
    expect(() => { (point as unknown as { openBudget: unknown }).openBudget = () => undefined; }).toThrow(TypeError);
  });

  it('lists every bridge pusher that queues a purchase command', () => {
    const state = { pendingCommands: [] } as unknown as BridgeState;
    const pushers = createAiIntentionPushers({ state }) as unknown as Record<string, unknown>;
    const queuesPurchase = new Map<string, boolean>();
    for (const [name, pusher] of Object.entries(pushers)) {
      if (typeof pusher !== 'function') continue;
      state.pendingCommands.length = 0;
      (pusher as (...args: unknown[]) => unknown)(1, 2, 3, 4);
      queuesPurchase.set(name, state.pendingCommands.some((command) => PURCHASE_COMMAND_TYPES.includes(command.type)));
    }
    expect(queuesPurchase.size, 'the factory made no pushers to check').toBeGreaterThan(AI_PURCHASE_COMMANDS.length);
    const queuing = [...queuesPurchase].filter(([, queues]) => queues).map(([name]) => name).sort();
    expect(queuing).toEqual([...AI_PURCHASE_COMMANDS].sort());
  });

  it('hands the phases dependencies without a purchase command or the pending queue', () => {
    const all = Object.fromEntries([...AI_PURCHASE_COMMANDS, 'pendingCommands', 'world', 'accessor'].map((key) => [key, () => key]));
    const { commands, pendingCommands, deps } = splitPurchaseCommands(all as never) as unknown as {
      commands: Record<string, unknown>;
      pendingCommands: unknown;
      deps: Record<string, unknown>;
    };
    expect(Object.keys(deps).sort()).toEqual(['accessor', 'world']);
    expect(Object.keys(commands).sort()).toEqual([...AI_PURCHASE_COMMANDS].sort());
    expect(pendingCommands).toBe(all.pendingCommands);
  });
});
