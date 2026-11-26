import { use, useState } from "react";
import { Button } from "@funstack/ui/button";
import { Collapsible } from "@funstack/ui/collapsible";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { fakeSave, sleep } from "./shared/fake-backend.js";
import { Spinner } from "./shared/Spinner.js";
import { Demo } from "./shared/Demo.js";
import "./collapsible-demo.css";

function JsFreeDemo() {
  return (
    <section>
      <h3>JS-free</h3>
      <p>
        None of <code>open</code>, <code>defaultOpen</code>, <code>openChangeAction</code>: the
        browser owns <code>&lt;details open&gt;</code>. Try find-in-page for "zeppelin".
      </p>
      <Collapsible.Root className="col">
        <Collapsible.Trigger className="col-trigger">Spoiler</Collapsible.Trigger>
        <Collapsible.Panel className="col-panel">
          <p>The zeppelin lands safely.</p>
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}

function AsyncDemo() {
  const [fail, setFail] = useState(false);
  return (
    <section>
      <h3>Library mode, async action</h3>
      <p>
        <code>openChangeAction</code> is awaited for 800 ms: the chevron flips at once (
        <code>data-open</code>) with a spinner (<code>data-pending</code>); the{" "}
        <code>&lt;details&gt;</code> opens when the save resolves. A rejection reverts and reaches
        the Error Boundary.
      </p>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> fail
        the next save
      </label>
      <DemoErrorBoundary>
        <Collapsible.Root
          className="col"
          openChangeAction={(open) => fakeSave("collapsible", open, { fail })}
        >
          <Collapsible.Trigger className="col-trigger">
            {({ pending }) => <>Filters {pending && <Spinner />}</>}
          </Collapsible.Trigger>
          <Collapsible.Panel className="col-panel">
            <p>Price, brand and rating filters.</p>
          </Collapsible.Panel>
        </Collapsible.Root>
      </DemoErrorBoundary>
    </section>
  );
}

let replies: Promise<string[]> | undefined;
function Replies() {
  replies ??= sleep(1200).then(() => ["First reply", "Second reply"]);
  return (
    <ul>
      {use(replies).map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

function SuspenseDemo() {
  return (
    <section>
      <h3>Lazy, suspending content</h3>
      <p>
        <code>defaultOpen={"{false}"}</code> alone selects library mode. The Panel mounts the
        replies from committed <code>open</code>; they suspend for 1.2 s and the{" "}
        <code>&lt;details&gt;</code> stays closed and pending until they are ready.
      </p>
      <Collapsible.Root className="col col-vt" defaultOpen={false} transition="col-grow">
        <Collapsible.Trigger className="col-trigger">
          {({ open, pending }) => (
            <>
              {open ? "Hide replies" : "Show 2 replies"} {pending && <Spinner />}
            </>
          )}
        </Collapsible.Trigger>
        <Collapsible.Panel className="col-panel">
          {({ open }) => open && <Replies />}
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}

function ControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <h3>Controlled from elsewhere</h3>
      <p>One setter serves the Trigger, a find-in-page reveal and the outside button.</p>
      <Button action={() => setOpen((o) => !o)}>{open ? "Hide details" : "Show details"}</Button>
      <Collapsible.Root className="col" open={open} openChangeAction={setOpen}>
        <Collapsible.Trigger className="col-trigger">Details</Collapsible.Trigger>
        <Collapsible.Panel className="col-panel">
          <p>Committed: {String(open)}</p>
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}

export function CollapsibleDemo() {
  return (
    <Demo title="Collapsible">
      <p>
        One disclosure: the Root is the <code>&lt;details&gt;</code>, the Trigger its{" "}
        <code>&lt;summary&gt;</code>. Enter/Space toggle natively.
      </p>
      <JsFreeDemo />
      <AsyncDemo />
      <SuspenseDemo />
      <ControlledDemo />
    </Demo>
  );
}
