// Interest Invokers (`interestfor`) for jsdom, which has neither the attribute's behaviour nor
// `InterestEvent`. Chromium fires `interest` at the target with the button as `source`, then shows
// a popover target through its interest show (`source` the button), and on lost interest fires
// `loseinterest` (same `source`) before hiding a popover that interest show opened
// (design/components/popover.md, amendment #127). These helpers dispatch the events as plain
// `Event`s carrying `source`; `gainInterest` adds the interest show, which a library-mode Popup
// cancels at `beforetoggle` and routes, as it does Chromium's.

/** Dispatches an `interest` event at `target` with `source` (no show). */
export function dispatchInterest(target: Element, source: Element): Event {
  const event = Object.assign(new Event("interest"), { source });
  target.dispatchEvent(event);
  return event;
}

/** Dispatches a `loseinterest` event at `target` with `source` (no hide). */
export function dispatchLoseInterest(target: Element, source: Element): Event {
  const event = Object.assign(new Event("loseinterest"), { source });
  target.dispatchEvent(event);
  return event;
}

/**
 * Chromium's interest gained on `source` for the popover `target`: `interest`, then
 * `showPopover({ source })` (a no-op when the popover is already shown).
 */
export function gainInterest(target: HTMLElement, source: HTMLElement): void {
  dispatchInterest(target, source);
  target.showPopover({ source });
}
