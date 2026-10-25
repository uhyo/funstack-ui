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
import { cdp, commands, userEvent } from "vitest/browser";
import { Suspense, use } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import {
  anchorPositionHonoursParentDirection,
  browserName,
  supportsAriaNotify,
} from "../__tests__/engine.js";
import { axProperty, expectInvokerExpanded, getAXNodes } from "../__tests__/ax-tree.js";
import { deferred, PlainButton } from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Field } from "../field/index.js";
import { Popover } from "../popover/index.js";
import { Combobox } from "./index.js";
import type {
  ComboboxInputValueChangeDetails,
  ComboboxOpenChangeDetails,
  ComboboxPopupProps,
  ComboboxRootProps,
  ComboboxTriggerProps,
  ComboboxValueChangeDetails,
} from "./index.js";
import { addExitStyle } from "../__tests__/overlay-browser-suite.js";
import {
  addStyle,
  animationsFinished,
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
import { mouse, toPagePoint } from "../__tests__/browser-commands.js";

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
  trigger?: Partial<ComboboxTriggerProps>;
}

function Box({ root, popup, results, trigger }: HarnessProps) {
  return (
    <Combobox.Root {...root}>
      <Combobox.Label style={labelStyle}>Country</Combobox.Label>
      <Combobox.Input data-testid="input" style={{ width: 200 }} />
      <Combobox.Trigger data-testid="trigger" aria-label="Show all" {...trigger}>
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
      // A second press closes it (the Trigger is an invoker: not a light dismiss, #112).
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

    it("aria-expanded on the Input is false right after Escape, while a slow notification runs (#118)", async () => {
      const work = deferred();
      const openAction = vi.fn<OpenAction>(async (next) => {
        if (!next) await work.promise;
      });
      render(<Harness root={{ openChangeAction: openAction }} />);
      await typeInto("ja");
      await expect.poll(() => isOpen()).toBe(true);
      await expect.poll(() => input().getAttribute("aria-expanded")).toBe("true");
      await user.keyboard("{Escape}");
      await sleep(60);
      expect(isOpen()).toBe(false);
      expect(document.activeElement).toBe(input());
      expect(input()).toHaveAttribute("data-pending", "");
      // The Input is no invoker: every engine reads this attribute (#118 review, M1).
      expect(input()).toHaveAttribute("aria-expanded", "false");
      if (browserName === "chromium") {
        const node = (await getAXNodes()).find((n) => n.role?.value === "combobox");
        expect(node).toBeDefined();
        expect(axProperty(node, "expanded")).toBe(false);
      }
      // The Trigger is a `popovertarget` invoker: no attribute, the browser's state (#121).
      await expectInvokerExpanded(screen.getByTestId("trigger"), popup(), false);
      expect(input()).toHaveAttribute("data-pending", "");
      work.resolve();
      await expect.poll(() => input().hasAttribute("data-pending")).toBe(false);
      expect(input()).toHaveAttribute("aria-expanded", "false");
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

    it("a press on the label dragged off and released on the page reverts (no label click)", async () => {
      const texts = vi.fn<TextAction>();
      render(
        <>
          <Harness
            root={{ defaultValue: "fr", defaultInputValue: "France", onInputValueChange: texts }}
          />
          <div data-testid="page" style={{ height: 80 }}>
            page
          </div>
        </>,
      );
      await user.click(input());
      await user.clear(input());
      await user.keyboard("Ja");
      await settle(() => expect(isOpen()).toBe(true));
      const l = screen.getByText("Country", { selector: "label" }).getBoundingClientRect();
      const p = screen.getByTestId("page").getBoundingClientRect();
      await mouse.down(l.left + 4, l.top + 4);
      await mouse.move(p.left + 4, p.top + 4);
      await flushFor(40);
      expect(input().value).toBe("Ja");
      await mouse.up(p.left + 4, p.top + 4);
      await settle(() => expect(input().value).toBe("France"));
      expect(document.activeElement).not.toBe(input());
      expect(isOpen()).toBe(false);
      expect(texts.mock.lastCall![1].reason).toBe("dismiss");
    });

    it("openOnClick: a label click keeps the text and does not reopen", async () => {
      const action = vi.fn<ValueAction>();
      render(<Box root={{ openOnClick: true, valueChangeAction: action }} />);
      await typeInto("Ja");
      expect(isOpen()).toBe(true);
      await press(screen.getByText("Country", { selector: "label" }), 0);
      await settle(() => expect(document.activeElement).toBe(input()));
      await flushFor(60);
      expect(input().value).toBe("Ja");
      expect(action).not.toHaveBeenCalled();
      // Light dismiss closed it; the label's activation focuses the input but is no click in it.
      expect(isOpen()).toBe(false);
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
          <Combobox.Trigger aria-label="Show all">▾</Combobox.Trigger>
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
      const triggerButton = container.querySelector("button")!;
      const listbox = container.querySelector("[popover]")!;
      // The server HTML's Trigger names no popover (#112, #121): a real click before hydration
      // opens nothing.
      expect(triggerButton.hasAttribute("popovertarget")).toBe(false);
      expect(triggerButton.hasAttribute("commandfor")).toBe(false);
      expect(triggerButton.hasAttribute("command")).toBe(false);
      expect(triggerButton.hasAttribute("aria-expanded")).toBe(false);
      await clickInFrame(iframe, triggerButton);
      expect(listbox.matches(":popover-open")).toBe(false);
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
      expect(listbox.matches(":popover-open")).toBe(false);
      // After hydration the Trigger is the listbox's invoker.
      expect(container.querySelector("button")).toBe(triggerButton);
      expect(triggerButton.getAttribute("popovertarget")).toBe(listbox.id);
      expect(triggerButton.hasAttribute("commandfor")).toBe(false);
      expect(triggerButton.hasAttribute("aria-expanded")).toBe(false);
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
  function Plain({
    transition,
    search,
    className,
  }: {
    transition?: ViewTransitionClass;
    search?: Search;
    className?: string;
  }) {
    return (
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Popup
          data-testid="popup"
          transition={transition}
          className={className}
          style={popupStyle}
        >
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

  /** The `::view-transition-*` pseudo-elements animating now, by name (read at `ready`). */
  function pseudoNames(): string[] {
    return [
      ...new Set(
        document
          .getAnimations()
          .map((animation) => (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "")
          .filter((name) => name.startsWith("::view-transition-")),
      ),
    ].sort();
  }

  /** The popup's images of `kind`: any `::view-transition-<kind>` other than the root's. */
  const popupImages = (kind: "old" | "new") =>
    pseudoNames().filter(
      (name) =>
        name.startsWith(`::view-transition-${kind}(`) && name !== `::view-transition-${kind}(root)`,
    );

  // Design 12.2, as the shared overlay suite's "a CSS exit (recipe=%s)" rows (#132): Chromium
  // keeps a closed popup rendered through its CSS fade, so the accept-close's new snapshot
  // captures it as a live `::view-transition-new` next to the old image (a double image); the
  // docs' recipe cuts the fade while a view transition runs. Firefox closes at once: the old
  // image only either way. WebKit: `display: none` by `ready`, pseudo names unreliable. If the
  // recipe=false row starts failing, an engine changed; re-check the docs' recipe.
  describe.each([false, true])("a CSS exit (recipe=%s)", (recipe) => {
    it("an accepted option has the old image, a live new image only where the box still fades (Chromium, recipe=false); the options are not re-mounted", async () => {
      addExitStyle("fade", "200ms", { openPseudo: ":popover-open", recipe });
      render(<Plain transition={TYPE_MAP} className="fade" />);
      input().focus();
      await press("j");
      await expect.poll(() => calls.length).toBe(1);
      await transitions[0]!.finished;
      await animationsFinished(popup()); // the enter fade
      let mounts = 0;
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element && node.matches('[role="option"], :has([role="option"])')) {
              mounts++;
            }
          }
        }
      });
      observer.observe(popup(), { childList: true, subtree: true });
      option("jm").click();
      await expect.poll(() => calls.length).toBe(2);
      expect(calls[1]!.openAtStart).toBe(true);
      await transitions[1]!.ready;
      const fading = getComputedStyle(popup()).display !== "none";
      const seen = JSON.stringify({ names: pseudoNames(), fading });
      expect(fading, seen).toBe(!recipe && browserName === "chromium");
      if (browserName !== "webkit") {
        expect(popupImages("old").length, seen).toBeGreaterThan(0);
        expect(popupImages("new").length > 0, seen).toBe(fading);
      }
      await transitions[1]!.finished;
      expect(isOpen()).toBe(false);
      await quietPeriod(100, "the release of the hold must not start a view transition");
      expect(calls).toHaveLength(2);
      observer.disconnect();
      expect(mounts).toBe(0);
    });
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

// Design 12.2 "Trigger close (#112)": after hydration the Trigger names the popup
// (`popovertarget`, #121), so a real press on it while the listbox is open is
// not a light dismiss; the click's `requestClose` is the single source of the close. Real mouse
// input (`mouse.down` / `mouse.up`), outside React's act environment so the timing is real. No
// engine branch: WebKit is verified by its CI job.
describe("Trigger close (#112, browser)", () => {
  let restoreAct: () => void;

  beforeEach(() => {
    restoreAct = leaveActEnvironment();
  });

  afterEach(async () => {
    await mouse.releaseHeld();
    restoreAct();
  });

  const trigger = () => screen.getByTestId("trigger");

  function center(element: Element) {
    const r = element.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }

  /** A real press and release on the Trigger. */
  async function pressTrigger() {
    const { x, y } = center(trigger());
    await mouse.down(x, y);
    await mouse.up(x, y);
  }

  /** Records `:popover-open` on every frame until `stop()`. */
  function sampleFrames() {
    const samples: boolean[] = [];
    let id = 0;
    const tick = () => {
      samples.push(isOpen());
      id = requestAnimationFrame(tick);
    };
    tick();
    return {
      samples,
      stop: () => cancelAnimationFrame(id),
    };
  }

  /** A parent that keeps `open={true}` whatever the action does (it refuses every close). */
  function Refusing({ action }: { action: OpenAction }) {
    return <Box root={{ open: true, openChangeAction: action }} />;
  }

  it("keeps the listbox shown, the input focused, the Trigger pending until the action settles", async () => {
    // A deferred, not a fixed window: the AX read below may take any time (#121 review F6).
    const work = deferred();
    const openAction = vi.fn<OpenAction>(async (next) => {
      if (!next) await work.promise;
    });
    render(<Harness root={{ openChangeAction: openAction }} />);
    await pressTrigger();
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => trigger().hasAttribute("data-pending")).toBe(false);
    expect(document.activeElement).toBe(input());
    openAction.mockClear();

    await pressTrigger();
    await sleep(20);
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(trigger()).toHaveAttribute("data-pending", "");
    // Optimistically closed, still shown: exposed expanded, no `aria-expanded` (#118, #121; the AX
    // state on Chromium).
    expect(trigger()).not.toHaveAttribute("data-open");
    await expectInvokerExpanded(trigger(), popup(), true);
    expect(isOpen()).toBe(true);
    expect(trigger()).toHaveAttribute("data-pending", "");
    work.resolve();
    await expect.poll(() => isOpen(), { timeout: 2000 }).toBe(false);
    await expectInvokerExpanded(trigger(), popup(), false);
    expect(document.activeElement).toBe(input());
    expect(openAction).toHaveBeenCalledTimes(1);
    const [next, details] = openAction.mock.calls[0]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.event!.type).toBe("click");
  });

  for (const kind of ["async", "sync"] as const) {
    it(`a controlled parent that refuses the close (${kind} action): the listbox never hides`, async () => {
      const openAction = vi.fn<OpenAction>(kind === "async" ? () => sleep(300) : () => undefined);
      render(<Refusing action={openAction} />);
      await expect.poll(() => isOpen()).toBe(true);
      input().focus();
      // Firefox lands a hide and re-show in one frame, which the sampler cannot see (and which
      // still replays the animations): no `beforetoggle` "closed" at all.
      const toggles: string[] = [];
      popup().addEventListener("beforetoggle", (event) => toggles.push(event.newState));
      const frames = sampleFrames();
      try {
        await pressTrigger();
        await sleep(400);
      } finally {
        frames.stop();
      }
      expect(frames.samples.length).toBeGreaterThan(5);
      expect(frames.samples.every(Boolean)).toBe(true);
      expect(toggles).toEqual([]);
      expect(isOpen()).toBe(true);
      expect(openAction.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[false, "activate"]]);
    });
  }

  it("a link render pressed while open: light-dismissed at the press, one (false, activate), no re-open", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const openAction = vi.fn<OpenAction>();
    render(
      <Harness root={{ openChangeAction: openAction }} trigger={{ render: <a href="#" /> }} />,
    );
    expect(trigger().tagName).toBe("A");
    expect(trigger()).not.toHaveAttribute("popovertarget");
    // No invoker: the link exposes the shown mirror itself (#118, #121).
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    await pressTrigger();
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    await expect.poll(() => trigger().getAttribute("aria-expanded")).toBe("true");
    openAction.mockClear();
    const toggles: string[] = [];
    popup().addEventListener("beforetoggle", (event) => toggles.push(event.newState));
    await pressTrigger();
    await expect.poll(() => isOpen()).toBe(false);
    const frames = sampleFrames();
    try {
      await quietPeriod(200, "the listbox must not re-open");
    } finally {
      frames.stop();
    }
    expect(frames.samples.some(Boolean)).toBe(false);
    expect(toggles).toEqual(["closed"]);
    expect(openAction.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
      [false, "activate", "click"],
    ]);
    expect(location.hash).toBe("");
  });

  it("a disabled component render pressed while shown: light-dismissed, one (false, dismiss), focus stays in the input (#132)", async () => {
    const openAction = vi.fn<OpenAction>();
    render(
      <Harness
        root={{ openChangeAction: openAction }}
        trigger={{ disabled: true, render: <PlainButton /> }}
      />,
    );
    expect(trigger()).toHaveAttribute("aria-disabled", "true");
    // No invoker while disabled and focusable: nothing exempts a press on it from light dismiss.
    expect(trigger()).not.toHaveAttribute("popovertarget");
    input().focus();
    await userEvent.keyboard("j");
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => trigger().getAttribute("aria-expanded")).toBe("true");
    openAction.mockClear();
    await pressTrigger();
    await expect.poll(() => isOpen()).toBe(false);
    await quietPeriod(100, "the listbox must not re-open");
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(input());
    expect(openAction.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[false, "dismiss"]]);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("a click while closed opens once, anchored to the input, at least as wide (no command ran)", async () => {
    const openAction = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: openAction }} />);
    // A command that ran would show the popup first (from the button), then the library again.
    const toggles: string[] = [];
    popup().addEventListener("beforetoggle", (event) => toggles.push(event.newState));
    await pressTrigger();
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    expect(toggles).toEqual(["open"]);
    expect(document.activeElement).toBe(input());
    expect(openAction.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
      [true, "activate", "click"],
    ]);
    const i = input().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    expect(Math.abs(p.left - i.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.top - i.bottom)).toBeLessThanOrEqual(1);
    expect(p.width).toBeGreaterThanOrEqual(i.width - 0.5);
  });

  it("with transition: the Trigger close runs one view transition with the popup's old image", async () => {
    const calls: { openAtStart: boolean }[] = [];
    const { transitions } = spyViewTransitions(() => {
      calls.push({ openAtStart: isOpen() });
    });
    addStyle(`
        ::view-transition-old(.pop) { animation: 150ms ease-in both cb-pop-out; }
        ::view-transition-new(.pop) { animation: 150ms ease-out both cb-pop-in; }
        @keyframes cb-pop-out { to { opacity: 0; } }
        @keyframes cb-pop-in { from { opacity: 0; } }
      `);
    try {
      render(
        <Harness
          popup={{
            transition: {
              "fsui-combobox-open": "pop",
              "fsui-combobox-close": "pop",
              default: "none",
            },
          }}
        />,
      );
      await pressTrigger();
      await expect.poll(() => calls.length).toBe(1);
      await transitions[0]!.finished;
      expect(isOpen()).toBe(true);

      await pressTrigger();
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
      expect(calls).toHaveLength(2);
    } finally {
      await Promise.allSettled(transitions.map((transition) => transition.finished));
    }
  });
});

