# Feudal age-up prerequisite — campaign-11 finding (a) investigation → NOT A BUG

## Origin

campaign-11 `playtest:findings` conformance-probe finding (a): "building Houses didn't advance the Feudal 2-building prerequisite tally (0/2 after a House, 1/2 only after a Mill)" — the probe (an LLM) inferred a bug, claiming Houses should count.

## Investigation

`DARK_AGE_PREREQUISITE_BUILDINGS` (`prototypeBuildingRules.ts`) = {mill, lumber-camp, mining-camp, barracks} — it does NOT include house, palisade-wall, or farm (all Dark-Age buildable). The code matches the probe's observation (Houses don't count). On the probe's premise that "any non-Town-Center Dark-Age building should count," an attempted fix added house/palisade-wall/farm (with TDD + docs + a 0.1.48 bump).

## Conclusion: NOT A BUG — the rule was already correct

The mandatory 3-CLI review (Claude, with Liquipedia + Fandom sources) flagged the attempted fix as a gameplay REGRESSION. Verified against the authoritative AoE2 wikis (Fandom + a cross-check web search): advancing Dark→Feudal needs 2 of {Barracks, Dock, Lumber Camp, Mill, Mining Camp}; **Houses, Farms, and Walls explicitly do NOT count.** The existing {mill, lumber-camp, mining-camp, barracks} is exactly AoE2's qualifying five minus Dock (which this land-only slice lacks) — already correct. The agent's "0/2 after a House" was working-as-intended. Finding (a) is a conformance-probe MISDIAGNOSIS.

**Disposition:** the attempted fix REVERTED (no code change). Docs record the not-a-bug finding (roadmap, devlog, this thread + `2026-06-17/1/REVIEW.md`) + a `lessons.md` entry. No version bump, no changelog. When naval is added, `dock` joins the prerequisite set — the only AoE2-qualifying Dark-Age building this land-only slice currently lacks.

See `2026-06-17/1/REVIEW.md` for the full 3-CLI review + the wiki verification.
