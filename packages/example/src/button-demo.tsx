import { startTransition, useState } from "react";
import { Button } from "@funstack/ui/button";
import { Form } from "@funstack/ui/form";
import { Tooltip } from "@funstack/ui/tooltip";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary";
import { fakeSave } from "./shared/fake-backend";
import { Demo } from "./shared/Demo";
import "./button-demo.css";

/** Fake backend call; 1 s by default. */
const fakeCall = (label: string, { ms = 1000, fail = false } = {}) =>
  fakeSave("button", label, { ms, fail });

function SaveDemo() {
  const [calls, setCalls] = useState(0);
  const [saved, setSaved] = useState(0);
  return (
    <section>
      <h3>Async action, re-entry ignored</h3>
      <p>
        Click several times quickly: the action runs once. The button is <code>aria-disabled</code>{" "}
        and <code>data-pending</code> while it runs and keeps focus.
      </p>
      <Button
        className="btn"
        action={async () => {
          startTransition(() => setCalls((c) => c + 1));
          await fakeCall("save");
          startTransition(() => setSaved((s) => s + 1));
        }}
      >
        {({ pending }) => (pending ? "Saving…" : "Save")}
      </Button>{" "}
      <output>
        calls: {calls}, saved: {saved}
      </output>
    </section>
  );
}

function RejectDemo() {
  return (
    <section>
      <h3>Rejection reaches the Error Boundary</h3>
      <DemoErrorBoundary>
        <Button className="btn" action={() => fakeCall("delete", { fail: true })}>
          {({ pending }) => (pending ? "Deleting…" : "Delete (fails)")}
        </Button>
      </DemoErrorBoundary>
    </section>
  );
}

function FormDemo() {
  const [log, setLog] = useState<string[]>([]);
  const record = (line: string) => startTransition(() => setLog((l) => [...l, line]));
  return (
    <section>
      <h3>Secondary submitters: formAction</h3>
      <p>
        Each <code>Button formAction</code> is pending for its own submission only;{" "}
        <code>Form.Submit</code> shows the whole form channel.
      </p>
      <Form.Root
        action={async (data: FormData) => {
          await fakeCall(`publish ${String(data.get("title"))}`);
          record("published");
        }}
      >
        <input name="title" aria-label="Title" defaultValue="Hello" />{" "}
        <Form.Submit className="btn">Publish</Form.Submit>{" "}
        <Button
          className="btn"
          formAction={async (data: FormData) => {
            await fakeCall(`save draft ${String(data.get("title"))}`);
            record("draft saved");
          }}
        >
          Save draft
        </Button>{" "}
        <Button
          className="btn"
          formAction={async () => {
            await fakeCall("discard", { ms: 1500 });
            record("discarded");
          }}
        >
          Discard
        </Button>
      </Form.Root>
      <ul>
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function ComposeDemo() {
  return (
    <section>
      <h3>Tooltip on a pending Button; focusable when disabled</h3>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={<Button className="btn" action={() => fakeCall("archive", { ms: 3000 })} />}
        >
          Archive
        </Tooltip.Trigger>
        <Tooltip.Popup className="btn-tip">Hover me while pending: I still open</Tooltip.Popup>
      </Tooltip.Root>{" "}
      <Tooltip.Root>
        <Tooltip.Trigger render={<Button className="btn" disabled focusableWhenDisabled />}>
          Export
        </Tooltip.Trigger>
        <Tooltip.Popup className="btn-tip">Export needs a paid plan</Tooltip.Popup>
      </Tooltip.Root>
    </section>
  );
}

export function ButtonDemo() {
  return (
    <Demo title="Button">
      <SaveDemo />
      <RejectDemo />
      <FormDemo />
      <ComposeDemo />
    </Demo>
  );
}
