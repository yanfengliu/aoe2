# Review: AGENTS Claude reviewer model switch, iteration 1

## Scope

Change `AGENTS.md` files under `C:\Users\38909\Documents\github` from Fable-based Claude reviewer commands to the latest Opus 1M context model because Fable is banned for now.

## Codex

- **MEDIUM:** `python_mini_metro/AGENTS.md` still documented a live Claude reviewer command using `--model best`. Although it did not contain a literal Fable string, `best` did not satisfy the cross-repo requirement to use the latest Opus 1M context model.
- **Disposition:** fixed in iteration 2 by changing that command to `--model "opus[1m]"`.

## Claude

- **IMPORTANT / Scope awareness:** live non-AGENTS Fable callers remain, including `investing/scripts/run_retro.cmd` and the aoe2 playtest harness. These are real follow-up candidates if the Fable ban is operational everywhere, but they are outside this AGENTS.md-only task.
- **MINOR:** aoe2 devlog did not yet record the reviewer-model sweep.
- **MINOR:** the alias-vs-pinned-model wording could read inconsistently with the new `opus[1m]` alias.
- **Disposition:** devlog entry added; shared AGENTS wording now distinguishes latest-family aliases from pinned model IDs. Non-AGENTS Fable callers were left untouched by scope.

## Result

Iteration 1 found one real AGENTS coverage gap and two documentation/process cleanups. Re-review required.
