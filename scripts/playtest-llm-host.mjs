// Playwright host adapter for the LLM playtest runner: the browser-facing
// half of `scripts/playtest-llm.mjs`, split out so both files stay well under
// the 500-line budget.
//
// `makePlaywrightHost` implements the `LlmPlaytestHost` contract from
// `src/game/playtest/llmRunner.ts` against a live page driven by Playwright.

/**
 * Largest text a single `page.evaluate` may return during bundle export.
 *
 * This is a TRANSPORT bound (Playwright's JSON-RPC payload), not a correctness
 * one: 4 MiB is 128 times under V8's 536,870,888-char string cap, so no string
 * on either side of the bridge can approach it.
 */
const EXPORT_PIECE_CHARS = 4 * 1024 * 1024;

// The page-side export. Deliberately mirrors `writeBundleFile` in
// `src/game/playtest/bundleIo.ts` — top-level values one at a time, top-level
// arrays one element at a time — and deliberately DUPLICATES it, because this
// body is serialized into the browser by Playwright and cannot import anything.
//
// Why it exists: `JSON.stringify(bundle)` INSIDE THE PAGE builds the whole
// document as one JavaScript string, and V8 caps a string at 536,870,888 chars
// in the browser exactly as it does in Node. A Node-side streaming writer
// cannot reach that ceiling; it has to be removed where the string is built.
// At the measured 15.7 KB per tick entry a run crosses the cap near 34,000
// ticks, and `--max-ticks` is a CLI flag.
//
// The largest string this ever builds is one piece (EXPORT_PIECE_CHARS), one
// array ELEMENT (a tick entry, about 16 KB), or one non-array top-level value
// (`initialSnapshot`, about 0.5 MB) — the same bound `writeBundleFile` carries.

/** Page-side: stash the bundle and an export cursor on `window`. */
function beginPageExport(maxChars) {
  const bundle = window.__AOE2_TEST__.agent.getRecorderBundle();
  window.__AOE2_PLAYTEST_EXPORT__ = {
    // `JSON.stringify` omits own properties whose value is undefined; match it.
    entries: Object.entries(bundle).filter(([, value]) => value !== undefined),
    keyIndex: 0,
    elementIndex: 0,
    maxChars,
  };
  return window.__AOE2_PLAYTEST_EXPORT__.entries.length;
}

/** Page-side: emit the next piece, or null when the document is exhausted. */
function nextPageExportPiece() {
  const state = window.__AOE2_PLAYTEST_EXPORT__;
  if (!state) throw new Error('bundle export cursor is gone (page reloaded mid-export?)');
  if (state.keyIndex >= state.entries.length) return null;
  const [key, value] = state.entries[state.keyIndex];
  if (!Array.isArray(value)) {
    state.keyIndex += 1;
    state.elementIndex = 0;
    return { key, kind: 'value', text: JSON.stringify(value) };
  }
  // One batch of array elements. Elements are serialized individually and
  // joined, so the only string over an element's size is this batch.
  const parts = [];
  let chars = 0;
  while (state.elementIndex < value.length && chars < state.maxChars) {
    // An array hole / undefined element serializes as null, as in JSON.stringify.
    const text = JSON.stringify(value[state.elementIndex]) ?? 'null';
    parts.push(text);
    chars += text.length + 1;
    state.elementIndex += 1;
  }
  const done = state.elementIndex >= value.length;
  if (done) {
    state.keyIndex += 1;
    state.elementIndex = 0;
  }
  return { key, kind: 'elements', text: `[${parts.join(',')}]`, done };
}

