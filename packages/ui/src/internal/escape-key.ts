// The one rule of every Escape the library handles in JS (conventions 15). No "use client"
// directive: reads a DOM event only.

/** The fields of a `keydown` the rule reads; a DOM `KeyboardEvent` (React's `nativeEvent`). */
type KeyLike = Pick<KeyboardEvent, "key" | "isComposing" | "keyCode">;

/**
 * Whether a `keydown` belongs to an IME composition: `isComposing`, or `keyCode === 229`, which
 * engines report for a key the IME took (WebKit fires `compositionend` before the key that ends
 * the composition, so that keydown has `isComposing === false`).
 */
export function isComposingKey(event: KeyLike): boolean {
  return event.isComposing || event.keyCode === 229;
}

/**
 * Whether a `keydown` is an Escape the library may act on (conventions 15): `key === "Escape"`,
 * not part of an IME composition (there Escape cancels the composition), and not prevented
 * already (innermost first: an inner handler or layer consumed it).
 */
export function isEscapeRequest(event: KeyLike & Pick<Event, "defaultPrevented">): boolean {
  return event.key === "Escape" && !event.defaultPrevented && !isComposingKey(event);
}
