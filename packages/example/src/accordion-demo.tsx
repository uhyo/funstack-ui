import { startTransition, use, useState } from "react";
import { Accordion } from "@funstack/ui/accordion";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { fakeSave, sleep } from "./shared/fake-backend.js";
import { Spinner } from "./shared/Spinner.js";
import { Demo } from "./shared/Demo.js";
import "./accordion-demo.css";

const faq = [
  {
    id: "what",
    q: "What is FUNSTACK UI?",
    a: "A headless UI library for React that is Async React-native: Suspense-native, transition by default, action props instead of event handlers.",
  },
  {
    id: "js",
    q: "Does this accordion need JavaScript?",
    a: "No. This section is in JS-free mode: the browser owns <details open>, Enter/Space and clicks are native, and `exclusive` is the platform's `name` group. Try find-in-page (Ctrl/Cmd+F) for a word in a closed answer.",
  },
  {
    id: "free",
    q: "Is it free?",
    a: "Yes, MIT licensed.",
  },
];

function JsFreeDemo() {
  return (
    <section>
      <h3>JS-free, exclusive</h3>
      <p>
        No value props on the Root, so nothing runs on toggle. <code>exclusive</code> renders the
        same <code>name</code> on every <code>&lt;details&gt;</code>; the open/close animation is
        CSS on <code>::details-content</code> (grid rows). Markup works before hydration and with JS
        off.
      </p>
      <Accordion.Root exclusive className="acc">
        {faq.map((item, index) => (
          <Accordion.Item
            key={item.id}
            value={item.id}
            defaultOpen={index === 0}
            className="acc-item"
          >
            <Accordion.Trigger className="acc-trigger">
              <h4>{item.q}</h4>
            </Accordion.Trigger>
            <Accordion.Panel className="acc-panel">
              <p>{item.a}</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}

const sections = [
  { id: "shipping", title: "Shipping", body: "We ship worldwide; 2 to 5 business days." },
  { id: "returns", title: "Returns", body: "30 days, no questions asked." },
  { id: "billing", title: "Billing", body: "Unavailable on this plan.", disabled: true },
];

function AsyncDemo() {
  return (
    <section>
      <h3>Library mode, uncontrolled, async action</h3>
      <p>
        <code>defaultValue</code> puts the Root in library mode: the summary click is intercepted,{" "}
        <code>valueChangeAction</code> is awaited for 800 ms. The chevron flips immediately (
        <code>data-open</code>, optimistic) and shows a spinner (<code>data-pending</code>); the{" "}
        <code>&lt;details&gt;</code> itself opens when the action resolves. Multiple items may be
        open. The third item is <code>disabled</code>.
      </p>
      <Accordion.Root
        className="acc"
        defaultValue={[]}
        valueChangeAction={(next) => fakeSave("uncontrolled", next)}
      >
        {sections.map((s) => (
          <Accordion.Item key={s.id} value={s.id} disabled={s.disabled} className="acc-item">
            <Accordion.Trigger className="acc-trigger">
              {({ pending }) => (
                <>
                  <h4>{s.title}</h4>
                  {pending && <Spinner />}
                </>
              )}
            </Accordion.Trigger>
            <Accordion.Panel className="acc-panel">
              <p>{s.body}</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}

const threads = [
  { id: "t1", title: "Thread one" },
  { id: "t2", title: "Thread two" },
  { id: "t3", title: "Thread three" },
];

const replyCache = new Map<string, Promise<string[]>>();
function loadReplies(threadId: string): Promise<string[]> {
  let p = replyCache.get(threadId);
  if (p === undefined) {
    p = sleep(1200).then(() => [`First reply in ${threadId}`, `Second reply in ${threadId}`]);
    replyCache.set(threadId, p);
  }
  return p;
}

function Replies({ threadId }: { threadId: string }) {
  const replies = use(loadReplies(threadId));
  return (
    <ul>
      {replies.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

function SuspenseDemo() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section>
      <h3>Controlled, exclusive, lazily loaded content that suspends</h3>
      <p>
        The Panel's function child mounts <code>&lt;Replies&gt;</code> only when the committed state
        is open. Replies load for 1.2 s through <code>use()</code>; because the change is a
        transition, the item stays closed and the trigger shows <code>data-pending</code> until the
        data is ready, then open and content commit together. No Suspense fallback flashes. The
        cache keeps a thread's replies, so reopening it is instant.
      </p>
      <Accordion.Root
        className="acc"
        exclusive
        value={open}
        valueChangeAction={(next) => {
          setOpen(next);
        }}
      >
        {threads.map((t) => (
          <Accordion.Item key={t.id} value={t.id} className="acc-item">
            <Accordion.Trigger className="acc-trigger">
              {({ pending }) => (
                <>
                  <h4>{t.title}</h4>
                  {pending && <Spinner />}
                </>
              )}
            </Accordion.Trigger>
            <Accordion.Panel className="acc-panel">
              {({ open }) => open && <Replies threadId={t.id} />}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
      <output className="readout">
        parent state: <code>{JSON.stringify(open)}</code>
      </output>
    </section>
  );
}

function ControlledVetoDemo() {
  const [open, setOpen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  return (
    <section>
      <h3>Controlled, update on success (veto)</h3>
      <p>
        The parent writes its state only after the save succeeds, re-wrapped in{" "}
        <code>startTransition</code> after the <code>await</code>. Opening &quot;Returns&quot; fails
        and is caught inside the action, so the chevron snaps back and the item never opens. A
        find-in-page reveal of a closed answer also dispatches (reason <code>platform</code>) and is
        re-closed if the parent refuses it.
      </p>
      <Accordion.Root
        className="acc"
        value={open}
        valueChangeAction={async (next, details) => {
          setError(null);
          console.log(`[veto] reason=${details.reason} item=${details.item} open=${details.open}`);
          try {
            await fakeSave("veto", next, { fail: details.open && details.item === "returns" });
            startTransition(() => setOpen(next));
          } catch (e) {
            startTransition(() => setError(e instanceof Error ? e.message : String(e)));
          }
        }}
      >
        {sections
          .filter((s) => !s.disabled)
          .map((s) => (
            <Accordion.Item key={s.id} value={s.id} className="acc-item">
              <Accordion.Trigger className="acc-trigger">
                {({ pending }) => (
                  <>
                    <h4>{s.title}</h4>
                    {pending && <Spinner />}
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.Panel className="acc-panel">
                <p>{s.body}</p>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
      </Accordion.Root>
      <output className="readout">
        parent state: <code>{JSON.stringify(open)}</code>
        {error && <span className="inline-error"> {error}</span>}
      </output>
    </section>
  );
}

function RejectingDemo() {
  return (
    <section>
      <h3>Rejecting action inside an Error Boundary</h3>
      <p>
        The action rejects after 800 ms. The rejection reaches the boundary around the Root, which
        replaces the accordion with its fallback; the optimistic <code>data-open</code> is rolled
        back underneath and the <code>&lt;details&gt;</code> never opened.
      </p>
      <DemoErrorBoundary>
        <Accordion.Root
          className="acc"
          defaultValue={[]}
          valueChangeAction={(next) => fakeSave("rejecting", next, { fail: true })}
        >
          <Accordion.Item value="x" className="acc-item">
            <Accordion.Trigger className="acc-trigger">
              {({ pending }) => (
                <>
                  <h4>Open me</h4>
                  {pending && <Spinner />}
                </>
              )}
            </Accordion.Trigger>
            <Accordion.Panel className="acc-panel">
              <p>You will not see this.</p>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      </DemoErrorBoundary>
    </section>
  );
}

function TransitionDemo() {
  return (
    <section>
      <h3>
        <code>transition</code> prop (ViewTransition on each Item)
      </h3>
      <p>
        <code>transition="fsui-grow"</code> on every Item animates each item's box in the commit
        that ends the action, so the items below the opening one slide instead of jumping. This
        section uses no <code>::details-content</code> transition (the two must not be combined for
        the same change). Open DevTools to see <code>fsui-accordion-expand</code> /{" "}
        <code>-collapse</code> on <code>&lt;html&gt;</code>.
      </p>
      <Accordion.Root
        className="acc acc-vt"
        exclusive
        defaultValue={null}
        valueChangeAction={(next) => fakeSave("transition", next)}
      >
        {sections
          .filter((s) => !s.disabled)
          .map((s) => (
            <Accordion.Item key={s.id} value={s.id} className="acc-item" transition="fsui-grow">
              <Accordion.Trigger className="acc-trigger">
                {({ pending }) => (
                  <>
                    <h4>{s.title}</h4>
                    {pending && <Spinner />}
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.Panel className="acc-panel">
                <p>{s.body}</p>
                <p>{s.body}</p>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
      </Accordion.Root>
    </section>
  );
}

function InterpolateSizeDemo() {
  return (
    <section>
      <h3>
        <code>experimental_interpolateSize</code>
      </h3>
      <p>
        Renders <code>interpolate-size: allow-keywords</code> on the Root so{" "}
        <code>::details-content</code> can transition <code>height</code> to <code>auto</code>.
        Chromium only today; elsewhere the height jumps.
      </p>
      <Accordion.Root className="acc acc-interp" experimental_interpolateSize>
        {faq.map((item) => (
          <Accordion.Item key={item.id} value={item.id} className="acc-item">
            <Accordion.Trigger className="acc-trigger">
              <h4>{item.q}</h4>
            </Accordion.Trigger>
            <Accordion.Panel className="acc-panel">
              <p>{item.a}</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}

export function AccordionDemo() {
  return (
    <Demo title="Accordion">
      <p>
        Built on <code>&lt;details&gt;</code>/<code>&lt;summary&gt;</code>.
        ArrowUp/ArrowDown/Home/End move between triggers in every section; Enter/Space toggle
        natively.
      </p>
      <JsFreeDemo />
      <AsyncDemo />
      <SuspenseDemo />
      <ControlledVetoDemo />
      <RejectingDemo />
      <TransitionDemo />
      <InterpolateSizeDemo />
    </Demo>
  );
}
