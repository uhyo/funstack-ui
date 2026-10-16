"use client";
import { Suspense, use, useState } from "react";
import { Tabs } from "@funstack/ui/tabs";
import { sleep } from "./fake-api.js";

// Cache the promises so `use()` sees the same one on every render.
const cache = new Map<string, Promise<string[]>>();
function loadOrders(status: string): Promise<string[]> {
  let promise = cache.get(status);
  if (promise === undefined) {
    promise = sleep(1200).then(() => [1, 2, 3].map((n) => `${status} order #${n}0${n}`));
    cache.set(status, promise);
  }
  return promise;
}

function Orders({ status }: { status: string }) {
  const orders = use(loadOrders(status));
  return (
    <ul>
      {orders.map((order) => (
        <li key={order}>{order}</li>
      ))}
    </ul>
  );
}

const statuses = ["Open", "Shipped", "Returned"];
const tabs = ["Summary", ...statuses];

// Panels suspend while their data loads. The Suspense boundary sits above Tabs.Root, yet its
// fallback never replaces a loaded panel: selection is a transition, so the old panel stays
// (dimmed through .demo-tabs[data-pending]) and the selected tab shows a spinner.
export function TabsSuspending() {
  const [generation, setGeneration] = useState(0);
  return (
    <>
      <Suspense key={generation} fallback={<p>Loading orders…</p>}>
        <Tabs.Root className="demo-tabs" defaultValue="Summary">
          <Tabs.List className="demo-tabs-list" aria-label="Orders">
            {tabs.map((status) => (
              <Tabs.Tab key={status} value={status} className="demo-tab">
                {({ pending }) => (
                  <>
                    {status}
                    {pending && <span className="demo-spinner" aria-hidden />}
                  </>
                )}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator className="demo-tabs-indicator" />
          </Tabs.List>
          {/* The first panel needs no data, so the server-rendered HTML is complete. */}
          <Tabs.Panel value="Summary" className="demo-tab-panel">
            <p>Pick a status. Each list takes 1.2 s to load the first time.</p>
          </Tabs.Panel>
          {statuses.map((status) => (
            <Tabs.Panel key={status} value={status} className="demo-tab-panel">
              <Orders status={status} />
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      </Suspense>
      <button
        type="button"
        className="demo-button"
        onClick={() => {
          cache.clear();
          setGeneration((g) => g + 1);
        }}
      >
        Clear the cache and start over
      </button>
    </>
  );
}
