// No directive: a DOM helper (conventions 7.1).

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
 * declaration restored exactly as it was, so nothing is left for React's `style` diffing.
 * Dismissals (Escape, light dismiss) never come here: their CSS exit plays.
 */
export function withCssTransitionCut<T>(
  element: HTMLElement,
  hasTransition: boolean,
  run: () => T,
): T {
  if (!hasTransition || cutting.has(element) || !viewTransitionActive(element)) return run();
  const { style } = element;
  const attribute = element.getAttribute("style");
  const previous = style.getPropertyValue("transition");
  const priority = style.getPropertyPriority("transition");
  cutting.add(element);
  style.setProperty("transition", "none", "important");
  const cut = element.getAttribute("style");
  try {
    return run();
  } finally {
    // The show or hide's style change is processed while the cut is in place.
    void getComputedStyle(element).opacity;
    if (element.getAttribute("style") === cut) {
      // Nothing else wrote inline style meanwhile: put the attribute back byte for byte (absent
      // included), not a CSSOM re-serialisation of it.
      if (attribute === null) element.removeAttribute("style");
      else element.setAttribute("style", attribute);
    } else if (previous === "") {
      style.removeProperty("transition");
    } else {
      style.setProperty("transition", previous, priority);
    }
    cutting.delete(element);
  }
}
