# Debugging session — <short title>

Copy this file into `docs/debugging/<YYYY-MM-DD>-<slug>.md` at the start of a new
debugging session. Iterate on it as you investigate. Write learnings into
the gate that prevents a recurrence when the session is resolved — the knowledge
goes in that gate's own header, not into a list. Clean up any dump files
created during the session, but keep this `.md` file.

## Symptom
What the user or a test is observing. Include the exact error message, fixture
seed, command, or steps to reproduce.

## Expected vs actual
- Expected: ...
- Actual: ...

## Reproduction
- Which engine debug tool answers this, named BEFORE any probe of your own: `replay:inspect` on a recorded bundle for "what stood at tick T"; `diffBundles` / `SessionReplayer.forkAt` for two runs side by side; the path-queue and occupancy probes for who is blocking whom — or why none does (AGENTS.md, Debugging).
- Commands / URL / seed used to reproduce reliably.
- Any temporary instrumentation added (remove before closing the session).

## Hypotheses
List candidate root causes in priority order. Note what would confirm or rule out
each one. Keep this list pruned as hypotheses are disproved.

- [ ] Hypothesis 1 — how to confirm, what it would imply.
- [ ] Hypothesis 2 — ...

## Investigation log
Chronological notes. Prefer concrete observations over guesses.

- YYYY-MM-DD HH:MM — ...

## Root cause
Single-sentence summary once you are confident.

## Fix
What changed, which files, and why this specific fix addresses the root cause
rather than the symptom.

## Verification
- Commands run (full gate: `npx vitest run`, `npx tsc --noEmit`, `npx vite build`).
- Browser tests if relevant: `npm run test:browser`.
- Any new regression tests added.

## Follow-ups
- Engine-level gaps worth flagging in `docs/engine-feedback/current.md`.
- The gate that now prevents this, and where its header carries the reasoning.
- Architecture implications, if any.
