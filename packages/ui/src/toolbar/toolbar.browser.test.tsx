// Toolbar rows that need a real engine (design/components/toggle-group.md 14, rows 20-23): real
// Tab order, the native `focusgroup` path in Chromium against the JS path everywhere (and in
// Chromium without the flag), Safari's click-does-not-focus, and the ViewTransition mount cost.
import { render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ViewTransitionClass } from "react";
import { describe, expect, it } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsFocusgroup } from "../__tests__/engine.js";
import { Button } from "../button/index.js";
import { Menu } from "../menu/index.js";
import { ToggleGroup } from "../toggle-group/index.js";
import { Toolbar } from "./index.js";
import { outsideAct, spyViewTransitions } from "../__tests__/browser-helpers.js";

const button = (name: string) => screen.getByRole("button", { name });
const focused = () => document.activeElement;

function Editor({ flag, rtl = false }: { flag: boolean; rtl?: boolean }) {
  return (
    <div style={rtl ? { direction: "rtl" } : undefined}>
      <button type="button">before</button>
      <Toolbar.Root aria-label="Formatting" experimental_focusgroup={flag}>
        <Button>Cut</Button>
        <ToggleGroup.Root aria-label="Style" defaultValue={["i"]}>
          <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
          <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
        </ToggleGroup.Root>
        <button type="button" disabled>
          Off
        </button>
        <Button disabled>Copy</Button>
        <input type="text" aria-label="Size" defaultValue="12" />
        <Button>Paste</Button>
      </Toolbar.Root>
      <button type="button">after</button>
    </div>
  );
}

