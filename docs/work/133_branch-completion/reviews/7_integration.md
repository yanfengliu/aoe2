# Work 133 — final integrated acceptance review

## Target

2026-10-17, work 133 final integration review. Base: `af328ae641165def6622029ae6af6f617bd0085a`. Frozen staged tree: `27a02fe6355e3d083b3850d91d0c7df4cc162ccb`, 193 paths, in `C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017`.

Recoverable input: `C:/Users/38909/Documents/github/aoe2/tmp/work133-retained/final-review/final-input.patch`, SHA-256 `e3def52c20dc41a17d862f1016fc1aa344c5d2418ba349e0f4da3f69756c9fa9`. Its adjacent `final-target.json` records every path hash. I independently rehashed all 193 current files: zero mismatches. Read-only comparisons found no staged difference from the frozen tree and no unstaged changes.

The executable/expectation increment since broad review 2 consists of exactly these six files:

| Path | SHA-256 |
| --- | --- |
| `src/game/simulation/bridge/footprintClearing.ts` | `cf96acd46ef734c971723c4fe67d4c5f74c032141bd960832760b14a6066eff4` |
| `tests/simulation/foundationStartAnimals.test.ts` | `87f441191e6743607ea2c1c71466dac87cf4657f289cf642d5a0e7c1c75d4a01` |
| `tests/simulation/selfPlayContentCensus.expected.json` | `269a2e5b064905d7ae9ef2c438e2cd57f170ef4aece69ecc413699767b267dc2` |
| `tests/browser/presentation-keeps-still-world.spec.ts` | `021018317503088c9d45b6ef49613019eb82d2aa3ddc7c4c09c4e5183257d243` |
| `tests/simulation/aiRelicsSelfPlay.test.ts` | `7229f27884a1d61e8d770862ac43247f2a6a671ff6f99b64c03e3460bb4ef76c` |
| `tests/simulation/aiRelicsSelfPlay.helpers.ts` | `929be17e0fc82a9eb9a86f1f17fdeb31a5c6769553cb696a4ace9c279474a373` |

These match the precise repair targets accepted in rounds 3–6.

## Reviewers and coverage

Independent collaboration reviewer `final_acceptance_review`, under the fleet Astra/xhigh assignment. Read-only review of work 133’s plan, design, rounds 0–6, final increment, adjacent product contracts, retained evidence and acceptance limitations. I inspected the actual six changed files rather than relying solely on their earlier reports.

Outside the increment, I read relic ownership in `src/game/simulation/bridge/matchEndOps.ts:126`, visibility composition in `src/game/simulation/bridge/visibilitySlots.ts:63`, unit passability in `src/game/simulation/bridge/cellPassability.ts:249`, and owner/team gate admission in `src/game/simulation/gates.ts:51`.

I did not reread every line of the original 177-path implementation or independently repeat the owner’s branch-preservation audit. Broad coverage remains attributed to round 2, supplemented by the exact subsequent repairs and this integration check.

Claude remains unavailable: automatic approval review rejected the earlier source export before execution. That lane supplies no report or approval. No source was exported by this reviewer.

## Reports

**No new material implementation defect found in the frozen final increment.** The previously identified fixes remain present together, with no uncovered product-source change after their focused reviews.

Foundation reassignment preserves atomic clearing. `footprintClearing.ts:211` replaces the unsuccessful provisional plan only after a complete fallback succeeds; actual relocation remains deferred until line 224. Exclusive animal cells and capacity-aware unit reassignment at lines 137–163 preserve IR1 while addressing IR3’s asymmetric exits. The inspected tests exercise both the sheep/shared-cell case and owner-specific gate alternative. This remains bounded to existing terrain/passability predicates and the stated synthetic cases.

The relic repair retains positive transport requirements. `aiRelicsSelfPlay.test.ts:52` requires correlated home delivery, and line 53 requires no terminal carrier. Its companion unconditionally requires all three pickups, qualifying transports, stored relics and the correct countdown at lines 99–104. The helper independently checks conservation and live references, associates disappearance with an actual store increment, and checks countdown ownership at lines 91–154. Its expected victory condition agrees with the unchanged product ownership rule; it does not derive its expected answer by calling that rule.

