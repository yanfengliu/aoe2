---
name: multi-cli-review
description: Use when running the multi-CLI (Codex + Claude) adversarial code review on high-risk changes or full-codebase audits — routes to the fleet-canonical runbook (pins, commands, output extraction, failure modes) plus aoe2-specific pin sites.
---

# Multi-CLI review — aoe2 stub

**Read the fleet-canonical runbook now:** `../loop-ops/docs/skills/multi-cli-review.md` — current review model pins (the fleet's single bump site), exact CLI commands, `-o` output extraction, Windows gotchas, and failure modes. Do not act from memory of an older per-repo copy of this skill.

aoe2-specific notes:

- Reviewer pin sites in scripts: `scripts/propose-fix.mjs` hard-codes both reviewer pins (Claude `claude-opus-4-8[1m]` per `design/spec-final.md` §15.7 while the Fable-5 ban stands; Codex synced to the fleet pin `gpt-5.6-sol`/ultra on 2026-07-09). Sync it on every fleet pin bump.
- The playtest LLM pin (ONE model for every harness call) is app-facing and governed by `design/spec-final.md` §15.7 — never bump it from review tooling.
- Capture and artifact conventions (`tmp/review-runs/<objective>/<date>/<iteration_number>/`, thread `REVIEW.md` under `docs/threads/`) are defined in AGENTS.md (Core rules / Team of subagents).
