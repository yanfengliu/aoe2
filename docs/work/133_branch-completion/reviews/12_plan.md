## Target

Round 12 reviews archive instrument repair 1 and its one proposed retry under C:/Users/38909/Documents/github/aoe2-worktrees/software-culling-proof-1017/tmp/probes/work130-culling/shipping-pin-preparation/attempt2-preparation/.

Reviewed SHA256 pins: index.json b45a69c05049c70508dbed8db628eae3e305a98fd62bcbb54d19e5182c5a661d; plan.md f8b0e0eea9fb733077f1cc7abef93278eeda8f3beaa0b3950dca002f5818a1d2; execute-attempt2.ps1 8d2f941bf229045880f692b41077935c78bcb8b9bf9295f119931af58880614b. The shipping source remains commit 08398b573ad54bcb5c764ad0c2ef3cedc3cce33f.

Attempt-1 evidence is retained in ../execution-1/: report.md 65523d99352505ea3d7fd4b0c1c2ee9e83dee735ab7158d3f6fecac68d1c6fd4; artifact-index.json f446c7b939dfdcc7ba2660d38539fbfd1edce50f2b3b0e7589ce518a57fa548e; archive-diagnostic.json 68fd898bf35b76cce45e8fe479f74b455fb52016cf226c3a829e803c6ac6ec12. All hashes are SHA256.

## Reviewers and coverage

Independent Codex reviewer using the prescribed Astra/xhigh controls. Read-only inspection covered the failed run's report, first failure, native exits, manifests, retained tar/extracted files, process cleanup, retry controller and exact diff, and proposed literal-path preservation moves. No move, archive creation, extraction, compiler, proof, browser or profile was executed. This authored review is the only new output.

## Reports

Attempt 1 correctly stopped before compilation on the exact-source guard: .gitattributes was 397 bytes rather than its pinned 391-byte Git blob. Archive, inventory and extraction each exited 0; the sequence failed at SourcePins. No compiler, setup, lifecycle case or mutation ran. All sixteen cases remain NOT RUN for shipping source.

Independent in-memory inspection of the retained tar confirms all 166 payloads match the extracted files, all 166 differ from their Git blobs, and replacing CRLF with LF in memory reproduces all 166 exact expected blob identities and lengths. No file bytes were changed. The actual Git configuration reports system core.autocrlf=true from C:/Program Files/Git/etc/gitconfig. The retained tar still hashes to e2e4ea7bf688386bd07a6424661dac59a00b8c52af17cf4d13f00e9fb937f966.

The actual controller comparison has exactly two changed lines: line 6 directs fresh output to execution-2; line 97 adds process-local core.autocrlf=false and core.eol=lf to git archive. No global/repository config write, normalization, compiler-option change, test change or sibling write was added.

## Findings and disposition

The diagnosis is supported. Round 11 did not identify the ambient archive line-ending conversion; the unchanged exact-blob gate caught it before compiler or behavioral execution. This is an archive instrument defect, not a product/candidate counterexample. The scoped archive flags directly address the observed cause. Their success remains subject to the same 166 exact blob/length checks during the retry.

The preservation plan is adequate: revalidate owned absolute paths, reparse-point absence, destination absence and original hashes; use native PowerShell LiteralPath moves in one shell; then rehash the moved tar and all 166 source files and retain a separate relocation receipt. The original artifact index and diagnostic remain unchanged historical records, with the relocation receipt mapping their old paths. Recreating source/ afterward preserves the reviewed compiler and alias paths. No overwrite or deletion of attempt-1 evidence is authorized.

Behavioral acceptance is unchanged. The same compiler overlay, source inventory, aliases, public-class guard, loaded-JS trace, copied sixteen-case suite, four intended mutation controls and healthy restorations remain required. The terminal-failed graph exception remains diagnostic only; usable and reconstructed runtime comparisons remain strict. Compiler/import/setup/behavior failures must stop without another edit or rerun.

The controller continues to bind the original 2,684 protected inputs. The owner must additionally retain this retry's own reviewed pins before and after execution, as the retry plan states, and audit the controller's exit and owned process identities after it finishes. The two-line controller change does not itself add that outer retry-manifest record.

## Verification

Independently checked all 187 attempt-1 artifact entries and five retry-index entries: no hash/length mismatch. The 2,684 before/after protected bindings agree, and fresh hashing finds no current drift. The original and retry controller hashes match their declared pins; their only changed lines are 6 and 97. Git reports no tracked changes.

Fresh move-preflight inspection finds 166 source files, no reparse points in the listed ancestors or source subtree, original source/archive still present, and both preservation destinations absent. execution-2, the proof copy and source/dist are absent. None of the five recorded owned PIDs remains active. These checks must be refreshed immediately before the authorized moves; no move has occurred during review.

## Round outcome

Accepted for the specified evidence-preserving moves and ONE bounded retry after the integration owner explicitly releases the lane. Keep attempt 1 intact, record relocation and retry pins, then run the exact reviewed controller once. Exact source identity and all original behavioral criteria remain mandatory.

No shipping-runtime pass is claimed. This step cannot establish CI artifact-byte equivalence, real host/bridge lifecycle, WebGL/pixels, browser controls or equal-work FPS. No product candidate is approved. The software ratio <=1.25, GPU >=55 FPS, preserved pixels and unchanged simulation work remain unchanged requirements; the stronger software criterion remains UNMET.
