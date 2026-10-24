// The one-Trigger-per-Root dev warning (#113 API3), for every Root with a single `triggerRef`:
// Popover, Dialog, Menu (and its submenus) and Combobox (whose Input is the popover's trigger).
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "../combobox/index.js";
import { Dialog } from "../dialog/index.js";
import { Menu } from "../menu/index.js";
import { Popover } from "../popover/index.js";

type Case = {
  name: string;
  part: string;
  /** A Root with `count` Triggers, keyed from `first`. */
  root: (count: number, first?: number) => ReactNode;
};

const triggers = (count: number, first: number, make: (i: number) => ReactNode) =>
  Array.from({ length: count }, (_, i) => make(first + i));

const cases: Case[] = [
  {
    name: "Popover",
    part: "Popover.Trigger",
    root: (count, first = 0) => (
      <Popover.Root>
        {triggers(count, first, (i) => (
          <Popover.Trigger key={i}>Open {i}</Popover.Trigger>
        ))}
        <Popover.Popup>Content</Popover.Popup>
      </Popover.Root>
    ),
  },
  {
    name: "Dialog",
    part: "Dialog.Trigger",
    root: (count, first = 0) => (
      <Dialog.Root>
        {triggers(count, first, (i) => (
          <Dialog.Trigger key={i}>Open {i}</Dialog.Trigger>
        ))}
        <Dialog.Popup>
          <Dialog.Title>Title</Dialog.Title>
        </Dialog.Popup>
      </Dialog.Root>
    ),
  },
  {
    name: "Menu",
    part: "Menu.Trigger",
    root: (count, first = 0) => (
      <Menu.Root>
        {triggers(count, first, (i) => (
          <Menu.Trigger key={i}>Actions {i}</Menu.Trigger>
        ))}
        <Menu.Popup>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ),
  },
  {
    name: "Menu submenu",
    part: "Menu.SubmenuTrigger",
    // The outer menu is open: a closed popup's content is hidden by `<Activity>`, which
    // detaches its refs.
    root: (count, first = 0) => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Popup>
          <Menu.Root>
            {triggers(count, first, (i) => (
              <Menu.SubmenuTrigger key={i}>Move {i}</Menu.SubmenuTrigger>
            ))}
            <Menu.Popup>
              <Menu.Item>Inbox</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Menu.Popup>
      </Menu.Root>
    ),
  },
  {
    name: "Combobox",
    part: "Combobox.Input",
    root: (count, first = 0) => (
      <Combobox.Root>
        {triggers(count, first, (i) => (
          <Combobox.Input key={i} aria-label={`Country ${i}`} />
        ))}
        <Combobox.Popup>
          <Combobox.List>{() => <Combobox.Option value="a">A</Combobox.Option>}</Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    ),
  },
];

const secondTriggerWarnings = (spy: { mock: { calls: unknown[][] } }, part: string) =>
  spy.mock.calls.filter(
    ([message]) =>
      typeof message === "string" && message.startsWith(`${part}: a second ${part} mounted`),
  );

describe.each(cases)("$name: one Trigger per Root (#113 API3)", ({ part, root }) => {
  it("warns once when a second Trigger mounts", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(root(2));
    expect(secondTriggerWarnings(error, part)).toHaveLength(1);
    rerender(root(3));
    expect(secondTriggerWarnings(error, part)).toHaveLength(1);
  });

  it("each Root warns for itself", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        {root(2)}
        {root(2)}
      </>,
    );
    expect(secondTriggerWarnings(error, part)).toHaveLength(2);
  });

  it("does not warn for one Trigger, under StrictMode, or when one Trigger replaces another", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<StrictMode>{root(1)}</StrictMode>);
    expect(secondTriggerWarnings(error, part)).toHaveLength(0);
    // The same Root, its Trigger remounted under a new key: the old one detaches first.
    rerender(<StrictMode>{root(1, 1)}</StrictMode>);
    expect(secondTriggerWarnings(error, part)).toHaveLength(0);
  });
});
