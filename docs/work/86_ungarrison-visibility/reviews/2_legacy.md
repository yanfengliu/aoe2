# Review — iteration 3

## Providers

- Three in-process adversarial reviewers completed final live-code reviews and approved after the fixes below.
- OpenAI Codex `gpt-5.6-sol` at ultra effort was launched against the complete staged diff. It read the live implementation and attempted additional probes, but hit the 10-minute execution limit before emitting its `-o` final review; this run is recorded as unavailable, not approval.
- Anthropic Claude Code was explicitly authorized, but tenant private-source export policy blocked the run before execution; no Claude review was produced and no diff was sent through that path.

## Findings and disposition

- [MEDIUM][In-process] Exhaustion was tested only at the allocator boundary, not through `ungarrisonBuilding`. **Resolved:** `trainingMarketOps.ungarrison.test.ts` proves both containment maps, stored vision, positionlessness, transform stability, no render invalidation, and successful retry.
- [MEDIUM][In-process] Root assertions used numeric IDs without explicitly proving generation identity. **Resolved:** Town Center and full-Castle regressions preserve exact `id:generation`; the Castle test also verifies save/load position and transform parity.
- [LOW][In-process] The exported occupancy comment still described the old relocation/overflow semantics. **Resolved:** it now distinguishes ordinary `syncUnit` overflow from bounded fresh placement and its outer `null` result.
- [LOW][In-process] The active roadmap still named v0.2.3 and omitted the completed ungarrison behavior. **Resolved:** the current voxel baseline now records v0.2.4 while dated Phaser-era records remain historical.

## Result

All substantive local findings are resolved and the in-process review converged. The two completed external Codex iterations produced substantive findings that were fixed; the final Codex attempt and Claude run are represented by their actual unavailable/blocked states rather than inferred votes. Final verification passed 2,022 Vitest tests with two skips across 266 files, 106 headless Chromium tests with two skips, lint, typecheck, content validation, and a 529-module build; both dependency audits reported zero vulnerabilities.
