# Lessons

The one-line form of every lesson this repo has paid for and has NOT yet gated. Read this file at session start; it is short by construction, because every entry leaves as soon as its gate lands.

Each rule links into [lessons-evidence.md](lessons-evidence.md), which holds the war story and the anchor. Open that only when a rule is in doubt, or the work is in that area — it is not session-start reading.

A new lesson is an entry there plus one line here, and that line NAMES THE GATE it is waiting for. If you cannot name one, this is not the file: put it in [local-rules.md](../policies/local-rules.md) if it is true only here, stage it for the constitution if it is fleet-wide, or drop it.

When the gate lands, prove it red by reintroducing the defect and delete both halves in the same commit. (The file restarted EMPTY on 2026-09-02 — see the local rule; the deleted 84-entry index is in git history and is not to be restored.)

## Rules

- A rendering trick calibrated against a hardware limit is only as good as the limit you MEASURED — a step chosen for a 24-bit depth buffer silently does nothing on a 16-bit one, and the failure is invisible on the machine that chose it — **gate:** a browser spec reading `gl.getParameter(gl.DEPTH_BITS)` off the live world canvas and asserting >= 24, so the assumption fails loudly instead of degrading into torn shadows on someone else's device ([evidence](lessons-evidence.md#a-rendering-trick-calibrated-against-a-hardware-limit-is-only-as-good-as-the-limit-you-measured-2026-09-02))
