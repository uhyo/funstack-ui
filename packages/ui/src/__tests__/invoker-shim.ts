// Test-only Invoker Commands emulation for jsdom, shared by the `<dialog>` shim and the popover
// shim (design/components/dialog.md 13.1, popover.md 13.1). jsdom has no `command` /
// `commandfor`. Installed only where the platform lacks `HTMLButtonElement.prototype.command`, so
// the browser project keeps the real implementation.
//
// As in the platform: the command runs as the button's activation behaviour, after the `click`
// has been dispatched and only if nobody cancelled it. A submit button in a form does not invoke
// (its activation behaviour submits instead); a disabled button does nothing. An invalid command
// for the target fires no `command` event and does nothing; custom `--commands` always fire. A
// valid one dispatches a cancelable `command` event (with `command` and `source`) at the target
// and runs the command unless that event was cancelled.
//
// Without `commandfor`, a button with `popovertarget` runs the popover target attribute
// activation behaviour (#121): the target must be a `[popover]`, `popovertargetaction` picks
// `toggle` (default, also for an invalid value), `show` or `hide` (`show` on a shown and `hide` on
// a hidden popover do nothing), there is **no `command` event**, and the same disabled and
// submit-button exclusions apply. It runs through the popover shim's registered command, with the
// button as the `source` of both the show and the hide (`ToggleEvent.source`, #125).

/** One kind of command target (dialogs, popovers). */
export interface CommandHandler {
  /** Whether `command` is a valid built-in command for `target` right now (HTML "is valid"). */
  readonly isValid: (target: Element, command: string) => boolean;
  /** Runs a valid, uncancelled built-in command. */
  readonly run: (target: Element, command: string, button: HTMLButtonElement) => void;
}

const handlers: CommandHandler[] = [];

/** Registers the commands of one kind of target (called by the dialog and popover shims). */
export function registerCommandHandler(handler: CommandHandler): void {
  handlers.push(handler);
}

/** Dispatches a `command` event the way an invoker would (tests drive foreign invokers). */
export function dispatchCommand(
  target: Element,
  command: string,
  source: Element | null = null,
): Event {
  const event = Object.assign(new Event("command", { cancelable: true }), { command, source });
  target.dispatchEvent(event);
  return event;
}

let installed = false;

/** Adds the document `click` listener once (both shims call it). */
export function installInvokerShim(): void {
  if (installed || typeof document === "undefined") return;
  if (typeof HTMLButtonElement !== "undefined" && "command" in HTMLButtonElement.prototype) return;
  installed = true;
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button === null || button.disabled) return;
    if (button.type === "submit" && button.form !== null) return;
    const id = button.getAttribute("commandfor");
    const command = button.getAttribute("command")?.toLowerCase();
    if (id === null || command === undefined) {
      runPopoverTarget(button);
      return;
    }
    const target = button.ownerDocument.getElementById(id);
    if (target === null) return;
    if (command.startsWith("--")) {
      dispatchCommand(target, command, button);
      return;
    }
    const handler = handlers.find((h) => h.isValid(target, command));
    if (handler === undefined) return;
    const commandEvent = dispatchCommand(target, command, button);
    if (commandEvent.defaultPrevented) return;
    handler.run(target, command, button);
  });
}

/** The `popovertarget` activation behaviour: no `command` event (HTML "popover target attribute"). */
function runPopoverTarget(button: HTMLButtonElement): void {
  const id = button.getAttribute("popovertarget");
  if (id === null) return;
  const target = button.ownerDocument.getElementById(id);
  if (target === null || !target.hasAttribute("popover")) return;
  const action = button.getAttribute("popovertargetaction")?.toLowerCase();
  const command =
    action === "show" ? "show-popover" : action === "hide" ? "hide-popover" : "toggle-popover";
  handlers.find((h) => h.isValid(target, command))?.run(target, command, button);
}
