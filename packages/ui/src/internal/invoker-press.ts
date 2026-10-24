// No directive: DOM listeners only (conventions 7.1).

/** An invoker button's IDL; absent where the engine lacks the Popover API or Invoker Commands. */
interface InvokerButton {
  readonly popoverTargetElement?: Element | null;
  readonly commandForElement?: Element | null;
  readonly command?: string;
}

/**
 * Whether a press on `target` is a press on a foreign invoker of `popup`: its closest `<button>`
 * is outside the popup and names it through `popovertarget`, or through `commandfor` with a
 * popover command (`toggle-popover`, `show-popover`, `hide-popover`). The relationship light
 * dismiss exempts (conventions 3.5, #126). Read through the IDL, so an engine without it has no
 * such invoker.
 */
export function isPopoverInvoker(target: EventTarget | null, popup: Element): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest("button");
  if (button === null || popup.contains(button)) return false;
  const invoker = button as InvokerButton;
  if (invoker.popoverTargetElement === popup) return true;
  return invoker.commandForElement === popup && /-popover$/.test(invoker.command ?? "");
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
