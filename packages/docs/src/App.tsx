import { lazy, type ComponentType, type ReactElement } from "react";
import { Outlet } from "@funstack/router";
import { route } from "@funstack/router/server";
import { defer } from "@funstack/static/server";
import { ClientApp } from "./ClientApp.js";
import { DocsLayout } from "./components/DocsLayout.js";
import { Layout } from "./components/Layout.js";
import { PageMeta } from "./pageMeta.js";

function lazyPage<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): ComponentType {
  return lazy<ComponentType>(() => load().then((m) => ({ default: m[name] })));
}

const HomePage = lazyPage(() => import("./pages/HomePage.js"), "HomePage");
const GettingStartedPage = lazyPage(
  () => import("./pages/GettingStartedPage.js"),
  "GettingStartedPage",
);
const ActionPropsPage = lazyPage(() => import("./pages/ActionPropsPage.js"), "ActionPropsPage");
const PendingOptimisticPage = lazyPage(
  () => import("./pages/PendingOptimisticPage.js"),
  "PendingOptimisticPage",
);
const TransitionsPage = lazyPage(() => import("./pages/TransitionsPage.js"), "TransitionsPage");
const SuspensePage = lazyPage(() => import("./pages/SuspensePage.js"), "SuspensePage");
const ServerComponentsPage = lazyPage(
  () => import("./pages/ServerComponentsPage.js"),
  "ServerComponentsPage",
);
const BrowserOwnedStatePage = lazyPage(
  () => import("./pages/BrowserOwnedStatePage.js"),
  "BrowserOwnedStatePage",
);
const ExperimentalPage = lazyPage(() => import("./pages/ExperimentalPage.js"), "ExperimentalPage");
const TogglePage = lazyPage(() => import("./pages/TogglePage.js"), "TogglePage");
const TabsPage = lazyPage(() => import("./pages/TabsPage.js"), "TabsPage");
const AccordionPage = lazyPage(() => import("./pages/AccordionPage.js"), "AccordionPage");
const TooltipPage = lazyPage(() => import("./pages/TooltipPage.js"), "TooltipPage");
const DialogPage = lazyPage(() => import("./pages/DialogPage.js"), "DialogPage");
const PopoverPage = lazyPage(() => import("./pages/PopoverPage.js"), "PopoverPage");
const MenuPage = lazyPage(() => import("./pages/MenuPage.js"), "MenuPage");
const SwitchPage = lazyPage(() => import("./pages/SwitchPage.js"), "SwitchPage");
const CheckboxPage = lazyPage(() => import("./pages/CheckboxPage.js"), "CheckboxPage");
const RadioGroupPage = lazyPage(() => import("./pages/RadioGroupPage.js"), "RadioGroupPage");
const SelectPage = lazyPage(() => import("./pages/SelectPage.js"), "SelectPage");
const ComboboxPage = lazyPage(() => import("./pages/ComboboxPage.js"), "ComboboxPage");
const ToastPage = lazyPage(() => import("./pages/ToastPage.js"), "ToastPage");
const SliderPage = lazyPage(() => import("./pages/SliderPage.js"), "SliderPage");
const FieldPage = lazyPage(() => import("./pages/FieldPage.js"), "FieldPage");
const ProgressPage = lazyPage(() => import("./pages/ProgressPage.js"), "ProgressPage");
const MeterPage = lazyPage(() => import("./pages/MeterPage.js"), "MeterPage");
const CheckboxGroupPage = lazyPage(
  () => import("./pages/CheckboxGroupPage.js"),
  "CheckboxGroupPage",
);
const RoadmapPage = lazyPage(() => import("./pages/RoadmapPage.js"), "RoadmapPage");
const NotFoundPage = lazyPage(() => import("./pages/NotFoundPage.js"), "NotFoundPage");

/** A leaf route whose page is rendered on the server and streamed separately (`defer`). */
function page(path: string, fullPath: string, Page: ComponentType, name: string) {
  const node: ReactElement = (
    <>
      <PageMeta path={fullPath} />
      <Page />
    </>
  );
  return route({ path, component: defer(node, { name }) });
}

export const routes = [
  route({
    component: <Outlet />,
    children: [
      route({
        component: <Layout />,
        children: [
          page("/", "/", HomePage, "HomePage"),
          route({
            component: <DocsLayout />,
            children: [
              page(
                "/getting-started",
                "/getting-started",
                GettingStartedPage,
                "GettingStartedPage",
              ),
              route({
                path: "/concepts",
                component: <Outlet />,
                children: [
                  page(
                    "/action-props",
                    "/concepts/action-props",
                    ActionPropsPage,
                    "ActionPropsPage",
                  ),
                  page(
                    "/pending-and-optimistic",
                    "/concepts/pending-and-optimistic",
                    PendingOptimisticPage,
                    "PendingOptimisticPage",
                  ),
                  page("/transitions", "/concepts/transitions", TransitionsPage, "TransitionsPage"),
                  page("/suspense", "/concepts/suspense", SuspensePage, "SuspensePage"),
                  page(
                    "/server-components",
                    "/concepts/server-components",
                    ServerComponentsPage,
                    "ServerComponentsPage",
                  ),
                  page(
                    "/browser-owned-state",
                    "/concepts/browser-owned-state",
                    BrowserOwnedStatePage,
                    "BrowserOwnedStatePage",
                  ),
                  page(
                    "/experimental",
                    "/concepts/experimental",
                    ExperimentalPage,
                    "ExperimentalPage",
                  ),
                ],
              }),
              route({
                path: "/components",
                component: <Outlet />,
                children: [
                  page("/toggle", "/components/toggle", TogglePage, "TogglePage"),
                  page("/tabs", "/components/tabs", TabsPage, "TabsPage"),
                  page("/accordion", "/components/accordion", AccordionPage, "AccordionPage"),
                  page("/tooltip", "/components/tooltip", TooltipPage, "TooltipPage"),
                  page("/dialog", "/components/dialog", DialogPage, "DialogPage"),
                  page("/popover", "/components/popover", PopoverPage, "PopoverPage"),
                  page("/menu", "/components/menu", MenuPage, "MenuPage"),
                  page("/switch", "/components/switch", SwitchPage, "SwitchPage"),
                  page("/checkbox", "/components/checkbox", CheckboxPage, "CheckboxPage"),
                  page("/radio-group", "/components/radio-group", RadioGroupPage, "RadioGroupPage"),
                  page(
                    "/checkbox-group",
                    "/components/checkbox-group",
                    CheckboxGroupPage,
                    "CheckboxGroupPage",
                  ),
                  page("/select", "/components/select", SelectPage, "SelectPage"),
                  page("/combobox", "/components/combobox", ComboboxPage, "ComboboxPage"),
                  page("/toast", "/components/toast", ToastPage, "ToastPage"),
                  page("/slider", "/components/slider", SliderPage, "SliderPage"),
                  page("/field", "/components/field", FieldPage, "FieldPage"),
                  page("/progress", "/components/progress", ProgressPage, "ProgressPage"),
                  page("/meter", "/components/meter", MeterPage, "MeterPage"),
                ],
              }),
              page("/roadmap", "/roadmap", RoadmapPage, "RoadmapPage"),
            ],
          }),
          page("/*", "/*", NotFoundPage, "NotFoundPage"),
        ],
      }),
    ],
  }),
];

export default function App({ ssrPath }: { ssrPath?: string }) {
  return <ClientApp routes={routes} ssrPath={ssrPath} />;
}
