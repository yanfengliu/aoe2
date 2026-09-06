import { Buffer } from 'node:buffer';
import { closeSync, openSync, readSync, writeSync } from 'node:fs';
import type { SessionBundle } from 'civ-engine';

// Bundle files are written and read WITHOUT ever holding the whole document as
// one JavaScript string.
//
// `JSON.stringify` and `JSON.parse` both operate on a single string, and V8
// caps a string at `buffer.constants.MAX_STRING_LENGTH` (536,870,888 chars on
// Node 24 / 64-bit). A recorded playtest crosses that: measured on
// 2026-09-03's 20,001-tick corpus bundle, `ticks[]` is 95.9% of the file at a
// mean 15.7 KB per tick entry (its `diff` 84%, `metrics` 16%), and entries grow
// as the match fills with units — 20,001 ticks is 313 MB, and the 30,000-tick
// default of `npm run playtest` lands past the cap. `JSON.stringify` then
// throws `RangeError: Invalid string length` AFTER the simulation has run, so
// the whole run is lost.
//
// Dropping `null, 2` (v0.2.x) only bought headroom — it moved the wall, it did
// not remove it. These two functions remove it: the largest string either side
// ever builds is ONE array element (a tick entry: ~16 KB) or one non-array
// top-level value (`initialSnapshot`: 0.5 MB), never the document. The format
// is unchanged — the file is ordinary JSON, byte-identical to what
// `JSON.stringify(bundle)` produces — so bundles recorded before this change
// still load, and anything else that reads bundle JSON still works.

/** Flush the writer's pending text at this many chars — three orders of magnitude under the cap. */
const WRITE_FLUSH_CHARS = 4 * 1024 * 1024;
/** Reader's file-read granularity. Independent of value size: values may span chunks. */
const READ_CHUNK_BYTES = 4 * 1024 * 1024;

const TAB = 0x09;
const NEWLINE = 0x0a;
const RETURN = 0x0d;
const SPACE = 0x20;
const QUOTE = 0x22;
const COMMA = 0x2c;
const COLON = 0x3a;
const BACKSLASH = 0x5c;
const LEFT_BRACE = 0x7b;
const RIGHT_BRACE = 0x7d;
const LEFT_BRACKET = 0x5b;
const RIGHT_BRACKET = 0x5d;

function isWhitespace(byte: number): boolean {
  return byte === SPACE || byte === NEWLINE || byte === TAB || byte === RETURN;
}

/**
 * Write a session bundle as JSON, streaming top-level values and array
 * elements one at a time. Equivalent to
 * `writeFileSync(path, JSON.stringify(bundle))` for strict-JSON input, minus
 * the whole-document string.
 */
export function writeBundleFile(path: string, bundle: unknown): void {
  if (typeof bundle !== 'object' || bundle === null || Array.isArray(bundle)) {
    throw new Error(
      `writeBundleFile(${path}): expected a bundle object, got `
        + `${bundle === null ? 'null' : Array.isArray(bundle) ? 'an array' : typeof bundle} — `
        + 'pass the object returned by SessionRecorder.toBundle().',
    );
  }
  const fd = openSync(path, 'w');
  try {
    let pending: string[] = [];
    let pendingChars = 0;
    const flush = (): void => {
      if (pending.length === 0) return;
      writeAll(fd, pending.join(''));
      pending = [];
      pendingChars = 0;
    };
    const emit = (text: string): void => {
      pending.push(text);
      pendingChars += text.length;
      if (pendingChars >= WRITE_FLUSH_CHARS) flush();
    };

    emit('{');
    let firstKey = true;
    for (const [key, value] of Object.entries(bundle)) {
      // `JSON.stringify` omits own properties whose value is undefined.
      if (value === undefined) continue;
      if (!firstKey) emit(',');
      firstKey = false;
      emit(`${JSON.stringify(key)}:`);
      if (Array.isArray(value)) {
        emit('[');
        for (let i = 0; i < value.length; i++) {
          if (i > 0) emit(',');
          // An array hole / undefined element serializes as null, as in `JSON.stringify`.
          emit(JSON.stringify(value[i]) ?? 'null');
        }
        emit(']');
      } else {
        emit(JSON.stringify(value));
      }
    }
    emit('}');
    flush();
  } finally {
    closeSync(fd);
  }
}

function writeAll(fd: number, text: string): void {
  const buffer = Buffer.from(text, 'utf8');
  let offset = 0;
  // `writeSync` may write fewer bytes than asked; a short write must not
  // silently truncate the bundle.
  while (offset < buffer.length) {
    offset += writeSync(fd, buffer, offset, buffer.length - offset);
  }
}

/**
 * Read a JSON bundle file of any size. Splits the document structurally —
 * top-level key/value pairs, and the elements of top-level arrays — and hands
 * each piece to `JSON.parse` on its own, so no string near the cap is built.
 *
 * The scan is byte-level, which is safe for UTF-8: every JSON structural
 * character is ASCII and every continuation byte is >= 0x80, so a multi-byte
 * character can never be mistaken for one.
 */
export function readBundleFile<T = SessionBundle>(path: string): T {
  const fd = openSync(path, 'r');
  try {
    return readTopLevelObject(fd, path) as T;
  } finally {
    closeSync(fd);
  }
}

const BEFORE_ROOT = 0;
const KEY_OR_END = 1;
const IN_KEY = 2;
const BEFORE_COLON = 3;
const BEFORE_VALUE = 4;
const IN_VALUE = 5;
const ELEMENT_OR_END = 6;
const IN_ELEMENT = 7;
const DONE = 8;