// #123 (design 5.4, amendment "a press on the Input while open stays open"): `source` is no
// light-dismiss exemption, so a primary press on the Input while the listbox is shown captures the
// pointer to the Popup; the release then lands on the Popup, whose topmost clicked popover is the
// listbox itself. These rows check what the capture must not break: the caret, the double click,
// nesting, touch and the drag-selection (whose Firefox cost the design documents). The plain
// press is #117's row ("a real press while open", below). Outside React's act environment, as
// #117's rows.
describe("Input press (#123, browser)", () => {
  let restoreAct: (() => void) | undefined;

  afterEach(async () => {
    await mouse.releaseHeld();
    restoreAct?.();
    restoreAct = undefined;
  });

  // Ten characters with ordinary-width letters around the boundaries the rows press at (2, 3, 8).
  const TEXT = "Wide Words";

  /** Opens by typing TEXT with every option listed, then leaves the act environment. */
  async function openWithText(root: Partial<ComboboxRootProps> = {}) {
    render(<Harness root={root} results={() => <Options query="" />} />);
    await typeInto(TEXT);
    await settle(() => expect(isOpen()).toBe(true));
    expect(input().value).toBe(TEXT);
    restoreAct = leaveActEnvironment();
  }

  /** Client point of the caret boundary before `input().value[index]`, at mid-height. */
  function caretPoint(index: number) {
    const field = input();
    const style = getComputedStyle(field);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const r = field.getBoundingClientRect();
    const x =
      r.left +
      field.clientLeft +
      parseFloat(style.paddingLeft) +
      context.measureText(field.value.slice(0, index)).width -
      field.scrollLeft;
    return { x, y: r.top + r.height / 2 };
  }

  const selection = () => [input().selectionStart, input().selectionEnd];

  it("a caret click after the third character: the caret lands there, the listbox stays, the click goes to the Popup", async () => {
    const openAction = vi.fn<OpenAction>();
    const valueAction = vi.fn<ValueAction>();
    await openWithText({
      openOnClick: true,
      openChangeAction: openAction,
      valueChangeAction: valueAction,
    });
    openAction.mockClear();
    const clicks: EventTarget[] = [];
    const record = (event: Event) => clicks.push(event.target!);
    document.addEventListener("click", record, true);
    onCleanup(() => document.removeEventListener("click", record, true));
    const { x, y } = caretPoint(3);
    await mouse.down(x, y);
    await sleep(20);
    expect(isOpen()).toBe(true);
    await mouse.up(x, y);
    await quietPeriod(80, "a caret click must neither close nor re-open the listbox");
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe(TEXT);
    expect(selection()).toEqual([3, 3]);
    // Captured: the click is the Popup's, so openOnClick does not run for it.
    expect(clicks).toEqual([popup()]);
    expect(openAction).not.toHaveBeenCalled();
    expect(valueAction).not.toHaveBeenCalled();
  });

  it("closed: a click on the input reaches it (nothing captured) and openOnClick opens", async () => {
    const openAction = vi.fn<OpenAction>();
    render(<Harness root={{ openOnClick: true, openChangeAction: openAction }} />);
    restoreAct = leaveActEnvironment();
    expect(isOpen()).toBe(false);
    const clicks: EventTarget[] = [];
    const captures: EventTarget[] = [];
    const recordClick = (event: Event) => clicks.push(event.target!);
    const recordCapture = (event: Event) => captures.push(event.target!);
    document.addEventListener("click", recordClick, true);
    document.addEventListener("gotpointercapture", recordCapture, true);
    onCleanup(() => {
      document.removeEventListener("click", recordClick, true);
      document.removeEventListener("gotpointercapture", recordCapture, true);
    });
    const r = input().getBoundingClientRect();
    await mouse.click(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    await expect.poll(() => isOpen()).toBe(true);
    expect(captures).toEqual([]);
    expect(clicks).toEqual([input()]);
    expect(document.activeElement).toBe(input());
    expect(openAction.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
      [true, "activate", "click"],
    ]);
  });

  it("a double click on a word selects it; the listbox stays", async () => {
    const openAction = vi.fn<OpenAction>();
    await openWithText({ openChangeAction: openAction });
    openAction.mockClear();
    const from = caretPoint(5);
    const to = caretPoint(10);
    await mouse.dblclick((from.x + to.x) / 2, from.y);
    await quietPeriod(80, "a double click must not close the listbox");
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(selection()).toEqual([5, 10]);
    expect(openAction).not.toHaveBeenCalled();
  });

  // Firefox (design 5.4, the documented cost of the capture): Gecko routes the mouse drag to the
  // capturing element, so a drag-to-select in the field does not extend while the listbox is open
  // and the selection collapses at the press point. Chromium's selection drag ignores pointer
  // capture; WebKit is expected to behave like Chromium. No feature check fits a drag, hence the
  // engine name. If this branch starts failing, Gecko changed: re-check the amendment.
  it("a drag from the second to the eighth character: selects [2, 8] (Firefox: [2, 2], #123's cost); the listbox stays", async () => {
    const openAction = vi.fn<OpenAction>();
    await openWithText({ openChangeAction: openAction });
    openAction.mockClear();
    const from = caretPoint(2);
    const to = caretPoint(8);
    await mouse.down(from.x, from.y);
    await mouse.move((from.x + to.x) / 2, from.y);
    await mouse.move(to.x, to.y);
    await sleep(20);
    await mouse.up(to.x, to.y);
    await quietPeriod(80, "a drag in the field must not close the listbox");
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe(TEXT);
    expect(selection()).toEqual(browserName === "firefox" ? [2, 2] : [2, 8]);
    expect(openAction).not.toHaveBeenCalled();
  });

  it("nested in an open Popover: a press on the input keeps both open", async () => {
    render(<InPopover />);
    await user.click(screen.getByTestId("popover-trigger"));
    await flushFor();
    await typeInto("j");
    const outer = screen.getByTestId("popover");
    await settle(() => expect(isOpen()).toBe(true));
    expect(isOpen(outer)).toBe(true);
    restoreAct = leaveActEnvironment();
    const r = input().getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    await mouse.down(x, y);
    await sleep(20);
    await mouse.up(x, y);
    await quietPeriod(80, "a press on the input must close neither popover");
    expect(isOpen()).toBe(true);
    expect(isOpen(outer)).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("j");
  });

  // Touch needs a `hasTouch` context for Playwright's touchscreen, which this harness does not
  // create (it would turn the whole page into a touch device); Chromium takes CDP touch input
  // without it, as the Menu and NumberField touch rows. The touch compat `mousedown` / `click`
  // come after `pointerup`, so only a capture at `pointerdown` keeps the listbox (design 5.4).
  //
  // Chromium inside a frame (#124, memo/developer/issue-123.md): the capture keeps a touch tap
  // from light-dismissing in a top-level document, but in a same-origin iframe Chromium still
  // hides the listbox at the tap's `click` (mouse presses are fine there; Firefox keeps it open
  // in both; probed in plain DOM with Playwright's touchscreen too). vitest's runner is such a
  // frame, so the frame branch is what runs here; it asserts the documented close, and fails the
  // day Chromium changes.
  it.runIf(browserName === "chromium")(
    "a touch tap on the input (CDP): the listbox stays (Chromium in a frame: dismissed, #124), focus and text kept",
    async () => {
      const openAction = vi.fn<OpenAction>();
      const valueAction = vi.fn<ValueAction>();
      render(<Harness root={{ openChangeAction: openAction, valueChangeAction: valueAction }} />);
      await typeInto("j");
      await settle(() => expect(isOpen()).toBe(true));
      openAction.mockClear();
      restoreAct = leaveActEnvironment();
      const downs: string[] = [];
      const captures: Element[] = [];
      const recordDown = (event: PointerEvent) => downs.push(event.pointerType);
      const recordCapture = (event: Event) => captures.push(event.target as Element);
      const field = input();
      const listbox = popup();
      field.addEventListener("pointerdown", recordDown, true);
      listbox.addEventListener("gotpointercapture", recordCapture);
      onCleanup(() => {
        field.removeEventListener("pointerdown", recordDown, true);
        listbox.removeEventListener("gotpointercapture", recordCapture);
      });
      const r = field.getBoundingClientRect();
      const point = toPagePoint(r.left + r.width / 2, r.top + r.height / 2);
      const session = cdp();
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      await sleep(20);
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await quietPeriod(80, "a tap on the input must not close the listbox (top-level)");
      expect(downs).toEqual(["touch"]);
      expect(captures).toEqual([listbox]);
      expect(document.activeElement).toBe(field);
      expect(field.value).toBe("j");
      expect(valueAction).not.toHaveBeenCalled();
      if (window === window.top) {
        expect(isOpen()).toBe(true);
        expect(openAction).not.toHaveBeenCalled();
      } else {
        expect(isOpen()).toBe(false);
        expect(openAction.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
          [false, "dismiss", "toggle"],
        ]);
      }
    },
  );
});

