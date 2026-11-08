# Review 1: implementation

## Target

AoE2 work154 performance evidence for source tree `3de9f60dc0b0a5f2338aa8633dfb2966fa63002d` against base commit `a0e10435912d97078ee033112d49926a36807fde`, in `C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107`. The baseline commit resolves to tree `3cc8351b01dc04fe07dc971a02946467eed7cc0c`, matching measurement/inputs.json. The measured candidate-tree.txt names the reviewed tree. Final read-only Git comparisons still showed no index or tracked-worktree difference from that candidate; the separately retained review records are untracked additions, not source changes.

Evidence root: `C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/tmp/render-invalidation/measurement`. Primary interleaved records are aa-120-24k.json, ab-120-24k.json, ab-120-36k-repeat.json, and ab-168-24k.json. Primary profiles are profile-120-24k-baseline-repeat.cpuprofile and the original candidate12024, baseline12036, candidate12036, baseline16824, and candidate16824 profiles. Original ab-120-36k and profile-120-24k-baseline are excluded from primary claims because root identified overlap with local worker tests; they remain retained rather than erased.

## Reviewers and coverage

Authored by publisher_review, the assigned independent native Astra/xhigh review lane. I inspected the maintained measurement implementation and copied-instrument provenance, runner arguments and receipts, raw interleaved rows, input saves, package/lock/runtime version files, profile script, and six raw CPU profiles. I independently recalculated the CPU comparisons and walked raw profile sample ancestry to derive inclusive shares with each sample counted once per category. I did not execute the benchmark, game, profiler, tests, build, browser, or gates. Only the two explicitly authorized authored review records were written.

## Reports

### publisher_review

The evidence supports this bounded claim: **Across three retained 120x120 and 168x168 save windows, selected invalidation reduced the render adapter's inclusive sampled share from approximately 54–75% to 23–25%. Separate interleaved equal-work measurements observed 45–72% lower total process CPU per simulated tick. Every recorded 200-tick state checkpoint and final saved-world digest matched between arms.** These are measurements of those simulation windows, not a whole-game, browser-frame-rate, or visibility-algorithm speedup claim.

The actual engine is **2.9.0**. package.json, the root lock dependency, scripts/civ-engine-pin.json, and the lock's installed entry all select retained archive `civ-engine-c78a3b3162a3674b8e42204fed66cbabcdabf5ac.tgz`; the lock integrity matches the pin. The installed package.json and dist/version.js both say 2.9.0. Both Node and browser indexes export that version module. Raw baseline and candidate profile URLs resolve the same root installation's render-adapter.js, while their bridge source URLs resolve their respective baseline/candidate trees. No 2.9.1 result is established by these measurements.

The interleaved tool loads the same saved text independently into both bridges and alternates A/B then B/A in a single process. Each run completes five 200-tick chunks; the first is discarded from timing summaries, leaving 800 measured ticks per arm. The helper validates both StepReport success and a one-tick world-counter increment. World serialization fingerprints are computed after timing each pair, and final saved-world digests are computed separately. All raw rows have 200 successful ticks on both arms and matching fingerprints. My arithmetic reproduces the retained totals and medians.

| Retained window | Baseline / candidate process CPU ms per tick | Total B/A CPU ratio | Median chunk B/A ratio | Observed total CPU reduction |
|---|---:|---:|---:|---:|
| 120x120, load tick24000 | 20.391 / 11.134 | 0.5460 | 0.5347 | 45.4% |
| 120x120, load tick36000, clean repeat | 43.731 / 12.423 | 0.2841 | 0.2886 | 71.6% |
| 168x168, load tick24000 | 54.844 / 23.928 | 0.4363 | 0.4228 | 56.4% |

The contemporaneous A/A12024 control reports 16.580 versus 17.171 CPU ms/tick: total ratio1.0357 and median ratio1.0269. Its four retained chunk ratios span1.0180–1.0706. The A/B retained chunk ratios span0.5016–0.6385, 0.2632–0.2970, and0.4106–0.4900 respectively. The observed A/B effects are substantially larger than this observed A/A variation. One A/A run is not a confidence interval or a universal bound on noise; its baseline rate also differs from the later A/B baseline rate.

The profiler uses the same unmodified profile-selfplay.mjs and selfplayMeasurement.mjs in both trees, loads the same save, advances one settling tick, and samples 1000 successful ticks at a requested1000us interval. Thus profile windows are24001..25001 or36001..37001, while the interleaved runs cover24000..25000 or36000..37000. The two instruments are complementary observations, not exactly identical timing windows.

The following independently recomputed inclusive shares use the profiler's sample-count denominator after excluding idle/program/root/GC leaf samples. They are not exact CPU milliseconds. Refresh samples are contained within the adapter path except for occasional directly sampled caller frames; they must not be added to the adapter share.

