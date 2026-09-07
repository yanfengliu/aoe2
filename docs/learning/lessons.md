# Lessons

The one-line form of every lesson this repo has paid for and has NOT yet gated. Read this file at session start; it is short by construction, because every entry leaves as soon as its gate lands.

Each rule links into [lessons-evidence.md](lessons-evidence.md), which holds the war story and the anchor. Open that only when a rule is in doubt, or the work is in that area — it is not session-start reading.

A new lesson is an entry there plus one line here, and that line NAMES THE GATE it is waiting for. If you cannot name one, this is not the file: put it in [local-rules.md](../policies/local-rules.md) if it is true only here, stage it for the constitution if it is fleet-wide, or drop it.

When the gate lands, prove it red by reintroducing the defect, record that in [gate-proofs.md](gate-proofs.md), and delete both halves in the same commit. (The file restarted EMPTY on 2026-09-02 — see the local rule; the deleted 84-entry index is in git history and is not to be restored.)

## Rules

_Empty._

(The duration-budget rule was deleted on 2026-09-06 without a gate, because the
gate it named was BUILT and the measurement REFUSED it: per-test duration on one
machine swings up to 2x between two runs of the same bundle, in both directions,
so no threshold sits between "somebody was compiling" and the timeout that
already exists. Per the constitution an entry that can name no workable gate is
not a lesson, and repo-only knowledge goes to
[local-rules.md](../policies/local-rules.md) — where its substance and its
numbers now are, together with the standing instrument that replaced the gate.
Nothing was added to [gate-proofs.md](gate-proofs.md): no gate landed, and
recording a refutation there would misrepresent it. The register entry of
2026-09-06 is the full account.)

(The queue was emptied on 2026-09-03 when the depth-precision gate landed —
`tests/browser/shadow-depth-precision.spec.ts`, proof in
[gate-proofs.md](gate-proofs.md). An entry belongs here only if it names the
gate that will retire it.)
