"use client";
import { Tabs } from "@funstack/ui/tabs";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

let saves = 0;

// Manual activation with an awaited save: arrow keys only move focus, Enter / Space / click
// select. The panel switches when the save resolves; every third save rejects, the selection
// rolls back and the error reaches the Error Boundary. Panels slide by DOM direction through
// the library's fsui-tabs-next / fsui-tabs-prev transition types.
export function TabsSaved() {
  return (
    <DemoErrorBoundary>
      <Tabs.Root
        className="demo-tabs"
        defaultValue="profile"
        activationMode="manual"
        valueChangeAction={async (next) => {
          await fakeSave(`tab "${next}"`, { fail: ++saves % 3 === 0 });
        }}
      >
        <Tabs.List className="demo-tabs-list" aria-label="Account settings">
          <Tabs.Tab value="profile" className="demo-tab">
            Profile
          </Tabs.Tab>
          <Tabs.Tab value="billing" className="demo-tab">
            Billing
          </Tabs.Tab>
          <Tabs.Tab value="danger" className="demo-tab" disabled>
            Danger zone
          </Tabs.Tab>
          <Tabs.Tab value="team" className="demo-tab">
            Team
          </Tabs.Tab>
          <Tabs.Indicator className="demo-tabs-indicator" />
        </Tabs.List>
        {["profile", "billing", "danger", "team"].map((value) => (
          <Tabs.Panel
            key={value}
            value={value}
            className="demo-tab-panel"
            transition={{
              "fsui-tabs-next": "demo-slide-next",
              "fsui-tabs-prev": "demo-slide-prev",
              default: "none",
            }}
          >
            <p>The {value} settings.</p>
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </DemoErrorBoundary>
  );
}
