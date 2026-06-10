// Parse the ?disableAi=<csv> URL param for the LLM-agent harness.
// Contract per docs/threads/done/llm-agent-playtest/DESIGN.md:
//   - Comma-separated positive integers (player owner ids ≥ 2).
//   - Owner 1 (the human slot) is rejected — passing it would leave
//     nobody to attack and is therefore not a useful directive.
//   - Unparseable / negative / zero tokens are skipped with console.warn.
//   - Empty / absent param yields an empty Set (no-op at the call site).
// Closure-local — never written into world.state.aoe2.* (which would
// leak the directive into save files; see DESIGN H2).

export function parseDisableAiParam(url: string): Set<number> {
  const owners = new Set<number>();
  const raw = new URL(url).searchParams.get('disableAi');
  if (raw === null || raw.trim() === '') return owners;
  for (const tokenRaw of raw.split(',')) {
    const token = tokenRaw.trim();
    if (token === '') continue;
    const n = Number(token);
    if (!Number.isInteger(n) || n <= 0) {
      console.warn(`[aoe2] ?disableAi= token "${token}" is not a positive integer; ignored.`);
      continue;
    }
    if (n === 1) {
      console.warn('[aoe2] ?disableAi= rejected owner 1 (the human slot); ignored.');
      continue;
    }
    owners.add(n);
  }
  return owners;
}
