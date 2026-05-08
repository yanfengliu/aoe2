// Deferred follow-up (replay-load-and-e2e thread close-out): the
// escapeHtml helper was duplicated across MarkerListPanel,
// replayLoadDialog, and postGameSummary, and postGameSummary's copy
// was missing apostrophe coverage. Consolidating into one canonical
// module; this suite locks the 5-char escape contract so future
// drift is caught.

import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/ui/utils/escapeHtml';

describe('escapeHtml', () => {
  it('escapes ampersands first so subsequent escapes are not double-escaped', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes <, >, and " metacharacters', () => {
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
  });

  it("escapes apostrophes (the case postGameSummary's copy missed)", () => {
    expect(escapeHtml("'")).toBe('&#39;');
    expect(escapeHtml("Owner's session")).toBe('Owner&#39;s session');
  });

  it('passes through plain text and unicode unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeHtml('résumé — 日本語')).toBe('résumé — 日本語');
  });

  it('handles the empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes mixed payloads in a single pass', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&y`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;y',
    );
  });
});
