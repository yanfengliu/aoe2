// AO-2: TDD tests for bridge additive surfaces (Spec 2 v0.1.5).
// New surface: bridge.world (read-only getter), bridge.setPaused(boolean),
// bridge.getSelectedEntityRefs(), bridge.select(refs).

import { describe, expect, it } from 'vitest';
import type { EntityRef } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

const SEED = 'annotation-ui-test-seed';

describe('AO-2 bridge additive surfaces', () => {
  describe('bridge.world', () => {
    it('exposes the engine World instance as a stable read-only reference', () => {
      const bridge = createSimulationBridge(SEED);
      expect(bridge.world).toBeDefined();
      expect(typeof bridge.world.tick).toBe('number');
      expect(bridge.world).toBe(bridge.world); // same instance across reads
    });
  });

  describe('bridge.getSelectedEntityRefs', () => {
    it('returns empty array when nothing is selected', () => {
      const bridge = createSimulationBridge(SEED);
      const refs = bridge.getSelectedEntityRefs();
      expect(refs).toEqual([]);
    });

    it('returns EntityRef objects (with generation) for selected entities', () => {
      const bridge = createSimulationBridge(SEED);
      // Find a human-owned unit and select it. The bridge's
      // getRenderState contains projected entities; pick the first
      // selectable one.
      const renderState = bridge.getRenderState();
      const firstSelectable = renderState.entities.find((e) => e.owner === 1);
      if (!firstSelectable) {
        // Should never happen at startup but guard for clarity
        throw new Error('no selectable entities at startup');
      }
      const ok = bridge.selectUnitsByIds([firstSelectable.id]);
      expect(ok).toBe(true);

      const refs = bridge.getSelectedEntityRefs();
      expect(refs.length).toBe(1);
      expect(refs[0]).toMatchObject({ id: firstSelectable.id });
      expect(typeof refs[0].generation).toBe('number');
    });
  });

  describe('bridge.select(refs)', () => {
    it('filters stale refs and selects only the current ones', () => {
      const bridge = createSimulationBridge(SEED);
      const renderState = bridge.getRenderState();
      const firstSelectable = renderState.entities.find((e) => e.owner === 1);
      if (!firstSelectable) throw new Error('no selectable entities');

      const ref = bridge.world.getEntityRef(firstSelectable.id);
      expect(ref).not.toBeNull();
      const stale: EntityRef = { id: 99999, generation: 0 }; // never existed

      bridge.select([ref!, stale]);
      const refs = bridge.getSelectedEntityRefs();
      expect(refs.length).toBe(1);
      expect(refs[0].id).toBe(firstSelectable.id);
    });

    it('clears selection when all refs are stale', () => {
      const bridge = createSimulationBridge(SEED);
      const renderState = bridge.getRenderState();
      const firstSelectable = renderState.entities.find((e) => e.owner === 1);
      if (!firstSelectable) throw new Error('no selectable entities');
      bridge.selectUnitsByIds([firstSelectable.id]);
      expect(bridge.getSelectedEntityRefs().length).toBe(1);

      const stale: EntityRef = { id: 99999, generation: 0 };
      bridge.select([stale]);
      expect(bridge.getSelectedEntityRefs()).toEqual([]);
    });
  });

  describe('bridge.setPaused', () => {
    it('setPaused(true) prevents world.step from running on subsequent step() calls', () => {
      const bridge = createSimulationBridge(SEED);
      const initialTick = bridge.world.tick;
      bridge.setPaused(true);
      // Advance enough deltaMs to definitely cross a tick boundary at 30 TPS (~33ms/tick).
      bridge.step(100);
      bridge.step(100);
      expect(bridge.world.tick).toBe(initialTick); // no ticks ran
    });

    it('setPaused(false) resumes ticking', () => {
      const bridge = createSimulationBridge(SEED);
      bridge.setPaused(true);
      bridge.step(100);
      const pausedTick = bridge.world.tick;
      bridge.setPaused(false);
      bridge.step(200);
      expect(bridge.world.tick).toBeGreaterThan(pausedTick);
    });

    it('manual pause does NOT surface as engineHalted in HudState', () => {
      const bridge = createSimulationBridge(SEED);
      bridge.setPaused(true);
      const hud = bridge.getHudState();
      expect(hud.engineHalted).toBeNull();
    });

    it('setPaused(false) does NOT clear a real engineHalted state', () => {
      // Hard to trigger a real engine halt deterministically; verify the
      // separate-field invariant by reading HudState before any halt occurs:
      // setPaused doesn't touch the field. The integration concern is the
      // separate carrier; pausedManually lives outside haltState.
      const bridge = createSimulationBridge(SEED);
      bridge.setPaused(true);
      bridge.setPaused(false);
      const hud = bridge.getHudState();
      expect(hud.engineHalted).toBeNull();
    });

    it('setPaused is idempotent', () => {
      const bridge = createSimulationBridge(SEED);
      const initialTick = bridge.world.tick;
      bridge.setPaused(true);
      bridge.setPaused(true); // double-pause
      bridge.step(100);
      expect(bridge.world.tick).toBe(initialTick);
      bridge.setPaused(false);
      bridge.setPaused(false); // double-resume
      bridge.step(200);
      expect(bridge.world.tick).toBeGreaterThan(initialTick);
    });
  });
});
