# Findings and Guidance

## Practical Findings from the Current Revision

These facts came directly from inspecting `design/stats`:

- `civilizations.csv` currently resolves to `30` unique civilization names.
- `civilizations.csv` no longer contains duplicate civilization names after local cleanup.
- `civilizations.csv` currently includes expansion labels up through:
  - `Age of Kings`
  - `The Conquerors`
  - `Forgotten Empires`
  - `African Kingdoms`
  - `Rise of Rajas`
- some civilization fields still encode multiple unique units or unique techs as semicolon-delimited strings inside one CSV cell
- `units.csv` and `technologies.csv` are still dominated by the classic generic and AoC-era roster.
- The local bundle therefore does not yet represent the full current live-DE roster.

## Guidance for Future Edits

- Treat `design/stats` as canonical content unless the repo owner explicitly says otherwise.
- If the spec mentions DE features or content patterns not fully present in the local CSVs, mark them as framework requirements or data gaps, not as already-shipped local content.
- Do not hand-copy all civ bonuses, unit rosters, or tech trees into prose when they already live in `design/stats`.
- If full current-DE parity becomes a goal, extend the local stats bundle first, then update the spec.
