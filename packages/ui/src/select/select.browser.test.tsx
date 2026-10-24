/// <reference types="@vitest/browser-playwright" />
// Select rows that need a real engine (design/components/select.md 14.2): customizable select
// rendering and its degradation, hydration with the real parser (which clones into
// <selectedcontent> before React runs), a pick through the picker, the optimistic value under a
// pending action, the automatic <selectedcontent> refresh, late options while the picker is open,
// form reset and validity, stacking inside Popover / Dialog (with the WebKit 302008 row), the
// accessibility tree (Chromium, CDP) and ViewTransition. Runs in Chromium, Firefox and WebKit.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/select.md):
// - `supportsBaseSelect` (Chromium, Safari 27): the styled picker exists, `:open` can be driven by
//   a pointer. Firefox (default prefs) renders the native select: its popup is not in the page
//   and a headless click does not even match `:open`, so Firefox rows never pointer-open the
//   select and change the value through `selectOptions` (Playwright's `selectOption`).
// - `supportsSelectedContent`: the browser clones the selected option into <selectedcontent>.
//   Elsewhere the element stays empty, which is asserted rather than skipped.
// - No row asserts `document.activeElement` or key sequences while the picker is open (Chromium
//   focuses the option, native keeps the select, Safari's optional WPTs fail).
import { act, render, screen } from "@testing-library/react";
import { startTransition, Suspense, use, useState } from "react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsBaseSelect, supportsSelectedContent } from "../__tests__/engine.js";
import { createSuspender, deferred } from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Popover } from "../popover/index.js";
import { Select } from "./index.js";
import type { SelectValueChangeDetails } from "./index.js";

type ActionFn = (next: string, details: SelectValueChangeDetails) => unknown;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const flush = () =>
  act(async () => {
    await sleep(20);
  });
const sel = () => screen.getByRole("combobox") as HTMLSelectElement;
const content = () => sel().querySelector("selectedcontent")!;
const isOpen = (el: Element = sel()) => el.matches(":open");
/** Changes the value the way a pick does (input + change), in every engine. */
const selectOption = (select: HTMLSelectElement, value: string) =>
  act(async () => {
    await userEvent.selectOptions(select, value);
  });

// Two rules: Firefox drops a whole rule with the unknown `::picker(select)` selector.
const OPT_IN = `
  select { appearance: base-select; }
  select::picker(select) { appearance: base-select; }
`;
let styleElement: HTMLStyleElement;
beforeAll(() => {
  styleElement = document.createElement("style");
  styleElement.textContent = OPT_IN;
  document.head.append(styleElement);
});
afterAll(() => {
  styleElement.remove();
});
afterEach(async () => {
  // Close a picker left open so the next test starts with an interactive page.
  for (const s of document.querySelectorAll("select")) {
    if (s.matches(":open")) s.blur();
  }
  for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close();
  for (const el of document.querySelectorAll<HTMLElement>("[popover]")) {
    if (el.matches(":popover-open")) el.hidePopover();
  }
  vi.restoreAllMocks();
});

function Fruits({
  action,
  value,
  defaultValue = "a",
  children,
  ...rest
}: {
  action?: ActionFn;
  value?: string;
  defaultValue?: string;
  children?: ReactNode;
  name?: string;
  required?: boolean;
}) {
  return (
    <Select.Root
      aria-label="Fruit"
      {...(value === undefined ? { defaultValue } : { value })}
      valueChangeAction={action}
      {...rest}
    >
      <Select.Trigger data-testid="trigger">
        <Select.Value />
      </Select.Trigger>
      {children ?? (
        <>
          <Select.Option value="a">
            <b>Apple</b>
          </Select.Option>
          <Select.Option value="b">
            <b>Banana</b>
          </Select.Option>
          <Select.Option value="c">
            <b>Cherry</b>
          </Select.Option>
        </>
      )}
    </Select.Root>
  );
}

