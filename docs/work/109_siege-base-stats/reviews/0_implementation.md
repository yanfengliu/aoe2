# Review 0: implementation

## Target

Nine uncommitted source/test inputs in private worktree `siege-content-1001`, base and observed HEAD `10c26f52f0810321784603a7b73f3fbf6789dc44`, installed civ-engine2.5.0. This is a bounded source review of ten Onager, Ram and Heavy Scorpion base values and their CSV/runtime/simulation checks.

## Reviewers and coverage

`/root/siege_source_review` performed the configured pinned Astra/xhigh direct source read. This was one reviewer, not a two-provider or external CLI review. The reviewer read raw DE IDs and separately hashed English-name mappings, exact CSV/runtime changes and tests, relevant factory/upgrade/armor/replay code, and the prior focused RED/GREEN receipts. The reviewer ran no tests, mutated no source/Git/docs, and made no visual, real-control, full-gate, remote or shipping claim.

## Reports

The complete original [source report](../snapshots/source-review0/report.md) is retained unchanged:12,157 bytes, SHA256 `3c6a0c62c043abf7867aa8e0f02164c77dceb9823f0117187a35a4f22bb6ec14`. The exact [56-input provenance manifest](../snapshots/source-review0/inputs.json.txt) is retained unchanged:20,571 bytes, SHA256 `b3c595cb7675169905a27bae0bcc8fb953c11f702a4054cc7f8640db390533a7`. Both authored records are below256KiB; no raw run logs are promoted.

## Findings and disposition

No material source-value, implementation or bounded simulation-test defect was found. S1/P3 found two test labels implying update185872 established all ten values, when it supports only Onager attack/pierce and three Ram sight corrections. The labels were narrowed to name data pin3bb43b14 and the five-value official bound (test SHA256 `aac3b273…`). No expected value or assertion changed. The exact [two-string inverse label delta](../snapshots/source-review0/test-label-delta.json.txt) recovers reviewed test SHA2564a45969e995666413c911cc3b38508b89e9da61ef638e72906ee2723ab347ed6 from current SHA256aac3b273e7e5f8e3f82353cfad68aff8ec5c170a552d31ea07a2bfcfd7f80f98; root independently verified recovery. The exact report remains historical; this wrapper does not rewrite it as though the repair preceded review.

## Verification

The report inspected focused-green-02: native exit0,37/37 checks (23 content,14 World), zero skipped/todo,14.37seconds and completed cleanup; all12 frozen inputs matched. Content RED executed23 with19 stale-value assertion failures/four controls; initial World RED had nine stale-stat assertions and five preparation failures. Root separately accepted bounded real controls:4,336 ticks,47 trace actions (not user inputs), actual Ram production/upgrades, Onager and Heavy Scorpion body/DOM stats, and isolated4/5/6 sight witnesses; all six before/after/diff screenshots and confined pixel bounds were also accepted. This does not close full verify, final review, main/push or hosted gates. Old-save evidence is reconstructed schema2, not an authentic old-save corpus.

## Round outcome

Source values and bounded implementation/tests are accepted within the report limits; P3 wording is corrected in the candidate. This wrapper claims no re-review of that text-only repair and no shipping verdict. The later sensitivity receipt (SHA256 `1efc2703bbb61efcaf73a2d2f8a667097ca5d41bb4e5c27377561bd5d2d98750`) records test-native RED exit1 (22/23; only the expected Onager attack assertion failed), then test-native GREEN exit0 (23/23). The outer wrapper's native1 was a PowerShell 5.1 array-closing bookkeeping error; frozen12-input manifest SHA256 `365f596473877529affa1fecca6b4c2d1371f40b9935f964fda06458363f92b0` binds the population. Sensitivity receipt1efc2703 above contains the independent actual closing rehash confirming all12 inputs unchanged. Full verification, integrated review and shipping remain pending.
