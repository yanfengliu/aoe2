// @vitest-environment jsdom
//
// The command card's tooltips as the HUD mounts them over a real bridge (work
// 148 M2): each says what its unit, technology or building does, and an age
// says the buildings it needs whether the player has them or not, as DE's
// string 28101 does ("Advance to <b>Feudal Age<b> (<cost>; two Dark Age
// buildings)\n... Before you can advance, you must have any two Dark Age
// buildings: ..."). Until M2 the Feudal Age named its buildings only inside the
// simulation's refusal, so with the buildings standing and the food short it
// read "Research Feudal Age. Cost: 500 food; takes 130s. Not enough food.",
// and with both met it read the price alone (plan 106's HUD card, play-1014).
// The controller draws the help text's first line as its title.

import { afterEach, describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createTooltipController } from '../../src/ui/hud/tooltips';
import { mountSelectionPanel, type MountedPanel } from './shownPrice.helpers';
import { selectOwnedBuildingDirect, selectOwnedUnitDirect } from '../simulation/createSimulationBridge.helpers';

const FEUDAL_NEEDS = 'Before you can advance, you need any two Dark Age buildings: Mill, Lumber Camp, Mining Camp, Barracks, or Dock.';

let mounted: MountedPanel | null = null;
afterEach(() => {
  mounted?.destroy();
  mounted = null;
});

function tooltipOf(panel: MountedPanel, command: string): string {
  const button = panel.host.querySelector<HTMLElement>(`[data-command="${command}"]`);
  expect(button, `the card draws ${command}`).not.toBeNull();
  return button!.dataset.tooltip ?? '';
}

function townCenterOn(seed: string): { bridge: ReturnType<typeof createSimulationBridge>; panel: MountedPanel } {
  const bridge = createSimulationBridge(seed);
  expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
  mounted = mountSelectionPanel(bridge);
  mounted.refresh();
  return { bridge, panel: mounted };
}

describe('the Feudal Age says it needs two Dark Age buildings, whatever the player has', () => {
  it('one building standing: the buildings named once, by the simulation\'s refusal with its count', () => {
    const { panel } = townCenterOn('feudal-missing-prereq-fixture');
    const lines = tooltipOf(panel, 'research-feudal-age').split('\n');
    expect(lines[0]).toBe('Advance to Feudal Age (500 food; 130s; two Dark Age buildings)');
    expect(lines.at(-1)).toBe('Needs 2 completed Dark Age buildings (Mill, Lumber Camp, Mining Camp, Barracks, or Dock). You have 1.');
    // Said once: the refusal's line stands for the requirement's.
    expect(lines.filter((line) => line.includes('Lumber Camp'))).toHaveLength(1);
    expect(lines).toHaveLength(3);
  });

  it('both buildings standing and the food short: the requirement still, then "Not enough food."', () => {
    const { bridge, panel } = townCenterOn('feudal-age-fixture');
    // 700 food, 50 a villager: queue until the stockpile cannot pay the age.
    for (let index = 0; index < 20 && bridge.getHudState().playerResources.food >= 500; index += 1) {
      bridge.queueTrainUnit('villager');
      bridge.step(100);
    }
    expect(bridge.getHudState().playerResources.food).toBeLessThan(500);
    panel.refresh();
    const lines = tooltipOf(panel, 'research-feudal-age').split('\n');
    expect(lines[0]).toBe('Advance to Feudal Age (500 food; 130s; two Dark Age buildings)');
    expect(lines).toContain(FEUDAL_NEEDS);
    expect(lines.at(-1)).toBe('Not enough food.');
  });

  it('everything met: the requirement still, and no refusal', () => {
    const { panel } = townCenterOn('feudal-age-fixture');
    const button = panel.host.querySelector<HTMLButtonElement>('[data-command="research-feudal-age"]')!;
    expect(button.disabled).toBe(false);
    const lines = tooltipOf(panel, 'research-feudal-age').split('\n');
    expect(lines).toContain(FEUDAL_NEEDS);
    expect(lines.at(-1)).toBe(FEUDAL_NEEDS);
  });

  // The Imperial Age's refusal, as the simulation words it for a Castle Age
  // player with none of its buildings: it names the three and the Castle, so
  // it stands for the requirement's sentence and they are said once.
  it('the Imperial Age with no Castle Age building: its buildings and the Castle named once, by the refusal', () => {
    const { panel } = townCenterOn('exhausted-resources-fixture');
    const lines = tooltipOf(panel, 'research-imperial-age').split('\n');
    expect(lines[0]).toMatch(/^Advance to Imperial Age \(.*; two Castle Age buildings or a Castle\)$/);
    expect(lines.at(-1)).toMatch(/^Needs 2 completed Castle Age buildings \(.*\), or one completed Castle\. You have \d\.$/);
    expect(lines.filter((line) => line.includes('Siege Workshop'))).toHaveLength(1);
    expect(lines).toHaveLength(3);
  });
});

describe('every command on the card says what it does', () => {
  it('the Town Center: a Villager gathers and builds, Loom hardens villagers', () => {
    const { panel } = townCenterOn('feudal-age-fixture');
    expect(tooltipOf(panel, 'train-villager').split('\n')).toEqual([
      'Create Villager (50 food)',
      expect.stringMatching(/^Gathers resources, and builds and repairs buildings\b/),
    ]);
    expect(tooltipOf(panel, 'research-loom').split('\n')).toEqual([
      'Research Loom (50 gold; 25s)',
      'Villagers +15 hit points, +1 melee armor and +2 pierce armor.',
    ]);
  });

  it('a villager\'s build card: what the building is for, and the Barracks what it opens', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    mounted = mountSelectionPanel(bridge);
    mounted.refresh();
    expect(tooltipOf(mounted, 'build-house').split('\n')).toEqual([
      'Build House (25 wood)',
      expect.stringMatching(/^Supports 5 population\./),
    ]);
    // The Barracks is on the military page, which the card draws on a toggle.
    mounted.host.querySelector<HTMLButtonElement>('[data-build-page="military"]')!.click();
    mounted.refresh();
    expect(tooltipOf(mounted, 'build-barracks').split('\n')[1])
      .toMatch(/Required for the Stable, Archery Range, Blacksmith, Market and Watch Tower\.$/);
  });
});

describe('the tooltip draws the help text\'s first line as its title', () => {
  it('a title in bold, then the rest, and the copy whole as its text', () => {
    const { panel } = townCenterOn('feudal-age-fixture');
    const element = document.createElement('div');
    element.id = 'hud-tooltip';
    document.body.append(element);
    const controller = createTooltipController(panel.host, element);
    const loom = panel.host.querySelector<HTMLElement>('[data-command="research-loom"]')!;
    loom.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect(element.querySelector('.hud-tooltip__title')?.textContent).toBe('Research Loom (50 gold; 25s)');
    expect(element.textContent).toBe(loom.dataset.tooltip);
    controller.destroy();
    element.remove();
  });
});