describe("Select (browser)", () => {
  // The feature checks are pinned per engine in __tests__/environment.browser.test.tsx.
  it("degradation: styled button and cloned content with base-select, the native select without; the value contract is identical", async () => {
    const action = vi.fn<ActionFn>();
    render(
      <form data-testid="form">
        <Fruits action={action} defaultValue="b" name="fruit" />
      </form>,
    );
    // Chromium's UA style makes the select's button `display: contents`, so the rendered box to
    // look at is <selectedcontent>'s. Firefox does not render the button at all.
    const box = content().getBoundingClientRect().height;
    if (supportsBaseSelect) {
      expect(box).toBeGreaterThan(0);
      expect(content().innerHTML).toBe("<b>Banana</b>");
    } else {
      expect(box).toBe(0);
      expect(content().innerHTML).toBe("");
    }
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(sel().value).toBe("b");
    expect([...new FormData(form)]).toEqual([["fruit", "b"]]);
    expect(sel().validity.valid).toBe(true);

    await selectOption(sel(), "c");
    expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["c", "activate"]]);
    expect([...new FormData(form)]).toEqual([["fruit", "c"]]);
    if (supportsSelectedContent) expect(content().textContent).toBe("Cherry");
    else expect(content().textContent).toBe("");

    await act(async () => {
      form.reset();
    });
    await flush();
    expect(sel().value).toBe("b");
    if (supportsSelectedContent) expect(content().textContent).toBe("Banana");
    expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
      ["c", "activate"],
      ["b", "platform"],
    ]);
  });

  it("hydration with the real parser: no recoverable error, same <select>, a pre-hydration pick is reconciled once", async () => {
    const action = vi.fn<ActionFn>();
    function App() {
      return (
        <form>
          <Select.Root aria-label="Fruit" name="fruit" defaultValue="a" valueChangeAction={action}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Option value="a">
              <span aria-hidden="true">●</span> <b>Apple</b>
            </Select.Option>
            <Select.Group label="More">
              <Select.GroupLabel>More</Select.GroupLabel>
              <Select.Option value="b">
                <b>Banana</b>
              </Select.Option>
            </Select.Group>
            <Select.Separator />
            <Select.Option value="c">Cherry</Select.Option>
          </Select.Root>
        </form>
      );
    }
    const html = renderToString(<App />);
    const iframe = document.createElement("iframe");
    iframe.srcdoc = `<!doctype html><style>${OPT_IN}</style><div id="root">${html}</div>`;
    const loaded = new Promise((resolve) => (iframe.onload = resolve));
    document.body.append(iframe);
    await loaded;
    try {
      const container = iframe.contentDocument!.getElementById("root")!;
      const select = container.querySelector("select")!;
      const contentBefore = container.querySelector("selectedcontent")!;
      // Chromium and WebKit clone at parse time; that is what hydration must accept.
      expect(contentBefore.textContent).toBe(supportsSelectedContent ? "● Apple" : "");
      // The user picks before hydration.
      select.value = "b";
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));

      const recoverable: unknown[] = [];
      const consoleError = vi.spyOn(console, "error");
      await act(async () => {
        hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(e) });
      });
      await flush();
      expect(recoverable).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(container.querySelector("select")).toBe(select);
      expect(action.mock.calls.map(([n, d]) => [n, d.reason, d.event])).toEqual([
        ["b", "platform", undefined],
      ]);
      expect(select.value).toBe("b");
      if (supportsSelectedContent) expect(contentBefore.textContent).toBe("Banana");

      // Later picks still clone, and go through the library.
      await act(async () => {
        select.value = "c";
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(action.mock.calls.at(-1)?.[0]).toBe("c");
      expect(select.querySelector('option[value="c"]')).toHaveAttribute("data-selected", "");
      if (supportsSelectedContent) expect(contentBefore.textContent).toBe("Cherry");
    } finally {
      iframe.remove();
    }
  });

  it("a pick through the picker: one dispatch, value and content updated, the picker closes", async () => {
    const action = vi.fn<ActionFn>();
    render(<Fruits action={action} />);
    if (!supportsBaseSelect) {
      // Firefox: no in-page picker; the same contract through selectOption.
      await selectOption(sel(), "b");
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b"]);
      expect(sel().value).toBe("b");
      return;
    }
    await user.click(sel());
    await expect.poll(() => isOpen()).toBe(true);
    const banana = sel().querySelector<HTMLOptionElement>('option[value="b"]')!;
    await user.click(banana);
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    const [next, details] = action.mock.calls[0]!;
    expect(next).toBe("b");
    expect(details.reason).toBe("activate");
    expect(details.event?.type).toBe("change");
    expect(sel().value).toBe("b");
    expect(content().textContent).toBe("Banana");
    await expect.poll(() => isOpen()).toBe(false);
  });

  it("optimistic under a pending action: value and content show the pick throughout, and roll back when it fails", async () => {
    const d = deferred();
    function Controlled() {
      const [value, setValue] = useState("a");
      return (
        <Fruits
          value={value}
          action={async (next) => {
            try {
              await d.promise;
            } catch {
              return; // the parent does not adopt a failed value
            }
            startTransition(() => setValue(next));
          }}
        />
      );
    }
    render(<Controlled />);
    await selectOption(sel(), "b");
    for (let i = 0; i < 3; i++) {
      expect(sel().value).toBe("b");
      expect(sel()).toHaveAttribute("data-pending", "");
      if (supportsSelectedContent) expect(content().textContent).toBe("Banana");
      await flush();
    }
    await act(async () => {
      d.reject(new Error("save failed"));
    });
    await flush();
    expect(sel().value).toBe("a");
    expect(sel()).not.toHaveAttribute("data-pending");
    if (supportsSelectedContent) expect(content().textContent).toBe("Apple");
  });

  describe("automatic <selectedcontent> refresh (design 6.3)", () => {
    function Refreshing({
      onSetLabel,
      suspender,
    }: {
      onSetLabel: (set: (label: string) => void) => void;
      suspender: ReturnType<typeof createSuspender>;
    }) {
      const [label, setLabel] = useState("Bee");
      onSetLabel(setLabel);
      return (
        <Fruits>
          <Select.Option value="a">Ant</Select.Option>
          <Select.Option value="b">
            <i>{label}</i>
          </Select.Option>
          <Select.Option value="c">
            <Suspense fallback="Loading cherry">
              <suspender.Suspender value="cherry" />
            </Suspense>
          </Select.Option>
        </Fruits>
      );
    }

    it("re-clones when the selected option's content changes through React, without events", async () => {
      let setLabel!: (label: string) => void;
      const suspender = createSuspender();
      // Inside an async `act`: the option's Suspense boundary suspends on the first render.
      await act(async () => {
        render(<Refreshing onSetLabel={(s) => (setLabel = s)} suspender={suspender} />);
      });
      await selectOption(sel(), "b");
      const changes = vi.fn();
      sel().addEventListener("change", changes);
      sel().addEventListener("input", changes);

      await act(async () => {
        setLabel("Bumblebee");
      });
      await flush();
      expect(sel().selectedIndex).toBe(1);
      expect(changes).not.toHaveBeenCalled();
      if (supportsSelectedContent) {
        expect(content().innerHTML).toBe("<i>Bumblebee</i>");
      } else {
        expect(content().innerHTML).toBe("");
      }

      // A Suspense boundary resolving inside the selected option.
      await selectOption(sel(), "c");
      if (supportsSelectedContent) expect(content().textContent).toBe("Loading cherry");
      await act(async () => {
        suspender.resolve("cherry", "Cherry");
      });
      await flush();
      expect(sel().value).toBe("c");
      if (supportsSelectedContent) expect(content().textContent).toBe("Cherry");
      else expect(content().textContent).toBe("");
    });

    it.runIf(supportsBaseSelect)(
      "with the picker open, the refresh lands and the picker stays open",
      async () => {
        let setLabel!: (label: string) => void;
        await act(async () => {
          render(<Refreshing onSetLabel={(s) => (setLabel = s)} suspender={createSuspender()} />);
        });
        await selectOption(sel(), "b");
        await user.click(sel());
        await expect.poll(() => isOpen()).toBe(true);
        await act(async () => {
          setLabel("Hornet");
        });
        await flush();
        expect(isOpen()).toBe(true);
        expect(content().innerHTML).toBe("<i>Hornet</i>");
        expect(sel().value).toBe("b");
        await user.keyboard("{Escape}");
        await expect.poll(() => isOpen()).toBe(false);
      },
    );
  });

  it.runIf(supportsBaseSelect)(
    "late options while the picker is open: it stays open and the intended option is selected",
    async () => {
      const d = deferred();
      const p = d.promise as Promise<void> & { status?: string };
      p.status = "pending";
      function Late() {
        use(d.promise);
        return (
          <>
            <Select.Option value="a">Apple</Select.Option>
            <Select.Option value="b">Banana</Select.Option>
            <Select.Option value="c">Cherry</Select.Option>
          </>
        );
      }
      const action = vi.fn<ActionFn>();
      await act(async () => {
        render(
          <Select.Root aria-label="Fruit" value="c" valueChangeAction={action}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Suspense
              fallback={
                <Select.Option value="" disabled>
                  Loading…
                </Select.Option>
              }
            >
              <Late />
            </Suspense>
          </Select.Root>,
        );
      });
      expect(sel().selectedIndex).toBe(-1);
      await user.click(sel());
      await expect.poll(() => isOpen()).toBe(true);
      await act(async () => {
        p.status = "fulfilled";
        d.resolve();
      });
      await flush();
      expect(isOpen()).toBe(true);
      expect(sel().value).toBe("c");
      expect(content().textContent).toBe("Cherry");
      expect(action).not.toHaveBeenCalled();
      await user.keyboard("{Escape}");
      await expect.poll(() => isOpen()).toBe(false);
    },
  );

  it("form reset: content shows the reset target, one platform dispatch with the reset event", async () => {
    const action = vi.fn<ActionFn>();
    render(
      <form data-testid="form">
        <Fruits action={action} defaultValue="a" />
      </form>,
    );
    await selectOption(sel(), "c");
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    await flush();
    expect(action).toHaveBeenCalledTimes(2);
    const [next, details] = action.mock.calls[1]!;
    expect(next).toBe("a");
    expect(details.reason).toBe("platform");
    expect(details.event?.type).toBe("reset");
    expect(sel().value).toBe("a");
    if (supportsSelectedContent) expect(content().textContent).toBe("Apple");
  });

  it("validity: required with the placeholder is :user-invalid after a blocked submit, valid after a pick", async () => {
    const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault());
    render(
      <form data-testid="form" onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
        <Fruits defaultValue="" required>
          <Select.Option value="">Choose</Select.Option>
          <Select.Option value="a">Apple</Select.Option>
        </Fruits>
      </form>,
    );
    expect(sel().validity.valueMissing).toBe(true);
    expect(sel().matches(":user-invalid")).toBe(false);
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).requestSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(sel().matches(":user-invalid")).toBe(true);
    await selectOption(sel(), "a");
    expect(sel().matches(":user-invalid")).toBe(false);
    expect(sel().matches(":valid")).toBe(true);
  });

  describe("stacking (design 12)", () => {
    function InPopover() {
      return (
        <Popover.Root>
          <Popover.Trigger data-testid="popover-trigger">Filters</Popover.Trigger>
          <Popover.Popup data-testid="popover" style={{ width: 260, height: 160 }}>
            <Popover.Title>Filters</Popover.Title>
            <Fruits />
          </Popover.Popup>
        </Popover.Root>
      );
    }

    it.runIf(supportsBaseSelect)(
      "inside an open Popover: the picker opens without closing it; Escape closes only the picker",
      async () => {
        render(<InPopover />);
        await user.click(screen.getByTestId("popover-trigger"));
        const popover = screen.getByTestId("popover");
        expect(popover.matches(":popover-open")).toBe(true);
        await user.click(sel());
        await expect.poll(() => isOpen()).toBe(true);
        expect(popover.matches(":popover-open")).toBe(true);
        await user.keyboard("{Escape}");
        await expect.poll(() => isOpen()).toBe(false);
        expect(popover.matches(":popover-open")).toBe(true);
      },
    );

    it.runIf(supportsBaseSelect)(
      "inside a modal Dialog: Escape closes only the picker",
      async () => {
        render(
          <Dialog.Root>
            <Dialog.Trigger data-testid="dialog-trigger">Edit</Dialog.Trigger>
            <Dialog.Popup data-testid="dialog">
              <Dialog.Title>Edit</Dialog.Title>
              <Fruits />
            </Dialog.Popup>
          </Dialog.Root>,
        );
        await user.click(screen.getByTestId("dialog-trigger"));
        const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
        expect(dialog.open).toBe(true);
        await user.click(sel());
        await expect.poll(() => isOpen()).toBe(true);
        await user.keyboard("{Escape}");
        await expect.poll(() => isOpen()).toBe(false);
        expect(dialog.open).toBe(true);
      },
    );

    // WebKit 302008 (`position-try` on a nested popover hangs): the UA styles of
    // `::picker(select)` use try fallbacks, and the picker inside a Popover is a nested popover.
    // Opened twice (the original report hung on the second open) under a test timeout, so a hang
    // fails the row instead of stalling the job. The mitigation, if it hangs, is consumer CSS:
    // `select::picker(select) { position-try-fallbacks: none; }` (design 12).
    it.runIf(browserName === "webkit")(
      "WebKit 302008: the picker inside a Popover opens and closes twice",
      { timeout: 15_000 },
      async () => {
        render(<InPopover />);
        await user.click(screen.getByTestId("popover-trigger"));
        for (let i = 0; i < 2; i++) {
          await user.click(sel());
          await expect.poll(() => isOpen(), { timeout: 3000 }).toBe(true);
          await user.keyboard("{Escape}");
          await expect.poll(() => isOpen(), { timeout: 3000 }).toBe(false);
        }
        expect(screen.getByTestId("popover").matches(":popover-open")).toBe(true);
      },
    );
  });

  it.runIf(browserName === "chromium")(
    "accessibility tree (CDP): combobox named by its label, options named from content, group and separator",
    async () => {
      render(
        <>
          <label htmlFor="fruit">Favourite fruit</label>
          <Select.Root id="fruit" defaultValue="a">
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Option value="a">
              <svg aria-hidden="true" width="8" height="8" /> Apple
            </Select.Option>
            <Select.Group label="Citrus">
              <Select.GroupLabel>Citrus</Select.GroupLabel>
              <Select.Option value="o">Orange</Select.Option>
            </Select.Group>
            <Select.Separator />
            <Select.Option value="x" disabled>
              Durian
            </Select.Option>
          </Select.Root>
        </>,
      );
      type AXValue = { value?: unknown };
      type AXNode = {
        role?: AXValue;
        name?: AXValue;
        properties?: { name: string; value: AXValue }[];
      };
      const session = cdp();
      type FrameTree = { frame: { id: string; url: string }; childFrames?: FrameTree[] };
      const { frameTree } = (await session.send("Page.getFrameTree")) as { frameTree: FrameTree };
      const frames: FrameTree[] = [];
      const walk = (t: FrameTree) => {
        frames.push(t);
        t.childFrames?.forEach(walk);
      };
      walk(frameTree);
      const frameId = frames.find((f) => f.frame.url === location.href)?.frame.id;
      const tree = async () =>
        (
          (await session.send("Accessibility.getFullAXTree", { frameId })) as {
            nodes: AXNode[];
          }
        ).nodes;
      const find = (nodes: AXNode[], role: string, name?: string) =>
        nodes.find((n) => n.role?.value === role && (name === undefined || n.name?.value === name));
      const prop = (n: AXNode | undefined, p: string) =>
        n?.properties?.find((x) => x.name === p)?.value.value;

      const combobox = find(await tree(), "combobox", "Favourite fruit");
      expect(combobox).toBeDefined();
      expect(prop(combobox, "hasPopup")).toBe("menu");

      // Options, groups and the separator are in the tree while the picker is open.
      await user.click(sel());
      await expect.poll(() => isOpen()).toBe(true);
      const open = await tree();
      expect(find(open, "option", "Apple")).toBeDefined();
      expect(find(open, "option", "Orange")).toBeDefined();
      expect(find(open, "group")).toBeDefined();
      expect(find(open, "separator")).toBeDefined();
      expect(prop(find(open, "option", "Durian"), "disabled")).toBe(true);
      await user.keyboard("{Escape}");
      await expect.poll(() => isOpen()).toBe(false);
    },
  );

  it("ViewTransition: a pick never starts a document view transition (no part takes `transition`)", async () => {
    const start = vi.fn();
    if (typeof document.startViewTransition === "function") {
      const original = document.startViewTransition.bind(document);
      vi.spyOn(document, "startViewTransition").mockImplementation(((
        arg: Parameters<typeof document.startViewTransition>[0],
      ) => {
        start();
        return original(arg);
      }) as typeof document.startViewTransition);
    }
    const action = vi.fn<ActionFn>();
    render(<Fruits action={action} />);
    await selectOption(sel(), "b");
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });
});
