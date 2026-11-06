// The boot map's scripted raid (work 144 M2; `src/game/simulation/fixtures/raidWarning.ts`):
// `aoe2-prototype` itself with owner 2's AI off and one Militia of owner 2's standing
// out of reach, which `orderBootMapRaid` sends onto the human's nearest villager
// through the command pipeline. Specs that need an attack used the computer's own
// Dark Age raid on the idle human, which DE's Dark Age boom ended; a HUD or input
// spec must not depend on the computer's opening strategy. Headless, the first
// villager is hit 196 ticks after the order (`tests/simulation/bootMapRaidFixture.test.ts`).
import type { Page } from '@playwright/test';

export const BOOT_MAP_RAID_SEED = 'boot-map-raid-fixture';

export async function orderBootMapRaid(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const units = api.getEconomyState().units;
    const militia = units.find((unit) => unit.owner === 2 && unit.unitType === 'militia');
    if (!militia) throw new Error('boot-map-raid-fixture must give owner 2 a Militia to raid with.');
    const villagers = units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager');
    if (villagers.length === 0) throw new Error('boot-map-raid-fixture must give the human villagers to raid.');
    const distance = (unit: { x: number; y: number }) => Math.hypot(unit.x - militia.x, unit.y - militia.y);
    const target = villagers.reduce((best, unit) => (distance(unit) < distance(best) ? unit : best));
    const result = await api.agent.dispatchAgentCommand(
      { type: 'unit.attack', data: { unitId: militia.id, targetEntityId: target.id, targetEntityKind: 'unit' } },
      { expectedOwner: 2 },
    );
    if (!result.accepted) throw new Error(`owner 2's Militia refused the raid: ${JSON.stringify(result)}`);
  });
}
