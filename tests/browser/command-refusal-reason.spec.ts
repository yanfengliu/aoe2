import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

// GATE — the DOM half of "an unavailable command names what is missing"
// (2026-09-06). `tests/simulation/commandAvailabilityReasons.test.ts` holds
// the reasons the BRIDGE computes; this holds that the panel puts each one
// on its own control and that a player can actually read it.
//
// Why the DOM half has to exist separately: the age-up button is DISABLED,
// and a disabled button can never be clicked, so the rejection toast that
// carries the reason never fires for it. Hover is its only channel — a
// browser fact no unit test can assert. The measured defect was a disabled
// "Research Feudal Age" whose tooltip read "Research Feudal Age. Cost: 500
// food; takes 130s." and nothing else, while the player held 1,295 food.
//
// BOUND. Two scenarios at boot, at the suite's 800x600 viewport: the real
// default map for the age-up refusal, and the exhausted-resources fixture
// for a price refusal on a build card. It asserts the reason REACHES the
// control and the visible tooltip; it does not re-assert the wording rules
// (that is the bridge test) and it does not cover keyboard focus, because
// a disabled control is not focusable at all — see the handoff.
test.describe('an unavailable command says what is missing', () => {
  test('a locked age-up button carries its reason and shows it on hover', async ({ page }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    const feudal = page.locator('[data-command="research-feudal-age"]');
    await expect(feudal).toBeVisible();
    // The state the defect was reported in: drawn, and refusing.
    await expect(feudal).toBeDisabled();

    // The reason reaches the control, and names the buildings — not a bare
    // "unavailable", and not the resource the player already has.
    const reason = await feudal.getAttribute('data-command-reason');
    expect(reason).toContain('Dark Age buildings');
    expect(reason).toContain('Barracks');
    expect(reason).not.toContain('food');

    // The tooltip keeps the price AND gains the reason: the player needs
    // both to decide what to do next.
    const tooltipText = await feudal.getAttribute('data-tooltip');
    expect(tooltipText).toContain('Cost: 500 food');
    expect(tooltipText).toContain('Dark Age buildings');

    // And hovering a DISABLED button really does surface it. This is the
    // assertion that cannot move to a unit test: it is a browser question.
    const tooltip = page.locator('[data-hud="tooltip"]');
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'false');
    await feudal.hover();
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'true');
    await expect(tooltip).toContainText('Dark Age buildings');
    await expect(tooltip).toContainText('You have 0.');
  });

  test('a build card the player cannot pay for says which resource is short', async ({ page }) => {
    // A base with no wood, gold or stone left: every card in the palette
    // refuses, and each says why.
    await game.waitForBootWithSeed(page, 'exhausted-resources-fixture');
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);

    const house = page.locator('[data-command="build-house"]');
    await expect(house).toBeVisible();
    // §14.2 keeps a Short card actionable and dimmed rather than annotated,
    // so the affordability flag is unchanged and the reason rides the
    // tooltip and the accessible name instead of the tile's face.
    await expect(house).toHaveAttribute('data-command-affordable', 'false');
    await expect(house).toHaveAttribute('data-command-reason', 'Not enough wood.');
    await expect(house).toHaveAttribute('aria-label', /Not enough wood\./);

    const tooltip = page.locator('[data-hud="tooltip"]');
    await house.hover();
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'true');
    await expect(tooltip).toContainText('Not enough wood.');
  });
});
