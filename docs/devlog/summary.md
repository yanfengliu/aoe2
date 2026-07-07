## 2026-07-07 (vision harness conformance guard)
- **Post-hoc findings guard:** hardened `conformanceProbe` after the v0.1.121 vision run produced false high-severity "missing age/tech/combat" findings from a 750-tick Dark Age opening. The digest now labels command types as "used in this run" rather than "could use", carries a short-run caution for max-tick openings, and the prompt requires `record_findings` exactly once even when findings are empty. Regression tests cover the wording. Live rerun on `tmp/vision/llm-v0121-probe` now returns 0 findings with no probe note.

## 2026-07-07 (graphics loop v0.1.116-v0.1.121)
- **Screenshot-backed AoE2-style polish:** shipped six focused visual slices from the new vision loop: building material seams (v0.1.116), wildlife species silhouettes (v0.1.117), planted foot-unit limb detail (v0.1.118), deterministic terrain surface marks (v0.1.119), tactical minimap marker backing/layering (v0.1.120), and faceted gold/stone deposits (v0.1.121). All are render/UI-only and preserve simulation, saves, replays, hit testing, fog memory, and camera math.
- **Latest visual evidence:** v0.1.121 changed 825 / 983,040 canvas pixels (0.084%) localized to visible mineral deposits. The bounded v0.1.121 vision probe ran 3 decisions / 750 ticks with 14 accepted commands, 0 rejected, 0 stalls, and both owners alive.
- **Current graphics plan:** continue `docs/threads/current/isometric-overhaul/DESIGN.md`; next high-value visual work remains per-civilization/architecture-set facade variation, attack/death feedback, richer weapon animation, per-unit/per-civilization visual variety, and elevation/cliffs once the render contract exposes per-cell elevation.

## 2026-07-06 (civ-engine v1.3.0 visual-playtest adapter)
- **Internal harness adapter:** aoe2 adopted civ-engine v1.3.0 visual-playtest vocabulary as an adapter, not a runner replacement. `visualPlaytestAdapter.ts` feeds screenshot metadata, visible-text summary, and command-tool controls into tactical prompts while preserving the richer JSON snapshot/tool schemas; `findingsToMarkers` keeps deterministic `author:'agent'` marker injection. No gameplay/user-visible version bump.

## 2026-07-04/05 (AI economy close, scope cut, isometric overhaul)
- **AI-economy age-up arc closed (v0.1.88-v0.1.97):** Feudal food priority, villager reserve deadlock removal, military pacing, wider 4x4 placement, and market sell-for-age-up made the AI reach Castle in real matches; the corpus gate was recognized as too short rather than a mechanics failure. Menu/fixed-panel/auto-pause shipped in the same arc.
- **Roster scope cut:** supported civilizations are Britons, Franks, Goths, Aztecs, and Mongols. Mongols hunt-boar +50% and Light Cavalry/Hussars +30% HP shipped; out-of-roster Slavs farm bonus was reverted.
- **Graphics north star:** v0.1.102-v0.1.121 moved the first screen from flat top-down primitives toward original procedural isometric 2.5D terrain, structures, resources, units, HUD/minimap readability, and texture/detail cues. Real default `aoe2-prototype` capture with fog is the baseline visual protocol.

## 2026-06-30/07-03 (core gameplay and tech seams)
- **Major gameplay systems:** shipped armor selection panel, reachable drop-off reroute, AI villager-cap tuning, tower upgrades, Monastery techs, garrison healing plus Herbal Medicine/Heresy, Sappers, movement-speed banking with Husbandry/Squires/Wheelbarrow/Hand Cart, Bloodlines plus conformance fix, and broad command-card/selection icon coverage.
- **Economy breakthrough:** v0.1.79's wood-locality fix ranked gather targets by drop-off proximity, raising measured wood income by 3-15x and exposing/fixing the age-up queue and pop-blocked research stalls behind the earlier AI plateau.

## Current Practice
- Use the vision harness for real play evidence, but verify its findings against the live code before acting. Short max-tick openings are not proof that age-up, tech, or combat are absent.
- For user-visible gameplay/visual changes, keep the full loop: TDD red/green, before/after/diff when visual, spec/changelog/version as applicable, detailed devlog, four gates, commit to `main`, then continue the goal loop.
