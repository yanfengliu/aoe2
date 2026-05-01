# aoe2 engine-bump 0.8.12 → 0.8.13 Review

**Date:** 2026-04-30
**Reviewers:** Codex `gpt-5.5` xhigh — UNREACHABLE; Claude `claude-opus-4-7[1m]` max ✓ ACCEPT
**Disposition:** ACCEPT (single-reviewer; Codex blocked by Windows PowerShell sandbox restrictions on `rg` with complex quoting — same Windows-specific failure mode documented in lessons.md)

## Codex unreachable

Codex started normally and made 4-5 successful `rg` calls reading civ-engine source/docs, but eventually got blocked by the read-only sandbox's PowerShell pattern-match restrictions; the output ran 315 lines mostly of dumped file content with no final review section. Per AGENTS.md "if a CLI is unreachable, proceed with the remaining reviewer."

## Claude ACCEPT — verified zero-impact tracking commit

> 1. Lockfile bump consistent with upstream — civ-engine/package.json at 0.8.13; aoe2 package-lock.json correctly reflects same.
> 2. API names accurate — all four symbols (`bundleHotspots`, `BundleHotspot`, `BundleHotspotKind`, `BundleHotspotsOptions`) actually exported from civ-engine.
> 3. Zero-impact claim accurate — grep across aoe2 src/ for any of those symbols returns nothing.
> 4. Versioning policy correctly applied — no aoe2 package.json bump, no changelog entry (correct per AGENTS.md for tracking commits with no user-visible behavior).
> 5. Devlog scope/style appropriate — matches v0.8.12 tracking entry structure, accurately defers concrete usage to v0.1.6 TimelinePanel.
> 6. No structural / boundary changes.

No findings. Disposition: ACCEPT.
