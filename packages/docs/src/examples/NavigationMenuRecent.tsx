"use client";
import { use, useState } from "react";
import { NavigationMenu } from "@funstack/ui/navigation-menu";
import type { NavigationMenuOpenChangeDetails } from "@funstack/ui/navigation-menu";
import { sleep } from "./fake-api.js";

// A library-mode Item: `openChangeAction` selects it. The panel's content reads a promise with
// `use()`, so the first open suspends: the Trigger shows data-open and data-pending, the panel
// appears when the pages have loaded, with a view transition (`transition`). Tab away while it
// loads and the open is cancelled. The first panel is JS-free; opening one closes the other.
let recent: Promise<readonly string[]> | null = null;
function loadRecent(): Promise<readonly string[]> {
  recent ??= sleep(1500).then(() => ["Quarterly report", "Invoices", "Team settings"]);
  return recent;
}

function RecentPages() {
  const pages = use(loadRecent());
  return (
    <ul className="demo-nav-links">
      {pages.map((page) => (
        <li key={page}>
          <NavigationMenu.Link href="#suspense">{page}</NavigationMenu.Link>
        </li>
      ))}
    </ul>
  );
}

export function NavigationMenuRecent() {
  const [log, setLog] = useState("(none yet)");
  const request = (open: boolean, { reason }: NavigationMenuOpenChangeDetails) => {
    setLog(`openChangeAction(${open}, "${reason}")`);
  };
  // A fact: Escape, a click outside, another panel opening, focus leaving the Item.
  const dismissed = (open: boolean, { reason }: NavigationMenuOpenChangeDetails) => {
    setLog(`onOpenChange(${open}, "${reason}")`);
  };
  return (
    <div className="demo-stack">
      <NavigationMenu.Root aria-label="Workspace" className="demo-nav">
        <NavigationMenu.List className="demo-nav-list">
          <NavigationMenu.Item>
            <NavigationMenu.Trigger className="demo-nav-trigger">Products</NavigationMenu.Trigger>
            <NavigationMenu.Popup className="demo-nav-panel">
              <ul className="demo-nav-links">
                <li>
                  <NavigationMenu.Link href="#suspense">Analytics</NavigationMenu.Link>
                </li>
                <li>
                  <NavigationMenu.Link href="#suspense">Billing</NavigationMenu.Link>
                </li>
              </ul>
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
          <NavigationMenu.Item openChangeAction={request} onOpenChange={dismissed}>
            <NavigationMenu.Trigger className="demo-nav-trigger">
              {({ pending }) => (
                <>Recent{pending && <span className="demo-spinner" aria-hidden />}</>
              )}
            </NavigationMenu.Trigger>
            <NavigationMenu.Popup className="demo-nav-panel" transition="demo-nav-panel">
              <RecentPages />
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <p className="demo-readout">
        Last: <code>{log}</code>
      </p>
    </div>
  );
}
