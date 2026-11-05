#!/usr/bin/env node
// Build a self-improvement ledger from recorded playtest artifacts.
//
// Usage:
//   npm run playtest:self-improve -- --current output/playtests-llm/campaign-11 --baseline output/playtests-llm/campaign-10 --out output/self-improvement/campaign-11.json
//   npm run playtest:self-improve -- --current output/playtests/run --oracles
//
// The work is in playtest-self-improve-lib.mjs, so that its test can run it in-process; this file only runs it.

import { main } from './playtest-self-improve-lib.mjs';

main(process.argv).catch((err) => {
  console.error('[playtest-self-improve] fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
