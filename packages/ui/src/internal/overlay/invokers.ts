// No directive: DOM reads and listeners only (conventions 7.1). The platform's invoker
// relationship between a button and a popover, as the overlays read it.

/** An invoker button's IDL; absent where the engine lacks the Popover API or Invoker Commands. */
interface InvokerButton {
  readonly popoverTargetElement?: Element | null;
  readonly commandForElement?: Element | null;
  readonly command?: string;
}

/**
 * The `source` of a `ToggleEvent` (Chromium 140, Firefox 145, Safari 26.5), a `CommandEvent` or
 * an `InterestEvent`: the invoker that caused it, `null` without one. Not in TypeScript's DOM lib
 * for all three.
 */
export function eventSource(event: Event): Element | null {
  return (event as Event & { readonly source?: Element | null }).source ?? null;
}

/**
 * Whether the `ToggleEvent.source` of a close is a `popovertarget` invoker of `popup`. A
 * `commandfor` or `interestfor` invoker sets `source` too (Chromium's lost-interest hide, a
 * dismissal), and so names no `popovertarget` here.
 */
export function closedByPopoverTarget(event: ToggleEvent, popup: HTMLElement): boolean {
  const source = eventSource(event);
  return (
    (source instanceof HTMLButtonElement || source instanceof HTMLInputElement) &&
    source.popoverTargetElement === popup
  );
}

/** The `<input>` types HTML counts as buttons: the ones `popovertarget` applies to. */
const INPUT_BUTTON_TYPES = new Set(["submit", "image", "reset", "button"]);

/**
 * Whether a press on `target` is a press on a foreign invoker of `popup`: its closest button (a
 * `<button>`, or an `<input>` of a button type) is outside the popup and names it through
 * `popovertarget`, or (a `<button>`) through `commandfor` with a popover command
 * (`toggle-popover`, `show-popover`, `hide-popover`). HTML's invoker relationship, the one light
 * dismiss exempts (conventions 3.5): a disabled button and a submit button with a form owner
 * invoke nothing. Read through the IDL, so an engine without it has no such invoker.
 */
export function isPopoverInvoker(target: EventTarget | null, popup: Element): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement | HTMLInputElement>("button, input");
  if (button === null || popup.contains(button)) return false;
  const isInput = button.tagName === "INPUT";
  if (isInput && !INPUT_BUTTON_TYPES.has(button.type)) return false;
  if (button.disabled) return false;
  if (button.form !== null && (button.type === "submit" || button.type === "image")) return false;
  const invoker = button as InvokerButton;
  if (invoker.popoverTargetElement === popup) return true;
  return !isInput && invoker.commandForElement === popup && /-popover$/.test(invoker.command ?? "");
}

/**
 * While a popup that closes on focus leaving is shown: a primary-button `mousedown` on a foreign
 * invoker of it moves no focus (conventions 3.5). Chromium and Firefox focus a button on
 * press, which would close the popup at the `focusout` before the click's own toggle (as
 * `"dismiss"`, and the toggle then re-showed it). Returns the cleanup.
 */
export function listenInvokerPresses(popup: HTMLElement): () => void {
  const doc = popup.ownerDocument;
  const onMouseDown = (event: MouseEvent) => {
    if (event.button === 0 && isPopoverInvoker(event.target, popup)) event.preventDefault();
  };
  doc.addEventListener("mousedown", onMouseDown, true);
  return () => doc.removeEventListener("mousedown", onMouseDown, true);
}
