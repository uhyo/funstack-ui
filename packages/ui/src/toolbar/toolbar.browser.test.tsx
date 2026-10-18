// Toolbar rows that need a real engine (design/components/toggle-group.md 14, rows 20-23): real
// Tab order, the native `focusgroup` path in Chromium against the JS path everywhere (and in
// Chromium without the flag), Safari's click-does-not-focus, and the ViewTransition mount cost.
import { render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ViewTransitionClass } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsFocusgroup } from "../__tests__/engine.js";
import { ToggleGroup } from "../toggle-group/index.js";
import { Toolbar } from "./index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const button = (name: string) => screen.getByRole("button", { name });
const focused = () => document.activeElement;

function Editor({ flag, rtl = false }: { flag: boolean; rtl?: boolean }) {
  return (
    <div style={rtl ? { direction: "rtl" } : undefined}>
      <button type="button">before</button>
      <Toolbar.Root aria-label="Formatting" experimental_focusgroup={flag}>
        <Toolbar.Button>Cut</Toolbar.Button>
        <ToggleGroup.Root aria-label="Style" defaultValue={["i"]}>
          <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
          <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
        </ToggleGroup.Root>
        <button type="button" disabled>
          Off
        </button>
        <Toolbar.Button disabled>Copy</Toolbar.Button>
        <input type="text" aria-label="Size" defaultValue="12" />
        <Toolbar.Button>Paste</Toolbar.Button>
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
});

describe("Toolbar: native focusgroup detection", () => {
  it("Chromium has native focusgroup; Firefox and WebKit do not", () => {
    expect(supportsFocusgroup).toBe(browserName === "chromium");
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

describe("Toolbar.Button view transitions (row 23)", () => {
  async function mountButton(transition: ViewTransitionClass | undefined): Promise<number> {
    let calls = 0;
    const original = document.startViewTransition.bind(document);
    const spy = vi.spyOn(document, "startViewTransition").mockImplementation(((
      arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
    ) => {
      calls++;
      return original(arg);
    }) as typeof document.startViewTransition);
    function Late() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" onClick={() => startTransition(() => setShown(true))}>
            show
          </button>
          <Toolbar.Root aria-label="T">
            <Toolbar.Button>A</Toolbar.Button>
            {shown && (
              <Toolbar.Button {...(transition !== undefined && { transition })}>B</Toolbar.Button>
            )}
          </Toolbar.Root>
        </>
      );
    }
    const { unmount } = render(<Late />);
    // A view transition commits in its callback, after any `act` scope (issue #49).
    type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const actEnvironment = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
    try {
      button("show").click();
      await expect.poll(() => screen.queryByRole("button", { name: "B" })).not.toBeNull();
      await (
        document as Document & { __reactViewTransition?: ViewTransition | null }
      ).__reactViewTransition?.finished.catch(() => {});
    } finally {
      (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    }
    unmount();
    spy.mockRestore();
    return calls;
  }

  it("without `transition` a mount starts no view transition; with `none` it does", async () => {
    expect(await mountButton(undefined)).toBe(0);
    expect(await mountButton("none")).toBe(1);
  });
});
