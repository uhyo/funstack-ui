// Menubar tests (jsdom), mapped to the test plan of design/components/menubar.md (section 11 and
// the #170 entries of design/CHANGELOG.md). jsdom has no Popover API; `popover-shim.ts` provides
// it. The shim does not hide one `auto` popover when another shows, and has no light dismiss and
// no focus return: those are the browser rows (`menubar.browser.test.tsx`), with the
// accessibility tree and axe.
//
// N/A here: `Menubar` has no action props and holds no state (design 2.1), so the sync / async
// action, rejection, overlap, superseded-rejection, controlled parity, post-await and platform
// rows belong to each `Menu.Root` and are covered by menu.test.tsx; the rows below pin what the
// bar adds to them (the switch's request and fact, a suspending target, a superseded open, a
// pending item action in the menu a switch leaves, controlled Roots).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  expectNotPending,
  expectPending,
  flushTasks,
  hydrateFromServer,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import { Menu } from "../menu/index.js";
import type { MenuOpenChangeDetails, MenuRootProps } from "../menu/index.js";
import { Menubar } from "./index.js";
import type { MenubarProps, MenubarState } from "./index.js";

interface BarProps {
  bar?: Partial<MenubarProps>;
  file?: Partial<MenuRootProps>;
  edit?: Partial<MenuRootProps>;
  view?: Partial<MenuRootProps>;
  editContent?: ReactNode;
  fileItemAction?: () => unknown;
  viewDisabled?: boolean;
}

