import { lazy, type ComponentType } from "react";
import { Outlet } from "@funstack/router";
import { route } from "@funstack/router/server";
import { defer } from "@funstack/static/server";
import { ClientApp } from "./ClientApp.js";
import { DocsLayout } from "./components/DocsLayout.js";
import { Layout } from "./components/Layout.js";
import { PageMeta } from "./pageMeta.js";

// Every page module, loaded on demand. src/pages/FooPage.tsx exports the component FooPage.
const pageModules = import.meta.glob<Record<string, ComponentType>>("./pages/*Page.tsx");

/**
 * A leaf route whose page is rendered on the server and streamed separately (`defer`).
 * `name` is both the page's file and export name and the name of the deferred chunk.
 */
function page(path: string, name: string) {
  const load = pageModules[`./pages/${name}.tsx`];
  if (load === undefined) throw new Error(`No page module src/pages/${name}.tsx`);
  const Page = lazy(async () => {
    const Component = (await load())[name];
    if (Component === undefined) throw new Error(`src/pages/${name}.tsx does not export ${name}`);
    return { default: Component };
  });
  return route({
    path,
    component: defer(
      <>
        <PageMeta path={path} />
        <Page />
      </>,
      { name },
    ),
  });
}

export const routes = [
  route({
    component: <Outlet />,
    children: [
      route({
        component: <Layout />,
        children: [
          page("/", "HomePage"),
          route({
            component: <DocsLayout />,
            children: [
              page("/why", "WhyPage"),
              page("/getting-started", "GettingStartedPage"),
              page("/concepts/action-props", "ActionPropsPage"),
              page("/concepts/pending-and-optimistic", "PendingOptimisticPage"),
              page("/concepts/transitions", "TransitionsPage"),
              page("/concepts/suspense", "SuspensePage"),
              page("/concepts/server-components", "ServerComponentsPage"),
              page("/concepts/browser-owned-state", "BrowserOwnedStatePage"),
              page("/concepts/experimental", "ExperimentalPage"),
              page("/concepts/content-security-policy", "ContentSecurityPolicyPage"),
              page("/concepts/ai-agents", "AiAgentsPage"),
              page("/components/button", "ButtonPage"),
              page("/components/toggle", "TogglePage"),
              page("/components/tabs", "TabsPage"),
              page("/components/accordion", "AccordionPage"),
              page("/components/tooltip", "TooltipPage"),
              page("/components/dialog", "DialogPage"),
              page("/components/popover", "PopoverPage"),
              page("/components/menu", "MenuPage"),
              page("/components/context-menu", "ContextMenuPage"),
              page("/components/toolbar", "ToolbarPage"),
              page("/components/toggle-group", "ToggleGroupPage"),
              page("/components/switch", "SwitchPage"),
              page("/components/checkbox", "CheckboxPage"),
              page("/components/radio-group", "RadioGroupPage"),
              page("/components/checkbox-group", "CheckboxGroupPage"),
              page("/components/select", "SelectPage"),
              page("/components/combobox", "ComboboxPage"),
              page("/components/toast", "ToastPage"),
              page("/components/slider", "SliderPage"),
              page("/components/number-field", "NumberFieldPage"),
              page("/components/field", "FieldPage"),
              page("/components/progress", "ProgressPage"),
              page("/components/meter", "MeterPage"),
              page("/roadmap", "RoadmapPage"),
            ],
          }),
          page("/*", "NotFoundPage"),
        ],
      }),
    ],
  }),
];

export default function App({ ssrPath }: { ssrPath?: string }) {
  return <ClientApp routes={routes} ssrPath={ssrPath} />;
}
