// Combobox rows that need a real engine (design/components/combobox.md 12.2): CSS Anchor
// Positioning (placement, `anchor-size(width)`, logical keywords under RTL, `flip-block`), real
// pointer focus (`pointerdown` / `mousedown` prevented on the popup, the Trigger and Clear),
// Escape through the auto popover's close watcher, Tab through the real focus order, implicit
// form submission, nesting in Popover / Dialog (with the WebKit 302008 row), `ariaNotify`,
// typing before hydration with the real keyboard, ViewTransition around the top-layer element,
// IME composition, and the lane of a deferred results render while a save is pending (the
// verification of design section 4).
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - `supportsAriaNotify`: all three stable engines; the announcement row asserts no throw where
//   a Playwright build lacks it.
// - WebKit 302008 (`position-try-fallbacks` on a nested popover hangs / spins): a WebKit-only
//   row opens the listbox inside an open Popover twice with the default `flip-block` fallback,
//   under a 15 s test timeout, so a hang fails the row instead of stalling the job. The other
//   nested rows run everywhere with the default placement too.
// - IME: Chromium drives a real composition through CDP (`Input.imeSetComposition`); the other
//   engines assert the same guard with a composing `keydown`.
// WebKit cannot run on the development machine (memo/developer/browser-mode.md); its branches
// assert outcomes, not engine-specific sequences.
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { cdp, userEvent } from "vitest/browser";
import { Suspense, use } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsAriaNotify } from "../__tests__/engine.js";
import { deferred } from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Popover } from "../popover/index.js";
import { Combobox } from "./index.js";
import type {
  ComboboxInputValueChangeDetails,
  ComboboxOpenChangeDetails,
  ComboboxPopupProps,
  ComboboxRootProps,
  ComboboxValueChangeDetails,
} from "./index.js";

type ValueAction = (next: string | null, details: ComboboxValueChangeDetails) => unknown;
type TextAction = (next: string, details: ComboboxInputValueChangeDetails) => void;
type OpenAction = (next: boolean, details: ComboboxOpenChangeDetails) => unknown;

const COUNTRIES = [
  { code: "jp", name: "Japan" },
  { code: "jm", name: "Jamaica" },
  { code: "je", name: "Jersey" },
  { code: "fr", name: "France" },
];

function matching(query: string) {
  const q = query.toLowerCase();
  return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
}

function Options({ query }: { query: string }) {
  return matching(query).map((c) => (
    <Combobox.Option key={c.code} value={c.code} data-testid={`opt-${c.code}`} style={optionStyle}>
      {c.name}
    </Combobox.Option>
  ));
}

const popupStyle = { margin: 0, inset: "auto", padding: 0, border: "1px solid" } as const;
const optionStyle = { padding: "2px 4px" } as const;

interface HarnessProps {
  root?: Partial<ComboboxRootProps>;
  popup?: Partial<ComboboxPopupProps>;
  results?: (query: string) => ReactNode;
}

function Box({ root, popup, results }: HarnessProps) {
  return (
    <Combobox.Root {...root}>
      <Combobox.Label>Country</Combobox.Label>
      <Combobox.Input data-testid="input" style={{ width: 200 }} />
      <Combobox.Trigger data-testid="trigger" aria-label="Show all">
        ▾
      </Combobox.Trigger>
      <Combobox.Clear data-testid="clear" aria-label="Clear">
        ×
      </Combobox.Clear>
      <Combobox.Popup data-testid="popup" {...popup} style={{ ...popupStyle, ...popup?.style }}>
        <Combobox.List data-testid="list">
          {({ query }) => (results ? results(query) : <Options query={query} />)}
        </Combobox.List>
        <Combobox.Empty data-testid="empty">No country</Combobox.Empty>
      </Combobox.Popup>
    </Combobox.Root>
  );
}

function Harness(props: HarnessProps) {
  return (
    <>
      <input data-testid="before" aria-label="Before" />
      <Box {...props} />
      <input data-testid="after" aria-label="After" />
    </>
  );
}

const input = () => screen.getByTestId("input") as HTMLInputElement;
const popup = () => screen.getByTestId("popup");
const option = (code: string) => screen.getByTestId(`opt-${code}`);
const isOpen = (element: Element = popup()) => element.matches(":popover-open");
const optionTexts = () => screen.queryAllByRole("option").map((o) => o.textContent);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Lets queued `toggle` tasks and React's follow-up work run. */
const flush = () =>
  act(async () => {
    await sleep(20);
  });

