# Review: AGENTS Claude reviewer model switch, iteration 2

## Scope

Re-review the full AGENTS sweep after fixing `python_mini_metro/AGENTS.md` and clarifying latest-alias guidance.

## Codex

- **Findings:** no blocking findings for the AGENTS.md-only change.
- **Verification:** all 10 `AGENTS.md` files under `C:\Users\38909\Documents\github` are free of `fable`, `claude-fable`, `Fable`, and `--model best`; every Claude reviewer command in those files now uses `--model "opus[1m]"`.
- **Awareness:** non-AGENTS Fable callers remain as out-of-scope follow-up candidates.

## Claude

- **Findings:** no bugs, security issues, or performance concerns for the stated AGENTS scope.
- **Verification:** `opus[1m]` is accepted by the Claude CLI; coverage is uniform across all 10 AGENTS files; Codex and Gemini reviewer strings were correctly left unchanged.
- **Awareness:** the `python_mini_metro` change intentionally shifts its Claude reviewer from `best` to explicit Opus 1M, and non-AGENTS Fable runtime callers remain outside this diff.

## Result

Review converged. The AGENTS.md scope is ready with follow-up awareness for live Fable callers outside AGENTS.