/** File (with an "Open recent" submenu), Edit, View; a button before and after the bar. */
function Bar({ bar, file, edit, view, editContent, fileItemAction, viewDisabled }: BarProps) {
  return (
    <>
      <button type="button" data-testid="before">
        Before
      </button>
      <Menubar aria-label="Application" data-testid="bar" {...bar}>
        <Menu.Root {...file}>
          <Menu.Trigger data-testid="file">File</Menu.Trigger>
          <Menu.Popup data-testid="file-popup">
            <Menu.Item data-testid="new" action={fileItemAction}>
              New
            </Menu.Item>
            <Menu.Root>
              <Menu.SubmenuTrigger data-testid="recent">Open recent</Menu.SubmenuTrigger>
              <Menu.Popup data-testid="recent-popup">
                <Menu.Item data-testid="doc">Report.txt</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
            <Menu.Item data-testid="save">Save</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root {...edit}>
          <Menu.Trigger data-testid="edit">Edit</Menu.Trigger>
          <Menu.Popup data-testid="edit-popup">
            {editContent ?? (
              <>
                <Menu.Item data-testid="undo">Undo</Menu.Item>
                <Menu.Item data-testid="redo">Redo</Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root {...view}>
          <Menu.Trigger data-testid="view" disabled={viewDisabled}>
            View
          </Menu.Trigger>
          <Menu.Popup data-testid="view-popup">
            <Menu.Item data-testid="zoom">Zoom</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      <button type="button" data-testid="after">
        After
      </button>
    </>
  );
}

const el = (id: string) => screen.getByTestId(id);
const isOpen = (id: string) => el(id).matches(":popover-open");

async function openFile(user: ReturnType<typeof setupUser>) {
  await user.click(el("file"));
  await flushTasks(2);
  expect(isOpen("file-popup")).toBe(true);
}

describe("Menubar", () => {
  describe("roles and ARIA", () => {
    it("renders div[role=menubar] with the consumer's name and no aria-orientation", () => {
      render(<Bar />);
      const bar = el("bar");
      expect(bar.tagName).toBe("DIV");
      expect(bar).toHaveAttribute("role", "menubar");
      expect(bar).toHaveAttribute("aria-label", "Application");
      expect(bar).not.toHaveAttribute("aria-orientation");
      expect(screen.getByRole("menubar", { name: "Application" })).toBe(bar);
    });

    it("the Triggers are menuitems with aria-haspopup and popovertarget, no aria-expanded", () => {
      render(<Bar />);
      for (const id of ["file", "edit", "view"]) {
        const trigger = el(id);
        expect(trigger.tagName).toBe("BUTTON");
        expect(trigger).toHaveAttribute("role", "menuitem");
        expect(trigger).toHaveAttribute("type", "button");
        expect(trigger).toHaveAttribute("aria-haspopup", "menu");
        expect(trigger).toHaveAttribute("popovertarget", el(`${id}-popup`).id);
        expect(trigger).not.toHaveAttribute("aria-expanded");
      }
      expect(screen.getAllByRole("menuitem", { hidden: true }).slice(0, 3)).toEqual([
        el("file"),
        el("edit"),
        el("view"),
      ]);
    });

    it("the popups are menus labelled by their Trigger, DOM children of the bar", () => {
      render(<Bar />);
      const popup = el("file-popup");
      expect(popup).toHaveAttribute("role", "menu");
      expect(popup).toHaveAttribute("popover", "auto");
      expect(popup).toHaveAttribute("aria-labelledby", el("file").id);
      expect(popup.parentElement).toBe(el("bar"));
      expect(el("file").nextElementSibling).toBe(popup);
    });

    it("a disabled Trigger is aria-disabled and stays focusable (no native disabled)", async () => {
      render(<Bar viewDisabled />);
      const view = el("view");
      expect(view).toHaveAttribute("aria-disabled", "true");
      expect(view).not.toHaveAttribute("disabled");
      expect(view).toHaveAttribute("data-disabled", "");
      expect(view).toHaveAttribute("tabindex", "-1");
      const user = setupUser();
      await user.click(view);
      await flushTasks(2);
      expect(isOpen("view-popup")).toBe(false);
      expect(view).toHaveFocus();
    });

    it("server HTML has no tabindex on the Triggers; hydration writes the roving one", async () => {
      const html = renderToString(<Bar />);
      expect(html).toContain('role="menubar"');
      expect(html).toContain('role="menuitem"');
      const container = document.createElement("div");
      container.innerHTML = html;
      for (const trigger of container.querySelectorAll('[aria-haspopup="menu"]')) {
        expect(trigger).not.toHaveAttribute("tabindex");
      }
      await hydrateFromServer(<Bar />);
      expect(el("file")).toHaveAttribute("tabindex", "0");
      expect(el("edit")).toHaveAttribute("tabindex", "-1");
      expect(el("view")).toHaveAttribute("tabindex", "-1");
    });

    it("a Menu.Trigger outside a bar keeps its role-less button (no menuitem)", () => {
      render(
        <Menu.Root>
          <Menu.Trigger data-testid="plain">Actions</Menu.Trigger>
          <Menu.Popup />
        </Menu.Root>,
      );
      expect(el("plain")).not.toHaveAttribute("role");
    });

    it("a Menu.Trigger outside a bar keeps the consumer's onPointerMove", () => {
      const onPointerMove = vi.fn();
      render(
        <Menu.Root>
          <Menu.Trigger data-testid="plain" onPointerMove={onPointerMove}>
            Actions
          </Menu.Trigger>
          <Menu.Popup />
        </Menu.Root>,
      );
      fireEvent.pointerMove(el("plain"), { pointerType: "mouse" });
      expect(onPointerMove).toHaveBeenCalledTimes(1);
    });

    it("a Trigger in a menu of the bar does not see the bar (the context ends at Menu.Popup)", async () => {
      const errors = silenceErrors();
      render(
        <Menubar aria-label="Bar">
          <Menu.Root defaultOpen>
            <Menu.Trigger data-testid="top">Top</Menu.Trigger>
            <Menu.Popup>
              <Menu.Root>
                <Menu.Trigger data-testid="inner">Inner</Menu.Trigger>
                <Menu.Popup />
              </Menu.Root>
            </Menu.Popup>
          </Menu.Root>
        </Menubar>,
      );
      await flushTasks(2);
      expect(el("top")).toHaveAttribute("role", "menuitem");
      expect(el("inner")).not.toHaveAttribute("role");
      errors.mockRestore();
    });

    it("does not warn, also while every menu is still suspended at mount", async () => {
      const errors = silenceErrors();
      const suspender = createSuspender();
      await act(async () => {
        render(
          <Menubar aria-label="Later">
            <Suspense fallback={null}>
              <suspender.Suspender value="menus" />
              <Menu.Root>
                <Menu.Trigger data-testid="late">Late</Menu.Trigger>
                <Menu.Popup />
              </Menu.Root>
            </Suspense>
          </Menubar>,
        );
      });
      await flushTasks(2);
      expect(errors).not.toHaveBeenCalled();
      await act(async () => suspender.resolve("menus"));
      await flushTasks(2);
      expect(el("late")).toHaveAttribute("role", "menuitem");
      expect(el("late")).toHaveAttribute("tabindex", "0");
    });
  });

  describe("roving focus over the Triggers", () => {
    it("is one Tab stop; Tab enters at the first Trigger and leaves past the bar", async () => {
      render(<Bar />);
      const user = setupUser();
      el("before").focus();
      await user.tab();
      expect(el("file")).toHaveFocus();
      await user.tab();
      expect(el("after")).toHaveFocus();
      await user.tab({ shift: true });
      expect(el("file")).toHaveFocus();
    });

    it("ArrowRight / ArrowLeft / Home / End move between the Triggers and wrap", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      el("file").focus();
      await user.keyboard("{ArrowRight}");
      expect(el("edit")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      // A disabled Trigger is an item of the bar.
      expect(el("view")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(el("file")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(el("view")).toHaveFocus();
      await user.keyboard("{Home}");
      expect(el("file")).toHaveFocus();
      await user.keyboard("{End}");
      expect(el("view")).toHaveFocus();
      // Moving focus opens nothing while every menu is closed.
      expect(isOpen("file-popup") || isOpen("edit-popup") || isOpen("view-popup")).toBe(false);
    });

    it("loop={false} stops at the ends", async () => {
      render(<Bar bar={{ loop: false }} />);
      const user = setupUser();
      el("file").focus();
      await user.keyboard("{ArrowLeft}");
      expect(el("file")).toHaveFocus();
      await user.keyboard("{End}{ArrowRight}");
      expect(el("view")).toHaveFocus();
    });

    it("RTL swaps ArrowLeft and ArrowRight", async () => {
      render(<Bar bar={{ style: { direction: "rtl" } }} />);
      const user = setupUser();
      el("file").focus();
      await user.keyboard("{ArrowLeft}");
      expect(el("edit")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(el("file")).toHaveFocus();
    });

    it("the last focused Trigger stays the Tab stop after focus leaves", async () => {
      render(<Bar />);
      const user = setupUser();
      el("file").focus();
      await user.keyboard("{ArrowRight}");
      await user.tab();
      expect(el("after")).toHaveFocus();
      expect(el("edit")).toHaveAttribute("tabindex", "0");
      expect(el("file")).toHaveAttribute("tabindex", "-1");
      await user.tab({ shift: true });
      expect(el("edit")).toHaveFocus();
    });

    it("the items of an open menu are not items of the bar", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      for (const id of ["new", "recent", "save"]) {
        expect(el(id)).toHaveAttribute("tabindex", "-1");
      }
      expect(el("file")).toHaveAttribute("tabindex", "0");
      expect(el("file-popup")).toHaveAttribute("tabindex", "-1");
    });
  });

  describe("open keys on a Trigger (unchanged from Menu)", () => {
    it.each([
      ["{ArrowDown}", "undo"],
      ["{ArrowUp}", "redo"],
      ["{Enter}", "undo"],
      [" ", "undo"],
    ])("%s opens the menu with %s focused", async (key, focused) => {
      render(<Bar />);
      const user = setupUser();
      el("edit").focus();
      await user.keyboard(key);
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el(focused)).toHaveFocus();
    });
  });

  describe("switching from inside a menu", () => {
    it("ArrowRight on an item opens the next menu with its first item focused", async () => {
      const fileFacts = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => void>();
      const fileAction = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => void>();
      const editAction = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => void>();
      render(
        <Bar
          file={{ onOpenChange: fileFacts, openChangeAction: fileAction }}
          edit={{ openChangeAction: editAction }}
        />,
      );
      const user = setupUser();
      await openFile(user);
      expect(fileAction).toHaveBeenCalledTimes(1);
      expect(el("new")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      // The target Trigger is focused first; the old menu hid at once.
      expect(isOpen("file-popup")).toBe(false);
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("undo")).toHaveFocus();
      expect(fileFacts).toHaveBeenCalledTimes(1);
      expect(fileFacts.mock.calls[0]![0]).toBe(false);
      expect(fileFacts.mock.calls[0]![1].reason).toBe("dismiss");
      expect(editAction).toHaveBeenCalledTimes(1);
      expect(editAction.mock.calls[0]![0]).toBe(true);
      expect(editAction.mock.calls[0]![1].reason).toBe("activate");
      expect(editAction.mock.calls[0]![1].event).toBeInstanceOf(KeyboardEvent);
      expect(el("edit")).toHaveAttribute("tabindex", "0");
      // The browser already hid File (its blur rule) when the switch closed the other menus: the
      // fact only, no superseding request (menubar.tsx `closeMenu`).
      expect(fileAction).toHaveBeenCalledTimes(1);
    });

    it("ArrowLeft in a top-level menu opens the previous menu; both wrap", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowLeft}");
      await flushTasks(2);
      // Wraps from File to View.
      expect(isOpen("view-popup")).toBe(true);
      expect(el("zoom")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("view-popup")).toBe(false);
      expect(isOpen("file-popup")).toBe(true);
      expect(el("new")).toHaveFocus();
    });

    it("loop={false}: no switch past the ends", async () => {
      render(<Bar bar={{ loop: false }} />);
      const user = setupUser();
      await openFile(user);
      // Nothing switched, so the key is not consumed.
      expect(fireEvent.keyDown(el("new"), { key: "ArrowLeft" })).toBe(true);
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
      expect(el("new")).toHaveFocus();
      // A switch is.
      expect(fireEvent.keyDown(el("new"), { key: "ArrowRight" })).toBe(false);
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
    });

    it("RTL: ArrowLeft goes to the next menu, ArrowRight to the previous", async () => {
      render(<Bar bar={{ style: { direction: "rtl" } }} />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowLeft}");
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("undo")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
    });

    it("a SubmenuTrigger's ArrowRight still opens its submenu", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowDown}");
      expect(el("recent")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("recent-popup")).toBe(true);
      expect(el("doc")).toHaveFocus();
      expect(isOpen("edit-popup")).toBe(false);
    });

    it("in a submenu, ArrowRight goes to the next menu and ArrowLeft only closes the submenu", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowDown}{ArrowRight}");
      await flushTasks(2);
      expect(el("doc")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      await flushTasks(2);
      expect(isOpen("recent-popup")).toBe(false);
      expect(isOpen("file-popup")).toBe(true);
      expect(el("recent")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("doc")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      // File closed, and its content (the submenu with it) unmounted.
      expect(screen.queryByTestId("recent-popup")).toBeNull();
      expect(isOpen("file-popup")).toBe(false);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("undo")).toHaveFocus();
    });

    it("a disabled target is focused and nothing opens", async () => {
      const viewAction = vi.fn();
      render(<Bar viewDisabled view={{ openChangeAction: viewAction }} />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowLeft}");
      await flushTasks(2);
      expect(el("view")).toHaveFocus();
      expect(isOpen("file-popup")).toBe(false);
      expect(isOpen("view-popup")).toBe(false);
      expect(viewAction).not.toHaveBeenCalled();
    });

    it("keys with a modifier do not switch", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
      expect(el("new")).toHaveFocus();
    });
  });

  describe("menu mode on the bar", () => {
    it("arrows on the Trigger of an open menu switch with focus left on the Trigger", async () => {
      render(<Bar />);
      const user = setupUser();
      // A hover switch leaves focus on the Trigger of an open menu.
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("edit")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("view")).toHaveFocus();
      expect(isOpen("edit-popup")).toBe(false);
      expect(isOpen("view-popup")).toBe(true);
      await user.keyboard("{Home}");
      await flushTasks(2);
      expect(el("file")).toHaveFocus();
      expect(isOpen("view-popup")).toBe(false);
      expect(isOpen("file-popup")).toBe(true);
      expect(el("file")).toHaveFocus();
      await user.keyboard("{End}");
      await flushTasks(2);
      expect(isOpen("view-popup")).toBe(true);
      // ArrowDown then enters the menu.
      await user.keyboard("{ArrowDown}");
      expect(el("zoom")).toHaveFocus();
    });

    it("with every menu closed the arrows only move focus", async () => {
      const editAction = vi.fn();
      render(<Bar edit={{ openChangeAction: editAction }} />);
      const user = setupUser();
      el("file").focus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("edit")).toHaveFocus();
      expect(editAction).not.toHaveBeenCalled();
    });
  });

  // Menu mode held on a disabled Trigger (design 2.2 step 3, 2.3, 3). The fixture's View is
  // disabled: File, Edit, View (disabled), wrapping back to File.
  describe("menu mode across a disabled Trigger", () => {
    async function holdFromEditItem(user: ReturnType<typeof setupUser>) {
      el("edit").focus();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(el("undo")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("view")).toHaveFocus();
      expect(isOpen("edit-popup")).toBe(false);
      expect(isOpen("view-popup")).toBe(false);
    }

    it("from an item: ArrowRight onto the disabled Trigger, ArrowRight again opens the next menu, first item focused", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await holdFromEditItem(user);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
      expect(el("new")).toHaveFocus();
    });

    it("from the bar: the next menu opens with focus left on its Trigger", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(el("edit")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("view")).toHaveFocus();
      expect(isOpen("edit-popup")).toBe(false);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
      expect(el("file")).toHaveFocus();
      // Backwards from the hold too.
      await user.keyboard("{ArrowLeft}");
      await flushTasks(2);
      expect(el("view")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("edit")).toHaveFocus();
    });

    it("two disabled Triggers in a row keep the mode", async () => {
      render(
        <Menubar aria-label="Bar">
          {["a", "b", "c", "d"].map((id) => (
            <Menu.Root key={id}>
              <Menu.Trigger data-testid={id} disabled={id === "b" || id === "c"}>
                {id.toUpperCase()}
              </Menu.Trigger>
              <Menu.Popup data-testid={`${id}-popup`}>
                <Menu.Item data-testid={`${id}-item`}>{id} item</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
          ))}
        </Menubar>,
      );
      const user = setupUser();
      el("a").focus();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(el("a-item")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("b")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("c")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("d-popup")).toBe(true);
      expect(el("d-item")).toHaveFocus();
    });

    it("Escape on the held Trigger ends the mode; focus stays and the key is not consumed", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await holdFromEditItem(user);
      expect(fireEvent.keyDown(el("view"), { key: "Escape" })).toBe(true);
      expect(el("view")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("file")).toHaveFocus();
      expect(isOpen("file-popup")).toBe(false);
    });

    // Conventions 15 (#191): an Escape of an IME composition is not an Escape.
    it("an Escape of an IME composition on the held Trigger keeps the mode", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await holdFromEditItem(user);
      fireEvent.keyDown(el("view"), { key: "Escape", isComposing: true });
      fireEvent.keyDown(el("view"), { key: "Escape", keyCode: 229 });
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
    });

    it("a prevented Escape on the held Trigger keeps the mode", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await holdFromEditItem(user);
      const prevent = (event: Event) => event.preventDefault();
      document.addEventListener("keydown", prevent, true);
      fireEvent.keyDown(el("view"), { key: "Escape" });
      document.removeEventListener("keydown", prevent, true);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
    });

    it("Tab away ends the mode", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await holdFromEditItem(user);
      await user.tab();
      expect(el("after")).toHaveFocus();
      await user.tab({ shift: true });
      expect(el("view")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("file")).toHaveFocus();
      expect(isOpen("file-popup")).toBe(false);
    });

    it("a click elsewhere ends the mode", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await holdFromEditItem(user);
      await user.click(el("before"));
      el("view").focus();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("file")).toHaveFocus();
      expect(isOpen("file-popup")).toBe(false);
    });

    it("a pointermove onto an enabled Trigger while a disabled one holds the mode opens it", async () => {
      const editAction = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => void>();
      render(<Bar viewDisabled edit={{ openChangeAction: editAction }} />);
      const user = setupUser();
      await holdFromEditItem(user);
      editAction.mockClear();
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("edit")).toHaveFocus();
      expect(editAction).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ reason: "activate" }),
      );
      // The disabled Trigger itself still ignores the pointer.
      fireEvent.pointerMove(el("view"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
    });
  });

  describe("hover", () => {
    it("does nothing while every menu is closed", async () => {
      const editAction = vi.fn();
      render(<Bar edit={{ openChangeAction: editAction }} />);
      el("before").focus();
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(editAction).not.toHaveBeenCalled();
      expect(el("before")).toHaveFocus();
    });

    it("pointermove onto another Trigger while a menu is open switches, focus on the Trigger", async () => {
      const fileFacts = vi.fn();
      const fileAction = vi.fn();
      const editAction = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => void>();
      render(
        <Bar
          file={{ onOpenChange: fileFacts, openChangeAction: fileAction }}
          edit={{ openChangeAction: editAction }}
        />,
      );
      const user = setupUser();
      await openFile(user);
      expect(fileAction).toHaveBeenCalledTimes(1);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      expect(isOpen("file-popup")).toBe(false);
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("edit")).toHaveFocus();
      expect(fileFacts).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "dismiss" }));
      expect(editAction).toHaveBeenCalledTimes(1);
      expect(editAction.mock.calls[0]![1].reason).toBe("activate");
      expect(editAction.mock.calls[0]![1].event?.type).toBe("pointermove");
      // File was hidden by the switch (focus was in it): a fact, no request.
      expect(fileAction).toHaveBeenCalledTimes(1);
      // A move over the Trigger of the open menu does nothing more.
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(editAction).toHaveBeenCalledTimes(1);
    });

    it("touch is ignored, and so is a disabled Trigger", async () => {
      render(<Bar viewDisabled />);
      const user = setupUser();
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "touch" });
      fireEvent.pointerMove(el("view"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
      expect(isOpen("edit-popup")).toBe(false);
    });

    it("a click on the Trigger after a hover switch closes its menu", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
      await user.click(el("edit"));
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(false);
    });
  });

  describe("async", () => {
    it("target items that suspend hold the open: data-pending, no menu shown, then first item", async () => {
      const suspender = createSuspender();
      render(
        <Bar
          editContent={
            <>
              <suspender.Suspender value="edit" />
              <Menu.Item data-testid="undo">Undo</Menu.Item>
            </>
          }
        />,
      );
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("edit")).toHaveFocus();
      expect(el("edit")).toHaveAttribute("data-open", "");
      expectPending(el("edit"));
      expect(isOpen("file-popup")).toBe(false);
      expect(isOpen("edit-popup")).toBe(false);
      await act(async () => suspender.resolve("edit"));
      await flushTasks(2);
      expectNotPending(el("edit"));
      expect(isOpen("edit-popup")).toBe(true);
      expect(el("undo")).toHaveFocus();
    });

    it("a second switch while the first target's items suspend: the next menu opens at once", async () => {
      const suspender = createSuspender();
      const editAction = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => void>();
      const editFacts = vi.fn();
      render(
        <Bar
          edit={{ openChangeAction: editAction, onOpenChange: editFacts }}
          editContent={
            <>
              <suspender.Suspender value="edit" />
              <Menu.Item data-testid="undo">Undo</Menu.Item>
            </>
          }
        />,
      );
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("edit")).toHaveFocus();
      expectPending(el("edit"));
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      // Suspended content alone entangles nothing: View commits without waiting for Edit's data.
      expect(el("view")).toHaveFocus();
      expect(isOpen("view-popup")).toBe(true);
      expect(el("zoom")).not.toHaveFocus();
      expect(isOpen("edit-popup")).toBe(false);
      expect(el("edit")).not.toHaveAttribute("data-open");
      expect(editAction.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
        [true, "activate"],
        [false, "dismiss"],
      ]);
      expect(editFacts).not.toHaveBeenCalled();
      // Edit's data arriving later shows nothing.
      await act(async () => suspender.resolve("edit"));
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(false);
      expect(isOpen("view-popup")).toBe(true);
      expect(editFacts).not.toHaveBeenCalled();
    });

    it("a second switch supersedes a pending open (never shown)", async () => {
      const open = deferred();
      const editAction = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => unknown>((next) =>
        next ? open.promise : undefined,
      );
      render(<Bar edit={{ openChangeAction: editAction }} />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("edit")).toHaveFocus();
      expectPending(el("edit"));
      // Focus on the pending Trigger: the bar is in menu mode.
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(el("view")).toHaveFocus();
      expect(editAction).toHaveBeenCalledTimes(2);
      expect(editAction.mock.calls[1]![0]).toBe(false);
      expect(editAction.mock.calls[1]![1].reason).toBe("dismiss");
      // View's open is entangled with Edit's pending async action: optimistic until it settles.
      expect(el("view")).toHaveAttribute("data-open", "");
      expect(el("edit")).not.toHaveAttribute("data-open");
      await act(async () => open.resolve());
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(false);
      expect(el("edit")).not.toHaveAttribute("data-open");
      expect(isOpen("view-popup")).toBe(true);
    });

    it("focus leaving the bar supersedes a pending open", async () => {
      const open = deferred();
      const editAction = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => unknown>((next) =>
        next ? open.promise : undefined,
      );
      render(<Bar edit={{ openChangeAction: editAction }} />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      await user.tab();
      expect(el("after")).toHaveFocus();
      expect(editAction).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "dismiss" }),
      );
      await act(async () => open.resolve());
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(false);
    });

    it("a pending item action in the menu a switch leaves: its close is dropped", async () => {
      const save = deferred();
      render(<Bar fileItemAction={() => save.promise} />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{Enter}");
      expectPending(el("new"));
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(false);
      await act(async () => save.resolve());
      await flushTasks(2);
      // Entangled with the item's transition, the switch's open commits once it settled.
      expect(isOpen("edit-popup")).toBe(true);
      expect(isOpen("file-popup")).toBe(false);
    });

    it("a rejected item action in the menu a switch left goes to reportError", async () => {
      const report = vi.fn();
      vi.stubGlobal("reportError", report);
      silenceErrors();
      const save = deferred();
      render(<Bar fileItemAction={() => save.promise} />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{Enter}");
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      await act(async () => save.reject(new Error("save failed")));
      await flushTasks(2);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report.mock.calls[0]![0]).toEqual(new Error("save failed"));
    });
  });

  describe("controlled menus", () => {
    function Controlled({ onEdit }: { onEdit?: (open: boolean) => void }) {
      const [file, setFile] = useState(false);
      const [edit, setEdit] = useState(false);
      return (
        <Bar
          file={{ open: file, openChangeAction: setFile, onOpenChange: setFile }}
          edit={{
            open: edit,
            openChangeAction: (next) => {
              onEdit?.(next);
              setEdit(next);
            },
            onOpenChange: setEdit,
          }}
        />
      );
    }

    it("a switch between controlled Roots with onOpenChange", async () => {
      const onEdit = vi.fn();
      render(<Controlled onEdit={onEdit} />);
      const user = setupUser();
      await openFile(user);
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(false);
      expect(el("file")).not.toHaveAttribute("data-open");
      expect(isOpen("edit-popup")).toBe(true);
      expect(onEdit).toHaveBeenCalledWith(true);
      expect(el("undo")).toHaveFocus();
    });

    it("a controlled Root that keeps open={true} is re-shown after the switch's fact", async () => {
      silenceErrors();
      render(<Bar file={{ open: true, onOpenChange: () => {} }} />);
      await flushTasks(2);
      expect(isOpen("file-popup")).toBe(true);
      el("new").focus();
      const user = setupUser();
      await user.keyboard("{ArrowRight}");
      await flushTasks(2);
      // The parent refused the fact: File is shown again (in a browser, that hides Edit).
      expect(isOpen("file-popup")).toBe(true);
    });
  });

  describe("focus leaving the bar", () => {
    it("hides a menu still shown with focus on its Trigger", async () => {
      const editFacts = vi.fn();
      render(<Bar edit={{ onOpenChange: editFacts }} />);
      const user = setupUser();
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(el("edit")).toHaveFocus();
      expect(isOpen("edit-popup")).toBe(true);
      await user.tab();
      expect(el("after")).toHaveFocus();
      expect(isOpen("edit-popup")).toBe(false);
      await flushTasks(2);
      expect(editFacts).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "dismiss" }));
    });

    it("window blur (null relatedTarget) closes nothing", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      fireEvent.blur(el("edit"), { relatedTarget: null });
      await flushTasks(2);
      expect(isOpen("edit-popup")).toBe(true);
    });

    it("focus moving between a Trigger and its menu closes nothing", async () => {
      render(<Bar />);
      const user = setupUser();
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      await user.keyboard("{ArrowDown}");
      expect(el("undo")).toHaveFocus();
      expect(isOpen("edit-popup")).toBe(true);
    });
  });

  describe("function props, render and ref", () => {
    it("className, style and children receive the (empty) state", () => {
      const seen: MenubarState[] = [];
      render(
        <Menubar
          aria-label="Bar"
          data-testid="bar"
          className={(state) => {
            seen.push(state);
            return "bar";
          }}
          style={() => ({ gap: "4px" })}
        >
          {(state) => {
            seen.push(state);
            return (
              <Menu.Root>
                <Menu.Trigger>File</Menu.Trigger>
                <Menu.Popup />
              </Menu.Root>
            );
          }}
        </Menubar>,
      );
      expect(el("bar")).toHaveClass("bar");
      expect(el("bar")).toHaveStyle({ gap: "4px" });
      expect(seen.length).toBeGreaterThan(0);
      for (const state of seen) expect(state).toEqual({});
    });

    it("render element replaces the div, keeps the role and the keys, forwards ref", async () => {
      let node: HTMLElement | null = null;
      render(
        <Menubar
          aria-label="Bar"
          render={<nav data-testid="bar" className="from-element" />}
          className="from-prop"
          ref={(element) => {
            node = element;
          }}
        >
          <Menu.Root>
            <Menu.Trigger data-testid="file">File</Menu.Trigger>
            <Menu.Popup />
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger data-testid="edit">Edit</Menu.Trigger>
            <Menu.Popup />
          </Menu.Root>
        </Menubar>,
      );
      const bar = el("bar");
      expect(bar.tagName).toBe("NAV");
      expect(bar).toHaveAttribute("role", "menubar");
      expect(bar).toHaveClass("from-prop", "from-element");
      expect(node).toBe(bar);
      el("file").focus();
      const user = setupUser();
      await user.keyboard("{ArrowRight}");
      expect(el("edit")).toHaveFocus();
    });

    it("render function receives the props and the state", () => {
      const renderFn = vi.fn((props: object, _state: MenubarState) => (
        <div {...props} data-testid="bar" />
      ));
      render(
        <Menubar aria-label="Bar" render={renderFn}>
          <Menu.Root>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Popup />
          </Menu.Root>
        </Menubar>,
      );
      expect(el("bar")).toHaveAttribute("role", "menubar");
      expect(renderFn.mock.calls[0]![1]).toEqual({});
    });

    it("a consumer onPointerMove on a Trigger still runs, and so does the switch", async () => {
      const onPointerMove = vi.fn();
      render(
        <Menubar aria-label="Bar">
          <Menu.Root>
            <Menu.Trigger data-testid="file">File</Menu.Trigger>
            <Menu.Popup data-testid="file-popup">
              <Menu.Item>New</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger data-testid="edit" onPointerMove={onPointerMove}>
              Edit
            </Menu.Trigger>
            <Menu.Popup data-testid="edit-popup">
              <Menu.Item>Undo</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Menubar>,
      );
      const user = setupUser();
      await openFile(user);
      fireEvent.pointerMove(el("edit"), { pointerType: "mouse" });
      await flushTasks(2);
      expect(onPointerMove).toHaveBeenCalledTimes(1);
      expect(isOpen("edit-popup")).toBe(true);
    });

    it("renders with Suspense around a menu", async () => {
      render(
        <Menubar aria-label="Bar">
          <Suspense fallback={null}>
            <Menu.Root>
              <Menu.Trigger data-testid="file">File</Menu.Trigger>
              <Menu.Popup />
            </Menu.Root>
          </Suspense>
        </Menubar>,
      );
      expect(el("file")).toHaveAttribute("role", "menuitem");
      expect(el("file")).toHaveAttribute("tabindex", "0");
    });
  });
});