// --- helpers ---------------------------------------------------------------------------------

/**
 * A real left click on `element` inside `iframe` (a same-origin frame of this test frame);
 * resolves once the frame handled the release and the rest of its task ran.
 */
async function clickInFrame(iframe: HTMLIFrameElement, element: Element): Promise<void> {
  const frame = iframe.getBoundingClientRect();
  const r = element.getBoundingClientRect();
  const { x, y } = toPagePoint(
    frame.left + iframe.clientLeft + r.left + r.width / 2,
    frame.top + iframe.clientTop + r.top + r.height / 2,
  );
  const win = iframe.contentWindow!;
  const handled = new Promise<void>((resolve) => {
    win.addEventListener("pointerup", () => setTimeout(resolve, 0), { capture: true, once: true });
  });
  await commands.mouse("click", x, y);
  await handled;
}

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

// #117: a real press on each part of design 5.4's closing table while the listbox is open, outside
// React's act environment so the engine's focus, light dismiss and `toggle` tasks interleave with
// React's work as on a page. The Trigger is #112's describe above and the labels #111's.
describe("a real press while open (#117, browser)", () => {
  let restoreAct: (() => void) | undefined;

  afterEach(async () => {
    await mouse.releaseHeld();
    restoreAct?.();
    restoreAct = undefined;
  });

  /** Opens by typing `text` (inside act), then leaves the act environment for the press. */
  async function openByTyping(text: string) {
    await typeInto(text);
    await settle(() => expect(isOpen()).toBe(true));
    restoreAct = leaveActEnvironment();
  }

  /** A real press and release at `at` (relative to the element's top-left) or its centre. */
  async function press(target: Element, at?: { x: number; y: number }) {
    const r = target.getBoundingClientRect();
    const x = Math.round(r.left + (at?.x ?? r.width / 2));
    const y = Math.round(r.top + (at?.y ?? r.height / 2));
    await mouse.down(x, y);
    await sleep(20);
    const atPress = { open: isOpen(), focus: document.activeElement };
    await mouse.up(x, y);
    await sleep(20);
    return atPress;
  }

  it("an option: shown and focused through the value action, then the library-owned close ('activate')", async () => {
    const save = deferred();
    const valueAction = vi.fn<ValueAction>(() => save.promise);
    const openAction = vi.fn<OpenAction>();
    render(<Harness root={{ valueChangeAction: valueAction, openChangeAction: openAction }} />);
    await openByTyping("j");
    openAction.mockClear();
    const atPress = await press(option("jm"));
    expect(atPress).toEqual({ open: true, focus: input() });
    // Pending: the text and the selection are optimistic, the listbox stays.
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("Jamaica");
    expect(option("jm")).toHaveAttribute("data-pending", "");
    // The value action is pending (on the option, design 5.2); no close is requested yet.
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(input()).toHaveAttribute("data-open", "");
    expect(valueAction.mock.calls.map(([v, d]) => [v, d.reason, d.event?.type])).toEqual([
      ["jm", "activate", "click"],
    ]);
    expect(openAction).not.toHaveBeenCalled();
    await quietPeriod(50, "the listbox must stay shown until the value action settles");
    expect(isOpen()).toBe(true);
    save.resolve();
    await expect.poll(() => isOpen()).toBe(false);
    expect(document.activeElement).toBe(input());
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(openAction.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
      [false, "activate", "click"],
    ]);
  });

  it("Clear: light-dismissed at the release ('dismiss'), the text emptied, null dispatched, focus kept", async () => {
    const valueAction = vi.fn<ValueAction>();
    const openAction = vi.fn<OpenAction>();
    render(
      <Harness
        root={{
          defaultValue: "fr",
          defaultInputValue: "France",
          valueChangeAction: valueAction,
          openChangeAction: openAction,
        }}
      />,
    );
    await user.click(input());
    await user.clear(input());
    await openByTyping("Fr");
    openAction.mockClear();
    const atPress = await press(screen.getByTestId("clear"));
    // Clear's `mousedown` is prevented: the input keeps focus; light dismiss waits for `pointerup`.
    expect(atPress).toEqual({ open: true, focus: input() });
    await expect.poll(() => isOpen()).toBe(false);
    await expect.poll(() => valueAction.mock.calls.length).toBe(1);
    expect(valueAction.mock.calls[0]![0]).toBeNull();
    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());
    await quietPeriod(80, "Clear must not re-open the listbox");
    expect(isOpen()).toBe(false);
    expect(openAction.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
      [false, "dismiss", "toggle"],
    ]);
  });

  it("another field: the focus move hides it at the press ('dismiss'), the unmatched text reverts", async () => {
    const valueAction = vi.fn<ValueAction>();
    const openAction = vi.fn<OpenAction>();
    render(
      <Harness
        root={{
          defaultValue: "fr",
          defaultInputValue: "France",
          valueChangeAction: valueAction,
          openChangeAction: openAction,
        }}
      />,
    );
    await user.click(input());
    await user.clear(input());
    await openByTyping("Ja");
    openAction.mockClear();
    // The field before the Root: the one after it is under the listbox.
    const before = screen.getByTestId("before");
    const atPress = await press(before);
    expect(atPress).toEqual({ open: false, focus: before });
    await expect.poll(() => input().value).toBe("France");
    expect(document.activeElement).toBe(before);
    expect(valueAction).not.toHaveBeenCalled();
    await quietPeriod(50, "no re-open");
    expect(isOpen()).toBe(false);
    // The library hid it on the `focusout` and recorded that event as the close's.
    expect(openAction.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
      [false, "dismiss", "focusout"],
    ]);
  });

  // #123: `source` is no light-dismiss exemption (HTML's "topmost clicked popover" reads only an
  // invoker button's `commandfor` / `popovertarget`), so the Input captures the pointer to the
  // Popup at `pointerdown` while the listbox is shown; the release lands on the Popup and nothing
  // hides (design 5.4). The caret, double click, drag, nesting and touch rows are in
  // "Input press (#123, browser)".
  it("the input: nothing closes or dispatches; the input keeps focus and its text", async () => {
    const valueAction = vi.fn<ValueAction>();
    const openAction = vi.fn<OpenAction>();
    render(<Harness root={{ valueChangeAction: valueAction, openChangeAction: openAction }} />);
    await openByTyping("j");
    const calls = openAction.mock.calls.length;
    const atPress = await press(input());
    expect(atPress).toEqual({ open: true, focus: input() });
    await quietPeriod(80, "a press on the input must neither close nor dispatch");
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("j");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(valueAction).not.toHaveBeenCalled();
    expect(openAction).toHaveBeenCalledTimes(calls);
  });

  for (const [where, target, at] of [
    ["the popup's padding", () => popup(), { x: 3, y: 3 }],
    ["a disabled option", () => screen.getByTestId("opt-off"), undefined],
  ] as const) {
    it(`${where}: nothing closes or dispatches; the input keeps focus and its text`, async () => {
      const valueAction = vi.fn<ValueAction>();
      const openAction = vi.fn<OpenAction>();
      render(
        <Harness
          root={{ valueChangeAction: valueAction, openChangeAction: openAction }}
          popup={{ style: { padding: 6 } }}
          results={(query) => (
            <>
              <Options query={query} />
              <Combobox.Option value="off" disabled data-testid="opt-off" style={optionStyle}>
                Jupiter (closed)
              </Combobox.Option>
            </>
          )}
        />,
      );
      await openByTyping("j");
      const calls = openAction.mock.calls.length;
      const atPress = await press(target(), at);
      expect(atPress).toEqual({ open: true, focus: input() });
      await quietPeriod(80, "a press inside must neither close nor dispatch");
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(input());
      expect(input().value).toBe("j");
      expect(valueAction).not.toHaveBeenCalled();
      expect(openAction).toHaveBeenCalledTimes(calls);
    });
  }
});

