import { Component, Fragment, startTransition, use, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@funstack/ui/dialog";
import type { DialogOpenChangeDetails } from "@funstack/ui/dialog";
import "./dialog-demo.css";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function logChange(label: string) {
  return (open: boolean, { reason, returnValue }: DialogOpenChangeDetails) => {
    console.log(
      `[${label}] open=${open} reason=${reason} returnValue=${JSON.stringify(returnValue)}`,
    );
  };
}

function Spinner() {
  return <span className="dlg-spinner" aria-hidden />;
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
          {({ pending }) => (pending ? <Spinner /> : "Details")}
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
      {pending ? <Spinner /> : null} Save
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

/* 5. Nested confirm from a Close action ---------------------------------------------------- */

class Cancelled extends Error {}

function NestedDemo() {
  const pending = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const confirmDiscard = () =>
    new Promise<void>((resolve, reject) => {
      pending.current = { resolve, reject };
      startTransition(() => setConfirming(true));
    }).finally(() => {
      pending.current = null;
    });

  return (
    <section>
      <h3>Nested: confirm before discarding</h3>
      <p>
        The outer Discard button is a <code>Dialog.Close</code> with an <code>action</code> that
        opens an inner controlled dialog and waits for its answer. The inner modal stacks on top;
        Escape closes only the inner one. "Keep editing" rejects with a handled error, so the outer
        dialog stays open.
      </p>
      <Dialog.Root defaultOpen={false} openChangeAction={logChange("editor")}>
        <Dialog.Trigger className="dlg-btn">Open editor</Dialog.Trigger>
        <Dialog.Popup className="dlg">
          <Dialog.Title>Editor</Dialog.Title>
          <textarea className="dlg-textarea" defaultValue="Unsaved notes…" />
          <div className="dlg-actions">
            <SwallowCancelled>
              <Dialog.Close className="dlg-btn" value="discard" action={confirmDiscard}>
                {({ pending: busy }) => (busy ? "Waiting for confirmation…" : "Discard")}
              </Dialog.Close>
            </SwallowCancelled>
          </div>

          <Dialog.Root
            open={confirming}
            openChangeAction={(next) => {
              if (!next) {
                pending.current?.reject(new Cancelled("Kept editing"));
                setConfirming(false);
              }
            }}
          >
            <Dialog.Popup className="dlg dlg-small" role="alertdialog">
              <Dialog.Title>Discard changes?</Dialog.Title>
              <div className="dlg-actions">
                <Dialog.Close className="dlg-btn" value="keep">
                  Keep editing
                </Dialog.Close>
                <Dialog.Close
                  className="dlg-btn dlg-danger"
                  value="discard"
                  action={() => {
                    pending.current?.resolve();
                  }}
                >
                  Discard
                </Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

let resets = 0;

/**
 * Remounts the Close button after the handled "keep editing" rejection (a rejected action reaches
 * the nearest boundary; the button then starts fresh). Any other error is rethrown.
 */
class SwallowCancelled extends Component<{ children: ReactNode }, { key: number; error: unknown }> {
  state = { key: 0, error: undefined as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { key: ++resets, error };
  }

  render() {
    if (this.state.error !== undefined && !(this.state.error instanceof Cancelled)) {
      throw this.state.error;
    }
    return <Fragment key={this.state.key}>{this.props.children}</Fragment>;
  }
}

export function DialogDemo() {
  return (
    <section className="dlg-demo">
      <h2>Dialog</h2>
      <p>
        Built on <code>&lt;dialog&gt;</code> and Invoker Commands. The stylesheet carries the
        documented recipes: enter/exit animation with <code>@starting-style</code> and{" "}
        <code>allow-discrete</code> (the exit is instant in Firefox), and the CSS-only scroll lock{" "}
        <code>html:has(dialog:modal) {"{ overflow: hidden }"}</code>.
      </p>
      <JsFreeConfirm />
      <LoadOnOpen />
      <FormDemo />
      <DismissDemo />
      <NestedDemo />
    </section>
  );
}