function readTopLevelObject(fd: number, path: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES);
  const carried: Buffer[] = [];

  let state = BEFORE_ROOT;
  let key = '';
  let array: unknown[] | null = null;
  let start = -1; // index in `buffer` where the value being collected begins
  let depth = 0;
  let inString = false;
  let escaped = false;
  let filePos = 0;
  let chunkStart = 0; // file offset of buffer[0], for error messages

  const collected = (endExclusive: number): string => {
    const tail = buffer.subarray(start, endExclusive);
    const text = carried.length === 0
      ? tail.toString('utf8')
      : Buffer.concat([...carried, tail]).toString('utf8');
    carried.length = 0;
    start = -1;
    return text;
  };
  const parsePiece = (text: string, what: string, at: number): unknown => {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(
        `${path}: ${what} ending at byte ${at} is not valid JSON `
          + `(${err instanceof Error ? err.message : String(err)}). `
          + 'The file is truncated or was not written by writeBundleFile.',
      );
    }
  };
  const fail = (byte: number, at: number, expected: string): never => {
    throw new Error(
      `${path}: expected ${expected} at byte ${at}, got ${JSON.stringify(String.fromCharCode(byte))}. `
        + 'A bundle file is a JSON object written by writeBundleFile / JSON.stringify.',
    );
  };

  for (;;) {
    const got = readSync(fd, buffer, 0, READ_CHUNK_BYTES, filePos);
    if (got <= 0) break;
    chunkStart = filePos;
    filePos += got;
    let i = 0;
    while (i < got) {
      const c = buffer[i];
      if (state === IN_VALUE || state === IN_ELEMENT) {
        // Collect one complete JSON value, tracking nesting and string state.
        if (inString) {
          if (escaped) escaped = false;
          else if (c === BACKSLASH) escaped = true;
          else if (c === QUOTE) {
            inString = false;
            if (depth === 0) { i = finishValue(i + 1); continue; }
          }
          i++;
          continue;
        }
        if (c === QUOTE) { inString = true; i++; continue; }
        if (c === LEFT_BRACE || c === LEFT_BRACKET) { depth++; i++; continue; }
        if (c === RIGHT_BRACE || c === RIGHT_BRACKET) {
          if (depth > 0) {
            depth--;
            if (depth === 0) { i = finishValue(i + 1); continue; }
            i++;
            continue;
          }
          // Closes the parent container: a bare scalar ended just before it.
          i = finishValue(i);
          continue;
        }
        if (depth === 0 && (c === COMMA || isWhitespace(c))) { i = finishValue(i); continue; }
        i++;
        continue;
      }
      switch (state) {
        case BEFORE_ROOT:
          if (isWhitespace(c)) break;
          if (c !== LEFT_BRACE) fail(c, chunkStart + i, 'the opening "{" of a bundle object');
          state = KEY_OR_END;
          break;
        case KEY_OR_END:
          if (isWhitespace(c) || c === COMMA) break;
          if (c === RIGHT_BRACE) { state = DONE; break; }
          if (c !== QUOTE) fail(c, chunkStart + i, 'a property name');
          start = i; // include the opening quote so JSON.parse sees a string
          state = IN_KEY;
          break;
        case IN_KEY:
          if (escaped) escaped = false;
          else if (c === BACKSLASH) escaped = true;
          else if (c === QUOTE) {
            key = parsePiece(collected(i + 1), 'a property name', chunkStart + i) as string;
            state = BEFORE_COLON;
          }
          break;
        case BEFORE_COLON:
          if (isWhitespace(c)) break;
          if (c !== COLON) fail(c, chunkStart + i, `":" after property "${key}"`);
          state = BEFORE_VALUE;
          break;
        case BEFORE_VALUE:
          if (isWhitespace(c)) break;
          if (c === LEFT_BRACKET) {
            array = [];
            result[key] = array;
            state = ELEMENT_OR_END;
            break;
          }
          start = i;
          state = IN_VALUE;
          continue; // re-read this byte as the value's first
        case ELEMENT_OR_END:
          if (isWhitespace(c) || c === COMMA) break;
          if (c === RIGHT_BRACKET) { array = null; state = KEY_OR_END; break; }
          start = i;
          state = IN_ELEMENT;
          continue; // re-read this byte as the element's first
        case DONE:
          if (!isWhitespace(c)) fail(c, chunkStart + i, 'end of file after the bundle object');
          break;
        default:
          break;
      }
      i++;
    }
    if (start >= 0) {
      // A value straddles the chunk boundary: copy what we have (the buffer is
      // reused) and continue collecting from the start of the next chunk.
      carried.push(Buffer.from(buffer.subarray(start, got)));
      start = 0;
    }
  }

  if (state !== DONE) {
    throw new Error(
      `${path}: the bundle JSON ends before its closing "}" (stopped after ${filePos} bytes, `
        + `state ${state}). The file is truncated — the run that wrote it did not finish.`,
    );
  }
  return result;

  // Ends the value being collected at `endExclusive`, stores it, and returns
  // the index to resume from (the terminating byte is left for the next state
  // when it is not part of the value).
  function finishValue(endExclusive: number): number {
    const wasElement = state === IN_ELEMENT;
    const text = collected(endExclusive);
    const value = parsePiece(
      text,
      wasElement ? `element ${array?.length ?? 0} of "${key}"` : `the value of "${key}"`,
      chunkStart + endExclusive,
    );
    if (wasElement) array?.push(value);
    else result[key] = value;
    depth = 0;
    inString = false;
    escaped = false;
    state = wasElement ? ELEMENT_OR_END : KEY_OR_END;
    return endExclusive;
  }
}
