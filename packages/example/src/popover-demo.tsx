import { startTransition, use, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@funstack/ui/dialog";
import { Popover } from "@funstack/ui/popover";
import type { PopoverOpenChangeDetails } from "@funstack/ui/popover";
import { sleep } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
import "./popover-demo.css";

function logChange(label: string) {
  return (open: boolean, { reason }: PopoverOpenChangeDetails) => {
    console.log(`[${label}] open=${open} reason=${reason}`);
  };
}

/* 1. JS-free ------------------------------------------------------------------------------ */

function JsFreeShare() {
  return (
    <section>
      <h3>JS-free share popover</h3>
      <p>
        No <code>open</code>, <code>defaultOpen</code> or <code>openChangeAction</code>: the Trigger
        is a native <code>popovertarget</code> invoker. The browser opens it in the top layer below
        the button, focuses the input (the first focusable element), and closes it on Escape, a
        click outside or Done. The library only keeps the Trigger's <code>data-open</code> current.
      </p>
      <Popover.Root>
        <Popover.Trigger className="pop-btn">Share</Popover.Trigger>
        <Popover.Popup className="pop" align="start">
          <Popover.Title>Share this page</Popover.Title>
          <input className="pop-input" readOnly value="https://ui.funstack.work/" />
          <div className="pop-actions">
            <Popover.Close className="pop-btn">Done</Popover.Close>
          </div>
        </Popover.Popup>
      </Popover.Root>
    </section>
  );
}

/* 2. Library mode, content loaded on open, transition ------------------------------------ */

const permissionCache = new Map<string, Promise<readonly string[]>>();
function fetchPermissions(id: string): Promise<readonly string[]> {
  let promise = permissionCache.get(id);
  if (promise === undefined) {
    console.log(`[row ${id}] fetching permissions`);
    promise = sleep(900).then(() => (id === "b" ? ["Rename"] : ["Rename", "Archive"]));
    permissionCache.set(id, promise);
  }
  return promise;
}

function RowActions({ id, onArchive }: { id: string; onArchive: () => Promise<void> }) {
  const permissions = use(fetchPermissions(id));
  return (
    <div className="pop-actions">
      {permissions.includes("Rename") && (
        <Popover.Close className="pop-btn" action={() => sleep(300)}>
          {({ pending }) => (pending ? "Renaming…" : "Rename")}
        </Popover.Close>
      )}
      {permissions.includes("Archive") && (
        <Popover.Close className="pop-btn pop-danger" action={onArchive}>
          {({ pending }) => (pending ? "Archiving…" : "Archive")}
        </Popover.Close>
      )}
    </div>
  );
}

function Row({ id, name }: { id: string; name: string }) {
  const [archived, setArchived] = useState(false);
  return (
    <li className="pop-row" data-archived={archived ? "" : undefined}>
      <span>{name}</span>
      <Popover.Root defaultOpen={false} openChangeAction={logChange(`row ${id}`)}>
        <Popover.Trigger className="pop-btn" aria-label={`Actions for ${name}`}>
          {({ pending }) => (pending ? <span className="pop-spinner" aria-hidden /> : "⋯")}
        </Popover.Trigger>
        <Popover.Popup className="pop pop-vt" align="end" transition="pop">
          <Popover.Title>{name}</Popover.Title>
          <RowActions
            id={id}
            onArchive={async () => {
              await sleep(600);
              startTransition(() => setArchived(true));
            }}
          />
        </Popover.Popup>
      </Popover.Root>
    </li>
  );
}

function LoadOnOpen() {
  return (
    <section>
      <h3>Library mode: content loads on open, ViewTransition exit</h3>
      <p>
        <code>defaultOpen={"{false}"}</code> selects library mode. The actions suspend (a 0.9 s
        fetch) inside the opening transition: the Trigger shows <code>data-pending</code> and a
        spinner, and the popup opens once, complete. A Close with an <code>action</code> shows its
        own pending label, then closes through the Root with <code>transition="pop"</code>: the view
        transition animates the exit in every engine, Firefox included. Escape and clicks outside
        are the browser's and use the CSS fade.
      </p>
      <ul className="pop-list">
        <Row id="a" name="Quarterly report" />
        <Row id="b" name="Team offsite notes" />
      </ul>
    </section>
  );
}

/* 3. Controlled: submit, then close ------------------------------------------------------- */

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="pop-btn" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function Rename() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Untitled document");
  return (
    <section>
      <h3>Controlled: submit, then close</h3>
      <p>
        A <code>&lt;form action&gt;</code> inside the Popup plus a controlled <code>open</code>: the
        parent closes it after the save, and the Trigger toggle and Cancel are library-owned closes
        the parent could refuse.
      </p>
      <p>
        Title: <strong>{title}</strong>
      </p>
      <Popover.Root open={open} openChangeAction={(next) => setOpen(next)}>
        <Popover.Trigger className="pop-btn">Rename</Popover.Trigger>
        <Popover.Popup className="pop" initialFocus="[name=title]" align="start">
          <Popover.Title>Rename</Popover.Title>
          <form
            action={async (formData) => {
              await sleep(700);
              startTransition(() => {
                setTitle(String(formData.get("title")));
                setOpen(false);
              });
            }}
          >
            <input className="pop-input" name="title" defaultValue={title} />
            <div className="pop-actions">
              <Popover.Close className="pop-btn">Cancel</Popover.Close>
              <SubmitButton />
            </div>
          </form>
        </Popover.Popup>
      </Popover.Root>
    </section>
  );
}

