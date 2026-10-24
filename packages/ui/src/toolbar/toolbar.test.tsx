// Toolbar tests (jsdom), design/components/toggle-group.md section 14 rows 1, 8, 12-17 and 19,
// with `Button` as the command item (Toolbar.Button was removed, design/components/button.md 7.3;
// its action rows live in button.test.tsx). jsdom has no Popover API; the shim in vitest.setup.ts
// provides it for the Menu rows.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { setupUser, flushTasks, silenceErrors } from "../__tests__/helpers.js";
import { Button } from "../button/index.js";
import { Dialog } from "../dialog/index.js";
import { Menu } from "../menu/index.js";
import { Popover } from "../popover/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Toggle } from "../toggle/index.js";
import { ToggleGroup } from "../toggle-group/index.js";
import { Toolbar } from "./index.js";
import type { ToolbarRootState } from "./index.js";

const button = (name: string) => screen.getByRole("button", { name });
const toolbar = () => screen.getByRole("toolbar");
const tabStops = () =>
  [...toolbar().querySelectorAll("[tabindex]")].filter((el) => el.getAttribute("tabindex") === "0");

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

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
        <Button>One</Button>
        <Toggle>Two</Toggle>
        <button type="button" disabled>
          Off
        </button>
        <button type="button">Three</button>
        <a href="#x">Four</a>
        <Button disabled>Five</Button>
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
          <Button>A</Button>
          <Toolbar.Separator data-testid="sep" />
          <Button disabled>B</Button>
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

  describe("function props and render (row 8)", () => {
    it("Root state and Button render as a link get no type; a disabled link does not navigate", async () => {
      const className = vi.fn((s: ToolbarRootState) => `tb-${s.orientation}`);
      const action = vi.fn();
      render(
        <Toolbar.Root aria-label="T" orientation="vertical" className={className}>
          <Button render={<a href="#go" />} action={action}>
            Link
          </Button>
          <Button render={<a href="#no" />} disabled action={action}>
            Dead
          </Button>
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
          <Button disabled>Dead</Button>
          <Button>Live</Button>
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
            <Button>First</Button>
            {shown && <Button action={() => setShown(false)}>Gone</Button>}
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
          <Button>A</Button>
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
            <Button>A</Button>
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
            {!last && <Button>Z</Button>}
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
      silenceErrors();
      const action = vi.fn<(next: string[]) => void>();
      render(
        <Toolbar.Root aria-label="T" orientation="vertical">
          <Button>Before</Button>
          <ToggleGroup.Root aria-label="Style" defaultValue={["i"]} valueChangeAction={action}>
            <ToggleGroup.Item value="b">B</ToggleGroup.Item>
            <ToggleGroup.Item value="x" disabled>
              X
            </ToggleGroup.Item>
            <ToggleGroup.Item value="i">I</ToggleGroup.Item>
          </ToggleGroup.Root>
          <Button>After</Button>
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
      const error = silenceErrors();
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
          <Button>Before</Button>
          <Menu.Root>
            <Menu.Trigger>Insert</Menu.Trigger>
            <Menu.Popup data-testid="popup">
              <Menu.Item>Image</Menu.Item>
              <Menu.Item>Table</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
          <Button>After</Button>
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
      await flushTasks(2);
      expect(isOpen()).toBe(true);
    });

    it("vertical: ArrowRight opens; ArrowDown moves to the next item without opening", async () => {
      render(<WithMenu orientation="vertical" />);
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowDown");
      expect(button("After")).toHaveFocus();
      await flushTasks(2);
      expect(isOpen()).toBe(false);

      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowLeft");
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      press(button("Insert"), "ArrowRight");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      // Opened with the first item focused (Enter would focus it too; the point is the arrow).
      expect(screen.getByRole("menuitem", { name: "Image" })).toHaveFocus();
    });

    it("vertical RTL: ArrowLeft opens", async () => {
      render(<WithMenu orientation="vertical" rtl />);
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowRight");
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      press(button("Insert"), "ArrowLeft");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(screen.getByRole("menuitem", { name: "Image" })).toHaveFocus();
    });

    it("vertical: Enter still opens", async () => {
      render(<WithMenu orientation="vertical" />);
      act(() => button("Insert").focus());
      await setupUser().keyboard("{Enter}");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
    });

    it("the popup's items are not toolbar items", async () => {
      render(<WithMenu />);
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowDown");
      await flushTasks(2);
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
      await flushTasks(2);
      act(() => button("Insert").focus());
      press(button("Insert"), "ArrowRight");
      expect(button("After")).toHaveFocus();
    });
  });

  describe("experimental_focusgroup tokens (row 16)", () => {
    it("renders toolbar inline wrap; vertical + loop={false} gives block nowrap", () => {
      const { unmount } = render(
        <Toolbar.Root aria-label="T" experimental_focusgroup>
          <Button>A</Button>
          <Button>B</Button>
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
      await flushTasks(2);
      expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
      press(button("Insert"), "ArrowDown");
      await flushTasks(2);
      expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    });
  });

  describe("popups inside a Toolbar reset its context (review finding 4)", () => {
    it("Popover.Popup: a ToggleGroup runs its own engine, a Separator and a Menu.Trigger see no Toolbar", async () => {
      render(
        <Toolbar.Root aria-label="T" orientation="vertical">
          <Button>Before</Button>
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
      await flushTasks(2);
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
      await flushTasks(2);
      expect(screen.getByTestId("inner-menu").matches(":popover-open")).toBe(false);
      press(trigger, "ArrowDown");
      await flushTasks(2);
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
      await flushTasks(2);
      expect(screen.getByTestId("dialog-sep")).toHaveAttribute("aria-orientation", "vertical");
      expect(screen.getByTestId("menu-sep")).toHaveAttribute("aria-orientation", "vertical");
      expect(screen.getByRole("group", { name: "In dialog" })).toHaveAttribute(
        "data-orientation",
        "horizontal",
      );
    });
  });

  describe("native radios inside a Toolbar (#74, design 17)", () => {
    /** Row 25/26 fixture: b1, a checked `align` group, b2, an unchecked `size` group, b3. */
    function Radios({ loop }: { loop?: boolean }) {
      return (
        <>
          <button type="button">before</button>
          <Toolbar.Root aria-label="T" loop={loop}>
            <Button>b1</Button>
            <input type="radio" name="align" aria-label="left" />
            <input type="radio" name="align" aria-label="center" defaultChecked />
            <input type="radio" name="align" aria-label="right" />
            <Button>b2</Button>
            <input type="radio" name="size" aria-label="s" />
            <input type="radio" name="size" aria-label="m" />
            <input type="radio" name="size" aria-label="l" />
            <Button>b3</Button>
          </Toolbar.Root>
          <button type="button">after</button>
        </>
      );
    }
    const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
    const checkedNames = () =>
      (screen.getAllByRole("radio") as HTMLInputElement[])
        .filter((r) => r.checked)
        .map((r) => r.getAttribute("aria-label"));
    const from = (el: HTMLElement, key: string, init?: KeyboardEventInit) => {
      act(() => el.focus());
      return press(el, key, init);
    };

    describe("navigation (row 25)", () => {
      it.each([
        ["b1", "ArrowRight", "center"],
        ["b2", "ArrowLeft", "center"],
        ["b2", "ArrowRight", "s"],
        ["b3", "ArrowLeft", "s"],
        ["b2", "Home", "b1"],
        ["b2", "End", "b3"],
      ])("%s + %s lands on %s and checks nothing", (start, key, expected) => {
        render(<Radios />);
        const el = screen.getByRole(start.startsWith("b") ? "button" : "radio", { name: start });
        from(el, key);
        const target = expected.startsWith("b")
          ? button(expected)
          : (radio(expected) as HTMLElement);
        expect(target).toHaveFocus();
        expect(checkedNames()).toEqual(["center"]);
      });

      it("Home / End land on a unit's representative", () => {
        render(
          <Toolbar.Root aria-label="T">
            <input type="radio" name="a" aria-label="a1" />
            <input type="radio" name="a" aria-label="a2" defaultChecked />
            <Button>mid</Button>
            <input type="radio" name="z" aria-label="z1" />
            <input type="radio" name="z" aria-label="z2" />
          </Toolbar.Root>,
        );
        // First entry is the first unit's representative.
        expect(tabStops()).toEqual([radio("a2")]);
        from(button("mid"), "Home");
        expect(radio("a2")).toHaveFocus();
        from(button("mid"), "End");
        expect(radio("z1")).toHaveFocus();
      });

      it("on a radio, every arrow and Home / End is left to the radio group", () => {
        render(<Radios />);
        for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) {
          const event = from(radio("center"), key);
          expect(event.defaultPrevented).toBe(false);
          expect(radio("center")).toHaveFocus();
        }
      });

      it("loop wraps over units: b3 → b1, b1 → b3", () => {
        render(<Radios />);
        from(button("b3"), "ArrowRight");
        expect(button("b1")).toHaveFocus();
        from(button("b1"), "ArrowLeft");
        expect(button("b3")).toHaveFocus();
      });

      it("a button[role=radio] is an ordinary item: the arrows walk through it", () => {
        render(
          <Toolbar.Root aria-label="T">
            <Button>b1</Button>
            <button type="button" role="radio" aria-checked="true">
              r1
            </button>
            <button type="button" role="radio" aria-checked="false">
              r2
            </button>
          </Toolbar.Root>,
        );
        const r1 = screen.getByRole("radio", { name: "r1" });
        from(button("b1"), "ArrowRight");
        expect(r1).toHaveFocus();
        const event = press(r1, "ArrowRight");
        expect(event.defaultPrevented).toBe(true);
        expect(screen.getByRole("radio", { name: "r2" })).toHaveFocus();
      });
    });

    describe("Tab and tabindex (row 26)", () => {
      it("Tab / Shift+Tab from the checked radio go to the adjacent items", async () => {
        render(<Radios />);
        const user = setupUser();
        act(() => radio("center").focus());
        await user.tab();
        expect(button("b2")).toHaveFocus();
        act(() => radio("center").focus());
        await user.tab({ shift: true });
        expect(button("b1")).toHaveFocus();
      });

      it("Tab from an unchecked radio whose sibling is checked visits that sibling first", async () => {
        render(<Radios />);
        const user = setupUser();
        act(() => radio("left").focus());
        await user.tab();
        expect(radio("center")).toHaveFocus();
        await user.tab();
        expect(button("b2")).toHaveFocus();
        act(() => radio("right").focus());
        await user.tab({ shift: true });
        expect(radio("center")).toHaveFocus();
      });

      it.each(["s", "m", "l"])(
        "Tab / Shift+Tab from %s (nothing checked) leave the unit",
        async (name) => {
          render(<Radios />);
          const user = setupUser();
          act(() => radio(name).focus());
          await user.tab();
          expect(button("b3")).toHaveFocus();
          act(() => radio(name).focus());
          await user.tab({ shift: true });
          expect(button("b2")).toHaveFocus();
        },
      );

      it("Tab from the last unit is not handled", () => {
        render(
          <Toolbar.Root aria-label="T">
            <Button>b1</Button>
            <input type="radio" name="z" aria-label="z1" defaultChecked />
            <input type="radio" name="z" aria-label="z2" />
          </Toolbar.Root>,
        );
        expect(from(radio("z1"), "Tab").defaultPrevented).toBe(false);
        expect(from(radio("z1"), "Tab", { shiftKey: true }).defaultPrevented).toBe(true);
        expect(button("b1")).toHaveFocus();
      });

      it("tabindex: 0 on the stop's radio, -1 on the rest of its unit and on other units", () => {
        render(<Radios />);
        // First entry: b1. Every radio is -1.
        expect(tabStops()).toEqual([button("b1")]);
        for (const name of ["left", "center", "right", "s", "m", "l"]) {
          expect(radio(name)).toHaveAttribute("tabindex", "-1");
        }
        from(button("b1"), "ArrowRight"); // lands on the representative
        expect(tabStops()).toEqual([radio("center")]);
        // Focus on an unchecked radio moves the 0 to it.
        act(() => radio("m").focus());
        expect(tabStops()).toEqual([radio("m")]);
        expect(radio("s")).toHaveAttribute("tabindex", "-1");
        expect(radio("center")).toHaveAttribute("tabindex", "-1");
      });

      it("a RadioGroup.Root inside the toolbar is one unit; disabled removes it", () => {
        const { rerender } = render(
          <Toolbar.Root aria-label="T">
            <Button>b1</Button>
            <RadioGroup.Root aria-label="Size" defaultValue="m">
              <RadioGroup.Item value="s" aria-label="s" />
              <RadioGroup.Item value="m" aria-label="m" />
            </RadioGroup.Root>
            <Button>b2</Button>
          </Toolbar.Root>,
        );
        from(button("b1"), "ArrowRight");
        expect(radio("m")).toHaveFocus();
        from(button("b2"), "ArrowLeft");
        expect(radio("m")).toHaveFocus();
        rerender(
          <Toolbar.Root aria-label="T">
            <Button>b1</Button>
            <RadioGroup.Root aria-label="Size" defaultValue="m" disabled>
              <RadioGroup.Item value="s" aria-label="s" />
              <RadioGroup.Item value="m" aria-label="m" />
            </RadioGroup.Root>
            <Button>b2</Button>
          </Toolbar.Root>,
        );
        from(button("b1"), "ArrowRight");
        expect(button("b2")).toHaveFocus();
      });
    });
  });
});
