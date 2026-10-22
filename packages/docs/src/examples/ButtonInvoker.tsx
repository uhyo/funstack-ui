// No "use client": this file is a Server Component. It renders Button (a client module) with
// serialisable props only: `commandfor` / `command` are plain attributes, so the browser opens
// and closes the dialog before hydration and with JavaScript off. A Server Function would also be
// a valid `action` or `formAction` here; this static site has none.
import { Button } from "@funstack/ui/button";
import { ButtonCssPending } from "./ButtonCssPending.js";

export function ButtonInvoker() {
  return (
    <div className="demo-row">
      <Button className="demo-btn" commandfor="button-invoker-preview" command="show-modal">
        Preview
      </Button>
      <dialog id="button-invoker-preview" className="demo-dialog" aria-labelledby="bip-title">
        <h2 id="bip-title">Preview</h2>
        <p>Opened by the browser&apos;s Invoker Command, no JavaScript involved.</p>
        <div className="demo-dialog-actions">
          <Button className="demo-btn" commandfor="button-invoker-preview" command="close">
            Close
          </Button>
        </div>
      </dialog>
      {/* Pending styled by [data-pending] CSS only (no function children). */}
      <ButtonCssPending />
    </div>
  );
}
