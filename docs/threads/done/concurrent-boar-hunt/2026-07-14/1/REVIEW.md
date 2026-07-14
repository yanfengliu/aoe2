# Concurrent boar hunting review — iteration 1

## Review coverage

Two independent in-process reviewers traced the live context-command path from presented voxel hits through per-selected-unit command submission, attacker-keyed command storage, wildlife damage, retaliation, and save/load persistence. They reviewed the production diff, raw hit ordering, the focused controller regression, the one-order six-villager simulation proof, the persistence conversion, and canonical documentation/version surfaces. Every claim was checked against live symbols and tests rather than accepted from the task summary.

## Findings

- **No substantive code finding.** Villager-only arbitration changes command targeting without changing selection order, Monk healing, friendly building repair, non-villager commands, presented epoch/revision fencing, or the raw voxel hit proxy. One group order creates six independent attack paths, and two adjacent villagers reduce boar HP from 75 to 69 in the same tick.
- **MEDIUM — mandatory devlogs missing.** The first reviewed diff bumped v0.2.2 and added the changelog but had no summary or detailed devlog entry. Fixed by adding the required records with review and verification evidence.
- **LOW — active roadmap baseline stale.** `design/roadmap.md` still called v0.2.1 current despite the v0.2.2 command-hit behavior. Fixed by updating the active baseline and explicitly recording the friendly-silhouette arbitration boundary.

## Disposition

Code approved. Documentation findings were fixed and require a final documentation re-review in iteration 2.
