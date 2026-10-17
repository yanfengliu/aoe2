# Review 0: integration

## Target

Early combined working tree against main af328ae641165def6622029ae6af6f617bd0085a. Preserved input: tmp/work133/review0-input.patch, SHA-256 C58C384F99A2AD3140F44E530CFFBAD200151EC1C04C72415AB4A16ED4190DCC (153 paths). The performance M2 and foundation refund M2 overlays were not yet present. This is an early risk review, not final acceptance. The input remains ignored evidence until its target is recoverable after integration.

## Reviewers and coverage

Independent collaboration reviewer integration_review, gpt-6-astra at xhigh per the fleet review pin. Read-only; no tests, gates, builds, browser, server or file writes. Coverage concentrated on gatherer transitions and rally assignment, Monk/relic occupancy, foundation clearing/reachability, countdown derivation, rendering/HUD caches and surrounding eligibility/planning code.

## Reports

### Independent Astra reviewer

Early integration review found two material defects. This is not final acceptance.

**IR1 — P1: Foundation clearing can place an animal over a unit and strand it.** footprintClearing.ts:136 computes every destination against unchanged occupancy, then performs all moves at line 148. With an own villager and sheep inside a foundation and only one open exit, both searches select that cell. Relocation moves units before animals; the sheep then adds a blocking resource claim over the villager. The foundation starts, but the villager now stands on blocked ground and cannot route away. Two animals can likewise receive the same destination. Existing animal tests exercise individual occupants and an already-impossible exit, not competing successful plans. Reserve proposed destinations while preserving the all-or-none contract, accounting for exclusive animal cells and unit capacity. Gate mixed occupants, two animals, insufficient capacity, movement after successful clearing, and save/replay consistency. Root accepted this for repair; /root/ai received the reproduction and owns the fix.

**IR2 — P2: Direct rally assignment bypasses Farm ownership checks.** productionQueueSystem.ts:220 now installs the rally resource ID directly. Its helper at line 43 checks harvestability and economy kind, but receives no gatherer owner and never checks ownership. A Town Center rallied to another seat's Farm therefore produces a villager that walks to and harvests that Farm. The prior generic assignment applied the ownership/domain filters; the new direct route bypasses them, and the gathering step does not restore those checks. Outside the diff, gatherCommandOps.ts:54 explicitly rejects another owner's Farm, and movementPlanOps.ts:373 confirms that resource approach planning only answers routing. Keep exact-node rally targeting, but apply canonical gather eligibility first. Cover own Farm success, enemy/allied Farm refusal, and valid/invalid domain targets through production. Root accepted this for reproduction.

These are code-grounded findings; I did not execute reproductions or tests under the read-only assignment. No additional concrete defect was established in the inspected countdown, Monk, or rendering paths. That does not approve the uninspected portions of the 153-file integration.

Acceptance should remain pending until these fixes receive focused review and the combined tree passes its prescribed controls, save/replay checks, visual comparison, full gate, and hosted checks. The forthcoming performance M2 and foundation refund M2 require their own integrated review. Preserve the per-branch content audit: the pending ours merge proves ancestry only, not that each branch's behavior survived.

The required initial npm run ci:status returned UNKNOWN — could not resolve the commit to report on in this sandbox. The plan records the owner's separate elevated green result; I did not independently confirm remote status. No files were changed and no browser, server, or persistent process was launched.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 / IR1 | Foundation occupants compete for unreserved exits | Accepted; worker reproduced mixed occupants, animals and unit-capacity failures | Foundation owner repairs reservations and adds red/green gates; focused re-review required |
| F1 / IR2 | Direct rally bypasses ownership/domain eligibility | Accepted for reproduction; canonical gather route has the missing predicate | Gatherer owner repairs eligibility through real production; focused re-review required |

## Verification

Owner's combined TypeScript check exited 0 before review. Focused architecture run: three files passed and the register rollover failed on four excess closed entries; those entries were moved verbatim afterward. Neither result proves the new review defects fixed. Reviewer source access was read-only and no fresh runtime or remote verification was performed by the reviewer.

## Round outcome

Two material findings remain assigned. Final integrated review, performance M2/refund M2 coverage, runtime acceptance and main publication remain pending.