| Retained window | Render-adapter inclusive share, baseline → candidate | Full-refresh inclusive share, baseline → candidate | Union of adapter, refresh and new tracker, baseline → candidate |
|---|---:|---:|---:|
| 120x120, tick24000 | 54.020% → 23.222% | 40.283% → 0 observed samples | 54.020% → 23.269% |
| 120x120, tick36000 | 74.815% → 24.944% | 67.623% → 0 observed samples | 74.820% → 25.004% |
| 168x168, tick24000 | 66.760% → 22.942% | 57.486% → 0 observed samples | 66.773% → 23.003% |

The union counts each sampled stack once, including the new invalidation tracker; it is not a sum of overlapping inclusive percentages. Zero observed refresh samples does not mean mathematically zero runtime cost. The retained source tests separately count calls and require no tick-triggered full snapshot in their covered workload. The remaining adapter share still includes necessary diff projection, frame work, serialization validation, and downstream calls. JSON and visibility functions can occur beneath that stack and elsewhere, so their inclusive shares cannot be added or used to claim an independent visibility gain.

## Findings and disposition

No material defect found in the specified measurement evidence or the bounded claim above. Scope limitations must accompany any published performance wording. Root owns final product wording and acceptance; this record does not approve broader speedup, FPS, visual, or whole-match claims.

## Verification

All three copied instrument files match both instrument-provenance.json and their named source files by SHA256. Baseline/candidate profile-selfplay.mjs, selfplayMeasurement.mjs, package.json, and package-lock.json hashes are identical. The extracted baseline src differs from candidate src only in the three reviewed implementation files. Raw profile bridge/adapter URLs corroborate the intended source and dependency resolution.

Input saves were independently read and hashed. They are schema2, with ticks24000/36000/24000 and confirmed120x120/168x168 world configurations. SHA256s:12024 `26934A78DB4340F9CC8C377FDB79382507E5D554AF7A681AEF8D5B43AF0A7F8B`;12036 `0180D998433FE5A188A1AFB3137DF55CEC1F756450A3BC8EFEEF16EDC6CFF3F4`;16824 `C649FE87197332A0D9693F9C2994A23B0989ACAF50862FD3CF21DFD5B3E46C90`. Their retained filesystem write times precede these measurements. The paired final saved-world digests are respectively4d49d7016492edc2,2c3e1866af22fb81,9438d7225cbedec6. Digests establish the recorded equality checks, not an independent replay of the run or equality at every intervening tick.

The six inspected raw profile SHA256s, in table order baseline/candidate, are `08CD83D5F9F431A7B1E4B16ED8000D99FAE3E32A63B68E50489A88DE6F89D129`, `6A3C87C3946055442A23547ADCF29C1E8C0C60EBA34AD46F579E5D418AD51BA8`, `A48BDC049B9CBD7BA66EC6702B89B3EA2EE782B6DB117E8A01A1C81C743B3252`, `8992CE97FC0FE15CEDA851D3826D11235942F1330AB0996D3F1F76AC8A27405F`, `40C5D36A5416A66FC5EB2F82968CEF5C2CDCB4448646677BFB19CBAA80D7C982`, and `009E45C38928244AD9E82CA1232AC6FC92FCAB0F10F4D186B69B35F0D209B5BA`. Raw non-overhead sample counts are11531/6369,20981/6731,29374/11429. GC accounts for approximately2.7–4.4% of all samples and is excluded from the reported inclusive shares.

Every inspected primary measurement process receipt reports exit0 and no retained owned-process leftovers. I inspected those receipts rather than performing a fresh process census. The clean-repeat exclusion is root-reported provenance; there is no comprehensive machine-wide contention audit. Even the retained primary A/B runs report median foreign load around3.75–4.71 logical cores and maxima around5.98–6.23. Process CPU includes all process threads; profiler attribution samples the main JavaScript execution stack. Sequential profile captures, JIT/GC behavior, sampling granularity, same-process module sharing, and background contention limit precision. The A/A run uses the same baseline module twice, whereas A/B imports different bridge modules.

The measurements cover three loaded save states over short windows, with every-tick projection and no browser/render-state read loop, GPU presentation, pause interactions, or complete match. Loading can differ from a world that grew live. Full projected-view equality is supported by the separate source-review contracts, not by these state digests. No inclusive profile share was converted into a claimed exclusive feature duration, and no overlapping shares were summed.

## Round outcome

The retained raw evidence independently supports a substantial reduction in render projection work in the specified windows, alongside lower equal-work total process CPU. The concise claim above is accepted within these limits. Native GPU/interactive validation, complete required gates, final documentation, integration and hosted acceptance remain outside this performance review and pending with root.