// #126: a consumer's own invoker of the listbox (`popovertarget`, or `commandfor` with a popover
// command), pressed while it is shown. The Popup prevents the press's `mousedown`, so the input
// keeps focus, the focus-leaving close (5.4) never runs, and the click's native toggle closes the
// listbox as `"activate"` with the text untouched (design 5.4, conventions 3.5). Without the guard
// Chromium and Firefox (and Playwright's Linux WebKit, which focuses a clicked button) hid it at
// the press as `"dismiss"`, reverted the text, and the click's toggle re-showed it.
describe("a press on a foreign invoker while shown (#126, browser)", () => {
  let restoreAct: (() => void) | undefined;

  afterEach(async () => {
    await mouse.releaseHeld();
    restoreAct?.();
    restoreAct = undefined;
  });

  function ForeignHarness(props: HarnessProps) {
    return (
      <>
        {/* Before the Root: the listbox opens below the input and would cover a later button. */}
        <button type="button" data-testid="foreign" style={{ display: "block" }}>
          Foreign
        </button>
        <Box {...props} />
      </>
    );
  }

  const foreign = () => screen.getByTestId("foreign");

  async function setup(attributes: Record<string, string>) {
    const valueAction = vi.fn<ValueAction>();
    const openAction = vi.fn<OpenAction>();
    render(
      <ForeignHarness root={{ valueChangeAction: valueAction, openChangeAction: openAction }} />,
    );
    for (const [name, value] of Object.entries(attributes)) {
      foreign().setAttribute(name, value.replace("{popup}", popup().id));
    }
    // Unmatched text (`allowCustomValue` off): focus leaving would revert it.
    await typeInto("Jamaicax");
    await settle(() => expect(isOpen()).toBe(true));
    openAction.mockClear();
    restoreAct = leaveActEnvironment();
    return { valueAction, openAction };
  }

  function centre(target: Element) {
    const r = target.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }

  for (const [kind, attributes, eventType] of [
    ["popovertarget", { popovertarget: "{popup}" }, "beforetoggle"],
    [
      "commandfor + toggle-popover",
      { commandfor: "{popup}", command: "toggle-popover" },
      "command",
    ],
  ] as const) {
    it(`${kind}: the input keeps focus and its text, one (false, activate), no re-open`, async () => {
      const { valueAction, openAction } = await setup(attributes);
      const { x, y } = centre(foreign());
      await mouse.down(x, y);
      await sleep(20);
      expect({ open: isOpen(), focus: document.activeElement }).toEqual({
        open: true,
        focus: input(),
      });
      await mouse.up(x, y);
      await expect.poll(() => isOpen()).toBe(false);
      await expect.poll(() => openAction.mock.calls.length).toBe(1);
      const [next, details] = openAction.mock.calls[0]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event!.type).toBe(eventType);
      expect((details.event as Event & { source?: Element | null }).source).toBe(foreign());
      expect(input().value).toBe("Jamaicax");
      expect(document.activeElement).toBe(input());
      await quietPeriod(100, "the click's toggle must not re-open the listbox");
      expect(isOpen()).toBe(false);
      expect(openAction).toHaveBeenCalledTimes(1);
      expect(valueAction).not.toHaveBeenCalled();
    });
  }

  it("a dragged-off press: the listbox stays shown, the input focused, nothing dispatched", async () => {
    const { valueAction, openAction } = await setup({ popovertarget: "{popup}" });
    const { x, y } = centre(foreign());
    await mouse.down(x, y);
    await sleep(20);
    // Off the button, onto the empty page beside it (its own line: above the field).
    const page = foreign().getBoundingClientRect();
    await mouse.move(Math.round(page.right + 200), y);
    await mouse.up(Math.round(page.right + 200), y);
    await quietPeriod(100, "a dragged-off press must neither close nor dispatch");
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("Jamaicax");
    expect(openAction).not.toHaveBeenCalled();
    expect(valueAction).not.toHaveBeenCalled();
  });
});