The draw guard at `presentation-keeps-still-world.spec.ts:54` requires positive committed runtime frames equal to wrapper frames and uses committed frames as the denominator. The previous ratio, observation window and accepted-revision requirements remain intact. Round 4’s real-context-loss proof therefore still applies to these exact bytes.

The census expectation remains the exact measured JSON accepted in round 3. Its producer assertions and test configuration were not changed in this increment. The later post-IR3 full-gate census result is reported by the owner as passing; the earlier red run and documented gains/losses remain preserved.

Read-only comparison against measured tree `8a20dae29982e9b01388e3f5acebcf24f1555c61` found no changes under `src`, `scripts`, package manifests or `.github`. The final performance evidence therefore remains relevant to the frozen product. The rejected ground-order experiment has not silently become a shipping change.

## Findings and disposition

| Item | Disposition |
| --- | --- |
| IR1–IR3 | Previously accepted repairs remain integrated on their reviewed bytes. No new material defect found in this increment. |
| BR1–BR4 | Corrected measurement interpretation and committed-draw guard remain intact. Earlier invalid comparisons are not rehabilitated. |
| CR1–CR3 | Exact test repair and prior healthy/mutant/restored proof remain applicable. The short mutant first fails its complete-pickup assertion; later assertions were not reached. |
| Stronger software performance criterion | **UNMET.** Base and held-out median intervals rise 33.3→50.0 ms, ratio 1.5015 against 1.25. This is an outstanding acceptance condition. |
| GPU performance | Bounded pass from the reviewed matrix: group medians 59.75–59.88 FPS against the 55-FPS requirement. No universal hardware or scene claim. |
| DE comparison | Gallery and sourced comparisons are present and candid. No matched live-DE scene or complete gameplay-parity verification is established. |
| Final delivery | Pending full-gate completion, certified committed-tree receipt, main integration/push, hosted acceptance and resource retirement. |

## Verification

I independently checked the frozen patch digest, all 193 manifest entries, staged/working-tree identity and the limited executable delta. I read the eight retained renderer diff logs; each reports zero changed pixels out of 1,024,000. These are retained execution artifacts, not fresh reviewer-run pixel comparisons.

I inspected two control captures at native resolution and verified their hashes:

- Wonder tooltip: `2c5841e5e2aa725efab07dbee8bd318430a441b60cc3561dcc4bb3cf86c287e7`; visibly shows 197 years and 16:25.
- Missionary: `d2b99de0d6bb67a331c8e847942fc996e60dc9f90436e09863dd4ad52c99b2a3`; consistent with the documented limitation that a distinct carried attachment is not established by the still.

The six-control handoff explicitly distinguishes actual mouse/HUD orders from setup, observation and capture. Its initial clock assertion failure and corrected elapsed-tick bound remain recorded. I did not independently replay those controls or inspect every retained image. `git check-ignore` confirms the requested primary `tmp/visual-gallery/index.md` is ignored.

The required initial `npm run ci:status` returned UNKNOWN because it could not resolve the worktree commit. The owner subsequently reported fresh scoped/elevated GREEN results for remote main `ec500a61`, CI `39064945385` and corpus `39064945443`. Those certify remote main, not this pending integration.

At the last owner update, full gate 2 had 649 passing unit files/5,010 passing tests, one skipped file/three skipped tests, and passing typecheck; browser execution was still underway. No completed full-gate verdict, certified receipt or integrated hosted verdict is supplied by this review. The first full gate’s failure remains part of the record.

I ran no tests, simulation, build, browser, benchmark or profile; changed no files; and made no Git mutation. No persistent process was launched.

## Round outcome

Accept the frozen implementation increment for proceeding through the remaining landing gates, with no new material code finding from this review. Prior review repairs remain accounted for on exact matching bytes.

This does **not** establish whole-task completion. The stronger software performance criterion remains unmet, and final verification, certified receipt, main publication and hosted acceptance remain the integration owner’s outstanding responsibilities.
