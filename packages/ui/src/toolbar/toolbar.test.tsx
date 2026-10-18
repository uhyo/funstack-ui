// Toolbar tests (jsdom), design/components/toggle-group.md section 14 rows 1, 8, 12-17 and 19,
// plus Toolbar.Button's action rows (as Menu.Item's). jsdom has no Popover API; the shim in
// vitest.setup.ts provides it for the Menu rows.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  setupUser,
} from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Menu } from "../menu/index.js";
import { Popover } from "../popover/index.js";
import { Toggle } from "../toggle/index.js";
import { ToggleGroup } from "../toggle-group/index.js";
import { Toolbar } from "./index.js";
import type { ToolbarButtonActionDetails, ToolbarButtonState, ToolbarRootState } from "./index.js";

const button = (name: string) => screen.getByRole("button", { name });
const toolbar = () => screen.getByRole("toolbar");
const tabStops = () =>
  [...toolbar().querySelectorAll("[tabindex]")].filter((el) => el.getAttribute("tabindex") === "0");
/** Runs the tasks the popover shim queued and React's work after them. */
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** Mixed children (row 12). */
function Mixed({
  orientation,
  loop,
  rtl = false,
  children,
}: {
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
  rtl?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      <button type="button">before</button>
      <Toolbar.Root
        aria-label="Formatting"
        orientation={orientation}
        loop={loop}
        style={rtl ? { direction: "rtl" } : undefined}
      >
        <Toolbar.Button>One</Toolbar.Button>
        <Toggle>Two</Toggle>
        <button type="button" disabled>
          Off
        </button>
        <button type="button">Three</button>
        <a href="#x">Four</a>
        <Toolbar.Button disabled>Five</Toolbar.Button>
        {children}
      </Toolbar.Root>
      <button type="button">after</button>
    </>
  );
}

