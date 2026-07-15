# Review iteration 11

## Scope

OpenAI Codex CLI (`gpt-5.6-sol`, ultra reasoning) externally reviewed exact-boundary commit `ea765bd`, the production interpolation path, and the pending documentation/release diff with read-only access to the live repository. The prompt required every claim to be verified against actual symbols and tests. Anthropic Claude `opus[1m]` remained unavailable because the tenant export policy rejected the private-diff destination before execution; no bypass was attempted and no AoE source was transmitted to Claude.

## Findings and disposition

- **MEDIUM — the exact-boundary repair did not provide production warm/fresh locomotion equivalence and introduced a boundary discontinuity. Confirmed and fixed in `f57f5ab`.** The interim special case made a fresh direct sample at exactly 100 ms reconstruct prior locomotion, while 100.001 ms restarted from cancellation time. A red test measured a `0.5366` locomotion-weight jump. The special case was removed. The replacement exact/+epsilon regression proves fresh-sample continuity, and a production `interpolateProjectedEntities` regression proves roots plus attack phase, weight, and ambient suppression agree at alpha 0 and 0.5 while fresh disposable gait history intentionally restarts.
- **MEDIUM — the evidence-anchored lesson stopped at iteration 9 and encoded the superseded exact-boundary contract. Confirmed and fixed.** The lesson now cites iterations 10 and 11, records `ea765bd` as an interim attempt superseded by `f57f5ab`, names the final live test nodes, and states the production behavior delta.
- **LOW — active documentation overclaimed all HUD counts as fog-filtered. Confirmed and fixed.** Canonical architecture, drift, devlog, and lesson wording now distinguishes fog-filtered live/replay `visibleEntities` from the deliberately all-world alive `entityCount` debug/performance metric.
- **LOW — the roadmap called the five active bonus civilizations the supported roster even though content validation supports 18 civilizations. Confirmed and fixed.** Active spec and roadmap wording now calls Britons, Franks, Goths, Aztecs, and Mongols the five curated bonus-bearing civilizations.

## Result

An independent in-process refuter traced `AoeVoxelPresentationCoordinator`, `interpolateProjectedEntities`, the adapter history seam, and attack sampling and approved the corrected production contract with no substantive finding. The focused renderer/architecture suite passed 36 tests. Full `npm run verify` passed in 386.9 seconds, including 2,018 passing Vitest tests with two skips across 265 files, 106 passing headless Chromium tests with two skips, typecheck, lint, content validation, and a 528-module build. Iteration 12 must focus only on refuting `f57f5ab` and the reconciled final documentation before convergence.
