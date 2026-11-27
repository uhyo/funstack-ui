// Menubar rows that need a real engine (design/components/menubar.md 11 and the #170 entries of
// design/CHANGELOG.md): the accessibility tree and axe for a `menu` that is a direct DOM child of
// the `menubar` (test-plan step 1), the platform showing one `popover="auto"` at a time, real
// focus return to the Trigger a switch focused (Escape and item activation, after a keyboard and
// a hover switch), Tab and Shift+Tab from an item, real pointer moves, and a pre-hydration click.
//
// Engine branches (src/__tests__/engine.ts): the accessibility tree is read through CDP, so the
// node assertions run on Chromium only; Firefox's tree was read by hand through Marionette
// (memo/developer/probes/170-menubar-ax). axe and the DOM assertions run on all three engines.
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { axProperty, getAXNodes } from "../__tests__/ax-tree.js";
import type { AXNode } from "../__tests__/ax-tree.js";
import {
  addStyle,
  flushFor,
  leaveActEnvironment,
  onCleanup,
  settle,
} from "../__tests__/browser-helpers.js";
import { user } from "../__tests__/browser-user.js";
import { browserName } from "../__tests__/engine.js";
import { Menu } from "../menu/index.js";
import type { MenuOpenChangeDetails, MenuRootProps } from "../menu/index.js";
import { Menubar } from "./index.js";

const css = `
  .bar { display: flex; gap: 2px; padding: 40px 20px 0; }
  .bar > [role="menuitem"] { width: 80px; height: 30px; }
  .bar [role="menu"] { margin: 0; inset: auto; padding: 4px; border: 1px solid; width: 160px; }
  .bar [role="menu"] [role^="menuitem"] { display: block; width: 100%; height: 28px; text-align: start; }
`;

const el = (id: string) => screen.getByTestId(id);
const isOpen = (id: string) => el(id).matches(":popover-open");

interface BarProps {
  file?: Partial<MenuRootProps>;
  edit?: Partial<MenuRootProps>;
}

function Bar({ file, edit }: BarProps): ReactNode {
  return (
    <>
      <button type="button" data-testid="before">
        Before
      </button>
      <Menubar aria-label="Application" className="bar" data-testid="bar">
        <Menu.Root {...file}>
          <Menu.Trigger data-testid="file">File</Menu.Trigger>
          <Menu.Popup data-testid="file-popup">
            <Menu.Item data-testid="new">New</Menu.Item>
            <Menu.Item data-testid="save">Save</Menu.Item>
            <Menu.Separator />
            <Menu.CheckboxItem data-testid="autosave" defaultChecked>
              Autosave
            </Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root {...edit}>
          <Menu.Trigger data-testid="edit">Edit</Menu.Trigger>
          <Menu.Popup data-testid="edit-popup">
            <Menu.Item data-testid="undo">Undo</Menu.Item>
            <Menu.Item data-testid="redo">Redo</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger data-testid="view" disabled>
            View
          </Menu.Trigger>
          <Menu.Popup data-testid="view-popup">
            <Menu.Item>Zoom</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      <button type="button" data-testid="after">
        After
      </button>
    </>
  );
}

beforeEach(() => {
  addStyle(css);
});

async function openFileWithKeyboard() {
  el("file").focus();
  await user.keyboard("{ArrowDown}");
  await settle(() => expect(isOpen("file-popup")).toBe(true));
  expect(el("new")).toHaveFocus();
}

/** The non-ignored, non-generic AX children of `node` (Chromium), flattening generic wrappers. */
function axChildren(node: AXNode & { childIds?: string[] }, byId: Map<string, AXNode>): AXNode[] {
  const out: AXNode[] = [];
  for (const id of node.childIds ?? []) {
    const child = byId.get(id) as (AXNode & { childIds?: string[] }) | undefined;
    if (child === undefined) continue;
    const role = child.role?.value;
    if (child.ignored || role === "generic" || role === "none")
      out.push(...axChildren(child, byId));
    else if (role !== "StaticText" && role !== "InlineTextBox") out.push(child);
  }
  return out;
}

async function axeViolations(context: Element): Promise<{ id: string; nodes: string[] }[]> {
  // `region` (best practice: page content inside landmarks) is about the test page, not the bar.
  const result = await axe.run(context, {
    resultTypes: ["violations"],
    rules: { region: { enabled: false } },
  });
  return result.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
}

