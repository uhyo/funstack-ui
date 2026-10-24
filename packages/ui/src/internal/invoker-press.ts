// No directive: DOM listeners only (conventions 7.1).

/** An invoker button's IDL; absent where the engine lacks the Popover API or Invoker Commands. */
interface InvokerButton {
  readonly popoverTargetElement?: Element | null;
  readonly commandForElement?: Element | null;
  readonly command?: string;
}

/** The `<input>` types HTML counts as buttons: the ones `popovertarget` applies to. */
const INPUT_BUTTON_TYPES = new Set(["submit", "image", "reset", "button"]);

/**
 * Whether a press on `target` is a press on a foreign invoker of `popup`: its closest button (a
 * `<button>`, or an `<input>` of a button type) is outside the popup and names it through
 * `popovertarget`, or (a `<button>`) through `commandfor` with a popover command
 * (`toggle-popover`, `show-popover`, `hide-popover`). HTML's invoker relationship, the one light
 * dismiss exempts (conventions 3.5, #126): a disabled button and a submit button with a form owner
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
 * invoker of it moves no focus (conventions 3.5, #126). Chromium and Firefox focus a button on
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
