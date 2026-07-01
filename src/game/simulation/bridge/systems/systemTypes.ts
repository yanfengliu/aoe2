// Shared shapes used by multiple systems. Each lives in createWorld's side-
// map closures; these aliases just give the systems a stable type to refer
// to without leaking the bridge's local interfaces.

import type { EntityRef } from 'civ-engine';

export interface CombatState {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
  // Symmetric armor-tech bonus, added to BOTH melee and pierce armor.
  armor: number;
  // Extra pierce-only armor-tech bonus (the asymmetric +1 that the four
  // top-tier armor techs + Loom add on top of `armor`). See armorTechBonuses.ts.
  pierceArmorBonus: number;
}

export interface BuildingHealthState {
  currentHp: number;
  maxHp: number;
}

export interface BuildingCombatState {
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
}

export interface WildlifeState extends CombatState {
  autoAggro: boolean;
  isAlive: boolean;
  corpsePersists: boolean;
  aggroRange: number;
  targetEntityRef: EntityRef | null;
}

export type UnitCommandType = 'attack' | 'move' | 'build';

export interface UnitCommand {
  type: UnitCommandType;
  target?: { x: number; y: number };
  targetEntityRef?: EntityRef | null;
  targetEntityKind?: 'unit' | 'building' | 'resource' | null;
  buildingRef?: EntityRef | null;
}
