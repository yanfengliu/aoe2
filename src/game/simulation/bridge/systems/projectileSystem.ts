// Projectile flight resolution (spec §10.4). One job: every tick, land the
// shots whose impact tick has arrived.
//
// Ordering matters. This runs AFTER the systems that launch shots
// (`prototypePlayerCommands`, `prototypeTowerCombat`), so a projectile fired
// this tick is never resolved on the same tick it was launched — flight time
// is always observable, and a point-blank shot still spends a tick in the air.

import type { UnitType } from '../../types';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { combatStatesCodec, projectilesCodec } from '../bridgeStateSerialize';
import { resolveDueProjectiles } from '../projectileOps';
import type { GameWorld } from '../pureHelpers';

interface PlayerScoreCountersLike {
  unitsKilled: number;
}

export interface ProjectileSystemDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  damageBuilding: (
    buildingId: number,
    damage: number,
    attackerUnitType: UnitType | null,
    attackerOwner: number,
  ) => boolean;
  destroyUnitEntity: (id: number) => void;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
  markOutOfBandRenderChange: () => void;
  /** Called once per pass if any unit died — a dead unit stops seeing. */
  refreshVisibilityAfterCombat: () => void;
  isMatchRunning: () => boolean;
}

export function registerProjectileSystem(deps: ProjectileSystemDeps): void {
  const {
    world,
    accessor,
    damageBuilding,
    destroyUnitEntity,
    ensurePlayerScoreCounters,
    markOutOfBandRenderChange,
    refreshVisibilityAfterCombat,
    isMatchRunning,
  } = deps;

  world.registerSystem({
    name: 'prototypeProjectiles',
    phase: 'update',
    after: ['prototypePlayerCommands', 'prototypeTowerCombat'],
    execute(activeWorld) {
      if (!isMatchRunning()) return;
      const slot = accessor.get(projectilesCodec);
      if (slot.inFlight.length === 0) return;

      const before = slot.inFlight.length;
      const killedAnyUnit = resolveDueProjectiles({
        world: activeWorld,
        slot,
        tick: activeWorld.tick,
        combatStates: accessor.get(combatStatesCodec),
        damageBuilding,
        destroyUnit: destroyUnitEntity,
        addKill: (owner) => ensurePlayerScoreCounters(owner).unitsKilled++,
        markCombatDirty: () => accessor.markDirty(combatStatesCodec),
        markRender: markOutOfBandRenderChange,
      });
      if (slot.inFlight.length !== before) accessor.markDirty(projectilesCodec);
      if (killedAnyUnit) refreshVisibilityAfterCombat();
    },
  });
}
