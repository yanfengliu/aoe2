# Lessons

The one-line form of every lesson this repo has paid for and has NOT yet gated. Read this file at session start; it is short by construction, because every entry leaves as soon as its gate lands.

Each rule links into [lessons-evidence.md](lessons-evidence.md), which holds the war story and the anchor. Open that only when a rule is in doubt, or the work is in that area — it is not session-start reading.

A new lesson is an entry there plus one line here, and that line NAMES THE GATE it is waiting for. If you cannot name one, this is not the file: put it in [local-rules.md](../policies/local-rules.md) if it is true only here, stage it for the constitution if it is fleet-wide, or drop it.

When the gate lands, prove it red by reintroducing the defect, record that in [gate-proofs.md](gate-proofs.md), and delete both halves in the same commit. (The file restarted EMPTY on 2026-09-02 — see the local rule; the deleted 84-entry index is in git history and is not to be restored.)

## Rules

- **A browser spec whose duration is within a few seconds of the timeout is already red on somebody's machine.** GATE: a per-spec duration budget in `playwright.config.ts`, set below the 30s test timeout once the current distribution has been measured with `--reporter=list`, so a spec that creeps toward the budget goes red while there is still headroom. Evidence: two were found on 2026-09-04, and both had been passing. `keeps top status-bar chip positions stable` ran **29.8s against a 30-second budget** on an idle machine and timed out the first time a loaded one ran it — 25.5s of it was a single click on a card the population cap had made unavailable, waiting out Playwright's actionability check. `trade-route-reach` failed about one run in six against an identical build, on two separate races. Both are FIXED and both are in the register; what is not gated is the class, and every runner this repo has is slower than the one it is authored on.

(The queue was emptied on 2026-09-03 when the depth-precision gate landed —
`tests/browser/shadow-depth-precision.spec.ts`, proof in
[gate-proofs.md](gate-proofs.md). An entry belongs here only if it names the
gate that will retire it.)
