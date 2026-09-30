# M7 UI icons slice 1 (v0.1.39) — Review iteration 1

Change under review: original inline-SVG glyph icons on the HUD resource chips + build-command buttons. New `src/ui/hud/icons/glyphs.ts` (`resourceGlyph`/`buildingGlyph` factories — hand-authored 24×24 inline SVG, `currentColor`, `aria-hidden`) + `src/hudIcons.css` (sizing/tone, imported after `hudChrome.css`). `hudTemplate.ts` injects the resource glyph into a new `.hud-chip-head` row (sibling of `.hud-value`); `selectionPanel.ts`'s extracted `renderBuildButtons()` prepends the building glyph before a `<span>`-wrapped "Build X" label. Text labels kept. DOM/CSS only. Implemented by a fresh-context subagent; the glyph look was judged by the team lead via before/after screenshots; reviewed + gated by the main agent.

Reviewers: Codex (gpt-5.5, xhigh, BEGIN/END), Claude (opus[1m], --effort max), Gemini (gemini-3.1-pro, plan). All read the live codebase. Contamination audit: `git diff` (unstaged) empty — no reviewer wrote to the tree.

## Verdict: APPROVE — no HIGH/MEDIUM code findings from any reviewer. Converged at iter-1.

Claude APPROVE (8/8 verified against the live tree — read `glyphs.ts` + `hudIcons.css` in full, the browser-test assertions, and the `renderBuildButtons` consumers); Gemini "ready to merge"; Codex 0 code findings. All three confirmed: 100% original/procedural (inline SVG primitives, `currentColor`; no `url()`/`<image>`/`<text>`/`<title>`/font/`@import`/`data:`); the DOM/test contract holds (glyph is a SIBLING in `.hud-chip-head`, so `.hud-value[data-hud]` still holds only the number → the `toHaveText` browser assertions pass; build buttons keep `data-command="build-<type>"`, the handler binds `buildingType` at bind time so a click on the child glyph still fires, and the "Build X" text is preserved); no `src/phaser`/`src/game`/save-format/bridge impact (the `BuildableBuildingType` import is `import type`); no new hues (`#c4ae7a` is the existing gold); no layout breakage (a clean 2-row chip grid ~2px taller, buttons still `flex-wrap`, no `z-index`/`overflow` regression); all files <500; decorative glyphs `aria-hidden`. The pixel-diff (21.72%, confined to the resource bar + build panel; canvas pixel-identical) is the objective DOM-only proof.

All findings were doc-only and are fixed in this commit.

## Findings and disposition (all addressed this commit)

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | LOW | Codex + Claude (optional) | The glyph ENUMERATION in changelog / spec §14.1 / roadmap listed ~15 representative buildings and omitted `town-center`, `stable`, `archery-range` — though the code covers all 18 `BuildableBuildingType`s via an exhaustive TS `Record` (the general "each Build X gets a glyph" claim was already true). Codex: "not fully accurate"; Claude: "illustrative, not inaccurate — optionally note 'among others'". | FIXED — generalized all three enumerations to note every buildable type is covered (the three omitted included). |
| 2 | LOW | Codex + Claude | Close-out: changelog/roadmap referenced `done/ui-icons/` + the devlog `[pending]` while the thread was still `current/` (no thread dir existed). | FIXED in close-out — thread written at `current/ui-icons/` then moved to `done/ui-icons/`, devlog reviewer section filled. |

## Notes (no action)
- Hardcoded `#c4ae7a` (vs a CSS var): matches the existing `styles.css` convention (gold hardcoded in 4 places; no `--hud-gold` token) — consistent, not a regression. If a gold token ever lands, one more call site to migrate.
- The countdown chip keeps the old structure (no glyph) → ~2px shorter than glyph-bearing neighbors only while a Wonder/Relic countdown is active — cosmetic, intentional.
- The glyph aesthetic (readability at ~15-17px) was the team lead's call via the screenshots; the 3-CLI review scope was the CODE (procedural constraint, contract-safety, behavior-inertness), all confirmed.
