"use client";
import { useLayoutEffect, useRef } from "react";
import type { MouseEvent, RefObject } from "react";
import { useElementCheck } from "./use-element-check.js";
import type { ElementCheck } from "./use-element-check.js";

// The `<details>` / `<summary>` pair shared by Accordion (Item and Trigger) and Collapsible (Root
// and Trigger): the Trigger's click rule (accordion.md 2.2, collapsible.md 2.2) and the
// development checks of the rendered elements, and the record of the library's own `open` writes
// (the known value). The state side is not shared: an Accordion owns a set, a Collapsible one
// boolean.

const isDev = process.env.NODE_ENV !== "production";

/**
 * The known value of each library-mode `<details>` (accordion.md 2.3, conventions 3.5): the last
 * `open` the library wrote to the element or read from it. A `toggle` whose `details.open` equals
 * it is the library's own write echoing back; any other is a platform change. Neither committed
 * nor intended state is the test: the browser can bring the DOM back to either by itself while
 * a request is in flight.
 */
const knownOpen = new WeakMap<HTMLDetailsElement, boolean>();

/** Records the element's current `open` as known (attach, mount reconciliation, a platform change). */
export function noteOpen(element: HTMLDetailsElement): void {
  knownOpen.set(element, element.open);
}

/**
 * The library's own write of `open`: records `open` as known, then writes it if the DOM differs.
 * The `toggle` that write fires is an echo. Also called right after React committed the `open`
 * attribute, where it only records.
 */
export function writeOpen(element: HTMLDetailsElement, open: boolean): void {
  knownOpen.set(element, open);
  if (element.open !== open) element.open = open;
}

/**
 * Whether a `toggle` on `element` is the library's own write: `details.open` equals the known
 * value. An element never noted is noted now and treated as an echo.
 */
export function isEcho(element: HTMLDetailsElement): boolean {
  const known = knownOpen.get(element);
  if (known === undefined) {
    noteOpen(element);
    return true;
  }
  return element.open === known;
}

const NESTED_INTERACTIVE =
  "a[href], button, label, input, select, textarea, [contenteditable]:not([contenteditable='false'])";

/**
 * Nested controls with an activation behaviour of their own. The browser runs theirs instead of
 * the summary's (no toggle), so their click must keep its default: navigation, check, submit.
 */
const SELF_ACTIVATING =
  "a[href], button, label, input:is([type='button'], [type='submit'], [type='reset'], " +
  "[type='image'], [type='checkbox'], [type='radio'], [type='file'], [type='color'])";

/** The interactive descendant of the summary that was clicked (a link in the heading), if any. */
function nestedInteractive(target: EventTarget | null, summary: HTMLElement): Element | null {
  if (!(target instanceof Element) || target === summary) return null;
  const interactive = target.closest(NESTED_INTERACTIVE);
  return interactive !== null && interactive !== summary && summary.contains(interactive)
    ? interactive
    : null;
}

/**
 * The click rule of a `<summary>` Trigger whose click the library handles (library mode, or a
 * disabled Trigger in JS-free mode). Returns `true` when the click is a toggle request: it has
 * been cancelled, so the browser does not touch `open`, and the caller dispatches unless
 * disabled. Returns `false` for a click on interactive content nested in the summary, which never
 * toggles: a control without an activation behaviour of its own (text input, select, textarea,
 * contenteditable) would let the click fall through to the summary's toggle, so that click is
 * cancelled; focus and pickers happen on mousedown and are unaffected. Self-activating controls
 * (links, buttons, checkboxes) already pre-empt the summary's behaviour and keep their default.
 */
export function interceptSummaryClick(event: MouseEvent<HTMLElement>): boolean {
  const nested = nestedInteractive(event.target, event.currentTarget);
  if (nested !== null) {
    if (!nested.matches(SELF_ACTIVATING)) event.preventDefault();
    return false;
  }
  event.preventDefault();
  return true;
}

/**
 * The development check of a part that must render a `<details>` (`Accordion.Item`,
 * `Collapsible.Root`); `part` is its public name and `semantics` the platform behaviours the
 * part relies on, named in the message. Pass `semantics` as `isDev && "..."` so the text folds
 * away in production, where the hook is a no-op returning `undefined` (`useElementCheck`). Call
 * the result from the part's own ref.
 */
export function useDetailsCheck(
  part: string,
  semantics: string | false,
): ElementCheck<HTMLDetailsElement> | undefined {
  return useElementCheck<HTMLDetailsElement>(
    isDev &&
      ((element) =>
        element.tagName !== "DETAILS"
          ? `${part}: expected to render a <details> element but got <${element.tagName.toLowerCase()}>. ` +
            `The platform semantics (${String(semantics)}) need a real <details>.`
          : null),
  );
}

/**
 * The development check of a part that must render a `<summary>` (`Accordion.Trigger`,
 * `Collapsible.Trigger`); see {@link useDetailsCheck}.
 */
export function useSummaryCheck(part: string): ElementCheck<HTMLElement> | undefined {
  return useElementCheck(
    isDev &&
      ((element) =>
        element.tagName !== "SUMMARY"
          ? `${part}: expected to render a <summary> element but got <${element.tagName.toLowerCase()}>. ` +
            "Only a <summary> toggles its parent <details>."
          : null),
  );
}

/**
 * Records the committed `open` as known in the commit that changes it (React wrote the
 * attribute; accordion.md 2.3). The mount run is skipped: there the element's attach (and the
 * mount reconciliation) recorded the DOM value, which a click before hydration may have changed.
 * `open` is `undefined` in JS-free mode, where nothing is recorded.
 */
export function useCommittedOpenRecord(
  elementRef: RefObject<HTMLDetailsElement | null>,
  open: boolean | undefined,
): void {
  const recorded = useRef(open);
  useLayoutEffect(() => {
    if (recorded.current === open) return;
    recorded.current = open;
    const element = elementRef.current;
    if (element !== null && open !== undefined) writeOpen(element, open);
  }, [elementRef, open]);
}
