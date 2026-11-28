// Not part of the test suite: copy into packages/ui/src/probe206/ and run
// `pnpm --filter @funstack/ui exec vitest run --project jsdom src/probe206/` (the browser file:
// `FUNSTACK_BROWSERS=chromium ... --project browser`). The vt probe reports through a failing
// assertion on purpose. Results: memo/architect/pending-entanglement-206.md.
// Probe for #206 (architect): which library opens wait for an unrelated pending async action.
import { act, render, screen, fireEvent } from "@testing-library/react";
import { useTransition } from "react";
import { expect, it } from "vitest";
import { appendFileSync } from "node:fs";
const log = (...a: unknown[]) => appendFileSync(process.env.PROBE_LOG ?? "probe-206.log", a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");
import { Accordion } from "../accordion/index.js";
import { Collapsible } from "../collapsible/index.js";
import { Dialog } from "../dialog/index.js";
import { Menu } from "../menu/index.js";
import { Popover } from "../popover/index.js";
import { Tabs } from "../tabs/index.js";
import { Toggle } from "../toggle/index.js";
import { Checkbox } from "../checkbox/index.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

function Busy({ work }: { work: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return <button data-testid="busy" data-pending={String(pending)} onClick={() => start(work)} />;
}

function snapshot() {
  const q = (id: string) => screen.queryByTestId(id);
  return {
    menuPopupOpen: q("menu-popup")?.matches(":popover-open") ?? null,
    menuTriggerDataOpen: q("menu-trigger")?.hasAttribute("data-open"),
    menuTriggerPending: q("menu-trigger")?.hasAttribute("data-pending"),
    popoverOpen: q("pop-popup")?.matches(":popover-open") ?? null,
    dialogOpen: (q("dialog-popup") as HTMLDialogElement | null)?.open ?? null,
    tabSelected: q("tab-b")?.getAttribute("aria-selected"),
    tabsPending: q("tabs")?.hasAttribute("data-pending"),
    panel: q("panel-b") ? "b" : q("panel-a") ? "a" : null,
    accordionOpen: (q("acc-item") as HTMLDetailsElement | null)?.open,
    accPanelMounted: q("acc-content") !== null,
    collapsibleOpen: (q("col") as HTMLDetailsElement | null)?.open ?? q("col")?.hasAttribute("data-open"),
    togglePressed: q("toggle")?.getAttribute("aria-pressed"),
    checkbox: (q("checkbox") as HTMLInputElement | null)?.checked,
  };
}

function App({ work }: { work: () => Promise<void> }) {
  return (
    <div>
      <Busy work={work} />
      <Menu.Root>
        <Menu.Trigger data-testid="menu-trigger">menu</Menu.Trigger>
        <Menu.Popup data-testid="menu-popup">
          <Menu.Item>one</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <Popover.Root defaultOpen={false}>
        <Popover.Trigger data-testid="pop-trigger">pop</Popover.Trigger>
        <Popover.Popup data-testid="pop-popup">content</Popover.Popup>
      </Popover.Root>
      <Dialog.Root defaultOpen={false}>
        <Dialog.Trigger data-testid="dialog-trigger">dialog</Dialog.Trigger>
        <Dialog.Popup data-testid="dialog-popup">
          <Dialog.Title>t</Dialog.Title>
        </Dialog.Popup>
      </Dialog.Root>
      <Tabs.Root defaultValue="a" data-testid="tabs">
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b" data-testid="tab-b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" data-testid="panel-a">a</Tabs.Panel>
        <Tabs.Panel value="b" data-testid="panel-b">b</Tabs.Panel>
      </Tabs.Root>
      <Accordion.Root defaultValue={[]}>
        <Accordion.Item value="x" data-testid="acc-item">
          <Accordion.Trigger data-testid="acc-trigger">x</Accordion.Trigger>
          <Accordion.Panel><span data-testid="acc-content">x</span></Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
      <Collapsible.Root defaultOpen={false} data-testid="col">
        <Collapsible.Trigger data-testid="col-trigger">c</Collapsible.Trigger>
        <Collapsible.Panel>c</Collapsible.Panel>
      </Collapsible.Root>
      <Toggle data-testid="toggle">t</Toggle>
      <Checkbox data-testid="checkbox" />
    </div>
  );
}

it("library opens while an unrelated async action is pending", async () => {
  const d = deferred();
  render(<App work={() => d.promise} />);
  await flush();
  log("initial", snapshot());
  await act(async () => { fireEvent.click(screen.getByTestId("busy")); });
  for (const id of ["menu-trigger", "pop-trigger", "dialog-trigger", "tab-b", "acc-trigger", "col-trigger", "toggle", "checkbox"]) {
    await act(async () => { fireEvent.click(screen.getByTestId(id)); });
    await flush();
  }
  log("while pending", snapshot());
  await act(async () => { d.resolve(); });
  await flush();
  log("settled", snapshot());
  expect(true).toBe(true);
});
