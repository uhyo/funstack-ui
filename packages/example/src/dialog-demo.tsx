import { Component, startTransition, use, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@funstack/ui/dialog";
import type { DialogOpenChangeDetails } from "@funstack/ui/dialog";
import { sleep } from "./shared/fake-backend";
import { Spinner } from "./shared/Spinner";
import { Demo } from "./shared/Demo";
import "./dialog-demo.css";

function logChange(label: string) {
  return (open: boolean, { reason, returnValue }: DialogOpenChangeDetails) => {
    console.log(
      `[${label}] open=${open} reason=${reason} returnValue=${JSON.stringify(returnValue)}`,
    );
  };
}

class InlineErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="dlg-error">
          <p>{this.state.error.message}</p>
          <button type="button" className="dlg-btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* 1. JS-free ------------------------------------------------------------------------------ */

function JsFreeConfirm() {
  return (
    <section>
      <h3>JS-free confirm</h3>
      <p>
        No <code>open</code>, <code>defaultOpen</code> or <code>openChangeAction</code>: the Trigger
        is a native <code>command="show-modal"</code> invoker, the buttons are a{" "}
        <code>&lt;form method="dialog"&gt;</code> and a <code>command="request-close"</code> button.
        The browser opens, focuses, closes on Escape and returns focus; no library JS runs. The
        content is in the HTML.
      </p>
      <Dialog.Root>
        <Dialog.Trigger className="dlg-btn">Delete draft…</Dialog.Trigger>
        <Dialog.Popup className="dlg" role="alertdialog">
          <Dialog.Title>Delete this draft?</Dialog.Title>
          <Dialog.Description>This cannot be undone.</Dialog.Description>
          <Dialog.Form className="dlg-actions">
            <Dialog.Close className="dlg-btn" value="cancel">
              Cancel
            </Dialog.Close>
            <button type="submit" className="dlg-btn dlg-danger" value="delete">
              Delete
            </button>
          </Dialog.Form>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

/* 2. Library mode, content loaded on open ------------------------------------------------- */

interface Order {
  readonly id: string;
  readonly items: readonly string[];
  readonly total: string;
}

const orderCache = new Map<string, Promise<Order>>();
function fetchOrder(id: string): Promise<Order> {
  let promise = orderCache.get(id);
  if (promise === undefined) {
    console.log(`[order ${id}] fetching`);
    promise = sleep(1200).then(() => ({
      id,
      items: ["Keyboard", "USB-C cable"],
      total: id === "1042" ? "$129.00" : "$18.50",
    }));
    orderCache.set(id, promise);
  }
  return promise;
}

function OrderDetails({ id }: { id: string }) {
  const order = use(fetchOrder(id));
  return (
    <dl className="dlg-order">
      <dt>Items</dt>
      <dd>{order.items.join(", ")}</dd>
      <dt>Total</dt>
      <dd>{order.total}</dd>
    </dl>
  );
}

function OrderRow({ id }: { id: string }) {
  return (
    <li className="dlg-row">
      <span>Order #{id}</span>
      <Dialog.Root defaultOpen={false} openChangeAction={logChange(`order ${id}`)}>
        <Dialog.Trigger className="dlg-btn">
          {({ pending }) => (pending ? <Spinner className="dlg-spinner" /> : "Details")}
        </Dialog.Trigger>
        <Dialog.Popup className="dlg" initialFocus="[data-initial-focus]">
          <Dialog.Title>Order #{id}</Dialog.Title>
          <OrderDetails id={id} />
          <div className="dlg-actions">
            <Dialog.Close className="dlg-btn" data-initial-focus="">
              Close
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Root>
    </li>
  );
}

function LoadOnOpen() {
  return (
    <section>
      <h3>Library mode: content loads on open</h3>
      <p>
        <code>defaultOpen={"{false}"}</code> selects library mode. The content suspends (a 1.2 s
        fetch) inside the opening transition: the Trigger shows <code>data-pending</code> and a
        spinner, and the dialog opens once, complete. Nothing is fetched until you ask; the second
        open is instant (cached). <code>initialFocus</code> puts focus on Close.
      </p>
      <ul className="dlg-list">
        <OrderRow id="1042" />
        <OrderRow id="1043" />
      </ul>
    </section>
  );
}

/* 3. Form: action, then close ------------------------------------------------------------- */

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dlg-btn dlg-primary" value="save">
      {pending ? <Spinner className="dlg-spinner" /> : null} Save
    </button>
  );
}

async function saveProfile(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "");
  console.log(`[profile] saving name=${JSON.stringify(name)}`);
  await sleep(900);
  if (name.toLowerCase().includes("fail")) {
    throw new Error(`The server rejected the name "${name}". Try another one.`);
  }
  console.log(`[profile] saved`);
}

