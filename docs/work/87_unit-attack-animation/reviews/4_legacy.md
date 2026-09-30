# Review iteration 5

## Scope

OpenAI Codex externally reviewed the iteration-4 fog repair against the live worktree and was directed to verify every claim against the actual symbols, tests, documentation, and replay lifecycle. Anthropic Claude was not retried in this iteration because its earlier authorized invocation had been blocked before execution by tenant policy.

## Findings and disposition

- **HIGH — one visibility refresh was cached for the entire combat tick while later same-tick impacts recorded current coordinates. Confirmed and fixed.** Two attacks in one tick can mutate vision sources between impacts; the second event could therefore pair fresh hidden coordinates with the first event's stale witness set. The recorder now synchronizes visibility immediately before every successful impact. Unchanged-source fingerprints still avoid rebuilding the visibility map, but the source scan intentionally remains per impact. A red regression proved the old path refreshed once and retained both events; the fixed path refreshes twice and retains only the perspective-eligible event.
- **MEDIUM — renderer-local cue tombstones were lost when a replay bridge was reconstructed from a later checkpoint. Confirmed and fixed for newly recorded checkpoints.** The bounded feed now persists a canonical `suppressedFor` perspective set when a witnessed attacker leaves that perspective's view, before recorder checkpoint publication. Projection honors that state in live, replay, and filtered paths, while the renderer tombstone remains defense in depth. A fresh replay bridge no longer resurrects the cue. Historical checkpoints written before the field existed cannot reconstruct an earlier hide/reveal and retain their backward-compatible behavior.

## Result

The new regressions failed against the prior implementation and passed after the fixes. An in-process replay/fog refuter independently reproduced the stale same-tick leak and then verified the repair; a persistence refuter found no remaining semantic defect but caught that the expanded test file exceeded the hard 500-line architecture gate. The tests were split by lifecycle into a sibling persistence file instead of adding an exemption. Focused verification then passed six files and 32 tests, including the file-size gate. Because iteration 5 found substantive issues, iteration 6 must review the complete corrected diff before the thread closes.
