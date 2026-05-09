import { describe, expect, it } from 'vitest';
import { runPlaytest } from '../../src/game/playtest/runPlaytest';

describe('runPlaytest', () => {
  it('runs the bridge for maxTicks ticks and emits a well-formed bundle + envelope', async () => {
    const { bundle, envelope } = await runPlaytest({
      seed: 'default-seed',
      maxTicks: 200,
    });

    // Envelope shape
    expect(envelope.stopReason).toBe('maxTicks');
    expect(envelope.ticksRun).toBeGreaterThan(0);
    expect(envelope.ticksRun).toBeLessThanOrEqual(200);
    expect(envelope.seed).toBe('default-seed');
    expect(typeof envelope.runStartedAt).toBe('string');
    expect(typeof envelope.runCompletedAt).toBe('string');

    // Bundle shape
    expect(bundle.ticks.length).toBeGreaterThan(0);
    expect(bundle.metadata.engineVersion).toBeTruthy();
    expect(bundle.metadata.startTick).toBe(0);
    expect(bundle.initialSnapshot).toBeDefined();
  });

  it('uses sourceKind="synthetic" so downstream tooling distinguishes from live sessions', async () => {
    const { bundle } = await runPlaytest({
      seed: 'default-seed',
      maxTicks: 50,
    });
    expect(bundle.metadata.sourceKind).toBe('synthetic');
    expect(bundle.metadata.sourceLabel).toBe('aoe2-playtest-default-seed');
  });

  it('records the snapshot at the recorder start tick', async () => {
    const { bundle } = await runPlaytest({
      seed: 'default-seed',
      maxTicks: 50,
    });
    expect(bundle.initialSnapshot.tick).toBe(bundle.metadata.startTick);
  });
});
