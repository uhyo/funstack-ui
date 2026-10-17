"use client";
import { use, useState } from "react";
import { Dialog } from "@funstack/ui/dialog";
import type { DialogOpenChangeDetails } from "@funstack/ui/dialog";
import { sleep } from "./fake-api.js";

interface Order {
  readonly items: string;
  readonly total: string;
}

// Cache the promises so `use()` sees the same one on every render.
const cache = new Map<string, Promise<Order>>();
function loadOrder(id: string): Promise<Order> {
  let promise = cache.get(id);
  if (promise === undefined) {
    promise = sleep(1200).then(() => ({
      items: id === "1042" ? "Keyboard, USB-C cable" : "Notebook",
      total: id === "1042" ? "$129.00" : "$18.50",
    }));
    cache.set(id, promise);
  }
  return promise;
}

function OrderDetails({ id }: { id: string }) {
  const order = use(loadOrder(id));
  return (
    <dl className="demo-dialog-details">
      <dt>Items</dt>
      <dd>{order.items}</dd>
      <dt>Total</dt>
      <dd>{order.total}</dd>
    </dl>
  );
}

// Library mode: `defaultOpen={false}` (or any action prop) hands the open to the library. The
// Popup's children render from committed state, so <OrderDetails> mounts inside the opening
// transition and suspends: the dialog stays closed and the Trigger carries data-pending until the
// data is ready, then the dialog opens once, complete. The Close button's close is library-owned
// too: openChangeAction(false) runs first, then the dialog closes in a view transition
// (`transition`), so the exit animates in every engine, Firefox included. Escape and a click on
// the backdrop are dismissals: the browser closes the dialog (with the CSS exit) and the Root is
// told afterwards. The readout shows what the Root received.
export function DialogOrders() {
  const [last, setLast] = useState("(none yet)");
  const record = (open: boolean, { reason, returnValue }: DialogOpenChangeDetails) => {
    // The synchronous part of an action: this setState is a transition update.
    setLast(`open=${open} reason="${reason}" returnValue=${JSON.stringify(returnValue)}`);
  };
  return (
    <>
      <ul className="demo-list">
        {["1042", "1043"].map((id) => (
          <li key={id} className="demo-row">
            Order #{id}
            <Dialog.Root defaultOpen={false} openChangeAction={record}>
              <Dialog.Trigger className="demo-button">
                {({ pending }) => (
                  <>
                    Details
                    {pending && <span className="demo-spinner" aria-hidden />}
                  </>
                )}
              </Dialog.Trigger>
              <Dialog.Popup
                className="demo-dialog demo-dialog-vt"
                lightDismiss
                initialFocus="[data-autofocus]"
                transition={{
                  "fsui-dialog-open": "demo-dialog-pop",
                  "fsui-dialog-close": "demo-dialog-pop",
                  default: "none",
                }}
              >
                <Dialog.Title>Order #{id}</Dialog.Title>
                <OrderDetails id={id} />
                <div className="demo-dialog-actions">
                  <Dialog.Close className="demo-button" value="done" data-autofocus="">
                    Close
                  </Dialog.Close>
                </div>
              </Dialog.Popup>
            </Dialog.Root>
          </li>
        ))}
      </ul>
      <div className="demo-row">
        <button type="button" className="demo-button" onClick={() => cache.clear()}>
          Clear the cache
        </button>
      </div>
      <output className="demo-readout">
        last openChangeAction: <code>{last}</code>
      </output>
    </>
  );
}
