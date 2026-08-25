// Spies (technologies.csv): "Show enemy line of sight", priced per enemy
// villager — {"Gold": 200; "Enemy Villager": 1} — so a scouting shortcut
// against a boomed opponent costs what the boom was worth. Atheism halves it.
// Never free: with no enemy villagers left the base note is still due.

export const SPIES_GOLD_PER_ENEMY_VILLAGER = 200;

export function spiesCost(
  enemyVillagerCount: number,
  buyerHasAtheism: boolean,
): { gold: number } {
  const base = Math.max(1, enemyVillagerCount) * SPIES_GOLD_PER_ENEMY_VILLAGER;
  return { gold: buyerHasAtheism ? Math.round(base / 2) : base };
}
