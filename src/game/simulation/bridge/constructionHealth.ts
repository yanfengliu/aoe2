// A construction site's hit points ARE its build progress. One quantity, two
// readings — never two accumulators that can disagree.
//
// They used to be two. `builderWorkStep` credited every builder a full
// `(maxHp - startHp) / totalBuildTicks` of health per tick while crediting
// progress on AoE2's crew curve (a full share for the first builder that tick,
// a third for each of the rest), so an n-builder crew filled the health bar
// `3n / (n + 2)` times faster than it filled the site — 1.8x at three
// builders, 2.7x at eighteen. Health hit `maxHp`, clamped, and from then on
// said nothing at all: the bar read FINISHED on a scaffold that was not, the
// age-up requirement (which reads `isComplete`) counted it as nothing, and the
// player had no reading anywhere that distinguished a site still being built
// from a site that could not be. Found by the standing loop playing the game;
// it cost a match ninety minutes in the Dark Age.
//
// So health is derived here, from the progress that is actually standing, and
// this module is the only place that knows the 10% foundation floor.

/** The hit points a foundation stands up with: AoE2's 10% of full, and never
 *  zero, because a building on 0 HP is a destroyed one. */
export function constructionStartHp(maxHp: number): number {
  return Math.max(1, Math.floor(maxHp * 0.1));
}

/** The health a site with this much progress standing has EARNED: the 10%
 *  floor at no progress, rising to exactly `maxHp` when `progressTicks`
 *  reaches `totalBuildTicks` — which is the tick the caller finalizes the
 *  building on. While a site is unfinished this is strictly below `maxHp`, so
 *  a full bar cannot mean anything but a finished building. */
export function constructionEarnedHp(
  maxHp: number,
  progressTicks: number,
  totalBuildTicks: number,
): number {
  if (totalBuildTicks <= 0) return maxHp;
  const startHp = constructionStartHp(maxHp);
  const fraction = Math.max(0, Math.min(1, progressTicks / totalBuildTicks));
  return startHp + (maxHp - startHp) * fraction;
}

/** One builder-tick of health, for a site that just took `progressDelta` of
 *  build progress.
 *
 *  Two rules compose. The CEILING is what the progress standing has earned, so
 *  health can never run ahead of the build. The STEP is that same progress
 *  converted to hit points, so health cannot run ahead of the clock either:
 *  a foundation an enemy chipped mends at the build rate rather than snapping
 *  back to the curve the moment a villager touches it. */
export function constructionHealthAfterWork(
  currentHp: number,
  maxHp: number,
  progressTicks: number,
  totalBuildTicks: number,
  progressDelta: number,
): number {
  if (totalBuildTicks <= 0) return maxHp;
  const startHp = constructionStartHp(maxHp);
  const step = (progressDelta * (maxHp - startHp)) / totalBuildTicks;
  return Math.min(
    constructionEarnedHp(maxHp, progressTicks, totalBuildTicks),
    currentHp + step,
  );
}