describe("Toolbar", () => {
  describe("roles and ARIA (row 1)", () => {
    it("Root is div[role=toolbar] with aria-orientation; Separator is perpendicular", () => {
      const { unmount } = render(
        <Toolbar.Root aria-label="T">
          <Toolbar.Button>A</Toolbar.Button>
          <Toolbar.Separator data-testid="sep" />
          <Toolbar.Button disabled>B</Toolbar.Button>
        </Toolbar.Root>,
      );
      const root = screen.getByRole("toolbar", { name: "T" });
      expect(root.tagName).toBe("DIV");
      expect(root).toHaveAttribute("aria-orientation", "horizontal");
      expect(root).toHaveAttribute("data-orientation", "horizontal");
      expect(root).not.toHaveAttribute("focusgroup");
      const sep = screen.getByRole("separator");
      expect(sep.tagName).toBe("HR");
      expect(sep).toHaveAttribute("aria-orientation", "vertical");
      expect(sep).toHaveAttribute("data-orientation", "vertical");
      expect(button("A")).toHaveAttribute("type", "button");
      expect(button("A")).not.toHaveAttribute("aria-disabled");
      expect(button("B")).toHaveAttribute("aria-disabled", "true");
      expect(button("B")).toHaveAttribute("data-disabled", "");
      expect(button("B")).not.toBeDisabled();
      unmount();

      render(
        <Toolbar.Root aria-label="T" orientation="vertical">
          <Toolbar.Separator />
        </Toolbar.Root>,
      );
      expect(toolbar()).toHaveAttribute("aria-orientation", "vertical");
      expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
      expect(screen.getByRole("separator")).toHaveAttribute("data-orientation", "horizontal");
    });
  });

  describe("Toolbar.Button action", () => {
    it("sync action gets details with the click event", async () => {
      const action = vi.fn<(d: ToolbarButtonActionDetails) => void>();
      render(
        <Toolbar.Root aria-label="T">
          <Toolbar.Button action={action}>Cut</Toolbar.Button>
        </Toolbar.Root>,
      );
      await setupUser().click(button("Cut"));
      expect(action).toHaveBeenCalledTimes(1);
      const details = action.mock.calls[0]![0];
      expect(details.event?.type).toBe("click");
      // Row 19: `event` is virtual.
      expect(Object.keys(details)).toEqual([]);
      expect(JSON.stringify(details)).toBe("{}");
    });

    it("async action shows data-pending until it resolves; disabled never dispatches", async () => {
      const d = deferred();
      const action = vi.fn(() => d.promise);
      render(
        <Toolbar.Root aria-label="T">
          <Toolbar.Button action={action}>
            {(s: ToolbarButtonState) => (s.pending ? "Saving" : "Save")}
          </Toolbar.Button>
          <Toolbar.Button action={action} disabled>
            Copy
          </Toolbar.Button>
        </Toolbar.Root>,
      );
      const user = setupUser();
      await user.click(button("Save"));
      expectPending(button("Saving"));
      await act(async () => {
        d.resolve();
      });
      expectNotPending(button("Save"));

      await user.click(button("Copy"));
      act(() => button("Copy").focus());
      await user.keyboard("{Enter}[Space]");
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("pending stays until both overlapping runs settle", async () => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      render(
        <Toolbar.Root aria-label="T">
          <Toolbar.Button action={() => deferreds[calls++]!.promise}>Go</Toolbar.Button>
        </Toolbar.Root>,
      );
      const user = setupUser();
      await user.click(button("Go"));
      await user.click(button("Go"));
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expectPending(button("Go"));
      await act(async () => {
        deferreds[0]!.resolve();
      });
      expectNotPending(button("Go"));
    });

    it("rejection reaches the boundary above the button", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const onError = vi.fn();
      render(
        <Toolbar.Root aria-label="T">
          <ErrorCatcher onError={onError}>
            <Toolbar.Button action={() => d.promise}>Go</Toolbar.Button>
          </ErrorCatcher>
          <Toolbar.Button>Other</Toolbar.Button>
        </Toolbar.Root>,
      );
      await setupUser().click(button("Go"));
      const err = new Error("failed");
      await act(async () => {
        d.reject(err);
      });
      expect(onError).toHaveBeenCalledWith(err);
      expect(button("Other")).toBeInTheDocument();
    });

    it("a superseded rejection reaches the boundary too", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      const onError = vi.fn();
      render(
        <ErrorCatcher onError={onError}>
          <Toolbar.Button action={() => deferreds[calls++]!.promise}>Go</Toolbar.Button>
        </ErrorCatcher>,
      );
      const user = setupUser();
      await user.click(button("Go"));
      await user.click(button("Go"));
      await act(async () => {
        deferreds[1]!.resolve();
      });
      const err = new Error("older");
      await act(async () => {
        deferreds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledWith(err);
    });
  });

  describe("function props and render (row 8)", () => {
    it("Root state and Button render as a link get no type; a disabled link does not navigate", async () => {
      const className = vi.fn((s: ToolbarRootState) => `tb-${s.orientation}`);
      const action = vi.fn();
      render(
        <Toolbar.Root aria-label="T" orientation="vertical" className={className}>
          <Toolbar.Button render={<a href="#go" />} action={action}>
            Link
          </Toolbar.Button>
          <Toolbar.Button render={<a href="#no" />} disabled action={action}>
            Dead
          </Toolbar.Button>
        </Toolbar.Root>,
      );
      expect(toolbar()).toHaveClass("tb-vertical");
      const link = screen.getByText("Link");
      expect(link.tagName).toBe("A");
      expect(link).not.toHaveAttribute("type");
      await setupUser().click(link);
      expect(action).toHaveBeenCalledTimes(1);
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      act(() => {
        screen.getByText("Dead").dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("Separator className / style receive its orientation; render replaces the element", () => {
      render(
        <Toolbar.Root aria-label="T">
          <Toolbar.Separator
            className={(s) => `sep-${s.orientation}`}
            render={<div role="separator" />}
          />
        </Toolbar.Root>,
      );
      const sep = screen.getByRole("separator");
      expect(sep.tagName).toBe("DIV");
      expect(sep).toHaveClass("sep-vertical");
    });
  });

  describe("keyboard (row 12)", () => {
    const matrix = [
      ["horizontal", true, "One", "ArrowRight", "Two"],
      ["horizontal", true, "Two", "ArrowRight", "Three"], // skips the disabled button
      ["horizontal", true, "Four", "ArrowRight", "Five"], // aria-disabled is reachable
      ["horizontal", true, "Five", "ArrowRight", "One"],
      ["horizontal", false, "Five", "ArrowRight", "Five"],
      ["horizontal", true, "One", "ArrowLeft", "Five"],
      ["horizontal", false, "One", "ArrowLeft", "One"],
      ["horizontal", true, "One", "ArrowDown", "One"],
      ["horizontal", true, "Three", "Home", "One"],
      ["horizontal", true, "One", "End", "Five"],
      ["vertical", true, "One", "ArrowDown", "Two"],
      ["vertical", true, "One", "ArrowUp", "Five"],
      ["vertical", false, "One", "ArrowUp", "One"],
      ["vertical", true, "One", "ArrowRight", "One"],
      ["vertical", true, "Three", "Home", "One"],
      ["vertical", true, "One", "End", "Five"],
    ] as const;

    it.each(matrix)("%s loop=%s: %s + %s → %s", (orientation, loop, start, key, expected) => {
      render(<Mixed orientation={orientation} loop={loop} />);
      const from = screen.getByText(start);
      act(() => from.focus());
      const event = press(from, key);
      expect(screen.getByText(expected)).toHaveFocus();
      const onAxis =
        orientation === "horizontal"
          ? key === "ArrowLeft" || key === "ArrowRight"
          : key === "ArrowUp" || key === "ArrowDown";
      expect(event.defaultPrevented).toBe(onAxis || key === "Home" || key === "End");
    });

    it("RTL swaps the horizontal arrows", () => {
      render(<Mixed rtl />);
      act(() => button("One").focus());
      press(button("One"), "ArrowLeft");
      expect(button("Two")).toHaveFocus();
      press(button("Two"), "ArrowRight");
      expect(button("One")).toHaveFocus();
    });

    it("modifier keys and already-handled keys are ignored", () => {
      render(<Mixed />);
      act(() => button("One").focus());
      press(button("One"), "ArrowRight", { ctrlKey: true });
      expect(button("One")).toHaveFocus();
      const handled = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      handled.preventDefault();
      act(() => {
        button("One").dispatchEvent(handled);
      });
      expect(button("One")).toHaveFocus();
    });

    it("one tab stop: first entry on the first enabled item, re-entry on the last focused", async () => {
      render(<Mixed />);
      const user = setupUser();
      expect(tabStops()).toEqual([button("One")]);
      await user.tab();
      await user.tab();
      expect(button("One")).toHaveFocus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(button("Three")).toHaveFocus();
      await user.tab();
      expect(button("after")).toHaveFocus();
      await user.tab({ shift: true });
      expect(button("Three")).toHaveFocus();
      // From body.
      act(() => (document.activeElement as HTMLElement).blur());
      await user.tab();
      await user.tab();
      expect(button("Three")).toHaveFocus();
    });

    it("first entry lands on an aria-disabled first item, as native focusgroup does", () => {
      render(
        <Toolbar.Root aria-label="T">
          <Toolbar.Button disabled>Dead</Toolbar.Button>
          <Toolbar.Button>Live</Toolbar.Button>
        </Toolbar.Root>,
      );
      expect(tabStops()).toEqual([button("Dead")]);
    });

    it("a click (pointerdown) makes the item the stop", () => {
      render(<Mixed />);
      fireEvent.pointerDown(screen.getByText("Four"));
      expect(tabStops()).toEqual([screen.getByText("Four")]);
    });

    it("the remembered item unmounting moves the stop to the first enabled item", async () => {
      function Removable() {
        const [shown, setShown] = useState(true);
        return (
          <Toolbar.Root aria-label="T">
            <Toolbar.Button>First</Toolbar.Button>
            {shown && <Toolbar.Button action={() => setShown(false)}>Gone</Toolbar.Button>}
          </Toolbar.Root>
        );
      }
      render(<Removable />);
      const user = setupUser();
      await user.click(button("Gone"));
      expect(screen.queryByRole("button", { name: "Gone" })).toBeNull();
      expect(tabStops()).toEqual([button("First")]);
    });

    it("server HTML carries no tabindex", () => {
      const html = renderToString(
        <Toolbar.Root aria-label="T">
          <Toolbar.Button>A</Toolbar.Button>
          <button type="button">B</button>
        </Toolbar.Root>,
      );
      expect(html).not.toContain("tabindex");
      expect(html).toContain('role="toolbar"');
    });
  });

  describe("text-entry items (row 13)", () => {
    function Fields({ last = false }: { last?: boolean }) {
      return (
        <>
          <Toolbar.Root aria-label="T">
            <Toolbar.Button>A</Toolbar.Button>
            <input type="text" aria-label="text" />
            <textarea aria-label="area" />
            <div
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="rich"
              tabIndex={0}
            >
              rich
            </div>
            <div role="spinbutton" aria-label="spin" tabIndex={0} />
            {!last && <Toolbar.Button>Z</Toolbar.Button>}
            {last && <input type="text" aria-label="last" />}
          </Toolbar.Root>
          <button type="button">after</button>
        </>
      );
    }

    it.each(["text", "area", "rich", "spin"])("%s keeps its arrows, Home and End", (name) => {
      render(<Fields />);
      const el = screen.getByRole(name === "spin" ? "spinbutton" : "textbox", { name });
      act(() => el.focus());
      for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) {
        const event = press(el, key);
        expect(event.defaultPrevented).toBe(false);
        expect(el).toHaveFocus();
      }
    });

    it("Tab from the input moves to the next item, Shift+Tab to the previous", async () => {
      render(<Fields />);
      const user = setupUser();
      const input = screen.getByRole("textbox", { name: "text" });
      act(() => input.focus());
      await user.tab();
      expect(screen.getByRole("textbox", { name: "area" })).toHaveFocus();
      act(() => input.focus());
      await user.tab({ shift: true });
      expect(button("A")).toHaveFocus();
    });

    it("Tab from a last-placed input leaves the toolbar", async () => {
      render(<Fields last />);
      const user = setupUser();
      act(() => screen.getByRole("textbox", { name: "last" }).focus());
      await user.tab();
      expect(button("after")).toHaveFocus();
    });
  });

  describe("ToggleGroup inside a Toolbar (row 14)", () => {
    it("joins the Toolbar's single sequence; clicks still dispatch", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const action = vi.fn<(next: string[]) => void>();
      render(
        <Toolbar.Root aria-label="T" orientation="vertical">
          <Toolbar.Button>Before</Toolbar.Button>
          <ToggleGroup.Root aria-label="Style" defaultValue={["i"]} valueChangeAction={action}>
            <ToggleGroup.Item value="b">B</ToggleGroup.Item>
            <ToggleGroup.Item value="x" disabled>
              X
            </ToggleGroup.Item>
            <ToggleGroup.Item value="i">I</ToggleGroup.Item>
          </ToggleGroup.Root>
          <Toolbar.Button>After</Toolbar.Button>
        </Toolbar.Root>,
      );
      expect(tabStops()).toEqual([button("Before")]);
      const group = screen.getByRole("group", { name: "Style" });
      expect(group).toHaveAttribute("data-orientation", "vertical");
      expect(button("B")).toHaveAttribute("data-orientation", "vertical");

      act(() => button("Before").focus());
      press(button("Before"), "ArrowDown");
      expect(button("B")).toHaveFocus();
      press(button("B"), "ArrowDown");
      expect(button("I")).toHaveFocus();
      press(button("I"), "ArrowDown");
      expect(button("After")).toHaveFocus();
      // The perpendicular axis does nothing on an Item.
      act(() => button("B").focus());
      press(button("B"), "ArrowRight");
      expect(button("B")).toHaveFocus();
      expect(tabStops()).toEqual([button("B")]);

      await setupUser().click(button("B"));
      expect(action.mock.calls[0]?.[0]).toEqual(["b", "i"]);
    });

    it("the group renders no focusgroup and warns for each ignored prop once", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { rerender } = render(
        <Toolbar.Root aria-label="T">
          <ToggleGroup.Root
            aria-label="Style"
            experimental_focusgroup
            orientation="vertical"
            loop={false}
          >
            <ToggleGroup.Item value="b">B</ToggleGroup.Item>
            <ToggleGroup.Item value="i">I</ToggleGroup.Item>
          </ToggleGroup.Root>
        </Toolbar.Root>,
      );
      rerender(
        <Toolbar.Root aria-label="T">
          <ToggleGroup.Root
            aria-label="Style"
            experimental_focusgroup
            orientation="vertical"
            loop={false}
          >
            <ToggleGroup.Item value="b">B</ToggleGroup.Item>
            <ToggleGroup.Item value="i">I</ToggleGroup.Item>
          </ToggleGroup.Root>
        </Toolbar.Root>,
      );
      const group = screen.getByRole("group");
      expect(group).not.toHaveAttribute("focusgroup");
      expect(group).toHaveAttribute("data-orientation", "horizontal");
      const messages = error.mock.calls.map(([m]) => String(m));
      for (const prop of ["`orientation`", "`loop`", "`experimental_focusgroup`"]) {
        expect(messages.filter((m) => m.includes(prop) && m.includes("ignored"))).toHaveLength(1);
      }
      // Loop off on the group is ignored: the Toolbar wraps.
      act(() => button("I").focus());
      press(button("I"), "ArrowRight");
      expect(button("B")).toHaveFocus();
    });
  });

  describe("Menu.Trigger in a Toolbar (row 15)", () => {
    function WithMenu({
      orientation,
      rtl = false,
    }: {
      orientation?: "horizontal" | "vertical";
      rtl?: boolean;
    }) {
      return (
        <Toolbar.Root
          aria-label="T"
          orientation={orientation}
          style={rtl ? { direction: "rtl" } : undefined}
        >
          <Toolbar.Button>Before</Toolbar.Button>
          <Menu.Root>
            <Menu.Trigger>Insert</Menu.Trigger>
            <Menu.Popup data-testid="popup">
              <Menu.Item>Image</Menu.Item>
              <Menu.Item>Table</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
          <Toolbar.Button>After</Toolbar.Button>
        </Toolbar.Root>
      );
    }
    const isOpen = () => screen.getByTestId("popup").matches(":popover-open");

    it("horizontal: ArrowDown opens and the toolbar does not move; ArrowRight moves on", async () => {
      render(<WithMenu />);
      act(() => button("Insert").focus());
      const right = press(button("Insert"), "ArrowRight");
      expect(right.defaultPrevented).toBe(true);
      expect(button("After")).toHaveFocus();
      expect(isOpen()).toBe(false);

      act(() => button("Insert").focus());
      const down = press(button("Insert"), "ArrowDown");
      expect(down.defaultPrevented).toBe(true);
      expect(button("After")).not.toHaveFocus();
      await flush();
      expect(isOpen()).toBe(true);
    });

    it("vertical: ArrowRight opens; ArrowDown moves to the next item without opening", async () => {
      render(<WithMenu orientation="vertical" />);
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowDown");
      expect(button("After")).toHaveFocus();
      await flush();
      expect(isOpen()).toBe(false);

      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowLeft");
      await flush();
      expect(isOpen()).toBe(false);
      press(button("Insert"), "ArrowRight");
      await flush();
      expect(isOpen()).toBe(true);
      // Opened with the first item focused (Enter would focus it too; the point is the arrow).
      expect(screen.getByRole("menuitem", { name: "Image" })).toHaveFocus();
    });

    it("vertical RTL: ArrowLeft opens", async () => {
      render(<WithMenu orientation="vertical" rtl />);
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowRight");
      await flush();
      expect(isOpen()).toBe(false);
      press(button("Insert"), "ArrowLeft");
      await flush();
      expect(isOpen()).toBe(true);
      expect(screen.getByRole("menuitem", { name: "Image" })).toHaveFocus();
    });

    it("vertical: Enter still opens", async () => {
      render(<WithMenu orientation="vertical" />);
      act(() => button("Insert").focus());
      await setupUser().keyboard("{Enter}");
      await flush();
      expect(isOpen()).toBe(true);
    });

    it("the popup's items are not toolbar items", async () => {
      render(<WithMenu />);
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowDown");
      await flush();
      expect(isOpen()).toBe(true);
      const image = screen.getByRole("menuitem", { name: "Image" });
      // The menu's items keep the Menu's own tabindex; the toolbar wrote only its three items.
      expect(image).toHaveAttribute("tabindex", "-1");
      expect(tabStops()).toEqual([button("Insert")]);
      // End inside the menu is the menu's: the toolbar does not move focus out of it.
      act(() => image.focus());
      press(image, "End");
      expect(screen.getByRole("menuitem", { name: "Table" })).toHaveFocus();
      act(() => screen.getByTestId("popup").hidePopover());
      await flush();
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowRight");
      expect(button("After")).toHaveFocus();
    });
  });

  describe("experimental_focusgroup tokens (row 16)", () => {
    it("renders toolbar inline wrap; vertical + loop={false} gives block nowrap", () => {
      const { unmount } = render(
        <Toolbar.Root aria-label="T" experimental_focusgroup>
          <Toolbar.Button>A</Toolbar.Button>
          <Toolbar.Button>B</Toolbar.Button>
        </Toolbar.Root>,
      );
      expect(toolbar()).toHaveAttribute("focusgroup", "toolbar inline wrap");
      // jsdom has no `focusGroup`: the JS path still runs.
      act(() => button("A").focus());
      press(button("A"), "ArrowRight");
      expect(button("B")).toHaveFocus();
      unmount();

      render(
        <Toolbar.Root aria-label="T" experimental_focusgroup orientation="vertical" loop={false} />,
      );
      expect(toolbar()).toHaveAttribute("focusgroup", "toolbar block nowrap");
    });
  });

  describe("Menu.Trigger outside a Toolbar is unchanged", () => {
    it("ArrowRight does not open; ArrowDown does", async () => {
      render(
        <Menu.Root>
          <Menu.Trigger>Insert</Menu.Trigger>
          <Menu.Popup data-testid="popup">
            <Menu.Item>Image</Menu.Item>
          </Menu.Popup>
        </Menu.Root>,
      );
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowRight");
      await flush();
      expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
      press(button("Insert"), "ArrowDown");
      await flush();
      expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    });
  });

  describe("popups inside a Toolbar reset its context (review finding 4)", () => {
    it("Popover.Popup: a ToggleGroup runs its own engine, a Separator and a Menu.Trigger see no Toolbar", async () => {
      render(
        <Toolbar.Root aria-label="T" orientation="vertical">
          <Toolbar.Button>Before</Toolbar.Button>
          <Popover.Root defaultOpen>
            <Popover.Trigger>More</Popover.Trigger>
            <Popover.Popup data-testid="popover">
              <ToggleGroup.Root aria-label="Inner" defaultValue={["b"]}>
                <ToggleGroup.Item value="a">A</ToggleGroup.Item>
                <ToggleGroup.Item value="b">B</ToggleGroup.Item>
              </ToggleGroup.Root>
              <Toolbar.Separator data-testid="sep" />
              <Menu.Root>
                <Menu.Trigger>Inner menu</Menu.Trigger>
                <Menu.Popup data-testid="inner-menu">
                  <Menu.Item>First</Menu.Item>
                </Menu.Popup>
              </Menu.Root>
            </Popover.Popup>
          </Popover.Root>
        </Toolbar.Root>,
      );
      await flush();
      const group = screen.getByRole("group", { name: "Inner" });
      // Its own orientation and engine: one Tab stop on the pressed Item.
      expect(group).toHaveAttribute("data-orientation", "horizontal");
      expect(button("B")).toHaveAttribute("tabindex", "0");
      expect(button("A")).toHaveAttribute("tabindex", "-1");
      // A plain separator (vertical), not perpendicular to the vertical toolbar.
      expect(screen.getByTestId("sep")).toHaveAttribute("aria-orientation", "vertical");
      // The Menu.Trigger opens on ArrowDown, not on the vertical toolbar's ArrowRight.
      const trigger = button("Inner menu");
      act(() => trigger.focus());
      press(trigger, "ArrowRight");
      await flush();
      expect(screen.getByTestId("inner-menu").matches(":popover-open")).toBe(false);
      press(trigger, "ArrowDown");
      await flush();
      expect(screen.getByTestId("inner-menu").matches(":popover-open")).toBe(true);
      expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus();
    });

    it("Dialog.Popup and Menu.Popup reset it too", async () => {
      render(
        <Toolbar.Root aria-label="T" orientation="vertical">
          <Dialog.Root defaultOpen>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Popup aria-label="D">
              <Toolbar.Separator data-testid="dialog-sep" />
              <ToggleGroup.Root aria-label="In dialog">
                <ToggleGroup.Item value="x">X</ToggleGroup.Item>
              </ToggleGroup.Root>
            </Dialog.Popup>
          </Dialog.Root>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Menu</Menu.Trigger>
            <Menu.Popup>
              <Toolbar.Separator data-testid="menu-sep" />
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Toolbar.Root>,
      );
      await flush();
      expect(screen.getByTestId("dialog-sep")).toHaveAttribute("aria-orientation", "vertical");
      expect(screen.getByTestId("menu-sep")).toHaveAttribute("aria-orientation", "vertical");
      expect(screen.getByRole("group", { name: "In dialog" })).toHaveAttribute(
        "data-orientation",
        "horizontal",
      );
    });
  });
});
