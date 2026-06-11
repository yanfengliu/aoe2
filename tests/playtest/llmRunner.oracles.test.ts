import { describe, it, expect } from 'vitest';
import { runLlmPlaytest } from '../../src/game/playtest/llmRunner';
import { MockProvider } from '../../src/game/playtest/llmProviders';
import {
  MIN_BUNDLE,
  STRATEGY_OK,
  StubHost,
  TACTICAL_OK_NO_COMMANDS,
  TACTICAL_OK_ONE_COMMAND,
  makeAgent,
} from './llmRunnerTestKit';

describe('runLlmPlaytest — oracle wiring (checkpoints, screenshots, winner)', () => {
  // Phase-6.C.1: checkpoint screenshots are captured at any baseline
  // tick the loop's advance crosses. Verify the captures land in
  // result.checkpointScreenshots in tick-ascending order.
  it('captures checkpoint screenshots at baselineCheckpointTicks the advance crosses', async () => {
    const host = new StubHost(MIN_BUNDLE);
    let captureCount = 0;
    host.captureScreenshot = async () => {
      captureCount += 1;
      return new Uint8Array([captureCount]);
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 1000,
        decisionIntervalTicks: 250,
        screenshotEnabled: true,
        baselineCheckpointTicks: [250, 500, 1000],
      },
    });
    expect(result.checkpointScreenshots.map((e) => e.tick)).toEqual([250, 500, 1000]);
    // Each entry has non-empty bytes (counter-stub returns one byte
    // per call; we don't assert exact ordering of decision vs
    // checkpoint captures, only that the field is populated).
    for (const e of result.checkpointScreenshots) {
      expect(e.pngBytes.byteLength).toBeGreaterThan(0);
    }
  });

  it('omits checkpointScreenshots when baselineCheckpointTicks is empty', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: true,
        // baselineCheckpointTicks omitted
      },
    });
    expect(result.checkpointScreenshots).toEqual([]);
  });

  it('skips checkpoint capture when screenshotEnabled is false', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 500,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
        baselineCheckpointTicks: [250, 500],
      },
    });
    expect(result.checkpointScreenshots).toEqual([]);
  });

  // Phase-6.C.2 (Codex impl-1 MED 1, impl-2 LOW): finalScreenshotPng
  // must be the post-loop capture, not the last in-loop pre-advance
  // capture. Verify by handing the runner a counter-returning
  // captureScreenshot stub and asserting the result matches the
  // LAST call (post-loop) rather than any earlier loop call.
  it('returns the post-loop screenshot, not the pre-advance one from the last decision', async () => {
    const host = new StubHost(MIN_BUNDLE);
    let captureCount = 0;
    host.captureScreenshot = async () => {
      captureCount += 1;
      return new Uint8Array([captureCount]);
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 500,
        decisionIntervalTicks: 250,
        screenshotEnabled: true,
      },
    });
    // 2 in-loop decisions + 1 post-loop = 3 total captures.
    // result.finalScreenshotPng must reflect the LAST (3rd) call.
    expect(captureCount).toBe(3);
    expect(result.finalScreenshotPng).toEqual(new Uint8Array([3]));
  });

  // The post-loop capture is skipped when screenshots are disabled —
  // the in-loop fallback is undefined in that case (no screenshot
  // ever taken).
  it('finalScreenshotPng is undefined when screenshotEnabled=false', async () => {
    const host = new StubHost(MIN_BUNDLE);
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.finalScreenshotPng).toBeUndefined();
  });

  // Phase-6.D: winner-oracle scoring is invoked on clean exit and
  // surfaces in the envelope. NOT invoked on engineHalt (page may be
  // destabilized). Don't assert the exact winner kind here — the
  // scoring function has its own unit tests; just verify the field
  // shows up.
  it('attaches winner result to envelope on clean exit', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.getEntityCountsByOwner = async () => ({
      1: { units: 5, buildings: 2 },
      2: { units: 0, buildings: 0 },
    });
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.winner).toEqual({ kind: 'winner', ownerId: 1 });
  });

  it('omits winner field on engineHalt (page may be destabilized)', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.failOn = 'dispatchCommand';
    let countProbed = false;
    host.getEntityCountsByOwner = async () => {
      countProbed = true;
      return {};
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_ONE_COMMAND },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    expect(result.envelope.winner).toBeUndefined();
    expect(countProbed).toBe(false);
  });

  // Phase-6.D (Codex impl-1 MED 1b / Claude impl-1 IMPORTANT):
  // exportBundle throwing AFTER a successful winner probe must NOT
  // leak the winner field into the resulting engineHalt envelope.
  // The runner re-checks stopReason at envelope-build time and drops
  // winner if it's been escalated to engineHalt.
  it('drops winner field when exportBundle throws after a successful score', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.getEntityCountsByOwner = async () => ({
      1: { units: 5, buildings: 2 },
      2: { units: 0, buildings: 0 },
    });
    host.exportBundle = async () => {
      throw new Error('blob fetch failed');
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    expect(result.envelope.errorMessage).toMatch(/blob fetch failed/);
    expect(result.envelope.winner).toBeUndefined();
  });

  // Phase-6.D (Codex impl-1 MED 1a): count probe failure on a clean
  // exit escalates to engineHalt. Without this, the contract "winner
  // populated unless engineHalt" would silently break for probe-failure
  // cases.
  it('escalates a count-probe failure on clean exit to engineHalt', async () => {
    const host = new StubHost(MIN_BUNDLE);
    host.getEntityCountsByOwner = async () => {
      throw new Error('page disconnected');
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 250,
        decisionIntervalTicks: 250,
        screenshotEnabled: false,
      },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    expect(result.envelope.errorMessage).toMatch(/winner-oracle count probe failed/);
    expect(result.envelope.winner).toBeUndefined();
  });

  // On clean exit (maxTicks/stopWhen), a post-loop screenshot failure
  // is real harness regression — surface as engineHalt rather than
  // silently ship the stale in-loop screenshot to the oracle.
  it('escalates a post-loop screenshot failure on clean exit to engineHalt', async () => {
    const host = new StubHost(MIN_BUNDLE);
    let callIdx = 0;
    host.captureScreenshot = async () => {
      callIdx += 1;
      if (callIdx <= 2) return new Uint8Array([callIdx]); // in-loop captures
      throw new Error('playwright disconnected'); // post-loop call
    };
    const provider = new MockProvider({
      responses: [
        { content: STRATEGY_OK },
        { content: TACTICAL_OK_NO_COMMANDS },
        { content: TACTICAL_OK_NO_COMMANDS },
      ],
    });
    const result = await runLlmPlaytest({
      host,
      agent: makeAgent(provider),
      config: {
        ownerId: 2,
        maxTicks: 500,
        decisionIntervalTicks: 250,
        screenshotEnabled: true,
      },
    });
    expect(result.envelope.stopReason).toBe('engineHalt');
    expect(result.envelope.errorMessage).toMatch(/final-screenshot capture failed/);
  });
});