/* 4. Disclosure-style, nested, and a Dialog from a popover -------------------------------- */

function Disclosure() {
  return (
    <section>
      <h3>Disclosure-style info card</h3>
      <p>
        <code>render={"{<div />}"}</code> keeps focus on the Trigger (no dialog focusing steps); Tab
        enters the card because it is rendered right after the Trigger.
      </p>
      <Popover.Root>
        <Popover.Trigger className="pop-link">What is this?</Popover.Trigger>
        <Popover.Popup
          render={<div />}
          role="region"
          aria-label="Explanation"
          side="top"
          className="pop"
        >
          <p>
            Popovers are built on the Popover API: top layer, light dismiss and Escape for free.
          </p>
          <a href="https://ui.funstack.work/components/popover">Learn more</a>
        </Popover.Popup>
      </Popover.Root>
    </section>
  );
}

function Nested() {
  return (
    <section>
      <h3>Nested popover and a modal Dialog from a popover</h3>
      <p>
        The inner popover is a nested <code>auto</code> popover: opening it keeps the outer one
        open, Escape closes the innermost and the library returns focus to "Permissions" (the
        platform does not for nested popovers). The Dialog is a DOM descendant, so it keeps the
        popover open and its Escape closes first.
      </p>
      <Popover.Root defaultOpen={false} openChangeAction={logChange("share")}>
        <Popover.Trigger className="pop-btn">Share settings</Popover.Trigger>
        <Popover.Popup className="pop" align="start">
          <Popover.Title>Share</Popover.Title>
          <div className="pop-actions">
            <Popover.Root defaultOpen={false} openChangeAction={logChange("permissions")}>
              <Popover.Trigger className="pop-btn">Permissions</Popover.Trigger>
              <Popover.Popup className="pop" side="right" align="start">
                <Popover.Title>Permissions</Popover.Title>
                <label>
                  <input type="checkbox" defaultChecked /> Can edit
                </label>
              </Popover.Popup>
            </Popover.Root>
            <Dialog.Root>
              <Dialog.Trigger className="pop-btn">Advanced…</Dialog.Trigger>
              <Dialog.Popup className="pop-dialog" aria-label="Advanced sharing">
                <p>Advanced sharing settings.</p>
                <Dialog.Close className="pop-btn">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Root>
          </div>
        </Popover.Popup>
      </Popover.Root>
    </section>
  );
}

export function PopoverDemo() {
  return (
    <Demo title="Popover">
      <JsFreeShare />
      <LoadOnOpen />
      <Rename />
      <Disclosure />
      <Nested />
    </Demo>
  );
}
