import { describe, expect, it, vi } from 'vitest';
import { createPauseControl } from '../../src/game/control/PauseControl';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

const stubBridge = (): { bridge: SimulationBridge; setPaused: ReturnType<typeof vi.fn> } => {
  const setPaused = vi.fn();
  const bridge = { setPaused } as unknown as SimulationBridge;
  return { bridge, setPaused };
};

describe('PauseControl', () => {
  it('pause / resume drives bridge.setPaused with the correct boolean', () => {
    const { bridge, setPaused } = stubBridge();
    const pc = createPauseControl(() => bridge);
    pc.pause();
    expect(setPaused).toHaveBeenCalledWith(true);
    pc.resume();
    expect(setPaused).toHaveBeenCalledWith(false);
  });

  it('isPaused reflects the local cached state', () => {
    const { bridge } = stubBridge();
    const pc = createPauseControl(() => bridge);
    expect(pc.isPaused()).toBe(false);
    pc.pause();
    expect(pc.isPaused()).toBe(true);
    pc.resume();
    expect(pc.isPaused()).toBe(false);
  });

  it('idempotent on repeat pause / resume', () => {
    const { bridge, setPaused } = stubBridge();
    const pc = createPauseControl(() => bridge);
    pc.pause();
    pc.pause();
    expect(setPaused).toHaveBeenCalledTimes(1);
    expect(setPaused).toHaveBeenLastCalledWith(true);
    pc.resume();
    pc.resume();
    expect(setPaused).toHaveBeenCalledTimes(2);
    expect(setPaused).toHaveBeenLastCalledWith(false);
  });

  it('bridgeRef indirection survives a bridge swap', () => {
    const a = stubBridge();
    const b = stubBridge();
    let live = a.bridge;
    const pc = createPauseControl(() => live);
    pc.pause();
    expect(a.setPaused).toHaveBeenCalledWith(true);
    expect(b.setPaused).not.toHaveBeenCalled();
    // simulate a bridge swap (FU5-style): point bridgeRef at b
    live = b.bridge;
    pc.resume();
    expect(b.setPaused).toHaveBeenCalledWith(false);
  });
});