async function typeInto(text: string) {
  if (document.activeElement !== input()) await user.click(input());
  await user.keyboard(text);
  await flush();
}

function addStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

const cleanups: (() => void)[] = [];

afterEach(async () => {
  for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close();
  for (const element of document.querySelectorAll<HTMLElement>("[popover]")) {
    if (element.matches(":popover-open")) element.hidePopover();
  }
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

describe("Combobox (browser)", () => {
  describe("placement and width", () => {
    it("sits below the input, aligned to its inline-start edge, at least as wide", async () => {
      render(<Harness />);
      await typeInto("j");
      expect(isOpen()).toBe(true);
      const i = input().getBoundingClientRect();
      const p = popup().getBoundingClientRect();
      expect(Math.abs(p.top - i.bottom)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.left - i.left)).toBeLessThanOrEqual(1);
      expect(p.width).toBeGreaterThanOrEqual(i.width - 0.5);
    });

    // Page-level RTL. The logical keywords of `position-area` resolve against the popover's
    // containing block, which for a top-layer element is the root: `dir="rtl"` on a container
    // only does not flip them (probed: Chromium 156 keeps the left edges aligned, Firefox 157
    // gives offsets that match neither edge; the `self-` keywords fix Chromium only).
    it("aligns the inline-start edges under a page-level dir=rtl (the right edges)", async () => {
      document.documentElement.dir = "rtl";
      cleanups.push(() => document.documentElement.removeAttribute("dir"));
      render(
        <div style={{ paddingInline: 40 }}>
          <Harness />
        </div>,
      );
      await typeInto("j");
      const i = input().getBoundingClientRect();
      const p = popup().getBoundingClientRect();
      expect(Math.abs(p.right - i.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.top - i.bottom)).toBeLessThanOrEqual(1);
      expect(p.width).toBeGreaterThanOrEqual(i.width - 0.5);
    });

    it("flips above the input near the viewport bottom (flip-block)", async () => {
      render(
        <div style={{ position: "fixed", insetInline: 0, bottom: 4 }}>
          <Harness />
        </div>,
      );
      await typeInto("j");
      const i = input().getBoundingClientRect();
      const p = popup().getBoundingClientRect();
      expect(Math.abs(p.bottom - i.top)).toBeLessThanOrEqual(1);
    });
  });

  describe("focus stays in the input", () => {
    it("a real click on an option keeps focus; dispatches; closes after the action", async () => {
      const save = deferred();
      const action = vi.fn<ValueAction>(() => save.promise);
      render(<Harness root={{ valueChangeAction: action }} />);
      await typeInto("j");
      expect(document.activeElement).toBe(input());
      await user.click(option("jm"));
      expect(document.activeElement).toBe(input());
      expect(action).toHaveBeenCalledWith("jm", expect.anything());
      expect(input().value).toBe("Jamaica");
      expect(isOpen()).toBe(true);
      await act(async () => save.resolve());
      await flush();
      expect(isOpen()).toBe(false);
      expect(document.activeElement).toBe(input());
    });

    it("the Trigger opens with the input focused; Clear leaves focus in the input", async () => {
      render(<Harness root={{ defaultValue: "fr", defaultInputValue: "France" }} />);
      await user.click(screen.getByTestId("trigger"));
      await flush();
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(input());
      // A second press closes it (decided against the state at pointerdown).
      await user.click(screen.getByTestId("trigger"));
      await flush();
      expect(isOpen()).toBe(false);
      expect(document.activeElement).toBe(input());
      await user.click(screen.getByTestId("clear"));
      await flush();
      expect(document.activeElement).toBe(input());
      expect(input().value).toBe("");
    });

    it("a click on the page (no focus target) reverts unmatched text after light dismiss", async () => {
      render(
        <>
          <div data-testid="page" style={{ height: 80 }}>
            page
          </div>
          <Harness root={{ defaultValue: "fr", defaultInputValue: "France" }} />
        </>,
      );
      await user.click(input());
      await userEvent.clear(input());
      await user.keyboard("Ja");
      await flush();
      expect(isOpen()).toBe(true);
      await user.click(screen.getByTestId("page"));
      await flush();
      expect(isOpen()).toBe(false);
      expect(input().value).toBe("France");
    });
  });

  describe("Escape", () => {
    it("the platform closes the listbox; dismiss is notified; focus and text stay", async () => {
      const openAction = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: openAction }} />);
      await typeInto("ja");
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Escape}");
      await flush();
      expect(isOpen()).toBe(false);
      expect(openAction.mock.calls.at(-1)![0]).toBe(false);
      expect(openAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
      expect(document.activeElement).toBe(input());
      expect(input().value).toBe("ja");
      expect(input()).not.toHaveAttribute("aria-activedescendant");
    });

    it("inside a Dialog: the first Escape closes the listbox, the second the Dialog", async () => {
      render(
        <Dialog.Root>
          <Dialog.Trigger data-testid="dialog-trigger">Edit</Dialog.Trigger>
          <Dialog.Popup data-testid="dialog">
            <Dialog.Title>Edit</Dialog.Title>
            <Box />
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await user.click(screen.getByTestId("dialog-trigger"));
      const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
      expect(dialog.open).toBe(true);
      await typeInto("j");
      expect(isOpen()).toBe(true);
      expect(dialog.open).toBe(true);
      await user.keyboard("{Escape}");
      await flush();
      expect(isOpen()).toBe(false);
      expect(dialog.open).toBe(true);
      await user.keyboard("{Escape}");
      await flush();
      expect(dialog.open).toBe(false);
    });

    it("inside a Popover: the first Escape closes the listbox, the second the Popover", async () => {
      render(<InPopover />);
      await user.click(screen.getByTestId("popover-trigger"));
      await flush();
      const outer = screen.getByTestId("popover");
      expect(isOpen(outer)).toBe(true);
      await typeInto("j");
      expect(isOpen()).toBe(true);
      expect(isOpen(outer)).toBe(true);
      await user.keyboard("{Escape}");
      await flush();
      expect(isOpen()).toBe(false);
      expect(isOpen(outer)).toBe(true);
      await user.keyboard("{Escape}");
      await flush();
      expect(isOpen(outer)).toBe(false);
    });
  });

  describe("Tab closes", () => {
    it("Tab: focus moves on, the listbox hides, unmatched text reverts", async () => {
      const texts = vi.fn<TextAction>();
      render(
        <Harness
          root={{ defaultValue: "fr", defaultInputValue: "France", inputValueChangeAction: texts }}
        />,
      );
      await user.click(input());
      await userEvent.clear(input());
      await user.keyboard("Jam");
      await flush();
      expect(isOpen()).toBe(true);
      await user.tab();
      await flush();
      expect(document.activeElement).toBe(screen.getByTestId("after"));
      expect(isOpen()).toBe(false);
      expect(input().value).toBe("France");
      expect(texts.mock.lastCall![1].reason).toBe("dismiss");
    });

    it("Shift+Tab with allowCustomValue: the text is committed", async () => {
      const action = vi.fn<ValueAction>();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action }} />);
      await typeInto("Narnia");
      await user.tab({ shift: true });
      await flush();
      expect(document.activeElement).toBe(screen.getByTestId("before"));
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenCalledWith("Narnia", expect.anything());
      expect(action.mock.calls[0]![1].custom).toBe(true);
      expect(action.mock.calls[0]![1].event?.type).toBe("focusout");
    });
  });

  // Design section 4 claims a deferred render is not a transition and is not held by a pending
  // async action. This row is the verification (walkthrough 6).
  it("typing while a save is pending: the deferred results re-render before the save settles", async () => {
    const save = deferred();
    render(<Harness root={{ valueChangeAction: () => save.promise }} />);
    await typeInto("j");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(option("jp")).toHaveAttribute("data-pending", "");
    await userEvent.clear(input());
    await user.keyboard("fr");
    await expect.poll(() => optionTexts(), { timeout: 2000 }).toEqual(["France"]);
    expect(screen.getByTestId("list")).not.toHaveAttribute("data-stale");
    // Still pending: the save holds every transition, not the deferred render.
    expect(input()).toHaveAttribute("data-pending", "");
    await act(async () => save.resolve());
    await flush();
    expect(input()).not.toHaveAttribute("data-pending");
  });

  it("the same with an async search: the new results load and show while the save is pending", async () => {
    const save = deferred();
    const search = createSearch();
    search.resolve("j");
    render(
      <Harness
        root={{ valueChangeAction: () => save.promise }}
        results={(query) => (
          <Suspense fallback={<Combobox.Status>Searching…</Combobox.Status>}>
            <search.Results query={query} />
          </Suspense>
        )}
      />,
    );
    await typeInto("j");
    await user.keyboard("{ArrowDown}{Enter}");
    await userEvent.clear(input());
    await user.keyboard("f");
    await flush();
    expect(screen.getByTestId("list")).toHaveAttribute("data-stale", "");
    await act(async () => search.resolve("f"));
    await expect.poll(() => optionTexts(), { timeout: 2000 }).toEqual(["France"]);
    expect(input()).toHaveAttribute("data-pending", "");
    await act(async () => save.resolve());
    await flush();
  });

  it("Enter submits with the new value: the hidden input is updated before implicit submission", async () => {
    const submitted: (string | null)[] = [];
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get("tag") as string | null);
        }}
      >
        <Box root={{ allowCustomValue: true, name: "tag" }} />
      </form>,
    );
    await typeInto("Narnia");
    await user.keyboard("{Escape}");
    await flush();
    expect(isOpen()).toBe(false);
    await user.keyboard("{Enter}");
    await flush();
    // Document the engine's order if this ever differs (design 5.3).
    expect(submitted).toEqual(["Narnia"]);
  });

  describe("nested in Popover / Dialog", () => {
    it("opening the listbox keeps the outer Popover open; an outside click closes the stack", async () => {
      render(
        <>
          <button type="button" data-testid="outside">
            Outside
          </button>
          <InPopover />
        </>,
      );
      await user.click(screen.getByTestId("popover-trigger"));
      await flush();
      await typeInto("j");
      const outer = screen.getByTestId("popover");
      expect(isOpen()).toBe(true);
      expect(isOpen(outer)).toBe(true);
      await user.click(screen.getByTestId("outside"));
      await flush();
      expect(isOpen()).toBe(false);
      expect(isOpen(outer)).toBe(false);
    });

    // WebKit 302008 (design 7.3 and 12.2): `position-try-fallbacks` on a nested popover hangs
    // or spins. The listbox keeps `flip-block` by default; opened twice inside an open Popover
    // (the original report hung on the second open) under a test timeout, so a hang fails the
    // row instead of stalling the job. Escape hatch for consumers:
    // `style={{ positionTryFallbacks: "none" }}` on Combobox.Popup.
    it.runIf(browserName === "webkit")(
      "WebKit 302008: the listbox inside a Popover opens and closes twice with flip-block",
      { timeout: 15_000 },
      async () => {
        render(<InPopover />);
        await user.click(screen.getByTestId("popover-trigger"));
        await flush();
        expect(getComputedStyle(popup()).getPropertyValue("position-try-fallbacks")).toContain(
          "flip-block",
        );
        for (let i = 0; i < 2; i++) {
          await typeInto(i === 0 ? "j" : "a");
          await expect.poll(() => isOpen(), { timeout: 3000 }).toBe(true);
          await user.keyboard("{Escape}");
          await expect.poll(() => isOpen(), { timeout: 3000 }).toBe(false);
        }
        expect(screen.getByTestId("popover").matches(":popover-open")).toBe(true);
      },
    );
  });

  describe("announcements", () => {
    it("ariaNotify on the List once per settled result set, none while stale", async () => {
      const calls: { element: Element; message: string }[] = [];
      // `ariaNotify` is not in TypeScript's DOM lib yet.
      type Notifying = { ariaNotify(message: string, options?: object): void };
      const proto = Element.prototype as unknown as Notifying;
      if (supportsAriaNotify) {
        const original = proto.ariaNotify;
        vi.spyOn(proto, "ariaNotify").mockImplementation(function (
          this: Element,
          message: string,
          options?: object,
        ) {
          calls.push({ element: this, message });
          return original.call(this, message, options);
        });
      }
      const search = createSearch();
      search.resolve("j");
      render(<Harness results={(query) => <search.Results query={query} />} />);
      await typeInto("j");
      if (!supportsAriaNotify) {
        // Nothing to announce with, and nothing threw.
        expect(optionTexts()).toHaveLength(3);
        return;
      }
      expect(calls).toEqual([{ element: screen.getByTestId("list"), message: "3 results" }]);
      await user.keyboard("a");
      await flush();
      expect(screen.getByTestId("list")).toHaveAttribute("data-stale", "");
      expect(calls).toHaveLength(1);
      await act(async () => search.resolve("ja"));
      await flush();
      expect(calls.map((c) => c.message)).toEqual(["3 results", "2 results"]);
    });
  });

  it("text typed before hydration survives, is adopted once with platform, opens nothing", async () => {
    const texts = vi.fn<TextAction>();
    const action = vi.fn<ValueAction>();
    const openAction = vi.fn<OpenAction>();
    function App() {
      return (
        <Combobox.Root
          inputValueChangeAction={texts}
          valueChangeAction={action}
          openChangeAction={openAction}
        >
          <Combobox.Label>Country</Combobox.Label>
          <Combobox.Input />
          <Combobox.Popup>
            <Combobox.List>{({ query }) => <Options query={query} />}</Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      );
    }
    const html = renderToString(<App />);
    const iframe = document.createElement("iframe");
    iframe.srcdoc = `<!doctype html><div id="root">${html}</div>`;
    const loaded = new Promise((resolve) => (iframe.onload = resolve));
    document.body.append(iframe);
    await loaded;
    try {
      const container = iframe.contentDocument!.getElementById("root")!;
      const field = container.querySelector("input")!;
      // The real keyboard, before any JS is attached (the locator-based click cannot reach into
      // the iframe, so focus comes from script).
      field.focus();
      await userEvent.keyboard("jap");
      expect(field.value).toBe("jap");
      const recoverable: unknown[] = [];
      const consoleError = vi.spyOn(console, "error");
      await act(async () => {
        hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(e) });
      });
      await flush();
      expect(recoverable).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(container.querySelector("input")).toBe(field);
      expect(field.value).toBe("jap");
      expect(texts.mock.calls.map(([t, d]) => [t, d.reason, d.event])).toEqual([
        ["jap", "platform", undefined],
      ]);
      expect(action).not.toHaveBeenCalled();
      expect(openAction).not.toHaveBeenCalled();
      expect(container.querySelector("[popover]")!.matches(":popover-open")).toBe(false);
    } finally {
      iframe.remove();
      // Firefox keeps keyboard focus in the removed frame otherwise (the next row's keys go
      // nowhere).
      window.focus();
      document.body.focus();
    }
  });

  describe("IME", () => {
    it("composition updates the text and opens; Enter during composition does not accept", async () => {
      const action = vi.fn<ValueAction>();
      render(<Harness root={{ valueChangeAction: action }} results={() => <Options query="" />} />);
      await user.click(input());
      await user.keyboard("{ArrowDown}");
      await flush();
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
      if (browserName === "chromium") {
        const session = cdp();
        await act(async () => {
          await session.send("Input.imeSetComposition", {
            text: "に",
            selectionStart: 1,
            selectionEnd: 1,
          });
        });
        await flush();
        expect(input().value).toBe("に");
        expect(isOpen()).toBe(true);
        // Enter while composing commits the composition, not the active option.
        await act(async () => {
          await session.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "Enter",
            code: "Enter",
            windowsVirtualKeyCode: 229,
          });
          await session.send("Input.insertText", { text: "に" });
        });
        await flush();
        expect(action).not.toHaveBeenCalled();
        expect(input().value).toBe("に");
      } else {
        // The composing keydown is ignored by the library in every engine.
        const composing = new KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: true,
          bubbles: true,
          cancelable: true,
        });
        await act(async () => {
          input().dispatchEvent(composing);
        });
        expect(composing.defaultPrevented).toBe(false);
        expect(action).not.toHaveBeenCalled();
      }
      // Outside a composition Enter accepts as usual.
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenCalledTimes(1);
    });
  });
});

