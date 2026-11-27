import { use, useState } from "react";
import type { ReactNode } from "react";
import { Outlet, Router, route, useIsPending, useLocation } from "@funstack/router";
import { NavigationMenu } from "@funstack/ui/navigation-menu";
import type { NavigationMenuOpenChangeDetails } from "@funstack/ui/navigation-menu";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { sleep } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
import "./navigation-menu-demo.css";

// The demo's pages live under this prefix; FUNSTACK Router intercepts the navigations to them
// (Navigation API) and renders each page in a transition, like a real site's router.
const BASE = "/navigation-menu";

/** A page's content: loads for 800 ms the first time, so the route suspends. */
const pages = new Map<string, Promise<string>>();
function loadPage(name: string): Promise<string> {
  let promise = pages.get(name);
  if (promise === undefined) {
    console.log(`[navigation-menu] loading page ${name}`);
    promise = sleep(800).then(() => `The ${name} page, loaded from the fake backend.`);
    pages.set(name, promise);
  }
  return promise;
}

/** The "Recent" panel's content: loads for 1 s on the first open. */
let recent: Promise<readonly string[]> | null = null;
function loadRecent(): Promise<readonly string[]> {
  recent ??= sleep(1000).then(() => ["reports", "invoices", "team"]);
  return recent;
}

function Page({ params }: { params: { page: string } }) {
  // Suspends without a boundary: the router's transition keeps the old page until it is ready.
  const text = use(loadPage(params.page));
  return (
    <section className="nm-page">
      <h3>{params.page}</h3>
      <p>{text}</p>
    </section>
  );
}

function Home() {
  return (
    <section className="nm-page">
      <h3>Home</h3>
      <p>Open a panel and follow a link. Each page loads for 800 ms the first time.</p>
    </section>
  );
}

/** A router link that marks the current page with `aria-current="page"`. */
function NavLink({ page, children }: { page: string; children: ReactNode }) {
  const location = useLocation();
  const href = `${BASE}/${page}`;
  return (
    <NavigationMenu.Link href={href} aria-current={location.pathname === href ? "page" : undefined}>
      {children}
    </NavigationMenu.Link>
  );
}

function RecentPages() {
  const items = use(loadRecent());
  return (
    <ul className="nm-links">
      {items.map((page) => (
        <li key={page}>
          <NavLink page={page}>{page}</NavLink>
        </li>
      ))}
    </ul>
  );
}

function Layout() {
  const pending = useIsPending();
  const [log, setLog] = useState<readonly string[]>([]);
  const note = (line: string) => setLog((lines) => [...lines.slice(-5), line]);
  const describe = (next: boolean, details: NavigationMenuOpenChangeDetails) =>
    `${next ? "open" : "close"} (${details.reason})`;

  return (
    <>
      <NavigationMenu.Root aria-label="Demo site" className="nm-root">
        <NavigationMenu.List className="nm-list">
          {/* JS-free mode: the browser toggles it; the links are in the HTML. */}
          <NavigationMenu.Item>
            <NavigationMenu.Trigger className="nm-trigger">Products</NavigationMenu.Trigger>
            <NavigationMenu.Popup className="nm-panel">
              <ul className="nm-links">
                <li>
                  <NavLink page="analytics">Analytics</NavLink>
                </li>
                <li>
                  <NavLink page="billing">Billing</NavLink>
                </li>
                <li>
                  <NavLink page="security">Security</NavLink>
                </li>
              </ul>
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
          {/* Library mode: the content loads on the first open, the Trigger is data-pending. */}
          <NavigationMenu.Item
            openChangeAction={(next, details) => note(`Recent: ${describe(next, details)}`)}
            onOpenChange={(next, details) => note(`Recent: ${describe(next, details)}, a fact`)}
          >
            <NavigationMenu.Trigger className="nm-trigger">Recent</NavigationMenu.Trigger>
            <NavigationMenu.Popup className="nm-panel" transition="nm-panel">
              <RecentPages />
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
          {/* Library mode without a view transition. */}
          <NavigationMenu.Item
            openChangeAction={(next, details) => note(`Docs: ${describe(next, details)}`)}
            onOpenChange={(next, details) => note(`Docs: ${describe(next, details)}, a fact`)}
          >
            <NavigationMenu.Trigger className="nm-trigger">Docs</NavigationMenu.Trigger>
            <NavigationMenu.Popup className="nm-panel">
              <ul className="nm-links">
                <li>
                  <NavLink page="guides">Guides</NavLink>
                </li>
                <li>
                  <NavLink page="reference">Reference</NavLink>
                </li>
              </ul>
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavLink page="pricing">Pricing</NavLink>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <p className="nm-status" data-pending={pending ? "" : undefined}>
        {pending ? "Loading the page…" : "Ready"}
      </p>
      <Outlet />
      <ol className="nm-log" aria-label="NavigationMenu events">
        {log.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </>
  );
}

const routes = [
  route({
    path: "/",
    component: Layout,
    children: [
      route({ path: "/", component: Home }),
      route({ path: `${BASE}/:page`, component: Page }),
    ],
  }),
];

/**
 * A site header with FUNSTACK Router: a JS-free panel, a library-mode panel whose content loads
 * on open (with a view transition), and a top-level link. Following a link inside a panel closes
 * it; a modified click (new tab) leaves it open.
 */
export function NavigationMenuDemo() {
  return (
    <Demo title="NavigationMenu" className="nm-demo">
      <DemoErrorBoundary>
        <Router routes={routes} fallback="static" />
      </DemoErrorBoundary>
    </Demo>
  );
}
