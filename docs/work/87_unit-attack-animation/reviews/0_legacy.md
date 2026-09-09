# Review iteration 1

## Scope

OpenAI Codex reviewed the committed successful-hit projection and attack-pose range against the live codebase, focusing on replay/save boundaries, fog, Monk command semantics, warm/fresh presentation, bounded work, and tests. Anthropic Claude was requested but the tenant's private-diff export policy blocked that provider before execution; no AoE source was sent to Anthropic in this iteration.

## Findings and disposition

- **MEDIUM C1 — replay attack imports were unbounded and noncanonical. Fixed.** Hydration now examines only the final 1,024 candidates, validates finite in-bounds fresh events, canonicalizes witnesses, and retains the latest record per generation-aware attacker key.
- **MEDIUM C2 — Monk attacks could pass through minimum-damage and persisted-command paths. Fixed.** Semantic validation and the direct helper reject new Monk attacks, and the execution boundary clears any hydrated/persisted Monk attack before damage or event emission (`0cffba7`).
- **MEDIUM C3 — warm and fresh attack recovery could diverge. Fixed.** Attack phase, weight, source, and target are sampled from the event/display tick rather than renderer-history accidents (`3f9b242`).
- **MEDIUM C4 — event projection performed avoidable repeated scans. Fixed.** Generation-aware maps index active events and witnesses so hot projection/reconciliation work is bounded by active and previously active cues.
- **MEDIUM C5 — quiet replay output ticks dirtied the recorder slot. Fixed.** Bootstrap publishes the format once; later output changes only on add, change, or expiry (`755d054`).
- **IMPORTANT in-process verifier — raw persisted Monk commands bypassed command admission. Fixed.** The execution guard above closes the path independently of API validation.

## Result

All findings were reproduced against live code before repair. Focused tests covered canonical hydration, generation identity, quiet publication, Monk admission/execution, and warm/fresh sampling before the next external iteration.