describe.each([
  ["with experimental_focusgroup", true],
  ["without the flag (JS path everywhere)", false],
] as const)("Toolbar keyboard %s (rows 20, 21)", (_label, flag) => {
  const native = flag && supportsFocusgroup;

  it("one Tab stop, arrows, Home / End, disabled skipped, aria-disabled reached, memory", async () => {
    render(<Editor flag={flag} />);
    if (flag) {
      expect(screen.getByRole("toolbar")).toHaveAttribute("focusgroup", "toolbar inline wrap");
    }
    expect(screen.getByRole("group", { name: "Style" })).not.toHaveAttribute("focusgroup");
    // Native: the engine writes no tabindex (Chromium would leave -1 items out of the group).
    await expect.poll(() => button("Italic").getAttribute("tabindex")).toBe(native ? null : "-1");

    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("Cut"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(button("Bold"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(button("Italic"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(button("Copy"));
    await user.keyboard("{ArrowRight}");
    const size = screen.getByRole("textbox", { name: "Size" });
    await expect.poll(focused).toBe(size);
    // The input keeps its arrows; Shift+Tab / Tab move to the previous / next item.
    await user.keyboard("{ArrowLeft}");
    expect(focused()).toBe(size);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(button("Copy"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(size);
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("Paste"));
    await user.keyboard("{ArrowRight}"); // wraps
    await expect.poll(focused).toBe(button("Cut"));
    await user.keyboard("{End}");
    await expect.poll(focused).toBe(button("Paste"));
    await user.keyboard("{Home}");
    await expect.poll(focused).toBe(button("Cut"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(button("Bold"));

    // Out and back in: the last focused item; the nested group adds no Tab stop.
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("after"));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(button("Bold"));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(button("before"));
  });

  it("RTL mirrors the horizontal arrows", async () => {
    render(<Editor flag={flag} rtl />);
    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("Cut"));
    await user.keyboard("{ArrowLeft}");
    await expect.poll(focused).toBe(button("Bold"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(button("Cut"));
  });

  it("first entry lands on an aria-disabled first item (review finding 1)", async () => {
    render(
      <>
        <button type="button">before</button>
        <Toolbar.Root aria-label="T" experimental_focusgroup={flag}>
          <Button disabled>Dead</Button>
          <Button>Live</Button>
        </Toolbar.Root>
      </>,
    );
    await expect.poll(() => button("Live").getAttribute("tabindex")).toBe(native ? null : "-1");
    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("Dead"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(button("Live"));
  });

  it("vertical with loop={false}: Up / Down move, the ends do not wrap, Left / Right do nothing", async () => {
    render(
      <>
        <button type="button">before</button>
        <Toolbar.Root
          aria-label="Tools"
          orientation="vertical"
          loop={false}
          experimental_focusgroup={flag}
        >
          <Button>Select</Button>
          <Button>Draw</Button>
          <Button>Erase</Button>
        </Toolbar.Root>
      </>,
    );
    if (flag) {
      expect(screen.getByRole("toolbar")).toHaveAttribute("focusgroup", "toolbar block nowrap");
    }
    await expect.poll(() => button("Draw").getAttribute("tabindex")).toBe(native ? null : "-1");
    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("Select"));
    await user.keyboard("{ArrowUp}"); // no wrap
    expect(focused()).toBe(button("Select"));
    await user.keyboard("{ArrowDown}");
    await expect.poll(focused).toBe(button("Draw"));
    await user.keyboard("{ArrowRight}"); // the other axis
    expect(focused()).toBe(button("Draw"));
    await user.keyboard("{End}");
    await expect.poll(focused).toBe(button("Erase"));
    await user.keyboard("{ArrowDown}"); // no wrap
    expect(focused()).toBe(button("Erase"));
    await user.keyboard("{Home}");
    await expect.poll(focused).toBe(button("Select"));
  });

  it.each(["horizontal", "vertical"] as const)(
    "%s: a Menu.Trigger opens on its perpendicular arrow with the first item focused; the toolbar arrows move on",
    async (orientation) => {
      render(
        <Toolbar.Root aria-label="T" orientation={orientation} experimental_focusgroup={flag}>
          <Button>Before</Button>
          <Menu.Root>
            <Menu.Trigger>Insert</Menu.Trigger>
            <Menu.Popup data-testid="popup" side={orientation === "vertical" ? "right" : "bottom"}>
              <Menu.Item>Image</Menu.Item>
              <Menu.Item>Table</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
          <Button>After</Button>
        </Toolbar.Root>,
      );
      const [next, open] =
        orientation === "horizontal" ? ["ArrowRight", "ArrowDown"] : ["ArrowDown", "ArrowRight"];
      const popup = screen.getByTestId("popup");
      button("Insert").focus();
      // The toolbar's own arrow moves past the trigger without opening the menu.
      await user.keyboard(`{${next}}`);
      await expect.poll(focused).toBe(button("After"));
      expect(popup.matches(":popover-open")).toBe(false);

      button("Insert").focus();
      await user.keyboard(`{${open}}`);
      await expect.poll(() => popup.matches(":popover-open")).toBe(true);
      await expect.poll(focused).toBe(screen.getByRole("menuitem", { name: "Image" }));
      // Inside the menu, the arrows are the menu's, not the toolbar's.
      await user.keyboard("{ArrowDown}");
      await expect.poll(focused).toBe(screen.getByRole("menuitem", { name: "Table" }));
      await user.keyboard("{Escape}");
      await expect.poll(() => popup.matches(":popover-open")).toBe(false);
      await expect.poll(focused).toBe(button("Insert"));
      await user.keyboard(`{${next}}`);
      await expect.poll(focused).toBe(button("After"));
    },
  );
});

describe.each([
  ["with experimental_focusgroup", true],
  ["without the flag (JS path everywhere)", false],
] as const)("native radios inside a Toolbar %s (#74, row 27)", (_label, flag) => {
  function Radios() {
    return (
      <>
        <button type="button">before</button>
        <Toolbar.Root aria-label="T" experimental_focusgroup={flag}>
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
  const checked = () =>
    (screen.getAllByRole("radio") as HTMLInputElement[])
      .filter((r) => r.checked)
      .map((r) => r.getAttribute("aria-label"));

  it("arrows land on the unit's representative, then check and wrap within the group; Tab leaves", async () => {
    render(<Radios />);
    const native = flag && supportsFocusgroup;
    await expect.poll(() => button("b2").getAttribute("tabindex")).toBe(native ? null : "-1");

    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("b1"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(radio("center"));
    expect(checked()).toEqual(["center"]);
    // The group's own arrows: check as they move, wrap within the group, both axes.
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(radio("right"));
    await user.keyboard("{ArrowRight}"); // trapped: never leaves the group
    if (browserName === "webkit") {
      // WebKit's own radio navigation stops at the group's last radio instead of wrapping
      // (memo/developer/cross-engine.md); the toolbar still does not take the key.
      await expect.poll(focused).toBe(radio("right"));
      await user.keyboard("{ArrowLeft}{ArrowLeft}");
    }
    await expect.poll(focused).toBe(radio("left"));
    await user.keyboard("{ArrowDown}");
    await expect.poll(focused).toBe(radio("center"));
    expect(checked()).toEqual(["center"]);
    await user.keyboard("{Home}");
    expect(focused()).toBe(radio("center"));
    // Leave with Tab.
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("b2"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(radio("s")); // none checked: the first radio
    expect(checked()).toEqual(["center"]);
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("b3"));
    await user.keyboard("{ArrowLeft}");
    await expect.poll(focused).toBe(radio("s"));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(button("b2"));
    await user.keyboard("{ArrowLeft}");
    await expect.poll(focused).toBe(radio("center"));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(button("b1"));
  });

  it("Tab from an unchecked radio visits the checked sibling; memory re-enters on the remembered radio", async () => {
    render(<Radios />);
    await expect
      .poll(() => button("b2").getAttribute("tabindex"))
      .toBe(flag && supportsFocusgroup ? null : "-1");
    radio("left").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(radio("center"));
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("b2"));

    // Arrow into the align group and move to `right` (now checked), then leave and come back.
    await user.keyboard("{ArrowLeft}");
    await expect.poll(focused).toBe(radio("center"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(radio("right"));
    expect(checked()).toEqual(["right"]);
    button("after").focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(radio("right"));
  });
});

describe("Toolbar: a click makes the item the Tab stop (row 22)", () => {
  it("Tab from outside lands on the clicked item, also where a click does not focus", async () => {
    render(<Editor flag={false} />);
    await user.click(button("Paste"));
    // WebKit does not focus a button on click; the pointerdown memory still moves the stop.
    await expect.poll(() => button("Paste").getAttribute("tabindex")).toBe("0");
    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("Paste"));
  });
});

describe("Button view transitions in a Toolbar (row 23)", () => {
  async function mountButton(transition: ViewTransitionClass | undefined): Promise<number> {
    const vt = spyViewTransitions();
    function Late() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" onClick={() => startTransition(() => setShown(true))}>
            show
          </button>
          <Toolbar.Root aria-label="T">
            <Button>A</Button>
            {shown && <Button {...(transition !== undefined && { transition })}>B</Button>}
          </Toolbar.Root>
        </>
      );
    }
    const { unmount } = render(<Late />);
    // A view transition commits in its callback, after any `act` scope (issue #49).
    await outsideAct(async () => {
      button("show").click();
      await expect.poll(() => screen.queryByRole("button", { name: "B" })).not.toBeNull();
    });
    unmount();
    vt.restore();
    return vt.calls();
  }

  it("without `transition` a mount starts no view transition; with `none` it does", async () => {
    expect(await mountButton(undefined)).toBe(0);
    expect(await mountButton("none")).toBe(1);
  });
});
