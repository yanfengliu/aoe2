# Finish and integrate the recovered branch work

Status: active
Owner: Codex integration owner
Created: 2026-10-17
Updated: 2026-10-17

## Problem and outcome

The user requests completion and integration of the existing branches, prioritizing performance, gatherers and the AI. Recover useful work without losing overlays, finish its acceptance checks, merge into main, push, and retire the task's worktrees safely.

## Scope

Works 130 (frame rate), 131 (gatherers), 128 (AI relic collection), 126 (unbuilt foundations) and 132 (victory countdowns). Finish existing branch outcomes; do not expand to the remaining full-DE backlog or modify sibling repositories. Preserve old worktrees outside this scope until their retained work is accounted for.

## Approach

Main af328ae6 and both hosted gates are green. Recover each original branch in place. Performance, gatherer and AI workers own disjoint changes; root owns shared docs, conflict resolution, final review and one expensive gate at a time. Recover foundations and countdowns next. Combine mutually dependent changes before re-recording self-play censuses. Retain branch ancestry in a combined merge and inspect each branch's merge-base delta against the integrated result; ancestry alone does not establish preservation. Existing dirty AI and foundation documentation is inspected and retained or explicitly corrected, never discarded.

## Acceptance criteria

- Every branch's intended behavior and material review findings are resolved within the authorized repository, or a concrete unavailable sibling capability is recorded without claiming its blocked criterion complete.
- Relevant targeted checks, real headless game controls, save/replay interactions, realistic self-play and maintained visual evidence cover the combined changes.
- Spec, defect records, gate proofs, authored reviews and progress remain accurate; user-visible changes receive coherent version/changelog entries.
- The final combined tree passes npm run verify before its code commit; a clean committed-tree run earns a certified receipt accepted by verify-receipt check before push.
- Independent read-only review covers the final integrated changes and any fixes; hosted CI and playtest-corpus are followed to completion.
- Useful work is on main and pushed. Task-owned processes and safely retired worktrees are cleaned without touching unrelated applications or work.

## Implementation steps

- Performance owner: /root/performance; frame-rate 6ff29963. Recover M1 and resolve in-repo performance findings; identify any genuine M2 sibling boundary.
- Gatherer owner: /root/gatherers; gatherers 4d68b3ca. Finish continuation, hunting and idle behavior.
- AI owner: /root/ai; ai-relics 5dee1545 plus one existing detailed-devlog overlay. Finish relic search, reachability and ownership.
- Root: recover foundations df03d41b plus its two existing doc overlays, and countdowns 595df917 after priority lanes are prepared; delegate nontrivial implementation.
- Root: integrate in dependency order, reconcile shared self-play census and canonical docs, obtain pinned independent review, run serialized gates, merge/push, follow hosted gates, safely clean resources.

## Outcome

Pending. Main is ec500a61 / v0.3.257. No branch result is yet accepted as delivered. Initial ci:status was UNKNOWN due sandbox ownership/network restrictions; scoped Git configuration and elevated read-only networking confirmed both hosted gates GREEN. Original branches and overlays remain intact. Worktree controller rejects slash names, so the integration branch uses branch-completion-1017.

## Recovery findings and resource state

2026-10-17: a single-owner product-file preservation audit found only nine differences from the recovered branch tips, all accounted for by the gatherer and AI recovery overlays. Combined TypeScript checking passed. The initial four-file architecture check passed file-size, work records and line endings; the register rollover correctly rejected four excess closed entries, now moved verbatim to its archive. The inherited gate.lock names work 126's 2026-10-15 landing and has no surviving AoE2 gate process; preserve its owner record before taking the final gate lock. No unrelated browser is task-owned.

Early independent review finding IR1: foundation exit plans did not reserve destinations, permitting a unit and animal to share the same sole exit and trapping the unit. The foundation worker owns tests-first repair and focused re-review; acceptance remains open.

2026-10-17 integration checkpoint: recovery fixes IR1 and IR2 have targeted red/green evidence, and the current-DE comparison corrects Missionary relic transport. The first combined census exited 1: both players reached Imperial, but owner 2's completed Siege Workshop researched none of its five hosted technologies. AI diagnosis is assigned read-only first; expected JSON and producer assertions are unchanged. The original software frame-cost target remains open, and the corrected matched Normal instrument requires independent scrutiny before scoring the single ground-order counterfactual. No final gate, code commit or main publication has happened.

2026-10-17 bounded experiment outcome: the one ground draw-order candidate failed the predeclared unchanged-pixel criterion (Natural SwiftShader6/5 and GPU16/17 opening/late-base pixels; same-baseline GPUcontrol0). Its product and test were restored byte-for-byte, and no live cost matrix was scored. Full authored outcome is ground-experiment.md. This does not close the original stronger software criterion; verified M1/B work may ship only with that remaining gap stated. Current origin/mainec500a61 has both remote gates GREEN; its instruction-only update is preserved in the pending tree and its ancestry will be merged before landing.


