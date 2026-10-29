# What "done" means for this project (2026-09-03/04, owner, standing)

One of [this repo's local rules](../local-rules.md), where "above" and "below" mean earlier and later in its list.

The game is built **to completion**, matching Age of Empires II: Definitive Edition. Feature-complete means all five of rendering, technology, playability, freedom from bugs, and performance — and it is verified with **AI self-play**, not with a passing suite.

The acceptance test is a sentence, and it is re-checked every time the work looks finished: **"can we play this and feel like we're playing DE?"**

**Why:** the owner has restated this at the head of every standing-loop session, and it kept arriving as prompt text rather than as anything the repo held — which is the one place it cannot survive. It is the tiebreak above every other rule here: the [§1 source-of-truth order](../../../design/spec-final.md) says what a rule IS, "Behaviour matches the real Age of Empires II" below says which edition wins, and this says when the work is over.

**How to apply:** a change is not done because its gate is green. It is done when a match has been played with it (see "Every feature is playtested the way a human plays" below) and the whole rendered result has been swept for what is WRONG rather than for what was touched. All visual work is ORIGINAL or procedural art and all audio is procedural or original — no reproduced AoE assets — which is the one place this project deliberately does not match DE. The modern HUD was a second until 2026-09-25, when the owner put the HUD inside the DE target (the HUD entry below). Moebius, kept selectable for the world beside the DE look (spec §14.5), is an option rather than a divergence from the target; Natural is prepared as the default in v0.3.240, and a stored Moebius choice is retained.