function FormDemo() {
  const [name, setName] = useState("Ada Lovelace");
  return (
    <section>
      <h3>Form: action, then close</h3>
      <p>
        <code>Dialog.Form action</code> runs the React form action and closes the dialog when it has
        settled, with the submitter's value as <code>returnValue</code>. Type a name containing
        "fail" to see a rejected save: the Error Boundary inside the dialog shows it and the dialog
        stays open. Current name: <strong>{name}</strong>
      </p>
      <Dialog.Root defaultOpen={false} openChangeAction={logChange("profile dialog")}>
        <Dialog.Trigger className="dlg-btn">Edit profile</Dialog.Trigger>
        <Dialog.Popup className="dlg" initialFocus="[name=name]">
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Changes are saved to your account.</Dialog.Description>
          <InlineErrorBoundary>
            <Dialog.Form
              className="dlg-form"
              action={async (formData) => {
                await saveProfile(formData);
                startTransition(() => setName(String(formData.get("name"))));
              }}
            >
              <label>
                Name <input name="name" defaultValue={name} />
              </label>
              <div className="dlg-actions">
                <Dialog.Close className="dlg-btn" value="cancel">
                  Cancel
                </Dialog.Close>
                <SaveButton />
              </div>
            </Dialog.Form>
          </InlineErrorBoundary>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

/* 4. Dismissal flags ----------------------------------------------------------------------- */

const supportsClosedBy =
  typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;

function DismissDemo() {
  const [lightDismiss, setLightDismiss] = useState(true);
  const [closedBy, setClosedBy] = useState(false);
  const [modal, setModal] = useState(true);
  const [last, setLast] = useState<string>("(none yet)");
  return (
    <section>
      <h3>Dismissal: lightDismiss and experimental_closedBy</h3>
      <fieldset className="dlg-flags">
        <legend>Options</legend>
        <label>
          <input
            type="checkbox"
            checked={lightDismiss}
            onChange={(e) => setLightDismiss(e.target.checked)}
          />{" "}
          <code>lightDismiss</code> (close on a click outside)
        </label>
        <label>
          <input
            type="checkbox"
            checked={closedBy}
            onChange={(e) => setClosedBy(e.target.checked)}
          />{" "}
          <code>experimental_closedBy</code> (native <code>closedby</code>; this browser{" "}
          {supportsClosedBy ? "supports it" : "does not, so the JS fallback runs"})
        </label>
        <label>
          <input type="checkbox" checked={modal} onChange={(e) => setModal(e.target.checked)} />{" "}
          <code>modal</code> (unchecked: <code>show()</code>, no backdrop, JS Escape)
        </label>
      </fieldset>
      <p>
        Last close: <code>{last}</code>
      </p>
      <Dialog.Root
        key={modal ? "modal" : "non-modal"}
        defaultOpen={false}
        modal={modal}
        openChangeAction={(open, { reason, returnValue }) => {
          if (!open)
            startTransition(() => setLast(`reason=${reason} returnValue="${returnValue}"`));
        }}
      >
        <Dialog.Trigger className="dlg-btn">
          Open {modal ? "modal" : "non-modal"} dialog
        </Dialog.Trigger>
        <Dialog.Popup
          className={modal ? "dlg" : "dlg dlg-panel"}
          lightDismiss={lightDismiss}
          experimental_closedBy={closedBy}
        >
          <Dialog.Title>Dismiss me</Dialog.Title>
          <p>Press Escape{lightDismiss ? ", click outside," : ""} or use a button.</p>
          <div className="dlg-actions">
            <Dialog.Close className="dlg-btn" value="no">
              No
            </Dialog.Close>
            <Dialog.Close className="dlg-btn dlg-primary" value="yes">
              Yes
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

/* 5. Nested confirm ------------------------------------------------------------------------ */

async function discardDraft(): Promise<void> {
  console.log("[editor] discarding draft");
  await sleep(700);
  console.log("[editor] draft discarded");
}

function NestedDemo() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState("(none yet)");
  return (
    <section>
      <h3>Nested: confirm before discarding</h3>
      <p>
        No action waits for the user. "Discard…" is the Trigger of a JS-free confirm dialog, which
        opens at once on top of the editor; Escape or "Keep editing" closes only the confirm. The
        confirm's "Discard" is a <code>Dialog.Close</code> whose action discards the draft and then
        closes the editor, which is controlled (<code>open</code>). Do not write a Close action that
        awaits the inner dialog's answer: React holds every transition started while an async action
        is pending, the inner open included, so it would never open.
      </p>
      <p>
        Last result: <code>{last}</code>
      </p>
      <Dialog.Root
        open={open}
        openChangeAction={(next, details) => {
          logChange("editor")(next, details);
          setOpen(next);
          if (!next) setLast(`closed: returnValue="${details.returnValue}"`);
        }}
      >
        <Dialog.Trigger className="dlg-btn">Open editor</Dialog.Trigger>
        <Dialog.Popup className="dlg">
          <Dialog.Title>Editor</Dialog.Title>
          <textarea className="dlg-textarea" defaultValue="Unsaved notes…" />
          <div className="dlg-actions">
            <Dialog.Close className="dlg-btn" value="close">
              Close
            </Dialog.Close>
            {/* The inner Root starts here: its parts bind to the confirm dialog. */}
            <Dialog.Root>
              <Dialog.Trigger className="dlg-btn dlg-danger">Discard…</Dialog.Trigger>
              <Dialog.Popup className="dlg dlg-small" role="alertdialog">
                <Dialog.Title>Discard changes?</Dialog.Title>
                <div className="dlg-actions">
                  <Dialog.Close className="dlg-btn" value="keep">
                    Keep editing
                  </Dialog.Close>
                  <Dialog.Close
                    className="dlg-btn dlg-danger"
                    value="discard"
                    action={async () => {
                      await discardDraft();
                      startTransition(() => {
                        setOpen(false);
                        setLast("discarded");
                      });
                    }}
                  >
                    {({ pending }) => (pending ? <Spinner className="dlg-spinner" /> : "Discard")}
                  </Dialog.Close>
                </div>
              </Dialog.Popup>
            </Dialog.Root>
          </div>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

/* 6. Library-owned closes: ViewTransition exit and veto (#46) ------------------------------ */

function TransitionDemo() {
  const [open, setOpen] = useState(false);
  const [refuse, setRefuse] = useState(false);
  const [slow, setSlow] = useState(false);
  const [last, setLast] = useState("(none yet)");
  return (
    <section>
      <h3>Library-owned closes: ViewTransition exit and veto</h3>
      <p>
        <code>transition</code> on the Popup: the opening commit and every close a part asks for
        (Close, the <code>method="dialog"</code> OK button, the controlled close below) run in a
        view transition, so the exit animates in Firefox too. Escape and a click outside are
        dismissals: the browser closes them with the CSS exit and <code>openChangeAction</code> only
        hears about it. With "refuse" on, the controlled parent keeps <code>open</code> for a part's
        close (snap-back, a real veto); a refused dismissal re-opens.
      </p>
      <fieldset className="dlg-flags">
        <legend>Options</legend>
        <label>
          <input type="checkbox" checked={refuse} onChange={(e) => setRefuse(e.target.checked)} />{" "}
          Refuse closes (the parent keeps <code>open</code>)
        </label>
        <label>
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> Slow{" "}
          <code>openChangeAction</code> (800 ms): the Trigger and the Close stay pending
        </label>
      </fieldset>
      <p>
        Last change: <code>{last}</code>
      </p>
      <Dialog.Root
        open={open}
        openChangeAction={async (next, details) => {
          logChange("transition")(next, details);
          const { reason, returnValue } = details;
          if (slow) await sleep(800);
          startTransition(() => {
            setLast(`open=${next} reason=${reason} returnValue=${JSON.stringify(returnValue)}`);
            if (next || !refuse) setOpen(next);
          });
        }}
      >
        <Dialog.Trigger className="dlg-btn">
          {({ pending }) => (pending ? <Spinner className="dlg-spinner" /> : "Open")}
        </Dialog.Trigger>
        <Dialog.Popup
          className="dlg dlg-vt"
          lightDismiss
          transition={{
            "fsui-dialog-open": "dlg-pop",
            "fsui-dialog-close": "dlg-pop",
            default: "none",
          }}
        >
          <Dialog.Title>Animated close</Dialog.Title>
          <p>
            Close with a button (view transition) or with Escape / a click outside (CSS fade;
            instant in Firefox).
          </p>
          <Dialog.Form className="dlg-actions">
            <Dialog.Close className="dlg-btn" value="cancel">
              {({ pending }) => (pending ? <Spinner className="dlg-spinner" /> : "Cancel")}
            </Dialog.Close>
            <button
              type="button"
              className="dlg-btn"
              onClick={() => startTransition(() => setOpen(false))}
            >
              Controlled close
            </button>
            <button type="submit" className="dlg-btn dlg-primary" value="ok">
              OK
            </button>
          </Dialog.Form>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

export function DialogDemo() {
  return (
    <Demo title="Dialog">
      <p>
        Built on <code>&lt;dialog&gt;</code> and Invoker Commands. The stylesheet carries the
        documented recipes: enter/exit animation with <code>@starting-style</code> and{" "}
        <code>allow-discrete</code> (the exit is instant in Firefox), the CSS-only scroll lock{" "}
        <code>html:has(dialog:modal) {"{ overflow: hidden }"}</code>, and a <code>transition</code>{" "}
        recipe whose view transition animates library-driven closes in every engine.
      </p>
      <JsFreeConfirm />
      <LoadOnOpen />
      <FormDemo />
      <DismissDemo />
      <NestedDemo />
      <TransitionDemo />
    </Demo>
  );
}