2026-10-17 focused acceptance: independent review accepted IR1/IR2 mechanism closure and the tests-first IR3 reassignment repair. It independently reproduced the census’s thirteen set differences and accepted replacing only the snapshot with the measured JSON (SHA256269a2e5b064905d7ae9ef2c438e2cd57f170ef4aece69ecc413699767b267dc2). The old assertion failed in both original and instrumented runs; producer assertions, horizon and configuration remain unchanged. This measured run predates IR3, so only the forthcoming full integrated gate can establish final snapshot agreement. The direction and inherited purchase-batching cause are retained in census-diagnosis-2026-10-17.md and must appear in the shipping commit.

2026-10-17 final source freeze: IR1–IR3 are independently accepted, the actual-control playtest covers six affected flows, and BR4 now rejects a genuine lost graphics context that the old work-ratio guard passed. The exact measured census snapshot is integrated without changing any coverage assertion, horizon or configuration. All 48 final-build performance rows are valid: GPU medians are 59.75–59.88 FPS; software base and held-out median intervals rise 33.3→50.0 ms (1.5015×, above the predeclared 1.25 limit). Corner median intervals alone pass while FPS falls 59.75→46.88; that is not steady-rate parity. The stronger software criterion remains UNMET, with no unavailable sibling feature asserted as its cause. The one bounded pixel-preserving candidate was rejected and restored, and no further timing candidate is implied. The useful M1/B and gameplay increment is ready for final gates and publication, with the original performance gap explicitly retained in work 130. Full final gate, certification, merge/push and hosted acceptance remain pending.

2026-10-17 full gate 1: native exit 1, unit duration 376.27s, 648 files/5,008 tests passed, one file/three tests skipped, and one failed case. The final post-IR3 no-attack lab census passes its unchanged producer assertions and exact measured JSON at 45,000 ticks. The sole failure is the Standard-rules relic self-play case: owner 2 deposits one relic at tick 35,511, but no all-relic countdown starts within 45,000. No conclusion yet identifies a product defect or valid changed trajectory. The AI owner receives the exclusive heavy slot for one maintained ledger/history diagnosis of that exact seed/configuration/horizon. Content validation passed; typecheck, browser, lint, build and receipt write were not reached. No certified receipt exists. The failed output and native-exit record remain ignored, and all owned gate descendants were cleaned.

2026-10-17 Standard-match diagnosis: the maintained exact seed/configuration/horizon audit completed 45,000 ticks in 226.43s, native exit 0 (instrument completion, not a passing test). Its 180 history chunks have no truncation and the 737-input source digest is unchanged. Relic 2261 is picked up by owner 2 Monk 2367 at tick 35,155, travels from (40,10) toward its own completed Monastery 2231 at (42,29), and is deposited at 35,511. Relic 2260 stays at (24,24), explored only by owner 1, which remains Feudal without a Monk or Monastery. Owner 2 ends with three unladen Monks and no relic task. There is no transport stall and the all-relic countdown must not start. Independent contract review accepts keeping the same Standard seed/settings/45,000-tick horizon with actual delivery, conservation and premature-countdown guards, plus a separate unconditional all-known AI collection/countdown case. Test-local prior-exploration setup avoids a product/scenario change; implementation and sensitivity proof are pending. Raw audit and terminal save remain under ai-relics/tmp/probes/work133-relics until retained in the primary ignored handoff folder.

2026-10-17 relic-contract repair: independent plan/source review accepts the two-file test-only patch (test SHA-256 7229f27884a1d61e8d770862ac43247f2a6a671ff6f99b64c03e3460bb4ef76c; helper 929be17e0fc82a9eb9a86f1f17fdeb31a5c6769553cb696a4ace9c279474a373). The exact-source matrix passes both healthy cases, rejects both with the original carried-ground claim restored, and passes both after exact restoration. Short mutant failure is its positive all-pickups assertion, not the later travel/countdown assertions. No product code, seed, long horizon or AI strategy changes. Preservation audit now finds 100 single-owner files byte-equal to branch tips, 17 differences accounted for by accepted overlays, ten shared files independently reviewed, and no unaccounted extra path. Final full gate 2, certification, main merge/push and remote acceptance remain pending; the stronger software criterion remains unmet.

Proof promotion uses LF and a single final newline to satisfy the existing checkout gate. Original ignored authored proof SHA-256 ec446c28e8fea9069127465df55c875bb16bc41f246c7844f6ba951f93845226 is retained unchanged; promoted text SHA-256 967d82aa59a5131fed01b137e706ed0e6bb0348da4b24c3cf01c8cda4d9dc281 differs only in line endings and the extra final blank line. The earlier mixed-ending preflight is recorded as failed, not a product or runtime failure.

2026-10-17 full gate 2: native exit 0, all stages reached completion. Vitest reports 649 passing files/5,010 passing tests and one skipped file/three skipped tests; Playwright reports 271 passes/two existing skips. Content validation, typecheck, lint and final build pass. The receipt records the complete run but is correctly NOT CERTIFIED because the precommit tree is staged. Independent final round 7 rehashed all 193 frozen paths and accepted the exact increment with no new material finding. Its bounds preserve the stronger software criterion as unmet. A clean committed-tree full run, receipt check, main publication, hosted acceptance and junction-safe cleanup remain pending.