describe("ViewTransition (browser)", () => {
  type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let actEnvironment: boolean | undefined;
  let calls: { openAtStart: boolean }[] = [];
  let transitions: ViewTransition[] = [];

  beforeEach(() => {
    calls = [];
    transitions = [];
    const original = document.startViewTransition.bind(document);
    vi.spyOn(document, "startViewTransition").mockImplementation(((
      arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
    ) => {
      const element = document.querySelector("[data-testid=popup]");
      calls.push({ openAtStart: element?.matches(":popover-open") ?? false });
      const transition = original(arg);
      transitions.push(transition);
      return transition;
    }) as typeof document.startViewTransition);
    actEnvironment = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
    cleanups.push(
      addStyle(`
        ::view-transition-old(.pop) { animation: 150ms ease-in both cb-pop-out; }
        ::view-transition-new(.pop) { animation: 150ms ease-out both cb-pop-in; }
        @keyframes cb-pop-out { to { opacity: 0; } }
        @keyframes cb-pop-in { from { opacity: 0; } }
      `),
    );
  });

  afterEach(async () => {
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    await Promise.allSettled(transitions.map((transition) => transition.finished));
  });

  /** No wrapper element: the Popup's boundary is the top of what a transition inserts. */
  function Plain({ transition, search }: { transition?: ViewTransitionClass; search?: Search }) {
    return (
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Popup data-testid="popup" transition={transition} style={popupStyle}>
          <Combobox.List data-testid="list">
            {({ query }) => (search ? <search.Results query={query} /> : <Options query={query} />)}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    );
  }

  const TYPE_MAP: ViewTransitionClass = {
    "fsui-combobox-open": "pop",
    "fsui-combobox-close": "pop",
    default: "none",
  };

  /** Types one character with the real keyboard, outside `act` (in-page events). */
  async function press(text: string) {
    await userEvent.keyboard(text);
    await sleep(30);
  }

  it("type map with default none: open and accept-close run one each; a results change none", async () => {
    render(<Plain transition={TYPE_MAP} />);
    input().focus();
    await press("j");
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]!.openAtStart).toBe(false);
    await transitions[0]!.finished;
    await press("a");
    await expect.poll(() => optionTexts()).toEqual(["Japan", "Jamaica"]);
    await sleep(50);
    expect(calls).toHaveLength(1);
    option("jm").click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(true);
    await transitions[1]!.ready;
    const oldImages = document
      .getAnimations()
      .filter((animation) =>
        ((animation.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith(
          "::view-transition-old",
        ),
      );
    expect(oldImages.length).toBeGreaterThan(0);
    await transitions[1]!.finished;
    expect(isOpen()).toBe(false);
  });

  it('transition="pop": a results change runs one too (the documented cost)', async () => {
    render(<Plain transition="pop" />);
    input().focus();
    await press("j");
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.finished;
    await press("a");
    await expect.poll(() => optionTexts()).toEqual(["Japan", "Jamaica"]);
    await expect.poll(() => calls.length).toBe(2);
    await transitions[1]!.finished;
  });

  it("without transition: no view transition for an open, a results change or an accept", async () => {
    render(<Plain />);
    input().focus();
    await press("j");
    await expect.poll(() => isOpen()).toBe(true);
    await press("a");
    await expect.poll(() => optionTexts()).toEqual(["Japan", "Jamaica"]);
    option("jm").click();
    await expect.poll(() => isOpen()).toBe(false);
    await sleep(50);
    expect(calls).toHaveLength(0);
  });
});

// --- helpers ---------------------------------------------------------------------------------

function InPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger data-testid="popover-trigger">Filters</Popover.Trigger>
      <Popover.Popup data-testid="popover" aria-label="Filters" style={{ margin: 0 }}>
        <Box />
      </Popover.Popup>
    </Popover.Root>
  );
}

interface TrackedPromise extends Promise<void> {
  status?: "pending" | "fulfilled";
}

type Search = ReturnType<typeof createSearch>;

/** A search cache keyed by query: `<Results query>` suspends until `resolve(query)`. */
function createSearch() {
  const cache = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  const entry = (query: string) => {
    let found = cache.get(query);
    if (found === undefined) {
      const d = deferred();
      (d.promise as TrackedPromise).status = "pending";
      found = { promise: d.promise, resolve: () => d.resolve() };
      cache.set(query, found);
    }
    return found;
  };
  function Results({ query }: { query: string }) {
    use(entry(query).promise);
    return <Options query={query} />;
  }
  return {
    Results,
    resolve(query: string): void {
      const found = entry(query);
      (found.promise as TrackedPromise).status = "fulfilled";
      found.resolve();
    },
  };
}
