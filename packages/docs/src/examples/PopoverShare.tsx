// No "use client": this file is a Server Component. The Popover.Root has no `open`, `defaultOpen`
// or `openChangeAction`, so it runs in JS-free mode: the Trigger is a native
// `command="toggle-popover"` invoker and Done is a `command="hide-popover"` button. The browser
// opens the popup in the top layer below the button, focuses the `autoFocus` input, and closes it
// on Escape, a click outside or Done, before hydration and with JavaScript off.
import { Popover } from "@funstack/ui/popover";

export function PopoverShare() {
  return (
    <Popover.Root>
      <Popover.Trigger className="demo-button">Share</Popover.Trigger>
      <Popover.Popup className="demo-popover" align="start">
        <Popover.Title>Share this page</Popover.Title>
        <input
          className="demo-popover-input"
          readOnly
          value="https://ui.funstack.work/components/popover"
          autoFocus
        />
        <div className="demo-popover-actions">
          <Popover.Close className="demo-button">Done</Popover.Close>
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
}
