# Narrow-choke queueing review

## Scope

Reviewed the live simulation integration, traffic arbitration, transform stepping, persistence shape, focused regressions, specification, architecture records, and user-facing release note for v0.3.2.

## Adversarial findings and resolution

1. The first pass rejected move-only straight-corridor arbitration because monk/villager tasks were excluded, cached route direction was not serialized, and bends lost the choke contract. Focused RED tests reproduced all three; the implementation now uses serialized intent, includes task movers, and recognizes either endpoint's permanent flank pair.
2. The second pass found symmetric head-on waiting and same-tick worker activation bypass. RED tests reproduced both; actual attempted-leg reservations and pre-movement task intent make a stable caller yield while later systems see newly activated travel.
3. The third pass found call-order deadlock under misleading final headings, no winner for longer occupied cycles, and double admission from a co-located origin. RED tests reproduced all three; actual cardinal legs, directed-cycle closure, lowest-id release, and one origin reservation resolve them.
4. The fourth pass found stale legs after intent replacement, false cycle acceptance with an extra acyclic occupant, possible winner election for a noncaller, and owner-blind origin reservations. Three tests were RED and the existing conservative noncaller behavior was pinned; intent/tick provenance, all-branch closure, recent-caller eligibility, and owner scoping close the defects.
5. The fifth pass found no remaining code blocker. Its documentation blockers—four-field wording plus architecture/drift coverage—were corrected before the final gate.

## Verification

- Focused architecture and traffic contract: 18/18 passed.
- Full unit suite: 287 test files passed and 1 skipped; 2,165 tests passed and 2 skipped.
- Typecheck and lint: passed.
- Production build: passed, 565 modules transformed.
- Production-only and full dependency audits: zero vulnerabilities.

## Conclusion

Approved. The change preserves permanent-only global routing, confines temporary congestion to deterministic local arbitration, persists only the minimum provenance needed for save/load parity, and fails closed for stale or ambiguous occupied dependencies.