export async function makePlaywrightHost(page, hostOptions = {}) {
  const omniscient = !!hostOptions.omniscient;
  // playtest-fixes iter-1 (Codex HIGH): the agent may only command its
  // own entities; the in-page dispatcher enforces it via expectedOwner.
  const expectedOwner = hostOptions.ownerId;
  return {
    async waitForBoot() {
      // Assert both isBooted AND the agent sub-surface — defends
      // against a boot-vs-agent race where __AOE2_TEST__ exists but
      // the .agent methods aren't attached yet (HMR window with
      // --use-dev-server, late dynamic-import resolution). Without
      // this, the next host call hits a bare TypeError that the
      // operator can't decode from the envelope (Claude impl-345 M6).
      await page.waitForFunction(
        () =>
          window.__AOE2_TEST__?.isBooted() === true
          && typeof window.__AOE2_TEST__?.agent?.snapshotForAgent === 'function'
          && typeof window.__AOE2_TEST__?.agent?.dispatchAgentCommand === 'function'
          && typeof window.__AOE2_TEST__?.agent?.getRecorderBundle === 'function'
          && typeof window.__AOE2_TEST__?.setPaused === 'function',
        undefined,
        { timeout: 60_000 },
      );
    },
    // playtest-fixes C: freeze/unfreeze the live sim. The runner pauses
    // once after boot so the game does NOT free-run during the agent's
    // ~10-100s LLM calls (the 2026-06-09 run drifted to bridge tick
    // 5413 on a maxTicks-2000 run, voiding checkpoint alignment).
    async setPaused(paused) {
      await page.evaluate((p) => window.__AOE2_TEST__.setPaused(p), paused);
    },
    async getCurrentTick() {
      return await page.evaluate(() => window.__AOE2_TEST__.getRenderState().tick);
    },
    async snapshotForAgent(ownerId) {
      // Phase-6.B (impl-2 M7): forward host-level omniscient flag so the
      // snapshot honors visibility-gating per the corpus row / CLI flag.
      return await page.evaluate(
        ([id, opts]) => window.__AOE2_TEST__.agent.snapshotForAgent(id, opts),
        [ownerId, { omniscient }],
      );
    },
    async captureScreenshot() {
      const bbox = await page.evaluate(() => window.__AOE2_TEST__.agent.getCanvasBboxForScreenshot());
      const buffer = await page.screenshot({ clip: bbox });
      return new Uint8Array(buffer);
    },
    async dispatchCommand(cmd) {
      return await page.evaluate(
        ([c, owner]) => window.__AOE2_TEST__.agent.dispatchAgentCommand(c, { expectedOwner: owner }),
        [cmd, expectedOwner],
      );
    },
    async advanceTicks(count) {
      // Atomic unpause → step N → repause inside ONE synchronous page
      // task: requestAnimationFrame can never interleave a synchronous
      // evaluate, so with the runner-held pause active, advanceTicks is
      // the ONLY way the bridge tick moves. tickAfter - tickBefore then
      // equals the requested count exactly and baseline checkpoints
      // (multiples of decisionIntervalTicks) land precisely.
      await page.evaluate((n) => {
        const api = window.__AOE2_TEST__;
        api.setPaused(false);
        try {
          api.advanceTicks(n);
        } finally {
          api.setPaused(true);
        }
      }, count);
    },
    async drainDispatchLog() {
      return await page.evaluate(() => window.__AOE2_TEST__.agent.drainAgentDispatchLog());
    },
    async getEntityCountsByOwner() {
      return await page.evaluate(() => window.__AOE2_TEST__.agent.getEntityCountsByOwner());
    },
    async getMatchOutcome() {
      return await page.evaluate(() => window.__AOE2_TEST__.agent.getMatchOutcome());
    },
    async exportBundle() {
      // playtest-fixes D: the blob-URL path was dead on arrival —
      // page.request.fetch is an HTTP client and rejects blob: URLs, which
      // engineHalted every real run at export time. Its replacement then
      // stringified the whole bundle in the page and re-joined the chunks in
      // Node, which put V8's string cap on BOTH sides of the bridge. Now the
      // page emits structural pieces and Node parses each one on its own: no
      // string near the cap is built anywhere.
      const keyCount = await page.evaluate(beginPageExport, EXPORT_PIECE_CHARS);
      try {
        const bundle = {};
        let pieces = 0;
        let chars = 0;
        for (;;) {
          const piece = await page.evaluate(nextPageExportPiece);
          if (piece === null) break;
          pieces += 1;
          chars += piece.text.length;
          if (piece.kind === 'value') {
            bundle[piece.key] = JSON.parse(piece.text);
          } else {
            const target = (bundle[piece.key] ??= []);
            // A spread would push the whole batch as one argument list; loop
            // instead so a long array cannot overflow the call stack.
            for (const element of JSON.parse(piece.text)) target.push(element);
          }
        }
        console.log(
          `[playtest-llm] bundle exported: ${keyCount} top-level keys, ${pieces} pieces, ${chars} chars`,
        );
        return bundle;
      } finally {
        await page
          .evaluate(() => {
            delete window.__AOE2_PLAYTEST_EXPORT__;
          })
          .catch(() => {});
      }
    },
  };
}
