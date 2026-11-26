// Typeahead of the item lists (design/components/menu.md 5.1; multi-select.md B.8): a buffer of
// the characters typed within 500 ms, matched case-insensitively as a prefix. No "use client"
// directive: pure functions over a mutable buffer (conventions 7.1).

/** Buffer lifetime after the last keystroke (menu.md 5.1). */
export const TYPEAHEAD_RESET_MS = 500;

/** The typed prefix and the time of its last character. Kept in a ref by the part. */
export interface TypeaheadBuffer {
  text: string;
  at: number;
}

export function createTypeaheadBuffer(): TypeaheadBuffer {
  return { text: "", at: 0 };
}

/** A buffer is live: a Space then belongs to it rather than to the item. */
export function isTypingAhead(buffer: TypeaheadBuffer, now = Date.now()): boolean {
  return buffer.text !== "" && now - buffer.at <= TYPEAHEAD_RESET_MS;
}

/**
 * Adds `key` to the buffer (a stale buffer starts over). Returns `false` when the key is not
 * taken: a Space with an empty buffer, which belongs to the item instead.
 */
export function pushTypeahead(buffer: TypeaheadBuffer, key: string, now = Date.now()): boolean {
  if (buffer.text === "" || now - buffer.at > TYPEAHEAD_RESET_MS) buffer.text = "";
  if (key === " " && buffer.text === "") return false;
  buffer.text += key.toLowerCase();
  buffer.at = now;
  return true;
}

/**
 * The item the buffer selects among `texts` (each item's typeahead text, already trimmed and
 * lowercased, in list order), with `current` the index of the current item (`-1`: none); `-1`
 * when nothing matches.
 *
 * A repeated single character cycles through the items starting with it, from the one after
 * the current item; a longer buffer keeps the current item while it still matches.
 */
export function findTypeahead(
  buffer: TypeaheadBuffer,
  texts: readonly string[],
  current: number,
): number {
  if (texts.length === 0 || buffer.text === "") return -1;
  const repeated = [...buffer.text].every((c) => c === buffer.text[0]);
  const search = repeated ? buffer.text[0]! : buffer.text;
  const start = repeated || current < 0 ? current + 1 : current;
  for (let i = 0; i < texts.length; i++) {
    const index = (start + i) % texts.length;
    if (texts[index]!.startsWith(search)) return index;
  }
  return -1;
}

/**
 * `pushTypeahead` then `findTypeahead`: `null` when the key is not taken, else the index of the
 * match or `-1`.
 */
export function typeaheadMatch(
  buffer: TypeaheadBuffer,
  key: string,
  texts: readonly string[],
  current: number,
  now = Date.now(),
): number | null {
  if (!pushTypeahead(buffer, key, now)) return null;
  return findTypeahead(buffer, texts, current);
}
