# Relic transport contract mutation proof

2026-10-17: resumed the interrupted mechanical proof against the accepted work133 test contract. No product, test, assertion, seed, setting or horizon edit was made. The ignored exact-file control copy was the only mutation target; original ai-relics source and integration source were untouched. No browser, build, full verify, CI or Git mutation ran.

Command: `node prove-contract.mjs`, which runs `vitest run tests/simulation/aiRelicsSelfPlay.test.ts --maxWorkers=1 --minWorkers=1` three times through the inspected `control/run-owned.mjs`. All children were hidden and owned by PID; its finally path removes surviving owned descendants. Raw logs and native exit receipts are under `control/tmp/probes/work133-relics/`.

| Run | Native exit | Tests | Observed bounds |
| --- | --- | --- | --- |
| healthy-both | 0, signal null, no timeout | 2 passed | Standard 45,000 ticks: owner2 stored at35511, transported1, residual2260 unknown, countdown0. Short all-three positive assertions passed. |
| carried-claim-mutant-both | 1, signal null, no timeout | 2 failed | Long line52 positive correlated transport received0, stores[]. Short line99 picked IDs received[2163], expected[2163,2165,2166]. |
| restored-both | 0, signal null, no timeout | 2 passed | Same Standard transport/store/residual observation; short all-three positive assertions passed. |

The mutant removed only the carried-relic occupancy release/return guard from transformOps.ts, restoring the original carried-ground claim. The long case failed its required home-transport assertion. The short case passed initial setup assertions and first failed its required complete pickup set, a positive acquisition/transport-chain assertion. Its later line100 held-travel/deposit count, empty-carry, all-stored and countdown assertions were not reached; this proof does not claim they separately failed. Neither mutant case failed because of setup, timeout or conservation. Independent reviewer `relic_review_final` inspected the exact mutation and raw failures and accepted this bound.

Per-run Vitest durations were 139.07s healthy, 159.12s mutant and 163.51s restored; these are observations, not a speed comparison. Native receipts pin owned root PIDs 57492, 42420, 32316 and their descendants. `cleanup-audit.json` records the final owned-process audit and independent current-input rehash.

Test SHA-256: `7229f27884a1d61e8d770862ac43247f2a6a671ff6f99b64c03e3460bb4ef76c`. Helper SHA-256: `929be17e0fc82a9eb9a86f1f17fdeb31a5c6769553cb696a4ace9c279474a373`. Healthy/restored transform SHA-256: `c56766219024af27030bc722c78a5162ea661dbb039adf3bda6154b652488170`; mutant SHA-256: `59091579682d46004de2ed96ab95ce48f1990800c44294e71fccf37021fa2e14`.

`healthy-before-inputs.json`, `healthy-after-inputs.json`, `restored-before-inputs.json` and `restored-after-inputs.json` all have aggregate SHA-256 `dcee252007908280e0d8b31dff504fc945e13d59beeb2c7643b128b22b31ca75`. Each manifest pins 1,588 files. The independent current-input rehash found no mismatch; the post-run process audit found no owned Node process remaining. The two mutant manifests agree at `1928b4e4bf4891e6b036b95ee590a3715ce6f47c6ee087054344aaa641360e06`; the only changed pinned input is transformOps.ts. All six manifests record no unexpected input changes. Exact restoration occurred in the controller finally path before the final healthy run. `proof-results.json` retains the controller outcomes and native receipts; raw logs were inspected independently of its pass flag.

This is focused contract-sensitivity evidence. Final integrated review, full verify, certified receipt and landing remain the integration owner's responsibility.
