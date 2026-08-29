import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const TOOL_PART = 'villager-tool-head';
const ANCHOR_PART = 'villager-boot-left';

async function waitForPresentedSnapshot(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
    return metrics.acceptedRevision !== null
      && metrics.presentedRevision === metrics.acceptedRevision;
  })).toBe(true);
}

async function waitForTwoAnimationFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  }));
}

function distanceBetweenParts(
  left: readonly number[],
  right: readonly number[],
): number {
  return Math.hypot(
    left[12]! - right[12]!,
    left[13]! - right[13]!,
    left[14]! - right[14]!,
  );
}

test.describe('voxel unit attack animation', () => {
  test('presents concurrent boar strikes from simulation time while approachers keep moving', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'boar-hunt-fixture');

    const hunters = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const renderState = api.getRenderState();
      const villagers = renderState.entities.filter((entity) => (
        entity.kind === 'unit'
        && entity.owner === 1
        && entity.entityType === 'villager'
      ));
      const boar = renderState.entities.find((entity) => (
        entity.kind === 'resource' && entity.entityType === 'boar'
      ));
      if (villagers.length !== 6 || !boar) {
        throw new Error('The boar-hunt fixture must contain six villagers and one boar.');
      }
      if (!api.selectUnitsInBox(12, 7, 14, 9)) {
        throw new Error('Could not select the six boar hunters.');
      }
      if (api.getSelectionState().selectedCount !== 6) {
        throw new Error('The boar-hunt group selection did not retain all six villagers.');
      }
      if (!api.issueContextCommandAtWorldPosition(boar.x + 0.5, boar.y + 0.5)) {
        throw new Error('The grouped boar attack command was rejected.');
      }

      return villagers.map((villager) => ({
        id: villager.id,
        identity: `${String(villager.id)}:${String(villager.generation ?? 0)}`,
      }));
    });

    expect(hunters).toHaveLength(6);
    await waitForPresentedSnapshot(page);
    const restingParts = await page.evaluate(({ identities, toolPart, anchorPart }) => (
      identities.map(({ id, identity }) => ({
        id,
        identity,
        tool: window.__AOE2_TEST__!.inspectPresentedVoxelPartMatrix(identity, toolPart),
        anchor: window.__AOE2_TEST__!.inspectPresentedVoxelPartMatrix(identity, anchorPart),
      }))
    ), { identities: hunters, toolPart: TOOL_PART, anchorPart: ANCHOR_PART });
    expect(restingParts.every(({ tool, anchor }) => tool !== null && anchor !== null)).toBe(true);
    const restingByIdentity = new Map(
      restingParts.map((sample) => [sample.identity, sample]),
    );

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
    await waitForPresentedSnapshot(page);
    const firstStrikePresentation = await page.evaluate(({
      identities,
      toolPart,
      anchorPart,
    }) => {
      const api = window.__AOE2_TEST__!;
      const renderState = api.getRenderState();
      return {
        tick: renderState.tick,
        samples: identities.map(({ id, identity }) => ({
          id,
          identity,
          hasAttackEvent: renderState.entities.find(
            (entity) => entity.id === id,
          )?.attackAnimation !== undefined,
          tool: api.inspectPresentedVoxelPartMatrix(identity, toolPart),
          anchor: api.inspectPresentedVoxelPartMatrix(identity, anchorPart),
        })),
      };
    }, { identities: hunters, toolPart: TOOL_PART, anchorPart: ANCHOR_PART });
    const firstStrikeMotions = await page.evaluate((identities) => (
      identities.map(({ identity }) => ({
        identity,
        motion: window.__AOE2_TEST__!.inspectVoxelUnitMotion(identity),
      }))
    ), hunters);
    const motionByIdentity = new Map(
      firstStrikeMotions.map((sample) => [sample.identity, sample.motion]),
    );
    const firstStrikeSamples = firstStrikePresentation.samples.map((sample) => ({
      ...sample,
      motion: motionByIdentity.get(sample.identity) ?? null,
    }));
    const immediateAttackers = firstStrikeSamples.filter((sample) => (
      sample.hasAttackEvent && sample.motion?.mode === 'attacking'
    ));
    // A queued attack order alone is not an attack pose: only villagers with
    // a witnessed damage event animate. At exact tick time the interpolated
    // roots have not moved yet, so locomotion is sampled after a partial tick.
    const approachingHunters = firstStrikeSamples.filter((sample) => !sample.hasAttackEvent);

    expect(immediateAttackers).toHaveLength(2);
    expect(new Set(immediateAttackers.map((sample) => sample.id)).size).toBe(2);
    expect(immediateAttackers.every(
      (sample) => Math.abs((sample.motion?.attackPhase ?? 0) - 0.55) < 0.000_001,
    )).toBe(true);
    expect(immediateAttackers.every((sample) => (sample.motion?.attackWeight ?? 0) > 0)).toBe(true);
    for (const attacker of immediateAttackers) {
      const resting = restingByIdentity.get(attacker.identity)!;
      expect(attacker.tool).not.toBeNull();
      expect(attacker.anchor).not.toBeNull();
      const restingDistance = distanceBetweenParts(
        resting.tool!.matrix,
        resting.anchor!.matrix,
      );
      const strikeDistance = distanceBetweenParts(
        attacker.tool!.matrix,
        attacker.anchor!.matrix,
      );
      // The tool-to-planted-boot distance is invariant under whole-actor
      // facing, so this proves the accepted hit tick changed the attack pose
      // itself instead of only publishing phase-zero metadata.
      expect(Math.abs(strikeDistance - restingDistance)).toBeGreaterThan(0.001);
    }
    expect(approachingHunters).toHaveLength(4);
    expect(approachingHunters.every((sample) => sample.motion?.mode !== 'attacking')).toBe(true);
    expect(approachingHunters.every((sample) => sample.motion?.attackWeight === 0)).toBe(true);

    const frozenHistoriesBefore = await page.evaluate((attackers) => (
      attackers.map(({ identity }) => window.__AOE2_TEST__!.inspectVoxelUnitMotion(identity))
    ), immediateAttackers);
    await waitForPresentedSnapshot(page);
    const frozenPresentationBefore = await page.evaluate(({
      attackers,
      toolPart,
      anchorPart,
    }) => {
      const api = window.__AOE2_TEST__!;
      return {
        tick: api.getRenderState().tick,
        revision: api.getWorldRendererState().metrics.presentedRevision,
        parts: attackers.map(({ identity }) => ({
          tool: api.inspectPresentedVoxelPartMatrix(identity, toolPart),
          anchor: api.inspectPresentedVoxelPartMatrix(identity, anchorPart),
        })),
      };
    }, { attackers: immediateAttackers, toolPart: TOOL_PART, anchorPart: ANCHOR_PART });

    await waitForTwoAnimationFrames(page);

    const frozenPresentationAfter = await page.evaluate(({
      attackers,
      toolPart,
      anchorPart,
    }) => {
      const api = window.__AOE2_TEST__!;
      return {
        tick: api.getRenderState().tick,
        revision: api.getWorldRendererState().metrics.presentedRevision,
        parts: attackers.map(({ identity }) => ({
          tool: api.inspectPresentedVoxelPartMatrix(identity, toolPart),
          anchor: api.inspectPresentedVoxelPartMatrix(identity, anchorPart),
        })),
      };
    }, { attackers: immediateAttackers, toolPart: TOOL_PART, anchorPart: ANCHOR_PART });
    const frozenHistoriesAfter = await page.evaluate((attackers) => (
      attackers.map(({ identity }) => window.__AOE2_TEST__!.inspectVoxelUnitMotion(identity))
    ), immediateAttackers);

    expect(frozenPresentationAfter.tick).toBe(frozenPresentationBefore.tick);
    expect(frozenPresentationAfter.revision).toBe(frozenPresentationBefore.revision);
    expect(frozenPresentationAfter.parts).toEqual(frozenPresentationBefore.parts);
    expect(frozenHistoriesAfter).toEqual(frozenHistoriesBefore);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 150));
    await waitForPresentedSnapshot(page);
    const progressedPresentation = await page.evaluate(({
      attackers,
      toolPart,
      anchorPart,
    }) => {
      const api = window.__AOE2_TEST__!;
      return {
        tick: api.getRenderState().tick,
        parts: attackers.map(({ identity }) => ({
          tool: api.inspectPresentedVoxelPartMatrix(identity, toolPart),
          anchor: api.inspectPresentedVoxelPartMatrix(identity, anchorPart),
        })),
      };
    }, { attackers: immediateAttackers, toolPart: TOOL_PART, anchorPart: ANCHOR_PART });
    const progressedMotions = await page.evaluate(({ attackers, approachers }) => ({
      attackerMotions: attackers.map(
        ({ identity }) => window.__AOE2_TEST__!.inspectVoxelUnitMotion(identity),
      ),
      approacherMotions: approachers.map(
        ({ identity }) => window.__AOE2_TEST__!.inspectVoxelUnitMotion(identity),
      ),
    }), { attackers: immediateAttackers, approachers: approachingHunters });

    expect(progressedPresentation.tick).toBe(firstStrikePresentation.tick + 1);
    expect(progressedMotions.attackerMotions).toHaveLength(2);
    for (let index = 0; index < progressedMotions.attackerMotions.length; index += 1) {
      const before = immediateAttackers[index]!.motion!;
      const after = progressedMotions.attackerMotions[index]!;
      const impactParts = immediateAttackers[index]!;
      const progressedParts = progressedPresentation.parts[index]!;
      expect(after.mode).toBe('attacking');
      expect(after.attackPhase).toBeGreaterThan(before.attackPhase);
      expect(after.sampleTimeMs).toBe(before.sampleTimeMs + 150);
      expect(progressedParts.tool).not.toBeNull();
      expect(progressedParts.anchor).not.toBeNull();
      expect(progressedParts.tool!.matrix).not.toEqual(impactParts.tool!.matrix);
    }
    expect(progressedMotions.approacherMotions).toHaveLength(4);
    expect(progressedMotions.approacherMotions.every((motion) => (
      motion !== null
      && Number.isFinite(motion.attackWeight)
      && motion.attackWeight >= 0
      && motion.attackWeight <= 1
    ))).toBe(true);
    // §12.4.2 (v0.3.160): at honest walk speed the next pair of hunters has
    // NOT closed in one tick after the first strikes (the old [0,0,1,1]
    // choreography was teleport-clock timing). Walk the sim forward until the
    // nearer pair engages, and at that same presented moment the farther pair
    // must still read as WALKING — mode 'moving' across zero-step ticks is
    // exactly what the trailing motion window exists to keep true.
    let engagedWeights: number[] = [];
    let laterMotions: Array<{ mode: string; attackWeight: number } | null> = [];
    for (let round = 0; round < 40; round += 1) {
      await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(2, 150));
      await waitForPresentedSnapshot(page);
      laterMotions = await page.evaluate((approachers) => approachers.map(
        ({ identity }) => window.__AOE2_TEST__!.inspectVoxelUnitMotion(identity),
      ), approachingHunters);
      engagedWeights = laterMotions.map((motion) => motion?.attackWeight ?? Number.NaN);
      if (engagedWeights.filter((weight) => weight === 1).length >= 2) break;
    }
    expect([...engagedWeights].sort((left, right) => left - right)).toEqual([0, 0, 1, 1]);
    expect(laterMotions.filter((motion) => motion?.attackWeight === 0)
      .every((motion) => motion?.mode === 'moving')).toBe(true);
  });
});
