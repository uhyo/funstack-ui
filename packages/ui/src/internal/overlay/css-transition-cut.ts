// No directive: a DOM helper (conventions 7.1).

/** What `transition: none` sets, each restored on its own. */
const LONGHANDS = [
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "transition-behavior",
] as const;

/** Elements inside a cut right now: a nested call (Menu's `reshow`) runs inside the outer one. */
const cutting = new WeakSet<HTMLElement>();

/** Whether a document view transition is running (`html:active-view-transition`). */
function viewTransitionActive(element: HTMLElement): boolean {
  try {
    return element.ownerDocument.documentElement.matches(":active-view-transition");
  } catch {
    // An engine (or jsdom) that does not know the pseudo-class has no view transition to avoid.
    return false;
  }
}

/**
 * Runs the library's own show or hide of a popup (`showPopover()`, `hidePopover()`,
 * `showModal()`, `show()`, `close()`) with the popup's CSS transitions cut, when the Popup has a
 * `transition` prop and a view transition is running (conventions 5.1, issue #147). The view
 * transition animates that show or hide; a CSS `transition` on the popup would run next to it
 * (the open's `@starting-style` enter under the view transition's enter; in Chromium the close's
 * `display` / `overlay` fade keeps the hidden box in the new snapshot, a double image).
 *
 * One synchronous step: an inline `transition: none !important`, the call, a forced style
 * recalculation (without it Chromium sees the restored value and the fade runs), and the inline
 * `transition` longhands restored as they were, so nothing is left for React's `style` diffing.
 * Everything goes through CSSOM, never the `style` attribute: a CSP without `'unsafe-inline'`
 * for styles blocks an attribute write (React's `style` prop is CSSOM too). Only CSS
 * transitions are cut, not a `@keyframes` animation. Dismissals (Escape, light dismiss) never
 * come here: their CSS exit plays.
 */
export function withCssTransitionCut<T>(
  element: HTMLElement,
  hasTransition: boolean,
  run: () => T,
): T {
  if (!hasTransition || cutting.has(element) || !viewTransitionActive(element)) return run();
  const { style } = element;
  const hadAttribute = element.hasAttribute("style");
  // The shorthand, and the longhands for a consumer who set only some of them (the shorthand
  // then reads as "").
  const shorthand = style.getPropertyValue("transition");
  const shorthandPriority = style.getPropertyPriority("transition");
  const longhands = LONGHANDS.map(
    (name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)] as const,
  );
  cutting.add(element);
  style.setProperty("transition", "none", "important");
  try {
    return run();
  } finally {
    // The show or hide's style change is processed while the cut is in place.
    void getComputedStyle(element).opacity;
    // Only while the cut is still ours: a listener inside the call that wrote its own
    // `transition` keeps it.
    const ours = (name: string) =>
      style.getPropertyValue(name) === "none" && style.getPropertyPriority(name) === "important";
    if (ours("transition-property") || ours("transition")) {
      style.removeProperty("transition");
      if (shorthand !== "") {
        style.setProperty("transition", shorthand, shorthandPriority);
      } else {
        for (const [name, value, priority] of longhands) {
          if (value !== "") style.setProperty(name, value, priority);
        }
      }
    }
    // `removeAttribute` parses nothing, so CSP does not block it.
    if (!hadAttribute && style.length === 0) element.removeAttribute("style");
    cutting.delete(element);
  }
}