describe("Menubar (browser)", () => {
  describe("accessibility tree and axe (test plan step 1)", () => {
    it("a menu as a direct child of the menubar: menuitems with their expanded state, the menu named by its Trigger, no axe violation", async () => {
      render(<Bar />);
      await flushFor();
      // Closed.
      expect(await axeViolations(el("bar"))).toEqual([]);
      await openFileWithKeyboard();
      expect(el("file-popup").parentElement).toBe(el("bar"));
      expect(await axeViolations(document.body)).toEqual([]);
      if (browserName !== "chromium") return;

      type Node = AXNode & { nodeId?: string; childIds?: string[] };
      // Polled: the tree follows the DOM at the next lifecycle update.
      const read = async () => {
        const nodes = (await getAXNodes()) as Node[];
        const byId = new Map(nodes.map((n) => [n.nodeId!, n]));
        const bar = nodes.find((n) => n.role?.value === "menubar");
        if (bar === undefined) return null;
        const children = axChildren(bar, byId);
        return {
          name: bar.name?.value,
          children: children.map((n) => ({
            role: n.role?.value,
            name: n.name?.value,
            expanded: axProperty(n, "expanded"),
            hasPopup: axProperty(n, "hasPopup"),
            disabled: axProperty(n, "disabled"),
          })),
          menu: children[1]
            ? axChildren(children[1] as Node, byId).map((n) => [n.role?.value, n.name?.value])
            : [],
        };
      };
      await expect.poll(read).toEqual({
        name: "Application",
        children: [
          { role: "menuitem", name: "File", expanded: true, hasPopup: "menu", disabled: undefined },
          {
            role: "menu",
            name: "File",
            expanded: undefined,
            hasPopup: undefined,
            disabled: undefined,
          },
          {
            role: "menuitem",
            name: "Edit",
            expanded: false,
            hasPopup: "menu",
            disabled: undefined,
          },
          { role: "menuitem", name: "View", expanded: false, hasPopup: "menu", disabled: true },
        ],
        menu: [
          ["menuitem", "New"],
          ["menuitem", "Save"],
          ["separator", ""],
          ["menuitemcheckbox", "Autosave"],
        ],
      });
    });
  });

  describe("switching menus", () => {
    it("keyboard: one menu shown at a time; Escape returns focus to the new menu's Trigger", async () => {
      const fileFacts = vi.fn<(next: boolean, details: MenuOpenChangeDetails) => void>();
      render(<Bar file={{ onOpenChange: fileFacts }} />);
      await openFileWithKeyboard();
      await user.keyboard("{ArrowRight}");
      await settle(() => expect(isOpen("edit-popup")).toBe(true));
      expect(isOpen("file-popup")).toBe(false);
      expect(el("undo")).toHaveFocus();
      await settle(() => expect(fileFacts).toHaveBeenCalledTimes(1));
      expect(fileFacts.mock.calls[0]![1].reason).toBe("dismiss");
      // Anchored below its own Trigger.
      const t = el("edit").getBoundingClientRect();
      const p = el("edit-popup").getBoundingClientRect();
      expect(Math.round(p.top)).toBe(Math.round(t.bottom));
      expect(Math.round(p.left)).toBe(Math.round(t.left));
      await user.keyboard("{Escape}");
      await settle(() => expect(isOpen("edit-popup")).toBe(false));
      expect(el("edit")).toHaveFocus();
      expect(el("edit")).toHaveAttribute("tabindex", "0");
    });

    it("keyboard: an item's activation after a switch returns focus to the new Trigger", async () => {
      render(<Bar />);
      await openFileWithKeyboard();
      await user.keyboard("{ArrowRight}");
      await settle(() => expect(isOpen("edit-popup")).toBe(true));
      await user.keyboard("{Enter}");
      await settle(() => expect(isOpen("edit-popup")).toBe(false));
      expect(el("edit")).toHaveFocus();
    });

    it("hover: the pointer moving onto another Trigger switches, focus left on it; Escape returns there", async () => {
      render(<Bar />);
      await user.click(el("file"));
      await settle(() => expect(isOpen("file-popup")).toBe(true));
      await user.hover(el("edit"));
      await settle(() => expect(isOpen("edit-popup")).toBe(true));
      expect(isOpen("file-popup")).toBe(false);
      expect(el("edit")).toHaveFocus();
      await user.keyboard("{Escape}");
      await settle(() => expect(isOpen("edit-popup")).toBe(false));
      expect(el("edit")).toHaveFocus();
    });

    it("hover: an item clicked in the menu a hover switch opened returns focus to its Trigger", async () => {
      render(<Bar />);
      await user.click(el("file"));
      await settle(() => expect(isOpen("file-popup")).toBe(true));
      await user.hover(el("edit"));
      await settle(() => expect(isOpen("edit-popup")).toBe(true));
      await user.click(el("redo"));
      await settle(() => expect(isOpen("edit-popup")).toBe(false));
      expect(el("edit")).toHaveFocus();
    });

    it("hover over the Triggers does nothing while every menu is closed", async () => {
      render(<Bar />);
      el("before").focus();
      await user.hover(el("file"));
      await user.hover(el("edit"));
      await flushFor(50);
      expect(isOpen("file-popup") || isOpen("edit-popup")).toBe(false);
      expect(el("before")).toHaveFocus();
    });

    it("a click on the Trigger of a menu a hover switch opened closes it", async () => {
      render(<Bar />);
      await user.click(el("file"));
      await settle(() => expect(isOpen("file-popup")).toBe(true));
      await user.hover(el("edit"));
      await settle(() => expect(isOpen("edit-popup")).toBe(true));
      await user.click(el("edit"));
      await settle(() => expect(isOpen("edit-popup")).toBe(false));
      expect(isOpen("file-popup")).toBe(false);
    });
  });

  describe("Tab from a menu", () => {
    it("Tab from an item closes the menu and leaves the bar", async () => {
      render(<Bar />);
      await openFileWithKeyboard();
      await user.tab();
      expect(el("after")).toHaveFocus();
      expect(isOpen("file-popup")).toBe(false);
    });

    it("Shift+Tab from an item lands on the bar's Trigger and closes the menu; one more leaves", async () => {
      render(<Bar />);
      await openFileWithKeyboard();
      await user.tab({ shift: true });
      expect(el("file")).toHaveFocus();
      expect(isOpen("file-popup")).toBe(false);
      await user.tab({ shift: true });
      expect(el("before")).toHaveFocus();
    });

    it("Tab with a hover-opened menu and focus on its Trigger hides the menu", async () => {
      render(<Bar />);
      await user.click(el("file"));
      await settle(() => expect(isOpen("file-popup")).toBe(true));
      await user.hover(el("edit"));
      await settle(() => expect(isOpen("edit-popup")).toBe(true));
      expect(el("edit")).toHaveFocus();
      await user.tab();
      await settle(() => expect(isOpen("edit-popup")).toBe(false));
      expect(el("after")).toHaveFocus();
    });
  });

  describe("before hydration", () => {
    it("each Trigger is a Tab stop and a click opens its (empty) popup natively, one at a time; hydration fills it", async () => {
      const container = document.createElement("div");
      container.innerHTML = renderToString(<Bar />);
      document.body.append(container);
      onCleanup(() => container.remove());
      const file = container.querySelector<HTMLElement>('[data-testid="file"]')!;
      const edit = container.querySelector<HTMLElement>('[data-testid="edit"]')!;
      const filePopup = container.querySelector<HTMLElement>('[data-testid="file-popup"]')!;
      const editPopup = container.querySelector<HTMLElement>('[data-testid="edit-popup"]')!;
      expect(file).not.toHaveAttribute("tabindex");
      await userEvent.click(file);
      await expect.poll(() => filePopup.matches(":popover-open")).toBe(true);
      await userEvent.click(edit);
      await expect.poll(() => editPopup.matches(":popover-open")).toBe(true);
      expect(filePopup.matches(":popover-open")).toBe(false);
      expect(editPopup.querySelector('[role="menuitem"]')).toBeNull();

      // Hydration and the mount reconciliation's dispatch land outside any act scope.
      leaveActEnvironment();
      const root: Root = hydrateRoot(container, <Bar />);
      onCleanup(() => root.unmount());
      await expect.poll(() => editPopup.querySelector('[data-testid="undo"]')).not.toBeNull();
      expect(editPopup.matches(":popover-open")).toBe(true);
      expect(file).toHaveAttribute("tabindex", "0");
      expect(edit).toHaveAttribute("tabindex", "-1");
    });
  });
});
