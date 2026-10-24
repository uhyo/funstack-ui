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
import {
  anchorPositionHonoursParentDirection,
  browserName,
  supportsAriaNotify,
} from "../__tests__/engine.js";
import { deferred } from "../__tests__/helpers.js";
import { mouse } from "../__tests__/browser-commands.js";
import { Dialog } from "../dialog/index.js";
import { Field } from "../field/index.js";
import { Popover } from "../popover/index.js";
import { Combobox } from "./index.js";
import type {
  ComboboxInputValueChangeDetails,
  ComboboxOpenChangeDetails,
  ComboboxPopupProps,
  ComboboxRootProps,
  ComboboxValueChangeDetails,
} from "./index.js";
import {
  addStyle,
  closeOpenTopLayer,
  flushFor,
  onCleanup,
  runCleanups,
  settle,
  leaveActEnvironment,
  spyViewTransitions,
  quietPeriod,
  sleep,
} from "../__tests__/browser-helpers.js";

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
const labelStyle = { display: "inline-block", padding: 8 } as const;

interface HarnessProps {
  root?: Partial<ComboboxRootProps>;
  popup?: Partial<ComboboxPopupProps>;
  results?: (query: string) => ReactNode;
}

function Box({ root, popup, results }: HarnessProps) {
  return (
    <Combobox.Root {...root}>
      <Combobox.Label style={labelStyle}>Country</Combobox.Label>
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

async function typeInto(text: string) {
  if (document.activeElement !== input()) await user.click(input());
  await user.keyboard(text);
  await flushFor();
}

afterEach(async () => {
  closeOpenTopLayer();
  runCleanups();
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

    // Page-level RTL. Since wave 11 (#53) the listbox uses the `self-*` keywords
    // (`self-block-end span-self-inline-end`), which resolve against the popup's own inherited
    // direction, so a page and a container both flip it (next row).
    it("aligns the inline-start edges under a page-level dir=rtl (the right edges)", async () => {
      document.documentElement.dir = "rtl";
      onCleanup(() => document.documentElement.removeAttribute("dir"));
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

    it('aligns the right edges inside a dir="rtl" container (Firefox: Mozilla 2019601, asserted)', async () => {
      render(
        <div dir="rtl" style={{ paddingInline: 40 }}>
          <Harness />
        </div>,
      );
      await typeInto("j");
      expect(isOpen()).toBe(true);
      const i = input().getBoundingClientRect();
      const p = popup().getBoundingClientRect();
      expect(Math.abs(p.top - i.bottom)).toBeLessThanOrEqual(1);
      if (anchorPositionHonoursParentDirection) {
        expect(Math.abs(p.right - i.right)).toBeLessThanOrEqual(1);
      } else {
        // Firefox (Mozilla 2019601, #89): the popup's parent box has a direction different from
        // the root's, so the inline alignment inside the cell is mirrored; no workaround ships
        // (conventions 13.3). The listbox meets neither input edge. When this fails, the bug is
        // fixed: delete this branch.
        expect(Math.abs(p.right - i.right)).toBeGreaterThan(1);
        expect(Math.abs(p.left - i.left)).toBeGreaterThan(1);
      }
      // No resolved-placement observer on the listbox (design 7.2).
      expect(popup()).not.toHaveAttribute("data-side");
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
      await settle(() => expect(isOpen()).toBe(false));
      expect(document.activeElement).toBe(input());
    });

    it("the Trigger opens with the input focused; Clear leaves focus in the input", async () => {
      render(<Harness root={{ defaultValue: "fr", defaultInputValue: "France" }} />);
      await user.click(screen.getByTestId("trigger"));
      await settle(() => expect(isOpen()).toBe(true));
      expect(document.activeElement).toBe(input());
      // A second press closes it (decided against the state at pointerdown).
      await user.click(screen.getByTestId("trigger"));
      await settle(() => expect(isOpen()).toBe(false));
      expect(document.activeElement).toBe(input());
      await user.click(screen.getByTestId("clear"));
      await settle(() => expect(document.activeElement).toBe(input()));
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
      await user.clear(input());
      await user.keyboard("Ja");
      await settle(() => expect(isOpen()).toBe(true));
      await user.click(screen.getByTestId("page"));
      await settle(() => expect(isOpen()).toBe(false));
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
      await settle(() => expect(isOpen()).toBe(false));
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
      await settle(() => expect(isOpen()).toBe(false));
      expect(dialog.open).toBe(true);
      await user.keyboard("{Escape}");
      await settle(() => expect(dialog.open).toBe(false));
    });

    it("inside a Popover: the first Escape closes the listbox, the second the Popover", async () => {
      render(<InPopover />);
      await user.click(screen.getByTestId("popover-trigger"));
      await flushFor();
      const outer = screen.getByTestId("popover");
      expect(isOpen(outer)).toBe(true);
      await typeInto("j");
      expect(isOpen()).toBe(true);
      expect(isOpen(outer)).toBe(true);
      await user.keyboard("{Escape}");
      await settle(() => expect(isOpen()).toBe(false));
      expect(isOpen(outer)).toBe(true);
      await user.keyboard("{Escape}");
      await settle(() => expect(isOpen(outer)).toBe(false));
    });
  });

  describe("Tab closes", () => {
    it("Tab: focus moves on, the listbox hides, unmatched text reverts", async () => {
      const texts = vi.fn<TextAction>();
      render(
        <Harness
          root={{ defaultValue: "fr", defaultInputValue: "France", onInputValueChange: texts }}
        />,
      );
      await user.click(input());
      await user.clear(input());
      await user.keyboard("Jam");
      await settle(() => expect(isOpen()).toBe(true));
      await user.tab();
      await settle(() => expect(document.activeElement).toBe(screen.getByTestId("after")));
      expect(isOpen()).toBe(false);
      expect(input().value).toBe("France");
      expect(texts.mock.lastCall![1].reason).toBe("dismiss");
    });

    it("Shift+Tab with allowCustomValue: the text is committed", async () => {
      const action = vi.fn<ValueAction>();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action }} />);
      await typeInto("Narnia");
      await user.tab({ shift: true });
      await settle(() => expect(document.activeElement).toBe(screen.getByTestId("before")));
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenCalledWith("Narnia", expect.anything());
      expect(action.mock.calls[0]![1].custom).toBe(true);
      expect(action.mock.calls[0]![1].event?.type).toBe("focusout");
    });
  });

  // Issue #111: a press on a `<label for=input>` blurs the input with `relatedTarget === null`
  // at `mousedown`; the label's activation refocuses it at `click`. The leave check waits for the
  // `pointerup` (the click runs in the same task), so the typed text survives on every engine
  // however long the press is held. The listbox itself closes by light dismiss (browser-owned):
  // the label is outside the popup.
  describe("a press on a label is not focus loss (#111)", () => {
    function InField({ root }: HarnessProps) {
      return (
        <Field.Root>
          <Field.Label data-testid="field-label" style={labelStyle}>
            Country
          </Field.Label>
          <Box root={root} />
        </Field.Root>
      );
    }

    async function press(target: Element, hold: number) {
      const r = target.getBoundingClientRect();
      const x = r.left + 4;
      const y = r.top + 4;
      if (hold === 0) {
        await mouse.click(x, y);
      } else {
        await mouse.down(x, y);
        await sleep(hold);
        await mouse.up(x, y);
      }
    }

    afterEach(async () => {
      await mouse.releaseHeld();
    });

    for (const [where, label] of [
      ["Combobox.Label", () => screen.getByText("Country", { selector: "label" })],
      ["Field.Label", () => screen.getByTestId("field-label")],
    ] as const) {
      for (const [how, hold] of [
        ["a quick click", 0],
        ["a held press (80 ms)", 80],
      ] as const) {
        for (const allowCustomValue of [false, true]) {
          it(`${how} on ${where} keeps the typed text (allowCustomValue: ${allowCustomValue})`, async () => {
            const action = vi.fn<ValueAction>();
            const texts = vi.fn<TextAction>();
            const root = {
              defaultValue: "fr",
              defaultInputValue: "France",
              allowCustomValue,
              valueChangeAction: action,
              onInputValueChange: texts,
            };
            render(where === "Field.Label" ? <InField root={root} /> : <Box root={root} />);
            await user.click(input());
            await user.clear(input());
            await user.keyboard("Ja");
            await settle(() => expect(isOpen()).toBe(true));
            texts.mockClear();
            await press(label(), hold);
            await settle(() => expect(document.activeElement).toBe(input()));
            await flushFor(60);
            expect(input().value).toBe("Ja");
            expect(texts).not.toHaveBeenCalled();
            expect(action).not.toHaveBeenCalled();
            expect(isOpen()).toBe(false);
          });
        }
      }
    }

    it("a held press on the page (no focus target) still reverts once released", async () => {
      const texts = vi.fn<TextAction>();
      render(
        <>
          <div data-testid="page" style={{ height: 80 }}>
            page
          </div>
          <Harness
            root={{ defaultValue: "fr", defaultInputValue: "France", onInputValueChange: texts }}
          />
        </>,
      );
      await user.click(input());
      await user.clear(input());
      await user.keyboard("Ja");
      await settle(() => expect(isOpen()).toBe(true));
      const r = screen.getByTestId("page").getBoundingClientRect();
      await mouse.down(r.left + 4, r.top + 4);
      await flushFor(80);
      // Still held: nothing decided yet.
      expect(input().value).toBe("Ja");
      await mouse.up(r.left + 4, r.top + 4);
      await settle(() => expect(input().value).toBe("France"));
      expect(isOpen()).toBe(false);
      expect(texts.mock.lastCall![1].reason).toBe("dismiss");
      expect(texts.mock.lastCall![1].event?.type).toBe("focusout");
    });

    it("allowCustomValue: a quick click on the page commits the text", async () => {
      const action = vi.fn<ValueAction>();
      render(
        <>
          <div data-testid="page" style={{ height: 80 }}>
            page
          </div>
          <Harness root={{ allowCustomValue: true, valueChangeAction: action }} />
        </>,
      );
      await typeInto("Narnia");
      const r = screen.getByTestId("page").getBoundingClientRect();
      await mouse.click(r.left + 4, r.top + 4);
      await settle(() => expect(action).toHaveBeenCalledWith("Narnia", expect.anything()));
      expect(action.mock.calls[0]![1].event?.type).toBe("focusout");
      expect(isOpen()).toBe(false);
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
    await user.clear(input());
    await user.keyboard("fr");
    await expect.poll(() => optionTexts(), { timeout: 2000 }).toEqual(["France"]);
    expect(screen.getByTestId("list")).not.toHaveAttribute("data-stale");
    // Still pending: the save holds every transition, not the deferred render.
    expect(input()).toHaveAttribute("data-pending", "");
    await act(async () => save.resolve());
    await settle(() => expect(input()).not.toHaveAttribute("data-pending"));
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
    await user.clear(input());
    await user.keyboard("f");
    await settle(() => expect(screen.getByTestId("list")).toHaveAttribute("data-stale", ""));
    await act(async () => search.resolve("f"));
    await expect.poll(() => optionTexts(), { timeout: 2000 }).toEqual(["France"]);
    expect(input()).toHaveAttribute("data-pending", "");
    await act(async () => save.resolve());
    await flushFor();
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
    await settle(() => expect(isOpen()).toBe(false));
    await user.keyboard("{Enter}");
    await flushFor();
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
      await flushFor();
      await typeInto("j");
      const outer = screen.getByTestId("popover");
      expect(isOpen()).toBe(true);
      expect(isOpen(outer)).toBe(true);
      await user.click(screen.getByTestId("outside"));
      await settle(() => expect(isOpen()).toBe(false));
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
        await flushFor();
        expect(getComputedStyle(popup()).getPropertyValue("position-try-fallbacks")).toContain(
          "flip-block",
        );
        for (let i = 0; i < 2; i++) {
          await typeInto(i === 0 ? "j" : "a");
          await settle(() => expect(isOpen()).toBe(true), 3000);
          await user.keyboard("{Escape}");
          await settle(() => expect(isOpen()).toBe(false), 3000);
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
      await settle(() => expect(screen.getByTestId("list")).toHaveAttribute("data-stale", ""));
      expect(calls).toHaveLength(1);
      await act(async () => search.resolve("ja"));
      await settle(() => expect(calls.map((c) => c.message)).toEqual(["3 results", "2 results"]));
    });
  });

  it("text typed before hydration survives, is adopted once with platform, opens nothing", async () => {
    const texts = vi.fn<TextAction>();
    const action = vi.fn<ValueAction>();
    const openAction = vi.fn<OpenAction>();
    function App() {
      return (
        <Combobox.Root
          onInputValueChange={texts}
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
      if (field.value !== "jap" && browserName === "webkit") {
        // WebKit only (unprobed: it cannot run on the development machine): if the real keyboard
        // does not reach into the frame, type the way the parser-built field would receive it.
        // Chromium and Firefox must take the real keyboard path.
        console.warn(`[${browserName}] keyboard did not reach the iframe; typing by script`);
        field.value = "jap";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      expect(field.value).toBe("jap");
      const recoverable: unknown[] = [];
      const consoleError = vi.spyOn(console, "error");
      await act(async () => {
        hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(e) });
      });
      await settle(() => expect(recoverable).toEqual([]));
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
      await settle(() => expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id));
      if (browserName === "chromium") {
        const session = cdp();
        await act(async () => {
          await session.send("Input.imeSetComposition", {
            text: "に",
            selectionStart: 1,
            selectionEnd: 1,
          });
        });
        await settle(() => expect(input().value).toBe("に"));
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
        await settle(() => expect(action).not.toHaveBeenCalled());
        expect(input().value).toBe("に");
        // The composed text is an edit: visual focus went back to the input (APG).
        expect(input()).not.toHaveAttribute("aria-activedescendant");
        await user.keyboard("{ArrowDown}");
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
  let restoreAct: () => void;
  let calls: { openAtStart: boolean }[] = [];
  let transitions: ViewTransition[] = [];

  beforeEach(() => {
    calls = [];
    ({ transitions } = spyViewTransitions(() => {
      const element = document.querySelector("[data-testid=popup]");
      calls.push({ openAtStart: element?.matches(":popover-open") ?? false });
    }));
    restoreAct = leaveActEnvironment();
    addStyle(`
        ::view-transition-old(.pop) { animation: 150ms ease-in both cb-pop-out; }
        ::view-transition-new(.pop) { animation: 150ms ease-out both cb-pop-in; }
        @keyframes cb-pop-out { to { opacity: 0; } }
        @keyframes cb-pop-in { from { opacity: 0; } }
      `);
  });

  afterEach(async () => {
    restoreAct();
    await Promise.allSettled(transitions.map((transition) => transition.finished));
  });

  /** No wrapper element: the Popup's boundary is the top of what a transition inserts. */
  function Plain({ transition, search }: { transition?: ViewTransitionClass; search?: Search }) {
    return (
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Popup data-testid="popup" transition={transition} style={popupStyle}>
          <Combobox.List data-testid="list" aria-label="Country">
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

  /**
   * Types with the real keyboard, outside `act` (in-page events). Every press is followed by an
   * `expect.poll` on what it should cause, which replaces a fixed wait (#101).
   */
  const press = (text: string) => userEvent.keyboard(text);

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
    await quietPeriod(50, "a results change must not start a view transition");
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
    await quietPeriod(50, "no part may start a view transition");
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
