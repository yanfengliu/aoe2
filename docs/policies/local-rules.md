# Local rules — aoe2

Repo-scoped directions that outlive the task that produced them. Fleet-wide rules live in `../fleet/FLEET.md`; this file is only for things true of *this* repo.

## HUD styling: modern, not medieval (2026-08-18, owner)

The interface chrome targets a **modern** look — translucent dark-glass panels, one hairline border, soft two-part elevation, a token palette, generous radii — and explicitly NOT the AoE2-era framed wood-and-stone treatment that shipped in v0.1.38.

**Why:** the owner asked for "a modern looking UI" directly. The earlier direction came from the "perfect AoE2 HD clone" north star, which still holds for the **world** (terrain, units, buildings, effects). Only the HUD surface direction changed.

**How to apply:** every HUD colour comes from the tokens in `styles.css:root` (`--hud-surface*`, `--hud-hairline*`, `--hud-text*`, `--hud-accent`, the per-resource hues, and the radius/elevation scales). Do not reintroduce a raw colour literal into a HUD rule — `tests/ui/hudPalette.test.ts` fails on the retired wood-and-stone literals and holds text contrast against a translucent panel over sunlit grass. `hudChrome.css` owns the chassis, `hudCommandPanel.css` the components inside it, `hudIcons.css` glyph sizing.

Authoritative description: `design/spec-final.md` §14.1 "HUD chrome".
