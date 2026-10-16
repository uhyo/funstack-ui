import { Component, Suspense, use, useState } from "react";
import type { ReactNode } from "react";
import { Tabs } from "@funstack/ui/tabs";
import "./tabs-demo.css";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A tiny cache so that `use()` receives the same promise on every render (an uncached promise
 * would suspend forever). Each panel's data takes 1.2 s to "load" the first time.
 */
const dataCache = new Map<string, Promise<string[]>>();
function loadPanelData(key: string): Promise<string[]> {
  let promise = dataCache.get(key);
  if (promise === undefined) {
    console.log(`[tabs] loading ${key}`);
    promise = sleep(1200).then(() => {
      console.log(`[tabs] loaded ${key}`);
      return [1, 2, 3].map((n) => `${key} item ${n} (loaded ${new Date().toLocaleTimeString()})`);
    });
    dataCache.set(key, promise);
  }
  return promise;
}

function DataList({ name }: { name: string }) {
  const items = use(loadPanelData(name));
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Spinner() {
  return <span className="tabs-spinner" aria-hidden />;
}

class DemoErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="error-box">
          <p>Error Boundary caught: {this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Directional slide by DOM order of the tabs, cross-fade otherwise (design 10.3). */
const panelTransition = {
  "fsui-tabs-next": "tabs-slide-next",
  "fsui-tabs-prev": "tabs-slide-prev",
  default: "tabs-fade",
};

function SuspendingDemo() {
  const [cacheVersion, setCacheVersion] = useState(0);
  const sections = ["overview", "orders", "invoices", "activity"] as const;
  return (
    <section>
      <h3>Suspending panels, automatic activation</h3>
      <p>
        Every panel except Overview reads its data with <code>use()</code>; the Suspense boundary
        sits above <code>Tabs.Root</code>. Selecting a tab moves the indicator and{" "}
        <code>aria-selected</code> at once; the old panel stays (dimmed via{" "}
        <code>.root[data-pending]</code>) and the tab shows a spinner until the data is ready. Arrow
        keys follow focus; pressing them quickly only commits the last tab.
      </p>
      <button
        type="button"
        onClick={() => {
          dataCache.clear();
          setCacheVersion((v) => v + 1);
        }}
      >
        Clear the data cache
      </button>
      <Suspense key={cacheVersion} fallback={<p className="tabs-skeleton">Loading account…</p>}>
        <Tabs.Root className="tabs-root" defaultValue="overview">
          <Tabs.List className="tabs-list" aria-label="Account">
            {sections.map((section) => (
              <Tabs.Tab key={section} value={section} className="tabs-tab">
                {({ pending }) => (
                  <>
                    {section[0]!.toUpperCase() + section.slice(1)}
                    {pending && <Spinner />}
                  </>
                )}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator className="tabs-indicator" />
          </Tabs.List>
          <Tabs.Panel value="overview" className="tabs-panel" transition={panelTransition}>
            <p>Welcome back. This panel needs no data.</p>
          </Tabs.Panel>
          {sections.slice(1).map((section) => (
            <Tabs.Panel
              key={section}
              value={section}
              className="tabs-panel"
              transition={panelTransition}
            >
              <DataList name={section} />
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      </Suspense>
    </section>
  );
}

/** Fake server: resolves after 800 ms; every third save fails. */
let saveCount = 0;
async function fakeSaveTab(next: string): Promise<void> {
  saveCount += 1;
  const fail = saveCount % 3 === 0;
  console.log(`[tabs] saving active tab ${next}${fail ? " (will fail)" : ""}`);
  await sleep(800);
  if (fail) throw new Error(`the server rejected tab "${next}"`);
  console.log(`[tabs] saved active tab ${next}`);
}

function ManualAsyncDemo() {
  return (
    <section>
      <h3>Awaited server save, manual activation</h3>
      <p>
        <code>valueChangeAction</code> awaits an 800 ms save, so the switch waits for it and the
        arrow keys only move focus (Enter, Space or click selects). Every third save fails: the
        selection rolls back and the error reaches the Error Boundary.
      </p>
      <DemoErrorBoundary>
        <Tabs.Root
          className="tabs-root"
          defaultValue="general"
          activationMode="manual"
          valueChangeAction={async (next) => {
            await fakeSaveTab(next);
          }}
        >
          <Tabs.List className="tabs-list" aria-label="Settings">
            <Tabs.Tab value="general" className="tabs-tab">
              General
            </Tabs.Tab>
            <Tabs.Tab value="billing" className="tabs-tab">
              {({ pending }) => <>Billing{pending && <Spinner />}</>}
            </Tabs.Tab>
            <Tabs.Tab value="danger" className="tabs-tab" disabled>
              Danger zone
            </Tabs.Tab>
            <Tabs.Tab value="team" className="tabs-tab">
              {({ pending }) => <>Team{pending && <Spinner />}</>}
            </Tabs.Tab>
            <Tabs.Indicator className="tabs-indicator" />
          </Tabs.List>
          <Tabs.Panel value="general" className="tabs-panel" transition="tabs-fade">
            General settings.
          </Tabs.Panel>
          <Tabs.Panel value="billing" className="tabs-panel" transition="tabs-fade">
            Billing settings.
          </Tabs.Panel>
          <Tabs.Panel value="danger" className="tabs-panel" transition="tabs-fade">
            Unreachable: the tab is disabled (but focusable with arrows).
          </Tabs.Panel>
          <Tabs.Panel value="team" className="tabs-panel" transition="tabs-fade">
            Team settings.
          </Tabs.Panel>
        </Tabs.Root>
      </DemoErrorBoundary>
    </section>
  );
}

function Draft() {
  const [text, setText] = useState("Type something, switch tabs, come back.");
  return (
    <textarea
      className="tabs-textarea"
      aria-label="Draft"
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}

function KeepMountedDemo() {
  return (
    <section>
      <h3>
        <code>keepMounted</code>, vertical
      </h3>
      <p>
        The Editor panel is kept in <code>&lt;Activity mode="hidden"&gt;</code>, so the draft
        survives a round trip. The Changelog panel uses <code>keepMounted="until-found"</code>: use
        the browser's find-in-page for "zebra" while another tab is selected and the Changelog tab
        gets selected.
      </p>
      <Tabs.Root className="tabs-root tabs-vertical" defaultValue="editor" orientation="vertical">
        <Tabs.List className="tabs-list" aria-label="Document">
          <Tabs.Tab value="editor" className="tabs-tab">
            Editor
          </Tabs.Tab>
          <Tabs.Tab value="preview" className="tabs-tab">
            Preview
          </Tabs.Tab>
          <Tabs.Tab value="changelog" className="tabs-tab">
            Changelog
          </Tabs.Tab>
          <Tabs.Indicator className="tabs-indicator" />
        </Tabs.List>
        <Tabs.Panel value="editor" className="tabs-panel" keepMounted>
          <Draft />
        </Tabs.Panel>
        <Tabs.Panel value="preview" className="tabs-panel">
          Preview (unmounted when inactive).
        </Tabs.Panel>
        <Tabs.Panel value="changelog" className="tabs-panel" keepMounted="until-found">
          <p>v0.0.1: added a zebra-striped table.</p>
        </Tabs.Panel>
      </Tabs.Root>
    </section>
  );
}

export function TabsDemo() {
  return (
    <article className="demo">
      <h2>Tabs</h2>
      <SuspendingDemo />
      <ManualAsyncDemo />
      <KeepMountedDemo />
    </article>
  );
}
