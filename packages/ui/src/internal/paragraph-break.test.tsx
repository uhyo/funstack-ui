// The Popup-inside-<p> development warning (#221, conventions 9.5): the pure check, then one row
// per Popup that it runs on. jsdom builds the trees with DOM calls (no parser), so a `<div>` stays
// inside the `<p>` exactly as React's client render would leave it after a failed hydration.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AlertDialog } from "../alert-dialog/index.js";
import { Combobox } from "../combobox/index.js";
import { Dialog } from "../dialog/index.js";
import { Drawer } from "../drawer/index.js";
import { HoverCard } from "../hover-card/index.js";
import { Menu } from "../menu/index.js";
import { MultiSelect } from "../multi-select/index.js";
import { NavigationMenu } from "../navigation-menu/index.js";
import { Popover } from "../popover/index.js";
import { Tooltip } from "../tooltip/index.js";
import { paragraphBreakMessage, paragraphBrokenBy } from "./paragraph-break.js";

function tree(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  const target = host.querySelector("#t");
  if (target === null) throw new Error("no #t");
  return target;
}

function nest(...tags: string[]): Element {
  // Built with DOM calls: the parser would itself move a <div> out of a <p>.
  let parent: Element = document.createElement("section");
  document.body.append(parent);
  for (const tag of tags) {
    const child = document.createElement(tag);
    parent.append(child);
    parent = child;
  }
  return parent;
}

describe("paragraphBrokenBy", () => {
  it("finds a <p> parent of a <div> or a <dialog>", () => {
    expect(paragraphBrokenBy(nest("p", "div"))?.tagName).toBe("P");
    expect(paragraphBrokenBy(nest("p", "dialog"))?.tagName).toBe("P");
  });

  it("finds a <p> ancestor through phrasing elements (the parser looks in button scope)", () => {
    expect(paragraphBrokenBy(nest("p", "span", "a", "div"))?.tagName).toBe("P");
  });

  it("ignores a <span>, which a <p> may contain", () => {
    expect(paragraphBrokenBy(nest("p", "span"))).toBeNull();
  });

  it("ignores phrasing-only parents the parser leaves alone (<span>, <h2>, <button>)", () => {
    expect(paragraphBrokenBy(nest("span", "div"))).toBeNull();
    expect(paragraphBrokenBy(nest("h2", "div"))).toBeNull();
    expect(paragraphBrokenBy(nest("button", "div"))).toBeNull();
  });

  it("stops at a button-scope boundary: a <p> outside a <button> or <td> is not closed", () => {
    expect(paragraphBrokenBy(nest("p", "button", "div"))).toBeNull();
    expect(paragraphBrokenBy(nest("table", "tbody", "tr", "td", "div"))).toBeNull();
  });

  it("stops at an SVG ancestor", () => {
    const p = document.createElement("p");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    const div = document.createElement("div");
    p.append(svg);
    svg.append(fo);
    fo.append(div);
    document.body.append(p);
    expect(paragraphBrokenBy(div)).toBeNull();
  });

  it("ignores an element outside any <p>", () => {
    expect(paragraphBrokenBy(tree('<div><div id="t"></div></div>'))).toBeNull();
  });

  it("words the fix by whether the part may be a <span>", () => {
    const div = nest("p", "div");
    expect(paragraphBreakMessage("Tooltip.Popup", div, true)).toBe(
      "Tooltip.Popup: rendered inside a <p>. The HTML parser closes the paragraph at a <div>, so " +
        "the server HTML does not match and hydration fails. Inside running text, render it as " +
        "a <span> (`render={<span />}`), or render the Popup after the <p>.",
    );
    expect(paragraphBreakMessage("Popover.Popup", div, false)).toContain(
      "Put the text in a <div> instead of the <p>, or render the Popup after the <p>.",
    );
  });
});

function warningsFor(error: { mock: { calls: unknown[][] } }, part: string): unknown[][] {
  return error.mock.calls.filter(
    ([message]) =>
      typeof message === "string" && message.startsWith(`${part}: rendered inside a <p>`),
  );
}

/** Each Popup, mounted (and shown where the part only mounts while open). */
const popups: [part: string, content: (popup?: { render?: ReactNode }) => ReactNode][] = [
  [
    "Tooltip.Popup",
    (popup) => (
      <Tooltip.Root>
        <Tooltip.Trigger>?</Tooltip.Trigger>
        <Tooltip.Popup render={popup?.render as never}>Tip</Tooltip.Popup>
      </Tooltip.Root>
    ),
  ],
  [
    "HoverCard.Popup",
    (popup) => (
      <HoverCard.Root defaultOpen>
        <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger>
        <HoverCard.Popup render={popup?.render as never}>Card</HoverCard.Popup>
      </HoverCard.Root>
    ),
  ],
  [
    "Popover.Popup",
    () => (
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Popup aria-label="P">Body</Popover.Popup>
      </Popover.Root>
    ),
  ],
  [
    "Menu.Popup",
    () => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Menu</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item>One</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ),
  ],
  [
    "Combobox.Popup",
    () => (
      <Combobox.Root defaultOpen>
        <Combobox.Input aria-label="Country" />
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Option value="jp">Japan</Combobox.Option>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    ),
  ],
  [
    "MultiSelect.Popup",
    () => (
      <MultiSelect.Root defaultOpen>
        <MultiSelect.Trigger aria-label="Toppings">Pick</MultiSelect.Trigger>
        <MultiSelect.Popup>
          <MultiSelect.List>
            <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
          </MultiSelect.List>
        </MultiSelect.Popup>
      </MultiSelect.Root>
    ),
  ],
  [
    "NavigationMenu.Popup",
    () => (
      <NavigationMenu.Item>
        <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
        <NavigationMenu.Popup aria-label="Products">
          <NavigationMenu.Link href="#a">A</NavigationMenu.Link>
        </NavigationMenu.Popup>
      </NavigationMenu.Item>
    ),
  ],
  [
    "Dialog.Popup",
    () => (
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Popup aria-label="D">Body</Dialog.Popup>
      </Dialog.Root>
    ),
  ],
  [
    "AlertDialog.Popup",
    () => (
      <AlertDialog.Root>
        <AlertDialog.Trigger>Delete</AlertDialog.Trigger>
        <AlertDialog.Popup aria-label="Delete?" aria-describedby={undefined}>
          <AlertDialog.Description>Gone for good.</AlertDialog.Description>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        </AlertDialog.Popup>
      </AlertDialog.Root>
    ),
  ],
  [
    "Drawer.Popup",
    () => (
      <Drawer.Root>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Popup aria-label="Dr">
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
    ),
  ],
];

describe("a Popup inside a <p>", () => {
  it.each(popups)("%s warns once, naming the part", (part, content) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<p>Text {content()}</p>);
    rerender(<p>Text {content()} more</p>);
    expect(warningsFor(error, part)).toHaveLength(1);
  });

  it.each(popups)("%s does not warn outside a <p>", (part, content) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<div>Text {content()}</div>);
    expect(warningsFor(error, part)).toEqual([]);
  });

  it.each(popups.filter(([part]) => part === "Tooltip.Popup" || part === "HoverCard.Popup"))(
    "%s rendered as a <span> does not warn",
    (part, content) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<p>Text {content({ render: <span /> })}</p>);
      expect(warningsFor(error, part)).toEqual([]);
    },
  );
});
