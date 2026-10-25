// Combobox tests (jsdom), mapped to design/components/combobox.md section 12.1. jsdom has no
// Popover API; `src/__tests__/popover-shim.ts` provides it (with `source` recording). No anchor
// positioning, no `ariaNotify` (stubbed for the announcement rows), no close watcher: dismissals
// are driven with `hidePopover()`.
//
// Covered by `combobox.browser.test.tsx` instead: placement and width, real pointer focus, Escape,
// Tab through the real focus order, implicit submission, nesting in Popover / Dialog (WebKit
// 302008), ViewTransition, IME, pre-hydration typing with the real keyboard.
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { StrictMode, Suspense, startTransition, use, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, expectTypeOf, it, onTestFinished, vi } from "vitest";
import { capturedPointers } from "../__tests__/pointer-capture-shim.js";
import { popoverSource } from "../__tests__/popover-shim.js";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  flushTasks,
  hydrateFromServer,
  PlainButton,
  silenceErrors,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import type { UrgentChangeHandler } from "../index.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import type { FormErrors } from "../form/index.js";
import { Combobox } from "./index.js";
import type {
  ComboboxClearState,
  ComboboxInputProps,
  ComboboxInputState,
  ComboboxInputValueChangeDetails,
  ComboboxListState,
  ComboboxOpenChangeDetails,
  ComboboxOptionState,
  ComboboxPopupProps,
  ComboboxPopupState,
  ComboboxRootProps,
  ComboboxRootState,
  ComboboxTriggerProps,
  ComboboxTriggerState,
  ComboboxValueChangeDetails,
} from "./index.js";
import { spyHide } from "../__tests__/overlay-helpers.js";

type ValueAction = (next: string | null, details: ComboboxValueChangeDetails) => unknown;
type TextAction = (next: string, details: ComboboxInputValueChangeDetails) => void;
type OpenAction = (next: boolean, details: ComboboxOpenChangeDetails) => unknown;

interface Country {
  readonly code: string;
  readonly name: string;
  readonly disabled?: boolean;
}

const COUNTRIES: readonly Country[] = [
  { code: "jp", name: "Japan" },
  { code: "jm", name: "Jamaica" },
  { code: "je", name: "Jersey", disabled: true },
  { code: "fr", name: "France" },
];

function matching(query: string): readonly Country[] {
  const q = query.toLowerCase();
  return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
}

function Options({ query }: { query: string }) {
  return matching(query).map((c) => (
    <Combobox.Option
      key={c.code}
      value={c.code}
      disabled={c.disabled}
      data-testid={`opt-${c.code}`}
    >
      {c.name}
    </Combobox.Option>
  ));
}

interface HarnessProps {
  root?: Partial<ComboboxRootProps>;
  trigger?: Partial<ComboboxTriggerProps>;
  popup?: Partial<ComboboxPopupProps>;
  /** List content for a query; default: the countries matching it. */
  results?: (query: string) => ReactNode;
  /** Extra Popup content after the List (default: an Empty). */
  afterList?: ReactNode;
  boundary?: (error: unknown) => void;
}

function Harness({ root, trigger, popup, results, afterList, boundary }: HarnessProps) {
  let box: ReactNode = (
    <Combobox.Root {...root}>
      <Combobox.Label data-testid="label">Country</Combobox.Label>
      <Combobox.Input data-testid="input" />
      <Combobox.Trigger data-testid="trigger" aria-label="Show all" {...trigger} />
      <Combobox.Clear data-testid="clear" aria-label="Clear" />
      <Combobox.Popup data-testid="popup" {...popup}>
        <Combobox.List data-testid="list">
          {({ query }) => (results ? results(query) : <Options query={query} />)}
        </Combobox.List>
        {afterList ?? <Combobox.Empty data-testid="empty">No country</Combobox.Empty>}
      </Combobox.Popup>
    </Combobox.Root>
  );
  if (boundary) box = <ErrorCatcher onError={boundary}>{box}</ErrorCatcher>;
  return (
    <>
      <button type="button" data-testid="elsewhere">
        Elsewhere
      </button>
      {box}
      <input data-testid="next" />
    </>
  );
}

/** "Update on success" controlled parent for `value` (conventions 2.3 item 4). */
function ControlledValue({ action, root, ...rest }: HarnessProps & { action?: ValueAction }) {
  const { defaultValue, ...others } = root ?? {};
  const [value, setValue] = useState<string | null>(defaultValue ?? null);
  return (
    <>
      <output data-testid="parent-value">{String(value)}</output>
      <Harness
        {...rest}
        root={{
          ...others,
          value,
          valueChangeAction: async (next, details) => {
            await action?.(next, details);
            startTransition(() => setValue(next));
          },
        }}
      />
    </>
  );
}

function ValueHarness({
  mode,
  action,
  ...rest
}: HarnessProps & { mode: ControlMode; action?: ValueAction }) {
  if (mode === "controlled") return <ControlledValue action={action} {...rest} />;
  return <Harness {...rest} root={{ ...rest.root, valueChangeAction: action }} />;
}

/** Controlled `inputValue` with a plain urgent `setState` in the body. */
function ControlledText({ action, ...rest }: HarnessProps & { action?: TextAction }) {
  const [text, setText] = useState(rest.root?.defaultInputValue ?? "");
  const { defaultInputValue: _ignored, ...others } = rest.root ?? {};
  return (
    <>
      <output data-testid="parent-text">{text}</output>
      <Harness
        {...rest}
        root={{
          ...others,
          inputValue: text,
          onInputValueChange: (next, details) => {
            action?.(next, details);
            setText(next);
          },
        }}
      />
    </>
  );
}

function TextHarness({
  mode,
  action,
  ...rest
}: HarnessProps & { mode: ControlMode; action?: TextAction }) {
  if (mode === "controlled") return <ControlledText action={action} {...rest} />;
  return <Harness {...rest} root={{ ...rest.root, onInputValueChange: action }} />;
}

const input = () => screen.getByTestId("input") as HTMLInputElement;
const popup = () => screen.getByTestId("popup");
const list = () => screen.getByTestId("list");
const option = (code: string) => screen.getByTestId(`opt-${code}`);
const trigger = () => screen.getByTestId("trigger");
const clearButton = () => screen.getByTestId("clear");
const isOpen = () => popup().matches(":popover-open");
const optionTexts = () => screen.queryAllByRole("option").map((o) => o.textContent);
const hidden = () => document.querySelector<HTMLInputElement>('input[type="hidden"]');

function watchShow() {
  const calls: { popup: HTMLElement; source: unknown; children: number }[] = [];
  const original = HTMLElement.prototype.showPopover;
  vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
    this: HTMLElement,
    options?: ShowPopoverOptions,
  ) {
    calls.push({ popup: this, source: options?.source, children: this.childElementCount });
    return original.call(this, options);
  });
  return calls;
}

/** Types into the (focused) input and runs the open. */
async function typeText(user: ReturnType<typeof setupUser>, text: string) {
  if (document.activeElement !== input()) await user.click(input());
  await user.keyboard(text);
  await flushTasks(2);
}

afterEach(() => {
  vi.useRealTimers();
  // Restored here as well as in the setup file (which runs after this hook): the loop below
  // must reach the real `hidePopover`, not a test's spy.
  vi.restoreAllMocks();
  for (const element of document.querySelectorAll("[popover]")) {
    if (element.matches(":popover-open")) (element as HTMLElement).hidePopover();
  }
  document.body.innerHTML = "";
});

describe("Combobox", () => {
  describe("roles and ARIA", () => {
    it("renders the documented closed markup", () => {
      render(<Harness />);
      const i = input();
      const label = screen.getByTestId("label");
      expect(i.tagName).toBe("INPUT");
      expect(i).toHaveAttribute("type", "text");
      expect(i).toHaveAttribute("role", "combobox");
      expect(i).toHaveAttribute("aria-autocomplete", "list");
      expect(i).toHaveAttribute("aria-expanded", "false");
      expect(i).toHaveAttribute("autocomplete", "off");
      expect(i).not.toHaveAttribute("aria-activedescendant");
      expect(label.tagName).toBe("LABEL");
      expect(label).toHaveAttribute("for", i.id);
      expect(label.id).not.toBe("");
      expect(i.getAttribute("aria-controls")).toMatch(/-list$/);
      const t = trigger();
      expect(t).toHaveAttribute("type", "button");
      expect(t).toHaveAttribute("tabindex", "-1");
      // The browser exposes the listbox's state on the invoker: no `aria-expanded` (#121).
      expect(t).not.toHaveAttribute("aria-expanded");
      expect(t).toHaveAttribute("aria-controls", i.getAttribute("aria-controls"));
      // Written after hydration (#112, #121); absent from the server HTML (the "Trigger close"
      // rows).
      expect(t).toHaveAttribute("popovertarget", popup().id);
      expect(t).not.toHaveAttribute("popovertargetaction");
      expect(t).not.toHaveAttribute("commandfor");
      expect(t).not.toHaveAttribute("command");
      expect(clearButton()).toHaveAttribute("type", "button");
      expect(clearButton()).toHaveAttribute("tabindex", "-1");
      const p = popup();
      expect(p.tagName).toBe("DIV");
      expect(p).toHaveAttribute("popover", "auto");
      expect(p).not.toHaveAttribute("role");
      // `self-*` keywords (wave 11, #53): the popup's own direction, so an RTL container counts.
      expect(p.style.getPropertyValue("position-area")).toBe("self-block-end span-self-inline-end");
      expect(p.style.getPropertyValue("position-try-fallbacks")).toBe("flip-block");
      // No resolved-placement hook on the listbox (combobox.md 7.2).
      expect(p).not.toHaveAttribute("data-side");
      expect(p).not.toHaveAttribute("data-align");
      // Children render on open (conventions 3.7).
      expect(p.children).toHaveLength(0);
      expect(hidden()).toBeNull();
      // The label is visible text and names the input.
      expect(screen.getByRole("combobox", { name: "Country" })).toBe(i);
    });

    it("wires the listbox, options and active option when open", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      const l = list();
      expect(l).toHaveAttribute("role", "listbox");
      expect(input()).toHaveAttribute("aria-controls", l.id);
      expect(l).toHaveAttribute("aria-labelledby", screen.getByTestId("label").id);
      expect(input()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("listbox", { name: "Country" })).toBe(l);
      const jp = option("jp");
      expect(jp).toHaveAttribute("role", "option");
      expect(jp.id).toBe(`${l.id.replace(/-list$/, "")}-option-jp`);
      expect(jp).toHaveAttribute("aria-selected", "false");
      expect(jp).not.toHaveAttribute("tabindex");
      expect(option("je")).toHaveAttribute("aria-disabled", "true");
      expect(option("je")).toHaveAttribute("data-disabled", "");
      await user.keyboard("{ArrowDown}");
      expect(input()).toHaveAttribute("aria-activedescendant", jp.id);
      expect(jp).toHaveAttribute("data-active", "");
    });

    it("merges consumer aria-labelledby and aria-controls tokens", async () => {
      const user = setupUser();
      render(
        <Combobox.Root>
          <Combobox.Label>Country</Combobox.Label>
          <Combobox.Input data-testid="input" aria-controls="extra" />
          <Combobox.Popup data-testid="popup">
            <Combobox.List data-testid="list" aria-labelledby="heading">
              <Combobox.Option value="a">A</Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>,
      );
      await typeText(user, "a");
      expect(input().getAttribute("aria-controls")).toBe(`extra ${list().id}`);
      expect(list().getAttribute("aria-labelledby")?.split(" ")).toEqual([
        "heading",
        expect.stringMatching(/-label$/),
      ]);
    });

    it("names the listbox only when a Label is rendered (no dangling aria-labelledby)", async () => {
      const user = setupUser();
      render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" aria-label="Country" />
          <Combobox.Popup data-testid="popup">
            <Combobox.List data-testid="list">
              <Combobox.Option value="a">A</Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>,
      );
      await typeText(user, "a");
      expect(list()).not.toHaveAttribute("aria-labelledby");
    });

    it("warns about a List with no name, not one named by a Label or aria-label", async () => {
      const error = silenceErrors();
      const user = setupUser();
      const noName = () =>
        error.mock.calls.filter(([m]) => String(m).includes("no accessible name")).length;
      const Box = ({ label, listLabel }: { label?: boolean; listLabel?: string }) => (
        <Combobox.Root>
          {label && <Combobox.Label>Country</Combobox.Label>}
          <Combobox.Input data-testid="input" aria-label="Country" />
          <Combobox.Popup data-testid="popup">
            <Combobox.List data-testid="list" aria-label={listLabel}>
              <Combobox.Option value="a">A</Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      );
      const first = render(<Box label />);
      await typeText(user, "a");
      expect(noName()).toBe(0);
      first.unmount();
      const second = render(<Box listLabel="Countries" />);
      await typeText(user, "a");
      expect(noName()).toBe(0);
      second.unmount();
      render(<Box />);
      await typeText(user, "a");
      expect(noName()).toBe(1);
    });

    it("derives option ids from the value with encodeURIComponent", async () => {
      const user = setupUser();
      render(
        <Harness results={() => <Combobox.Option value="new york">New York</Combobox.Option>} />,
      );
      await typeText(user, "n");
      expect(screen.getByRole("option").id).toMatch(/-option-new%20york$/);
    });

    it("marks only the selected option aria-selected=true", async () => {
      const user = setupUser();
      render(
        <Harness
          root={{ defaultValue: "jm", defaultInputValue: "Jamaica" }}
          results={() => <Options query="" />}
        />,
      );
      await user.click(trigger());
      await flushTasks(2);
      expect(option("jm")).toHaveAttribute("aria-selected", "true");
      expect(option("jm")).toHaveAttribute("data-selected", "");
      expect(option("jp")).toHaveAttribute("aria-selected", "false");
      expect(input()).toHaveAttribute("data-selected", "");
      expect(input().value).toBe("Jamaica");
    });

    it('renders a hidden input only with name, `""` for null', () => {
      const { unmount } = render(<Harness root={{ name: "country", form: "f" }} />);
      expect(hidden()).toHaveAttribute("name", "country");
      expect(hidden()).toHaveAttribute("form", "f");
      expect(hidden()!.value).toBe("");
      unmount();
      render(
        <Harness root={{ name: "country", defaultValue: "fr", defaultInputValue: "France" }} />,
      );
      expect(hidden()!.value).toBe("fr");
    });

    it("passes required to the input (native validation)", () => {
      render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" required />
        </Combobox.Root>,
      );
      expect(input()).toBeRequired();
      expect(input().validity.valueMissing).toBe(true);
    });

    it("renders Status, Group and GroupLabel with their roles", async () => {
      const user = setupUser();
      render(
        <Harness
          results={() => (
            <Combobox.Group data-testid="group">
              <Combobox.GroupLabel data-testid="glabel">Europe</Combobox.GroupLabel>
              <Combobox.Option value="fr">France</Combobox.Option>
            </Combobox.Group>
          )}
          afterList={<Combobox.Status data-testid="status">Hint</Combobox.Status>}
        />,
      );
      await typeText(user, "f");
      expect(screen.getByTestId("group")).toHaveAttribute("role", "group");
      expect(screen.getByTestId("group")).toHaveAttribute(
        "aria-labelledby",
        screen.getByTestId("glabel").id,
      );
      expect(screen.getByTestId("status")).toHaveAttribute("role", "status");
    });

    it("warns about two options with one value", async () => {
      const user = setupUser();
      const error = silenceErrors();
      render(
        <Harness
          results={() => (
            <>
              <Combobox.Option value="a">A</Combobox.Option>
              <Combobox.Option value="a">A again</Combobox.Option>
            </>
          )}
        />,
      );
      await typeText(user, "a");
      expect(error.mock.calls.some(([m]) => String(m).includes("two options have the value"))).toBe(
        true,
      );
    });

    it("warns about an Option outside a List and a List outside a Popup", () => {
      const error = silenceErrors();
      render(
        <Combobox.Root>
          <Combobox.List>
            <Combobox.Option value="a">A</Combobox.Option>
          </Combobox.List>
          <Combobox.Option value="b">B</Combobox.Option>
        </Combobox.Root>,
      );
      const messages = error.mock.calls.map(([m]) => String(m));
      expect(messages.some((m) => m.includes("Combobox.List: rendered outside"))).toBe(true);
      expect(messages.some((m) => m.includes("Combobox.Option: rendered outside"))).toBe(true);
    });

    it("throws when a part is rendered outside a Root", () => {
      silenceErrors();
      expect(() => render(<Combobox.Input />)).toThrow(/inside a Combobox.Root/);
    });

    it("warns when a value is set without a text prop", () => {
      const error = silenceErrors();
      render(<Harness root={{ defaultValue: "jp" }} />);
      expect(error.mock.calls.some(([m]) => String(m).includes("neither `inputValue`"))).toBe(true);
    });

    it("warns about a Trigger without an accessible name", async () => {
      const error = silenceErrors();
      render(
        <Combobox.Root>
          <Combobox.Input />
          <Combobox.Trigger />
        </Combobox.Root>,
      );
      await act(async () => {});
      expect(error.mock.calls.some(([m]) => String(m).includes("no accessible name"))).toBe(true);
    });
  });

  renderBoth("urgent text", (mode) => {
    it("updates the DOM and calls onInputValueChange synchronously per keystroke", async () => {
      const calls: { next: string; dom: string; type: string | undefined; reason: string }[] = [];
      const action = vi.fn<TextAction>((next, details) => {
        calls.push({
          next,
          dom: input().value,
          type: details.event?.type,
          reason: details.reason,
        });
      });
      const user = setupUser();
      render(<TextHarness mode={mode} action={action} />);
      await user.type(input(), "jap");
      expect(input().value).toBe("jap");
      expect(calls).toEqual([
        { next: "j", dom: "j", type: "input", reason: "activate" },
        { next: "ja", dom: "ja", type: "input", reason: "activate" },
        { next: "jap", dom: "jap", type: "input", reason: "activate" },
      ]);
      expect(JSON.stringify(action.mock.calls[0]![1])).toBe('{"reason":"activate"}');
      if (mode === "controlled") expect(screen.getByTestId("parent-text")).toHaveTextContent("jap");
    });

    it("is not a transition: typing stays in sync while an async action holds every transition", async () => {
      const save = deferred();
      const seen: string[] = [];
      const user = setupUser();
      function Probe() {
        // A transition started in the parent: React entangles it with the pending save.
        const [isPending, start] = useTransition();
        const [, set] = useState(0);
        return (
          <button type="button" data-testid="probe" onClick={() => start(() => set((n) => n + 1))}>
            {String(isPending)}
          </button>
        );
      }
      render(
        <>
          <Probe />
          <TextHarness
            mode={mode}
            action={(next) => {
              seen.push(next);
            }}
            root={{ valueChangeAction: () => save.promise }}
          />
        </>,
      );
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}{Enter}");
      expect(option("jp")).toHaveAttribute("data-pending", "");
      // Transitions are now held by the pending save.
      await user.click(screen.getByTestId("probe"));
      expect(screen.getByTestId("probe")).toHaveTextContent("true");
      await user.click(input());
      await user.keyboard("{End}xy");
      expect(input().value).toBe("Japanxy");
      expect(seen.slice(-2)).toEqual(["Japanx", "Japanxy"]);
      if (mode === "controlled")
        expect(screen.getByTestId("parent-text")).toHaveTextContent("Japanxy");
      await act(async () => save.resolve());
      await flushTasks(2);
    });

    it("warns once when onInputValueChange returns a promise", async () => {
      const error = silenceErrors();
      const user = setupUser();
      render(<Harness root={{ onInputValueChange: async () => {} }} />);
      await typeText(user, "ab");
      const warnings = error.mock.calls.filter(([m]) =>
        String(m).includes("`onInputValueChange` returned a promise"),
      );
      expect(warnings).toHaveLength(1);
    });
  });

  it("restores the DOM when a controlled parent does not adopt a keystroke", async () => {
    const user = setupUser();
    const action = vi.fn();
    render(<Harness root={{ inputValue: "Fr", onInputValueChange: action }} />);
    await user.click(input());
    await user.keyboard("a");
    expect(action).toHaveBeenCalledWith("Fra", expect.anything());
    expect(input().value).toBe("Fr");
  });

  describe("deferred query", () => {
    it("passes the query to the List's children function", async () => {
      const seen: ComboboxListState[] = [];
      const user = setupUser();
      render(
        <Harness
          results={(query) => {
            seen.push({ query, stale: false, empty: false });
            return <Options query={query} />;
          }}
        />,
      );
      await typeText(user, "ja");
      expect(seen.at(-1)!.query).toBe("ja");
      expect(optionTexts()).toEqual(["Japan", "Jamaica"]);
    });

    it("keeps the old results, stale, while the new ones suspend; then swaps", async () => {
      const search = createSearch();
      search.resolve("j");
      const user = setupUser();
      render(<Harness results={(query) => <search.Results query={query} />} />);
      await typeText(user, "j");
      expect(optionTexts()).toEqual(["Japan", "Jamaica", "Jersey"]);
      expect(list()).not.toHaveAttribute("data-stale");
      await user.keyboard("a");
      await flushTasks(2);
      expect(input().value).toBe("ja");
      expect(optionTexts()).toEqual(["Japan", "Jamaica", "Jersey"]);
      expect(list()).toHaveAttribute("data-stale", "");
      expect(list()).toHaveAttribute("aria-busy", "true");
      expect(popup()).toHaveAttribute("data-stale", "");
      expect(input()).toHaveAttribute("data-stale", "");
      await act(async () => search.resolve("ja"));
      await flushTasks(2);
      expect(optionTexts()).toEqual(["Japan", "Jamaica"]);
      expect(list()).not.toHaveAttribute("data-stale");
      expect(list()).not.toHaveAttribute("aria-busy");
    });

    it("never shows a slow earlier query's results after a later one's", async () => {
      const search = createSearch();
      search.resolve("j");
      const user = setupUser();
      render(<Harness results={(query) => <search.Results query={query} />} />);
      await typeText(user, "j");
      await user.keyboard("a");
      await flushTasks(2);
      await user.keyboard("m");
      await flushTasks(2);
      await act(async () => search.resolve("jam"));
      await flushTasks(2);
      expect(optionTexts()).toEqual(["Jamaica"]);
      await act(async () => search.resolve("ja"));
      await flushTasks(2);
      expect(optionTexts()).toEqual(["Jamaica"]);
      expect(list()).not.toHaveAttribute("data-stale");
    });

    it("re-renders the results for a new query while a save is pending (design 4, walkthrough 6)", async () => {
      const save = deferred();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: () => save.promise }} />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}{Enter}");
      expect(option("jp")).toHaveAttribute("data-pending", "");
      await user.clear(input());
      await user.keyboard("fr");
      await flushTasks(2);
      // The deferred render ran although the save still holds every transition.
      expect(optionTexts()).toEqual(["France"]);
      expect(list()).not.toHaveAttribute("data-stale");
      expect(isOpen()).toBe(true);
      await act(async () => save.resolve());
      await flushTasks(2);
      // The user typed a new search meanwhile: the accepted option's close is dropped.
      expect(isOpen()).toBe(true);
    });
  });

  describe("open", () => {
    it("opens on typing: openChangeAction(true, activate) and showPopover({ source: input })", async () => {
      const shows = watchShow();
      const openAction = vi.fn<OpenAction>();
      const user = setupUser();
      render(<Harness root={{ openChangeAction: openAction }} />);
      await typeText(user, "j");
      expect(openAction).toHaveBeenCalledTimes(1);
      const [next, details] = openAction.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("input");
      expect(shows).toHaveLength(1);
      expect(shows[0]!.source).toBe(input());
      // After the open commit: the content is in the popup when it is shown.
      expect(shows[0]!.children).toBeGreaterThan(0);
      expect(popoverSource(popup())).toBe(input());
      expect(document.activeElement).toBe(input());
      await user.keyboard("a");
      await flushTasks(2);
      expect(openAction).toHaveBeenCalledTimes(1);
    });

    it("opens on an emptied text too", async () => {
      const user = setupUser();
      render(<Harness root={{ defaultInputValue: "j" }} />);
      await user.click(input());
      await user.keyboard("{Backspace}");
      await flushTasks(2);
      expect(input().value).toBe("");
      expect(isOpen()).toBe(true);
    });

    it("ArrowDown opens with the first enabled option active", async () => {
      const user = setupUser();
      render(<Harness />);
      await user.click(input());
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
    });

    it("ArrowUp opens with the last enabled option active", async () => {
      const user = setupUser();
      render(<Harness />);
      await user.click(input());
      await user.keyboard("{ArrowUp}");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(input()).toHaveAttribute("aria-activedescendant", option("fr").id);
    });

    it("Alt+ArrowDown opens with no option active", async () => {
      const user = setupUser();
      render(<Harness />);
      await user.click(input());
      await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(input()).not.toHaveAttribute("aria-activedescendant");
    });

    it("does not open on focus or on a click without openOnClick", async () => {
      const user = setupUser();
      render(<Harness />);
      await user.click(input());
      await user.tab();
      await user.tab({ shift: true });
      await flushTasks(2);
      expect(document.activeElement).toBe(input());
      expect(isOpen()).toBe(false);
    });

    it("opens on a click with openOnClick", async () => {
      const user = setupUser();
      render(<Harness root={{ openOnClick: true }} />);
      await user.click(input());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
    });

    it("the Trigger toggles and focuses the input", async () => {
      const openAction = vi.fn<OpenAction>();
      const user = setupUser();
      render(<Harness root={{ openChangeAction: openAction }} />);
      await user.click(trigger());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(input());
      expect(input()).toHaveAttribute("aria-expanded", "true");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(trigger()).toHaveAttribute("data-open", "");
      await user.click(trigger());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(openAction.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        [true, "activate"],
        [false, "activate"],
      ]);
    });

    it("disabled: nothing opens, the input and buttons are disabled", async () => {
      const openAction = vi.fn<OpenAction>();
      const user = setupUser();
      render(<Harness root={{ disabled: true, openChangeAction: openAction }} />);
      expect(input()).toBeDisabled();
      expect(input()).toHaveAttribute("data-disabled", "");
      expect(trigger()).toBeDisabled();
      expect(clearButton()).toBeDisabled();
      await user.click(trigger());
      fireEvent.keyDown(input(), { key: "ArrowDown" });
      await flushTasks(2);
      expect(openAction).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
    });

    it("a refused controlled open keeps aria-expanded false, snaps data-open back and keeps the text", async () => {
      const user = setupUser();
      render(<Harness root={{ open: false, openChangeAction: () => {} }} />);
      await typeText(user, "j");
      expect(input().value).toBe("j");
      expect(input()).toHaveAttribute("aria-expanded", "false");
      expect(input()).not.toHaveAttribute("data-open");
      expect(isOpen()).toBe(false);
    });
  });

  describe("keyboard", () => {
    it("ArrowDown / ArrowUp move the active option, skip disabled, and stop at the ends", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      const active = () => input().getAttribute("aria-activedescendant");
      await user.keyboard("{ArrowDown}");
      expect(active()).toBe(option("jp").id);
      await user.keyboard("{ArrowDown}");
      expect(active()).toBe(option("jm").id);
      expect(option("jm")).toHaveAttribute("data-active", "");
      expect(option("jp")).not.toHaveAttribute("data-active");
      // Jersey is disabled: skipped; Jamaica is the last enabled one.
      await user.keyboard("{ArrowDown}");
      expect(active()).toBe(option("jm").id);
      await user.keyboard("{ArrowUp}{ArrowUp}");
      expect(active()).toBe(option("jp").id);
    });

    it("ArrowUp with none active goes to the last enabled option", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      await user.keyboard("{ArrowUp}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jm").id);
    });

    it("wraps with loop", async () => {
      const user = setupUser();
      render(<Harness root={{ loop: true }} />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
      await user.keyboard("{ArrowUp}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jm").id);
    });

    it("prevents the arrow keys and Enter while open, not Home / End", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      const prevented = (key: string) => !fireEvent.keyDown(input(), { key });
      expect(prevented("ArrowDown")).toBe(true);
      expect(prevented("ArrowUp")).toBe(true);
      expect(prevented("Home")).toBe(false);
      expect(prevented("End")).toBe(false);
      act(() => input().focus());
      expect(prevented("Enter")).toBe(true);
    });

    it("Enter with no active option does nothing while open (prevented), is not handled while closed", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: action }} />);
      await typeText(user, "j");
      expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(false);
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(true);
      expect(action).not.toHaveBeenCalled();
    });

    it("Alt+ArrowUp accepts the active option, or closes when there is none", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: action }} />);
      await typeText(user, "j");
      await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(action).not.toHaveBeenCalled();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
      await flushTasks(2);
      expect(action).toHaveBeenCalledWith("jp", expect.anything());
      expect(input().value).toBe("Japan");
      expect(isOpen()).toBe(false);
    });

    it("ignores Ctrl / Meta combinations", async () => {
      const user = setupUser();
      render(<Harness />);
      await user.click(input());
      expect(fireEvent.keyDown(input(), { key: "ArrowDown", ctrlKey: true })).toBe(true);
      await flushTasks(2);
      expect(isOpen()).toBe(false);
    });

    it("ignores keys during IME composition", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: action }} />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}");
      expect(fireEvent.keyDown(input(), { key: "Enter", isComposing: true })).toBe(true);
      expect(fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 })).toBe(true);
      expect(action).not.toHaveBeenCalled();
    });

    it("pointermove makes an enabled option active, not a disabled one", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      fireEvent.pointerMove(option("jm"));
      expect(input()).toHaveAttribute("aria-activedescendant", option("jm").id);
      fireEvent.pointerMove(option("je"));
      expect(input()).toHaveAttribute("aria-activedescendant", option("jm").id);
      // Arrows continue from the hovered option.
      await user.keyboard("{ArrowUp}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
    });
  });

  renderBoth("accept", (mode) => {
    it("Enter: text at once, dispatch with the keydown, pending option, close after settle", async () => {
      const save = deferred();
      const action = vi.fn<ValueAction>(() => save.promise);
      const texts = vi.fn<TextAction>();
      const hide = spyHide();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          action={action}
          root={{ name: "country", onInputValueChange: texts }}
          results={() => <Options query="ja" />}
        />,
      );
      await typeText(user, "ja");
      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
      expect(input().value).toBe("Jamaica");
      expect(texts).toHaveBeenLastCalledWith("Jamaica", expect.anything());
      expect(texts.mock.lastCall![1].reason).toBe("activate");
      expect(texts.mock.lastCall![1].event?.type).toBe("keydown");
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("jm");
      expect(details.reason).toBe("activate");
      expect(details.custom).toBe(false);
      expect(details.event?.type).toBe("keydown");
      expect(JSON.stringify(details)).toBe('{"reason":"activate","custom":false}');
      expect(option("jm")).toHaveAttribute("aria-selected", "true");
      expect(option("jm")).toHaveAttribute("data-selected", "");
      expectPending(option("jm"));
      expectNotPending(option("jp"));
      expectPending(input());
      expect(input()).toHaveAttribute("data-selected", "");
      expect(hidden()!.value).toBe("jm");
      expect(isOpen()).toBe(true);
      expect(hide).not.toHaveBeenCalled();
      if (mode === "controlled")
        expect(screen.getByTestId("parent-value")).toHaveTextContent("null");
      await act(async () => save.resolve());
      await flushTasks(2);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      expectNotPending(input());
      expect(input()).toHaveAttribute("data-selected", "");
      expect(hidden()!.value).toBe("jm");
      expect(document.activeElement).toBe(input());
      if (mode === "controlled") expect(screen.getByTestId("parent-value")).toHaveTextContent("jm");
    });

    it("click: the label prop (else the trimmed text) and the click event", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          action={action}
          results={() => (
            <>
              <Combobox.Option value="a" label="Apple (fruit)" data-testid="opt-a">
                <b>Apple</b>
              </Combobox.Option>
              <Combobox.Option value="b" data-testid="opt-b">
                {"  Banana  "}
              </Combobox.Option>
            </>
          )}
        />,
      );
      await typeText(user, "x");
      await user.click(option("a"));
      await flushTasks(2);
      expect(input().value).toBe("Apple (fruit)");
      expect(action.mock.calls[0]![1].event?.type).toBe("click");
      expect(isOpen()).toBe(false);
      await user.click(trigger());
      await flushTasks(2);
      await user.click(option("b"));
      await flushTasks(2);
      expect(input().value).toBe("Banana");
      expect(action.mock.calls.map(([n]) => n)).toEqual(["a", "b"]);
    });

    it("re-accepting the selected option closes without dispatching", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          action={action}
          root={{ defaultValue: "fr", defaultInputValue: "France" }}
        />,
      );
      await user.click(trigger());
      await flushTasks(2);
      await user.click(option("fr"));
      await flushTasks(2);
      expect(action).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expect(input().value).toBe("France");
    });

    it("never accepts a disabled option", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<ValueHarness mode={mode} action={action} />);
      await typeText(user, "je");
      await user.click(option("je"));
      await flushTasks(2);
      expect(action).not.toHaveBeenCalled();
      expect(input().value).toBe("je");
      expect(isOpen()).toBe(true);
    });

    it("drops the close when the user dismissed and re-opened while the action ran", async () => {
      const save = deferred();
      const user = setupUser();
      render(<ValueHarness mode={mode} action={() => save.promise} />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}{Enter}");
      act(() => popup().hidePopover());
      await flushTasks(2);
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      await act(async () => save.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(input()).toHaveAttribute("data-selected", "");
    });
  });

  renderBoth("rejection", (mode) => {
    it("reaches the boundary; the text rolls back with reason dismiss", async () => {
      silenceErrors();
      const save = deferred();
      const caught = vi.fn();
      const texts = vi.fn<TextAction>();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          action={() => save.promise}
          boundary={caught}
          root={{ defaultValue: "fr", defaultInputValue: "France", onInputValueChange: texts }}
        />,
      );
      await user.click(input());
      await user.clear(input());
      await user.keyboard("ja");
      await flushTasks(2);
      await user.keyboard("{ArrowDown}{Enter}");
      expect(input().value).toBe("Japan");
      await act(async () => save.reject(new Error("nope")));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledTimes(1);
      expect(texts).toHaveBeenLastCalledWith("France", expect.anything());
      expect(texts.mock.lastCall![1].reason).toBe("dismiss");
      expect(texts.mock.lastCall![1].event).toBeUndefined();
    });

    it("a synchronous throw: the rollback write runs outside the transition", async () => {
      silenceErrors();
      const internals = (
        React as unknown as {
          __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { T: unknown };
        }
      ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      const writes: { next: string; inTransition: boolean }[] = [];
      const caught = vi.fn();
      const user = setupUser();
      render(
        <TextHarness
          mode={mode}
          action={(next) => writes.push({ next, inTransition: internals.T != null })}
          boundary={caught}
          root={{
            defaultValue: "fr",
            defaultInputValue: "France",
            valueChangeAction: () => {
              throw new Error("invalid");
            },
          }}
        />,
      );
      await user.click(input());
      await user.clear(input());
      await user.keyboard("ja");
      await flushTasks(2);
      await user.keyboard("{ArrowDown}{Enter}");
      await flushTasks(2);
      expect(caught).toHaveBeenCalledTimes(1);
      expect(writes.at(-1)).toEqual({ next: "France", inTransition: false });
      expect(writes.every((w) => !w.inTransition)).toBe(true);
      if (mode === "controlled")
        expect(screen.getByTestId("parent-text")).toHaveTextContent("France");
    });

    it("caught inside the action: commits (uncontrolled) / reverts without an error (controlled)", async () => {
      const caught = vi.fn();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          boundary={caught}
          action={async () => {
            try {
              await Promise.reject(new Error("offline"));
            } catch {
              // inline error UI
            }
          }}
          root={{ defaultValue: "fr", defaultInputValue: "France", name: "country" }}
        />,
      );
      await user.click(input());
      await user.clear(input());
      await user.keyboard("ja");
      await flushTasks(2);
      await user.keyboard("{ArrowDown}{Enter}");
      await flushTasks(2);
      expect(caught).not.toHaveBeenCalled();
      // Controlled parents in this suite always adopt after the action, so both commit.
      expect(input().value).toBe("Japan");
      expect(hidden()!.value).toBe("jp");
    });
  });

  it("a controlled parent that refuses the value: text and selection revert", async () => {
    const texts = vi.fn<TextAction>();
    const user = setupUser();
    render(
      <Harness
        root={{
          value: "fr",
          defaultInputValue: "France",
          valueChangeAction: async () => {},
          onInputValueChange: texts,
          name: "country",
        }}
        results={() => <Options query="" />}
      />,
    );
    await user.click(input());
    await user.clear(input());
    await user.keyboard("ja");
    await flushTasks(2);
    await user.keyboard("{ArrowDown}{Enter}");
    await flushTasks(2);
    expect(input().value).toBe("France");
    expect(texts.mock.lastCall).toEqual(["France", expect.anything()]);
    expect(texts.mock.lastCall![1].reason).toBe("dismiss");
    expect(hidden()!.value).toBe("fr");
    expect(input()).toHaveAttribute("data-selected", "");
    // The close is part of the action's commit: adoption cannot be known before it, so the
    // listbox closes (unlike a rejection, which skips the close).
    expect(isOpen()).toBe(false);
  });

  renderBoth("overlap", (mode) => {
    it("follows the latest accept; closes once after the latest settles", async () => {
      const first = deferred();
      const second = deferred();
      const queue = [first, second];
      const hide = spyHide();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          action={() => queue.shift()!.promise}
          results={() => <Options query="" />}
        />,
      );
      await typeText(user, "j");
      await user.click(option("jp"));
      await user.click(option("jm"));
      expect(input().value).toBe("Jamaica");
      expectPending(option("jm"));
      expectNotPending(option("jp"));
      await act(async () => second.resolve());
      await flushTasks(2);
      await act(async () => first.resolve());
      await flushTasks(2);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(input()).toHaveAttribute("data-selected", "");
      if (mode === "controlled") {
        // "Update on success" parents land writes in completion order (conventions 2.5): the
        // older intent wins, and the text follows the committed value.
        expect(screen.getByTestId("parent-value")).toHaveTextContent("jp");
        expect(input().value).toBe("Japan");
      } else {
        expect(input().value).toBe("Jamaica");
      }
    });

    it("an older rejection reaches the boundary after the newer resolved", async () => {
      silenceErrors();
      const first = deferred();
      const second = deferred();
      const queue = [first, second];
      const caught = vi.fn();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          action={() => queue.shift()!.promise}
          boundary={caught}
          results={() => <Options query="" />}
        />,
      );
      await typeText(user, "j");
      await user.click(option("jp"));
      await user.click(option("jm"));
      await act(async () => second.resolve());
      await flushTasks(2);
      await act(async () => first.reject(new Error("older")));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledTimes(1);
      expect((caught.mock.calls[0]![0] as Error).message).toBe("older");
    });

    it("an older rejection reaches the boundary while the newer is pending", async () => {
      silenceErrors();
      const first = deferred();
      const second = deferred();
      const queue = [first, second];
      const caught = vi.fn();
      const user = setupUser();
      render(
        <ValueHarness
          mode={mode}
          action={() => queue.shift()!.promise}
          boundary={caught}
          results={() => <Options query="" />}
        />,
      );
      await typeText(user, "j");
      await user.click(option("jp"));
      await user.click(option("jm"));
      await act(async () => first.reject(new Error("older")));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledTimes(1);
      expect((caught.mock.calls[0]![0] as Error).message).toBe("older");
      await act(async () => second.resolve());
      await flushTasks(2);
    });
  });

  describe("custom value", () => {
    it("Enter with no active option dispatches the text with custom: true and closes", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action, name: "tag" }} />);
      await typeText(user, "Narnia");
      await user.keyboard("{Enter}");
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("Narnia");
      expect(details.custom).toBe(true);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("keydown");
      expect(hidden()!.value).toBe("Narnia");
      expect(isOpen()).toBe(false);
      // Unchanged text: Enter again commits nothing.
      fireEvent.keyDown(input(), { key: "Enter" });
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("Enter while closed commits a changed text without preventing the key", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action, name: "tag" }} />);
      await typeText(user, "Oz");
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(true);
      expect(action).toHaveBeenCalledWith("Oz", expect.anything());
      expect(hidden()!.value).toBe("Oz");
    });

    it("Enter while closed: the hidden input holds the text before the key's default action", async () => {
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, name: "tag" }} />);
      await typeText(user, "Oz");
      act(() => popup().hidePopover());
      await flushTasks(2);
      let seen: string | undefined;
      const listener = () => {
        seen = hidden()!.value;
      };
      // Runs after React's root listener, still inside the keydown dispatch (Firefox submits
      // implicitly before a scheduled flush would run; probed in combobox.browser.test.tsx).
      document.addEventListener("keydown", listener);
      try {
        fireEvent.keyDown(input(), { key: "Enter" });
      } finally {
        document.removeEventListener("keydown", listener);
      }
      expect(seen).toBe("Oz");
      await flushTasks(2);
    });

    it("Enter right after a dismissal, before its toggle task, is the closed Enter", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action, name: "tag" }} />);
      await typeText(user, "Oz");
      // The platform hides the popup at once and queues `toggle`; Enter arrives in between.
      let notPrevented = false;
      act(() => {
        popup().hidePopover();
        notPrevented = fireEvent.keyDown(input(), { key: "Enter" });
      });
      expect(notPrevented).toBe(true);
      expect(action).toHaveBeenCalledWith("Oz", expect.anything());
      expect(hidden()!.value).toBe("Oz");
      await flushTasks(2);
    });

    it("focus leaving with changed text dispatches with the focusout event", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action }} />);
      await typeText(user, "Oz");
      await user.click(screen.getByTestId("next"));
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![0]).toBe("Oz");
      expect(action.mock.calls[0]![1].custom).toBe(true);
      expect(action.mock.calls[0]![1].event?.type).toBe("focusout");
      expect(isOpen()).toBe(false);
    });

    it("empty text with a value dispatches null", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(
        <Harness
          root={{
            allowCustomValue: true,
            defaultValue: "Oz",
            defaultInputValue: "Oz",
            valueChangeAction: action,
          }}
        />,
      );
      await user.click(input());
      await user.clear(input());
      await user.click(screen.getByTestId("next"));
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![0]).toBeNull();
      expect(action.mock.calls[0]![1].custom).toBe(false);
    });

    it("an accepted option is still a value with custom: false", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action }} />);
      await typeText(user, "fr");
      await user.keyboard("{ArrowDown}{Enter}");
      expect(action).toHaveBeenCalledWith("fr", expect.anything());
      expect(action.mock.calls[0]![1].custom).toBe(false);
    });

    it("without allowCustomValue focus leaving reverts the text and dispatches nothing", async () => {
      const action = vi.fn<ValueAction>();
      const texts = vi.fn<TextAction>();
      const user = setupUser();
      render(
        <Harness
          root={{
            defaultValue: "fr",
            defaultInputValue: "France",
            valueChangeAction: action,
            onInputValueChange: texts,
          }}
        />,
      );
      await user.click(input());
      await user.clear(input());
      await user.keyboard("Jam");
      await flushTasks(2);
      await user.click(screen.getByTestId("next"));
      await flushTasks(2);
      expect(action).not.toHaveBeenCalled();
      expect(input().value).toBe("France");
      expect(texts.mock.lastCall![0]).toBe("France");
      expect(texts.mock.lastCall![1].reason).toBe("dismiss");
      expect(texts.mock.lastCall![1].event?.type).toBe("focusout");
    });

    it("reverts to the label learnt from the option, or empty for null", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "ja");
      await user.click(screen.getByTestId("next"));
      await flushTasks(2);
      expect(input().value).toBe("");
      await typeText(user, "ja");
      await user.click(option("jm"));
      await flushTasks(2);
      await user.clear(input());
      await user.keyboard("zzz");
      await user.click(screen.getByTestId("next"));
      await flushTasks(2);
      expect(input().value).toBe("Jamaica");
    });
  });

  describe("focus loss", () => {
    it("disabled: focus leaving reverts and commits nothing", async () => {
      const action = vi.fn<ValueAction>();
      const texts = vi.fn<TextAction>();
      const user = setupUser();
      for (const allowCustomValue of [true, false]) {
        const root = { allowCustomValue, valueChangeAction: action, onInputValueChange: texts };
        const { rerender, unmount } = render(<Harness root={root} />);
        await typeText(user, "jam");
        texts.mockClear();
        rerender(<Harness root={{ ...root, disabled: true }} />);
        fireEvent.focusOut(input(), { relatedTarget: screen.getByTestId("next") });
        await flushTasks(2);
        expect(action).not.toHaveBeenCalled();
        expect(texts).not.toHaveBeenCalled();
        expect(input().value).toBe("jam");
        unmount();
      }
    });

    it("closes at once when focus moves outside, notified as dismiss", async () => {
      const openAction = vi.fn<OpenAction>();
      const hide = spyHide();
      const user = setupUser();
      render(<Harness root={{ openChangeAction: openAction }} />);
      await typeText(user, "j");
      await user.click(screen.getByTestId("elsewhere"));
      expect(hide).toHaveBeenCalledTimes(1);
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(openAction.mock.calls.at(-1)![0]).toBe(false);
      expect(openAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
      expect(openAction.mock.calls.at(-1)![1].event?.type).toBe("focusout");
    });

    it("closes nothing when focus leaves to nowhere (window blur)", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      fireEvent.blur(input(), { relatedTarget: null });
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(input().value).toBe("j");
    });

    // #111: focus moving to <body> during a press is decided one task after the release, when
    // the click has run (a `<label for>` refocuses the input there).
    describe("focus to nowhere during a press (#111)", () => {
      it("waits for the release: a press that refocuses the input keeps the text", async () => {
        const action = vi.fn<ValueAction>();
        const user = setupUser();
        for (const allowCustomValue of [false, true]) {
          const { unmount } = render(
            <Harness root={{ allowCustomValue, valueChangeAction: action }} />,
          );
          await typeText(user, "ja");
          fireEvent.pointerDown(screen.getByTestId("label"));
          input().blur();
          await flushTasks(3);
          expect(input().value).toBe("ja");
          // The release, then in the same task its click: the label's activation focuses.
          fireEvent.pointerUp(screen.getByTestId("label"));
          input().focus();
          await flushTasks(3);
          expect(input().value).toBe("ja");
          expect(isOpen()).toBe(true);
          expect(action).not.toHaveBeenCalled();
          unmount();
        }
      });

      it("a released press on nothing focusable reverts, or commits with allowCustomValue", async () => {
        const action = vi.fn<ValueAction>();
        const user = setupUser();
        for (const allowCustomValue of [false, true]) {
          const { unmount } = render(
            <Harness root={{ allowCustomValue, valueChangeAction: action }} />,
          );
          await typeText(user, "ja");
          fireEvent.pointerDown(document.body);
          input().blur();
          await flushTasks(3);
          expect(input().value).toBe("ja");
          expect(isOpen()).toBe(true);
          fireEvent.pointerUp(document.body);
          await flushTasks(3);
          expect(isOpen()).toBe(false);
          if (allowCustomValue) {
            expect(action).toHaveBeenCalledWith("ja", expect.anything());
            expect(action.mock.calls[0]![1].event?.type).toBe("focusout");
          } else {
            expect(input().value).toBe("");
            expect(action).not.toHaveBeenCalled();
          }
          unmount();
        }
      });

      it("a cancelled press decides too", async () => {
        const user = setupUser();
        render(<Harness />);
        await typeText(user, "ja");
        fireEvent.pointerDown(document.body);
        input().blur();
        fireEvent.pointerCancel(document.body);
        await flushTasks(3);
        expect(input().value).toBe("");
      });

      it("waits for the last of several pointers", async () => {
        const user = setupUser();
        render(<Harness />);
        await typeText(user, "ja");
        fireEvent.pointerDown(document.body, { pointerId: 1 });
        fireEvent.pointerDown(document.body, { pointerId: 2 });
        input().blur();
        fireEvent.pointerUp(document.body, { pointerId: 1 });
        await flushTasks(3);
        expect(input().value).toBe("ja");
        fireEvent.pointerUp(document.body, { pointerId: 2 });
        await flushTasks(3);
        expect(input().value).toBe("");
      });

      it("a window blur forgets the presses: a swallowed release does not hold the check", async () => {
        const user = setupUser();
        render(<Harness />);
        await typeText(user, "ja");
        fireEvent.pointerDown(document.body);
        input().blur();
        await flushTasks(3);
        expect(input().value).toBe("ja");
        fireEvent.blur(window);
        await flushTasks(3);
        expect(input().value).toBe("");
      });

      it("focus arriving in the input forgets a press whose release never came", async () => {
        const user = setupUser();
        render(<Harness />);
        await typeText(user, "ja");
        fireEvent.pointerDown(document.body);
        input().blur();
        input().focus();
        input().blur();
        await flushTasks(3);
        expect(input().value).toBe("");
      });

      it("presses are tracked only while the input is focused, until the leave is decided", async () => {
        const add = vi.spyOn(document, "addEventListener");
        const remove = vi.spyOn(document, "removeEventListener");
        onTestFinished(() => {
          add.mockRestore();
          remove.mockRestore();
        });
        const watched = (spy: typeof add) =>
          spy.mock.calls.filter(([type]) => type === "pointerdown").length;
        const user = setupUser();
        const { unmount } = render(<Harness />);
        expect(watched(add)).toBe(0);
        await typeText(user, "ja");
        expect(watched(add)).toBe(1);
        // A leave decided at once stops watching; focus starts again.
        input().blur();
        await flushTasks(3);
        expect(watched(remove)).toBe(1);
        input().focus();
        expect(watched(add)).toBe(2);
        // A leave deferred to a release keeps watching until the release.
        fireEvent.pointerDown(document.body);
        input().blur();
        expect(watched(remove)).toBe(1);
        fireEvent.pointerUp(document.body);
        expect(watched(remove)).toBe(2);
        input().focus();
        expect(watched(add)).toBe(3);
        // Focus moving to another element stops watching.
        await user.click(screen.getByTestId("next"));
        expect(watched(remove)).toBe(3);
        await user.click(input());
        expect(watched(add)).toBe(4);
        // Unmounting while focused stops watching.
        unmount();
        expect(watched(remove)).toBe(4);
      });

      it("an input focused before hydration (no focus event) is watched from the mount", async () => {
        const ui = <Harness root={{ defaultValue: "fr", defaultInputValue: "France" }} />;
        const host = document.createElement("div");
        host.innerHTML = renderToString(ui);
        document.body.append(host);
        onTestFinished(() => host.remove());
        const field = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
        field.focus();
        const root = await act(async () => hydrateRoot(host, ui));
        onTestFinished(() => act(() => root.unmount()));
        fireEvent.change(field, { target: { value: "Ja" } });
        await flushTasks(3);
        fireEvent.pointerDown(document.body);
        field.blur();
        await flushTasks(3);
        expect(field.value).toBe("Ja");
        fireEvent.pointerUp(document.body);
        await flushTasks(3);
        expect(field.value).toBe("France");
      });

      it("without a press, focus to <body> decides one task later", async () => {
        const user = setupUser();
        render(<Harness />);
        await typeText(user, "ja");
        input().blur();
        await flushTasks(3);
        expect(input().value).toBe("");
        expect(isOpen()).toBe(false);
      });
    });

    it("a press on an option or the popup is prevented and keeps focus in the input", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      expect(fireEvent.pointerDown(option("jp"))).toBe(false);
      expect(fireEvent.mouseDown(option("jp"))).toBe(false);
      expect(fireEvent.pointerDown(popup())).toBe(false);
      expect(fireEvent.mouseDown(screen.getByTestId("list"))).toBe(false);
      expect(fireEvent.pointerDown(trigger())).toBe(false);
      expect(fireEvent.mouseDown(clearButton())).toBe(false);
      expect(document.activeElement).toBe(input());
    });
  });

  describe("active option revalidation", () => {
    it("removes aria-activedescendant when the active option unmounts", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
      await user.keyboard("am");
      await flushTasks(2);
      expect(optionTexts()).toEqual(["Jamaica"]);
      expect(input()).not.toHaveAttribute("aria-activedescendant");
    });

    it("typing clears the active option even when it stays mounted (APG)", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jm").id);
      await user.keyboard("a");
      expect(input()).not.toHaveAttribute("aria-activedescendant");
      await flushTasks(2);
      expect(optionTexts()).toEqual(["Japan", "Jamaica"]);
      expect(input()).not.toHaveAttribute("aria-activedescendant");
      expect(option("jm")).not.toHaveAttribute("data-active");
      // The arrows start again from the top.
      await user.keyboard("{ArrowDown}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
    });

    it("Home, End, Left and Right clear the active option without being prevented", async () => {
      const user = setupUser();
      render(<Harness root={{ autoHighlight: true }} />);
      await typeText(user, "j");
      for (const key of ["Home", "End", "ArrowLeft", "ArrowRight"]) {
        await user.keyboard("{ArrowDown}");
        expect(input()).toHaveAttribute("aria-activedescendant");
        expect(fireEvent.keyDown(input(), { key })).toBe(true);
        await flushTasks(2);
        // autoHighlight does not take it back: the results did not change.
        expect(input()).not.toHaveAttribute("aria-activedescendant");
        expect(isOpen()).toBe(true);
      }
    });

    it("Enter after typing past the highlight commits the typed text, not the old option", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action }} />);
      await typeText(user, "ja");
      await user.keyboard("{ArrowDown}");
      await user.keyboard("p{Enter}");
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.lastCall![0]).toBe("jap");
      expect(action.mock.lastCall![1].custom).toBe(true);
    });

    it("autoHighlight: the first enabled option once the results are not stale", async () => {
      const search = createSearch();
      search.resolve("j");
      const user = setupUser();
      render(
        <Harness
          root={{ autoHighlight: true }}
          results={(query) => <search.Results query={query} />}
        />,
      );
      await typeText(user, "j");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
      await user.keyboard("{ArrowDown}");
      expect(input()).toHaveAttribute("aria-activedescendant", option("jm").id);
      await user.keyboard("{Backspace}f");
      await flushTasks(2);
      // Stale: the old results stay, nothing is active (typing cleared it; not re-highlighted).
      expect(list()).toHaveAttribute("data-stale", "");
      expect(input()).not.toHaveAttribute("aria-activedescendant");
      await act(async () => search.resolve("f"));
      await flushTasks(2);
      expect(input()).toHaveAttribute("aria-activedescendant", option("fr").id);
      await user.keyboard("{Enter}");
      expect(input().value).toBe("France");
    });

    it("autoHighlight never highlights stale results: a fast Enter commits the text or does nothing", async () => {
      for (const allowCustomValue of [true, false]) {
        const search = createSearch();
        search.resolve("ja");
        const action = vi.fn<ValueAction>();
        const user = setupUser();
        const { unmount } = render(
          <Harness
            root={{ autoHighlight: true, allowCustomValue, valueChangeAction: action }}
            results={(query) => <search.Results query={query} />}
          />,
        );
        await typeText(user, "ja");
        expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
        await user.keyboard("m");
        await flushTasks(2);
        expect(list()).toHaveAttribute("data-stale", "");
        expect(input()).not.toHaveAttribute("aria-activedescendant");
        await user.keyboard("{Enter}");
        await flushTasks(2);
        if (allowCustomValue) {
          expect(action).toHaveBeenCalledTimes(1);
          expect(action.mock.lastCall![0]).toBe("jam");
        } else {
          expect(action).not.toHaveBeenCalled();
          expect(input().value).toBe("jam");
          expect(isOpen()).toBe(true);
        }
        unmount();
      }
    });

    it("forgets the active option when the listbox closes", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}");
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(input()).not.toHaveAttribute("aria-activedescendant");
    });
  });

  describe("Empty and Status", () => {
    it("Empty shows only with no options and settled results; data-empty likewise", async () => {
      const search = createSearch();
      const user = setupUser();
      render(
        <Harness
          results={(query) => (
            <Suspense
              fallback={<Combobox.Status data-testid="loading">Searching…</Combobox.Status>}
            >
              <search.Results query={query} />
            </Suspense>
          )}
        />,
      );
      await typeText(user, "j");
      // First load: the fallback shows, Empty does not. The listbox is busy and the Status is
      // no live region (a listbox owns only options and groups).
      expect(screen.getByTestId("loading")).toHaveTextContent("Searching…");
      expect(screen.getByTestId("loading")).toHaveAttribute("role", "none");
      expect(list()).toHaveAttribute("aria-busy", "true");
      expect(list()).not.toHaveAttribute("data-stale");
      expect(screen.queryByTestId("empty")).toBeNull();
      expect(list()).not.toHaveAttribute("data-empty");
      await act(async () => search.resolve("j"));
      await flushTasks(2);
      expect(screen.queryByTestId("loading")).toBeNull();
      expect(list()).not.toHaveAttribute("aria-busy");
      expect(screen.queryByTestId("empty")).toBeNull();
      await user.keyboard("zz");
      await flushTasks(2);
      // Stale old results: no Empty.
      expect(list()).toHaveAttribute("data-stale", "");
      expect(screen.queryByTestId("empty")).toBeNull();
      await act(async () => search.resolve("jzz"));
      await flushTasks(2);
      expect(optionTexts()).toEqual([]);
      expect(screen.getByTestId("empty")).toHaveTextContent("No country");
      expect(list()).toHaveAttribute("data-empty", "");
    });

    it("a Status outside the List is a hint and does not hide Empty", async () => {
      const user = setupUser();
      render(
        <Harness
          afterList={
            <>
              <Combobox.Status>Type a country</Combobox.Status>
              <Combobox.Empty data-testid="empty">No country</Combobox.Empty>
            </>
          }
        />,
      );
      await typeText(user, "zz");
      expect(screen.getByTestId("empty")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Type a country");
      expect(list()).not.toHaveAttribute("aria-busy");
    });
  });

  describe("announcements", () => {
    function stubAriaNotify() {
      const notify = vi.fn();
      Object.defineProperty(Element.prototype, "ariaNotify", {
        configurable: true,
        value: function (this: Element, message: string) {
          notify(this, message);
        },
      });
      return notify;
    }
    afterEach(() => {
      delete (Element.prototype as { ariaNotify?: unknown }).ariaNotify;
    });

    it("announces the default English count on the List once per settled result set", async () => {
      const notify = stubAriaNotify();
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenLastCalledWith(list(), "3 results");
      await user.keyboard("a");
      await flushTasks(2);
      expect(notify).toHaveBeenLastCalledWith(list(), "2 results");
      await user.keyboard("m");
      await flushTasks(2);
      expect(notify).toHaveBeenLastCalledWith(list(), "1 result");
      await user.keyboard("z");
      await flushTasks(2);
      expect(notify).toHaveBeenLastCalledWith(list(), "No results");
      expect(notify).toHaveBeenCalledTimes(4);
      // A re-render with the same results announces nothing.
      await user.keyboard("{ArrowDown}");
      expect(notify).toHaveBeenCalledTimes(4);
    });

    it("announces nothing while stale", async () => {
      const notify = stubAriaNotify();
      const search = createSearch();
      search.resolve("j");
      const user = setupUser();
      render(<Harness results={(query) => <search.Results query={query} />} />);
      await typeText(user, "j");
      expect(notify).toHaveBeenCalledTimes(1);
      await user.keyboard("a");
      await flushTasks(2);
      expect(list()).toHaveAttribute("data-stale", "");
      expect(notify).toHaveBeenCalledTimes(1);
      await act(async () => search.resolve("ja"));
      await flushTasks(2);
      expect(notify).toHaveBeenCalledTimes(2);
      expect(notify).toHaveBeenLastCalledWith(list(), "2 results");
    });

    it("announces nothing while the Suspense fallback shows in the List, then the count", async () => {
      const notify = stubAriaNotify();
      const search = createSearch();
      const user = setupUser();
      render(
        <Harness
          results={(query) => (
            <Suspense
              fallback={<Combobox.Status data-testid="loading">Searching…</Combobox.Status>}
            >
              <search.Results query={query} />
            </Suspense>
          )}
        />,
      );
      await typeText(user, "j");
      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(isOpen()).toBe(true);
      await flushTasks(2);
      expect(notify).not.toHaveBeenCalled();
      await act(async () => search.resolve("j"));
      await flushTasks(2);
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenLastCalledWith(list(), "3 results");
    });

    it("uses announce(count, state), and nothing when it returns null", async () => {
      const notify = stubAriaNotify();
      const announce = vi.fn((count: number, state: ComboboxRootState) =>
        state.query === "x" ? null : `${count} countries`,
      );
      const user = setupUser();
      render(<Harness root={{ announce }} />);
      await typeText(user, "j");
      expect(notify).toHaveBeenLastCalledWith(list(), "3 countries");
      await user.clear(input());
      await user.keyboard("x");
      await flushTasks(2);
      expect(announce).toHaveBeenLastCalledWith(0, expect.objectContaining({ query: "x" }));
      // "3 countries" for "j", "4 countries" for the emptied text, nothing for "x".
      expect(notify).toHaveBeenCalledTimes(2);
      expect(notify).toHaveBeenLastCalledWith(list(), "4 countries");
    });

    it("does nothing where ariaNotify is missing", async () => {
      const announce = vi.fn(() => "x");
      const user = setupUser();
      render(<Harness root={{ announce }} />);
      await typeText(user, "j");
      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe("Clear", () => {
    it("writes empty text, dispatches null with the click and keeps focus", async () => {
      const action = vi.fn<ValueAction>();
      const texts = vi.fn<TextAction>();
      const user = setupUser();
      render(
        <Harness
          root={{
            defaultValue: "fr",
            defaultInputValue: "France",
            valueChangeAction: action,
            onInputValueChange: texts,
            name: "country",
          }}
        />,
      );
      await user.click(input());
      await user.click(clearButton());
      await flushTasks(2);
      expect(input().value).toBe("");
      expect(texts).toHaveBeenCalledWith("", expect.anything());
      expect(texts.mock.lastCall![1].reason).toBe("activate");
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![0]).toBeNull();
      expect(action.mock.calls[0]![1].reason).toBe("activate");
      expect(action.mock.calls[0]![1].custom).toBe(false);
      expect(action.mock.calls[0]![1].event?.type).toBe("click");
      expect(hidden()!.value).toBe("");
      expect(input()).not.toHaveAttribute("data-selected");
      expect(document.activeElement).toBe(input());
      await user.click(clearButton());
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe("disabled on component renders (#83, design/components/button.md 17.3)", () => {
    function Box({
      disabled,
      render: element,
    }: {
      disabled: boolean;
      render?: React.ReactElement<React.ComponentPropsWithRef<"button">>;
    }) {
      return (
        <Combobox.Root
          defaultValue="fr"
          defaultInputValue="France"
          openChangeAction={openAction}
          valueChangeAction={valueAction}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger
            data-testid="trigger"
            aria-label="Show all"
            disabled={disabled}
            render={element}
          />
          <Combobox.Clear
            data-testid="clear"
            aria-label="Clear"
            disabled={disabled}
            render={element}
          />
          <Combobox.Popup data-testid="popup">
            <Combobox.List data-testid="list">
              {({ query }) => <Options query={query} />}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      );
    }
    const openAction = vi.fn<OpenAction>();
    const valueAction = vi.fn<ValueAction>();
    afterEach(() => {
      openAction.mockReset();
      valueAction.mockReset();
    });

    it("a component render disabled: aria-disabled, tabIndex -1, a click neither opens nor clears", async () => {
      render(<Box disabled render={<PlainButton />} />);
      for (const el of [trigger(), clearButton()]) {
        expect(el).toHaveAttribute("aria-disabled", "true");
        expect(el).not.toHaveAttribute("disabled");
        expect(el).toHaveAttribute("data-disabled", "");
        expect(el).toHaveAttribute("tabindex", "-1");
        expect(fireEvent.click(el)).toBe(false); // cancelled
      }
      await setupUser().click(trigger());
      await setupUser().click(clearButton());
      await flushTasks(2);
      expect(openAction).not.toHaveBeenCalled();
      expect(valueAction).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expect(input().value).toBe("France");
    });

    it("a host button (no render) disabled: native disabled, no aria-disabled (unchanged)", () => {
      render(<Box disabled />);
      for (const el of [trigger(), clearButton()]) {
        expect(el).toBeDisabled();
        expect(el).not.toHaveAttribute("aria-disabled");
      }
    });
  });

  // Design 12.1 Trigger row (#112). The popover shim never light-dismisses, so the browser rows
  // ("Trigger close") are the ones that prove a press is not a light dismiss.
  describe("Trigger close (#112)", () => {
    it("a <button> Trigger names the Popup as its invoker after mount, never in the server HTML", () => {
      const html = renderToString(<Harness />);
      const server = document.createElement("div");
      server.innerHTML = html;
      const serverTrigger = server.querySelector('[data-testid="trigger"]')!;
      expect(serverTrigger.tagName).toBe("BUTTON");
      expect(serverTrigger).not.toHaveAttribute("popovertarget");
      expect(serverTrigger).not.toHaveAttribute("commandfor");
      expect(serverTrigger).not.toHaveAttribute("command");
      // No state before hydration either (#121): the Input carries it.
      expect(serverTrigger).not.toHaveAttribute("aria-expanded");
      render(<Harness />);
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).not.toHaveAttribute("commandfor");
      expect(trigger()).not.toHaveAttribute("command");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
    });

    it("a non-button render gets no popovertarget, renders aria-expanded from shown and warns", async () => {
      const error = silenceErrors();
      render(
        <Combobox.Root>
          <Combobox.Input aria-label="Country" />
          <Combobox.Trigger data-testid="trigger" aria-label="Show all" render={<span />} />
          <Combobox.Popup data-testid="popup">
            <Combobox.List aria-label="Countries">
              {({ query }) => <Options query={query} />}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>,
      );
      expect(trigger().tagName).toBe("SPAN");
      expect(trigger()).not.toHaveAttribute("popovertarget");
      expect(trigger()).not.toHaveAttribute("commandfor");
      expect(trigger()).not.toHaveAttribute("command");
      // No invoker, so the Trigger exposes the shown listbox itself (#118, #121).
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      act(() => trigger().click());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      // The `toggle` that reports it shown is a task after `showPopover()`.
      await flushTasks(2);
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      const messages = error.mock.calls.map(([message]) => String(message));
      expect(
        messages.filter((m) => m.includes("Combobox.Trigger: rendered a <span>. Only a <button>")),
      ).toHaveLength(1);
    });

    it("removes popovertarget when the Trigger's element goes away (a render swap)", () => {
      const error = silenceErrors();
      function Swap({ span }: { span: boolean }) {
        return (
          <Combobox.Root>
            <Combobox.Input aria-label="Country" />
            <Combobox.Trigger
              data-testid="trigger"
              aria-label="Show all"
              render={span ? <span /> : undefined}
            />
            <Combobox.Popup data-testid="popup">
              <Combobox.List aria-label="Countries">
                {({ query }) => <Options query={query} />}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Root>
        );
      }
      const { rerender } = render(<Swap span={false} />);
      const button = trigger();
      expect(button).toHaveAttribute("popovertarget", popup().id);
      rerender(<Swap span />);
      expect(trigger()).not.toBe(button);
      expect(button).not.toHaveAttribute("popovertarget");
      expect(trigger()).not.toHaveAttribute("popovertarget");
      expect(error).toHaveBeenCalled();
    });

    it("a disabled component render is no invoker: aria-disabled, no popovertarget, aria-expanded from shown (#132)", async () => {
      const openAction = vi.fn<OpenAction>();
      const user = setupUser();
      const { rerender } = render(
        <Harness
          root={{ openChangeAction: openAction }}
          trigger={{ disabled: true, render: <PlainButton /> }}
        />,
      );
      expect(trigger().tagName).toBe("BUTTON");
      expect(trigger()).toHaveAttribute("aria-disabled", "true");
      expect(trigger()).not.toHaveAttribute("disabled");
      expect(trigger()).not.toHaveAttribute("popovertarget");
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      // A cancelled click that opens nothing.
      expect(fireEvent.click(trigger())).toBe(false);
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(openAction).not.toHaveBeenCalled();
      // Shown through typing: the Trigger exposes it itself.
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
      await flushTasks(2);
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      // Enabled: an invoker again, the browser exposes the state.
      rerender(
        <Harness
          root={{ openChangeAction: openAction }}
          trigger={{ disabled: false, render: <PlainButton /> }}
        />,
      );
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(trigger()).not.toHaveAttribute("aria-disabled");
      // And back.
      rerender(
        <Harness
          root={{ openChangeAction: openAction }}
          trigger={{ disabled: true, render: <PlainButton /> }}
        />,
      );
      expect(trigger()).not.toHaveAttribute("popovertarget");
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
    });

    it("a natively disabled host button keeps popovertarget (an invoker; the browser's own disabled check applies)", () => {
      render(<Harness trigger={{ disabled: true }} />);
      expect(trigger()).toBeDisabled();
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).not.toHaveAttribute("aria-expanded");
    });

    it("popoverTarget, popoverTargetAction, commandfor and command are owned keys", () => {
      // @ts-expect-error -- owned key, omitted from ComboboxTriggerProps
      const popoverTarget: ComboboxTriggerProps = { popoverTarget: "elsewhere" };
      // @ts-expect-error -- owned key, omitted from ComboboxTriggerProps
      const popoverTargetAction: ComboboxTriggerProps = { popoverTargetAction: "show" };
      // @ts-expect-error -- reserved key, omitted from ComboboxTriggerProps
      const commandfor: ComboboxTriggerProps = { commandfor: "elsewhere" };
      // @ts-expect-error -- reserved key, omitted from ComboboxTriggerProps
      const command: ComboboxTriggerProps = { command: "show-popover" };
      expect([popoverTarget, popoverTargetAction, commandfor, command]).toHaveLength(4);
      // A render element cannot set them either: the ref writes the Popup's id.
      render(
        <Harness
          trigger={{
            render: (
              <button
                type="button"
                popoverTarget="elsewhere"
                popoverTargetAction="show"
                commandfor="elsewhere"
                command="show-popover"
              />
            ),
          }}
        />,
      );
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).not.toHaveAttribute("popovertargetaction");
      expect(trigger()).not.toHaveAttribute("commandfor");
      expect(trigger()).not.toHaveAttribute("command");
    });

    it("every click is cancelled, closed and open (the command never runs)", async () => {
      render(<Harness />);
      expect(fireEvent.click(trigger())).toBe(false);
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(popoverSource(popup())).toBe(input());
      expect(fireEvent.click(trigger())).toBe(false);
      await flushTasks(2);
      expect(isOpen()).toBe(false);
    });

    it("toggles against the intended state: a click while open closes with one (false, activate)", async () => {
      const openAction = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: openAction }} />);
      act(() => trigger().click());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      openAction.mockClear();
      const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
      act(() => {
        trigger().dispatchEvent(click);
      });
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(openAction).toHaveBeenCalledTimes(1);
      expect(openAction.mock.calls[0]![0]).toBe(false);
      expect(openAction.mock.calls[0]![1].reason).toBe("activate");
      expect(openAction.mock.calls[0]![1].event).toBe(click);
      // Closed some other way (a dismissal): the next click opens.
      act(() => trigger().click());
      await flushTasks(2);
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      openAction.mockClear();
      act(() => trigger().click());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(openAction.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[true, "activate"]]);
    });

    it("a dismissal: not expanded once the listbox is hidden, while the notification runs (#118)", async () => {
      const close = deferred();
      const openAction = vi.fn<OpenAction>((next) => (next ? undefined : close.promise));
      render(<Harness root={{ openChangeAction: openAction }} />);
      act(() => trigger().click());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      // The `toggle` that reports it shown is a task after `showPopover()`.
      await flushTasks(2);
      expect(input()).toHaveAttribute("aria-expanded", "true");
      // What Escape or a light dismiss does: the browser hides the listbox at once.
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expectPending(input());
      expect(input()).toHaveAttribute("aria-expanded", "false");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      await act(async () => close.resolve());
      await flushTasks(2);
      expectNotPending(input());
      expect(input()).toHaveAttribute("aria-expanded", "false");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
    });

    it("a dismissal entangled with an unrelated pending action: not expanded meanwhile (#118)", async () => {
      const save = deferred();
      const openAction = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: openAction }} />);
      act(() => trigger().click());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      // An unrelated async action holds every transition, the notification's included.
      act(() => startTransition(() => save.promise));
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(openAction.mock.calls.at(-1)![0]).toBe(false);
      expectPending(input());
      expect(input()).toHaveAttribute("aria-expanded", "false");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      await act(async () => save.resolve());
      await flushTasks(2);
      expectNotPending(input());
      expect(input()).toHaveAttribute("aria-expanded", "false");
    });

    it("a controlled open={true} parent that refuses the close keeps the listbox shown", async () => {
      const close = deferred();
      const openAction = vi.fn<OpenAction>(() => close.promise);
      const hide = spyHide();
      render(<Harness root={{ open: true, openChangeAction: openAction }} />);
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      act(() => trigger().click());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expectPending(trigger());
      // Optimistically closed, but the listbox is still shown: the input's `aria-expanded` is the
      // shown state (#118); the Trigger renders none, the browser exposes it (#121).
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(input()).toHaveAttribute("aria-expanded", "true");
      await act(async () => close.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expectNotPending(trigger());
      expect(input()).toHaveAttribute("aria-expanded", "true");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(hide).not.toHaveBeenCalled();
      expect(openAction.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[false, "activate"]]);
    });
  });

  describe("foreign popovertarget invoker (#125)", () => {
    it("a close that moves no focus is 'activate' with the ToggleEvent", async () => {
      const openAction = vi.fn<OpenAction>();
      const user = setupUser();
      render(<Harness root={{ openChangeAction: openAction }} />);
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
      openAction.mockClear();
      const foreign = screen.getByTestId("elsewhere");
      foreign.setAttribute("popovertarget", popup().id);
      // The click alone: the press keeps focus in the input (#126, the guard rows below).
      act(() => foreign.click());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(openAction).toHaveBeenCalledTimes(1);
      const [next, details] = openAction.mock.calls[0]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event!.type).toBe("beforetoggle");
      expect((details.event as ToggleEvent & { source?: unknown }).source).toBe(foreign);
    });
  });

  describe("a press on a foreign invoker of the shown listbox (#126)", () => {
    // The Popup's document capture `mousedown` guard: the input keeps focus, so its focusout never
    // pre-empts the click's own toggle and the text is left alone (design 5.4, conventions 3.5).
    it("a popovertarget or commandfor button: prevented while shown, the input keeps focus", async () => {
      const user = setupUser();
      render(<Harness />);
      const foreign = screen.getByTestId("elsewhere");
      foreign.setAttribute("popovertarget", popup().id);
      // Closed: an ordinary press.
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(true);
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
      expect(fireEvent.mouseDown(foreign, { button: 2 })).toBe(true);
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(false);
      foreign.removeAttribute("popovertarget");
      foreign.setAttribute("commandfor", popup().id);
      foreign.setAttribute("command", "hide-popover");
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(false);
      expect(input()).toHaveFocus();
      expect(input().value).toBe("j");
      expect(isOpen()).toBe(true);
      // Closed again (a dismissal: `hidePopover()` in jsdom): the guard is gone.
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(true);
    });

    it("a plain button is an outside press", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
      expect(fireEvent.mouseDown(screen.getByTestId("elsewhere"), { button: 0 })).toBe(true);
    });

    it("an <input type=button popovertarget> is guarded too", async () => {
      const user = setupUser();
      render(<Harness />);
      await typeText(user, "j");
      const foreign = document.createElement("input");
      foreign.type = "button";
      foreign.setAttribute("popovertarget", popup().id);
      document.body.append(foreign);
      onTestFinished(() => foreign.remove());
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(false);
      foreign.type = "reset";
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(false);
      foreign.type = "text";
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(true);
    });

    // HTML's invoker relationship: a submit button with a form owner invokes nothing, so its press
    // is an outside press (#126 review F1).
    it("a submit button in a form naming the popup: focus leaves, 'dismiss', the text reverts", async () => {
      const openAction = vi.fn<OpenAction>();
      const user = setupUser();
      render(<Harness root={{ openChangeAction: openAction }} />);
      const form = document.createElement("form");
      form.addEventListener("submit", (event) => event.preventDefault());
      const foreign = document.createElement("button");
      foreign.textContent = "Submit";
      foreign.setAttribute("popovertarget", popup().id);
      form.append(foreign);
      document.body.append(form);
      onTestFinished(() => form.remove());
      await typeText(user, "Jamaicax");
      expect(isOpen()).toBe(true);
      openAction.mockClear();
      expect(fireEvent.mouseDown(foreign, { button: 0 })).toBe(true);
      await user.click(foreign);
      await flushTasks(2);
      expect(foreign).toHaveFocus();
      expect(isOpen()).toBe(false);
      expect(input().value).toBe("");
      expect(openAction.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[false, "dismiss"]]);
    });

    it("unmounting while shown removes the listener", async () => {
      const added: EventListenerOrEventListenerObject[] = [];
      const user = setupUser();
      const { unmount } = render(<Harness />);
      const add = vi.spyOn(document, "addEventListener").mockImplementation(function (
        this: Document,
        ...args: Parameters<Document["addEventListener"]>
      ) {
        if (args[0] === "mousedown" && args[2] === true) added.push(args[1]!);
        return EventTarget.prototype.addEventListener.apply(this, args);
      });
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
      add.mockRestore();
      expect(added).toHaveLength(1);
      const remove = vi.spyOn(document, "removeEventListener");
      unmount();
      expect(remove).toHaveBeenCalledWith("mousedown", added[0], true);
    });
  });

  describe("Input press (#123)", () => {
    // `source` is no light-dismiss exemption: a primary press on the field while the listbox is
    // shown captures the pointer to the Popup, so the release is not a light dismiss (design 5.4).
    // The real-pointer outcome is in combobox.browser.test.tsx; these rows pin the call.
    const press = (init: PointerEventInit = {}) =>
      act(() => {
        input().dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            composed: true,
            button: 0,
            buttons: 1,
            pointerId: 7,
            pointerType: "mouse",
            isPrimary: true,
            ...init,
          }),
        );
      });
    const spyCapture = () => vi.spyOn(Element.prototype, "setPointerCapture");

    it("while shown: captures the pointer to the Popup once, with the press's pointer id", async () => {
      const openAction = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: openAction }} />);
      act(() => trigger().click());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      openAction.mockClear();
      const capture = spyCapture();
      press();
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledWith(7);
      expect(capture.mock.contexts[0]).toBe(popup());
      expect(capturedPointers.get(7)).toBe(popup());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(openAction).not.toHaveBeenCalled();
    });

    it("a touch press is captured too (capture at pointerdown, not the compat mousedown)", async () => {
      render(<Harness />);
      act(() => trigger().click());
      await flushTasks(2);
      const capture = spyCapture();
      press({ pointerType: "touch", pointerId: 3 });
      expect(capture).toHaveBeenCalledWith(3);
      expect(capture.mock.contexts[0]).toBe(popup());
    });

    it("while closed: nothing is captured", async () => {
      render(<Harness />);
      const capture = spyCapture();
      press();
      expect(isOpen()).toBe(false);
      expect(capture).not.toHaveBeenCalled();
    });

    it("a secondary-button press is not captured (the field's own context menu)", async () => {
      render(<Harness />);
      act(() => trigger().click());
      await flushTasks(2);
      const capture = spyCapture();
      press({ button: 2, buttons: 2 });
      press({ button: 1, buttons: 4 });
      expect(capture).not.toHaveBeenCalled();
    });

    it("disabled while shown: nothing is captured", async () => {
      function Toggle() {
        const [disabled, setDisabled] = useState(false);
        return (
          <>
            <button type="button" data-testid="disable" onClick={() => setDisabled(true)}>
              Disable
            </button>
            <Harness root={{ disabled, open: true }} />
          </>
        );
      }
      render(<Toggle />);
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      act(() => screen.getByTestId("disable").click());
      await flushTasks(2);
      // A controlled open={true} parent keeps it shown; the disabled Root still captures nothing.
      expect(isOpen()).toBe(true);
      expect(input()).toBeDisabled();
      const capture = spyCapture();
      press();
      expect(capture).not.toHaveBeenCalled();
    });

    it("judged on :popover-open: a press during a pending close is still captured", async () => {
      const close = deferred();
      const openAction = vi.fn<OpenAction>(() => close.promise);
      render(<Harness root={{ open: true, openChangeAction: openAction }} />);
      await flushTasks(2);
      act(() => trigger().click());
      await flushTasks(2);
      // Optimistically closed, still shown.
      expect(input()).not.toHaveAttribute("data-open");
      expect(isOpen()).toBe(true);
      const capture = spyCapture();
      press();
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture.mock.contexts[0]).toBe(popup());
      await act(async () => close.resolve());
    });

    it("a throwing setPointerCapture is swallowed", async () => {
      render(<Harness />);
      act(() => trigger().click());
      await flushTasks(2);
      vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {
        throw new DOMException("No active pointer", "NotFoundError");
      });
      expect(() => press()).not.toThrow();
      expect(isOpen()).toBe(true);
    });

    it("openOnClick still opens from a press and click while closed", async () => {
      const capture = spyCapture();
      const user = setupUser();
      render(<Harness root={{ openOnClick: true }} />);
      await user.click(input());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(capture).not.toHaveBeenCalled();
    });

    it("onPointerDown is an owned key", () => {
      // @ts-expect-error -- owned key, omitted from ComboboxInputProps
      const props: ComboboxInputProps = { onPointerDown: () => {} };
      expect(props).toBeDefined();
    });

    it("onFocus is an owned key; onFocusCapture passes through", () => {
      // @ts-expect-error -- owned key, omitted from ComboboxInputProps
      const props: ComboboxInputProps = { onFocus: () => {} };
      const capture: ComboboxInputProps = { onFocusCapture: () => {} };
      expect(props).toBeDefined();
      expect(capture).toBeDefined();
    });
  });

  describe("platform: mount reconciliation", () => {
    const hydrate = (ui: ReactNode, typed: string) =>
      hydrateFromServer(ui, {
        mutate: (c) => {
          c.querySelector<HTMLInputElement>('[role="combobox"]')!.value = typed;
        },
        flush: () => flushTasks(2),
      });

    renderBoth("typed before hydration", (mode) => {
      it("adopts the DOM text once with reason platform, opens nothing, dispatches no value", async () => {
        const texts = vi.fn<TextAction>();
        const action = vi.fn<ValueAction>();
        const openAction = vi.fn<OpenAction>();
        await hydrate(
          <StrictMode>
            <TextHarness
              mode={mode}
              action={texts}
              root={{ valueChangeAction: action, openChangeAction: openAction }}
            />
          </StrictMode>,
          "jap",
        );
        expect(texts).toHaveBeenCalledTimes(1);
        expect(texts.mock.calls[0]![0]).toBe("jap");
        expect(texts.mock.calls[0]![1].reason).toBe("platform");
        expect(texts.mock.calls[0]![1].event).toBeUndefined();
        expect(input().value).toBe("jap");
        expect(action).not.toHaveBeenCalled();
        expect(openAction).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
        if (mode === "controlled")
          expect(screen.getByTestId("parent-text")).toHaveTextContent("jap");
        // The next ArrowDown opens with results for the adopted text.
        const user = setupUser();
        await user.click(input());
        await user.keyboard("{ArrowDown}");
        await flushTasks(2);
        expect(optionTexts()).toEqual(["Japan"]);
      });
    });

    it("dispatches nothing when the DOM text matches", async () => {
      const texts = vi.fn<TextAction>();
      await hydrate(
        <Harness root={{ defaultInputValue: "Fr", onInputValueChange: texts }} />,
        "Fr",
      );
      expect(texts).not.toHaveBeenCalled();
    });
  });

  renderBoth("platform: form reset", (mode) => {
    function Form({ action, texts }: { action?: ValueAction; texts?: TextAction }) {
      return (
        <form data-testid="form">
          <ValueHarness
            mode={mode}
            action={action}
            root={{
              name: "country",
              defaultValue: "fr",
              defaultInputValue: "France",
              onInputValueChange: texts,
            }}
          />
          <button type="reset">Reset</button>
        </form>
      );
    }

    it("form.reset(): one platform value dispatch and one text write, from the mirrored defaults", async () => {
      const action = vi.fn<ValueAction>();
      const texts = vi.fn<TextAction>();
      const user = setupUser();
      render(<Form action={action} texts={texts} />);
      await user.click(input());
      await user.clear(input());
      await user.keyboard("ja");
      await flushTasks(2);
      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
      await flushTasks(2);
      expect(hidden()!.value).toBe("jm");
      expect(input().value).toBe("Jamaica");
      action.mockClear();
      texts.mockClear();
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).reset();
      });
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![0]).toBe("fr");
      expect(action.mock.calls[0]![1].reason).toBe("platform");
      expect(action.mock.calls[0]![1].event?.type).toBe("reset");
      expect(texts).toHaveBeenCalledTimes(1);
      expect(texts.mock.calls[0]![0]).toBe("France");
      expect(texts.mock.calls[0]![1].reason).toBe("platform");
      expect(input().value).toBe("France");
      expect(input().defaultValue).toBe("France");
      expect(hidden()!.value).toBe("fr");
    });

    it("<button type=reset> resets too; a cancelled reset dispatches nothing", async () => {
      const action = vi.fn<ValueAction>();
      const user = setupUser();
      render(<Form action={action} />);
      await user.click(input());
      await user.clear(input());
      await user.keyboard("ja");
      await flushTasks(2);
      await user.click(option("jp"));
      await flushTasks(2);
      action.mockClear();
      const form = screen.getByTestId("form");
      const cancel = (event: Event) => event.preventDefault();
      form.addEventListener("reset", cancel);
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushTasks(2);
      expect(action).not.toHaveBeenCalled();
      form.removeEventListener("reset", cancel);
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(input().value).toBe("France");
      expect(hidden()!.value).toBe("fr");
    });
  });

  it("reset targets: the latest defaults (uncontrolled), the mount-time values (controlled)", async () => {
    const action = vi.fn<ValueAction>();
    const texts = vi.fn<TextAction>();
    const form = () => screen.getByTestId("form") as HTMLFormElement;
    const ui = (root: Partial<ComboboxRootProps>) => (
      <form data-testid="form">
        <Harness
          root={{ name: "c", valueChangeAction: action, onInputValueChange: texts, ...root }}
        />
      </form>
    );
    const { rerender, unmount } = render(ui({ defaultValue: "fr", defaultInputValue: "France" }));
    rerender(ui({ defaultValue: "jp", defaultInputValue: "Japan" }));
    await act(async () => form().reset());
    await flushTasks(2);
    expect(action.mock.calls.map(([n]) => n)).toEqual(["jp"]);
    expect(texts.mock.calls.map(([t]) => t)).toEqual(["Japan"]);
    unmount();
    action.mockClear();
    texts.mockClear();
    const controlled = render(ui({ value: "fr", inputValue: "France" }));
    controlled.rerender(ui({ value: "jm", inputValue: "Jamaica" }));
    await act(async () => form().reset());
    await flushTasks(2);
    expect(action.mock.calls.map(([n]) => n)).toEqual(["fr"]);
    expect(texts.mock.calls.map(([t]) => t)).toEqual(["France"]);
  });

  it("React's automatic reset after a form action restores the defaults", async () => {
    const submit = deferred();
    const action = vi.fn<ValueAction>();
    const user = setupUser();
    render(
      <form
        action={async () => {
          await submit.promise;
        }}
      >
        <Harness root={{ name: "country", valueChangeAction: action }} />
        <button type="submit">Send</button>
      </form>,
    );
    await typeText(user, "fr");
    await user.keyboard("{ArrowDown}{Enter}");
    await flushTasks(2);
    expect(hidden()!.value).toBe("fr");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => submit.resolve());
    await flushTasks(2);
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]![0]).toBeNull();
    expect(action.mock.calls[1]![1].reason).toBe("platform");
    expect(input().value).toBe("");
    expect(hidden()!.value).toBe("");
  });

  it("a controlled text parent that refuses the reset gets the DOM re-synced", async () => {
    const user = setupUser();
    render(
      <form data-testid="form">
        <Harness root={{ inputValue: "Kept", onInputValueChange: () => {} }} />
      </form>,
    );
    await user.click(input());
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    await flushTasks(2);
    expect(input().value).toBe("Kept");
  });

  renderBoth("suspending content", (mode) => {
    it("content keyed on the value keeps the old content with the input pending", async () => {
      const content = createSuspender();
      content.resolve("none");
      const user = setupUser();
      function Detail({ value }: { value: string | null }) {
        return <content.Suspender value={value ?? "none"} />;
      }
      function App() {
        const [value, setValue] = useState<string | null>(null);
        return (
          <Suspense fallback={<p data-testid="fallback">loading</p>}>
            <Harness
              root={
                mode === "controlled"
                  ? {
                      value,
                      valueChangeAction: (next) => startTransition(() => setValue(next)),
                    }
                  : {
                      valueChangeAction: (next) => startTransition(() => setValue(next)),
                    }
              }
            />
            <Detail value={value} />
          </Suspense>
        );
      }
      render(<App />);
      await typeText(user, "fr");
      await user.keyboard("{ArrowDown}{Enter}");
      await flushTasks(2);
      expect(screen.queryByTestId("fallback")).toBeNull();
      expect(screen.getByTestId("suspender")).toHaveTextContent("none");
      expectPending(input());
      await act(async () => content.resolve("fr", "France detail"));
      await flushTasks(2);
      expect(screen.getByTestId("suspender")).toHaveTextContent("France detail");
      expectNotPending(input());
    });

    it("results suspending outside the List hold the open with the input and Trigger pending", async () => {
      const shows = watchShow();
      const results = createSearch();
      const user = setupUser();
      function Slow() {
        return (
          <results.Gate gate="all">
            <Combobox.Option value="x">X</Combobox.Option>
          </results.Gate>
        );
      }
      render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger" aria-label="Show" />
          <Combobox.Popup data-testid="popup">
            <Combobox.List>
              <Slow />
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>,
      );
      await user.click(trigger());
      await flushTasks(2);
      expectPending(input());
      expectPending(trigger());
      // Optimistically open, nothing shown yet (#118).
      expect(input()).toHaveAttribute("data-open", "");
      expect(input()).toHaveAttribute("aria-expanded", "false");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(shows).toHaveLength(0);
      await act(async () => results.resolve("all"));
      await flushTasks(2);
      expect(shows).toHaveLength(1);
      expect(isOpen()).toBe(true);
      expect(input()).toHaveAttribute("aria-expanded", "true");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expectNotPending(input());
    });
  });

  describe("function props and render", () => {
    it("passes the documented state to every part", async () => {
      const seen: Record<string, unknown> = {};
      const save = deferred();
      const user = setupUser();
      render(
        <Combobox.Root valueChangeAction={() => save.promise}>
          {(state: ComboboxRootState) => {
            seen.root = state;
            return (
              <>
                <Combobox.Input
                  data-testid="input"
                  className={(s: ComboboxInputState) => {
                    seen.input = s;
                    return "in";
                  }}
                />
                <Combobox.Trigger aria-label="t">
                  {(s: ComboboxTriggerState) => {
                    seen.trigger = s;
                    return "v";
                  }}
                </Combobox.Trigger>
                <Combobox.Clear aria-label="c">
                  {(s: ComboboxClearState) => {
                    seen.clear = s;
                    return "x";
                  }}
                </Combobox.Clear>
                <Combobox.Popup
                  data-testid="popup"
                  className={(s: ComboboxPopupState) => {
                    seen.popup = s;
                    return "pop";
                  }}
                >
                  <Combobox.List
                    className={(s: ComboboxListState) => {
                      seen.list = s;
                      return "lst";
                    }}
                  >
                    <Combobox.Option value="a" data-testid="opt-a">
                      {(s: ComboboxOptionState) => {
                        seen.option = s;
                        return "A";
                      }}
                    </Combobox.Option>
                  </Combobox.List>
                </Combobox.Popup>
              </>
            );
          }}
        </Combobox.Root>,
      );
      await typeText(user, "a");
      await user.keyboard("{ArrowDown}{Enter}");
      expect(seen.root).toEqual({
        value: "a",
        inputValue: "A",
        query: "A",
        stale: false,
        activeValue: "a",
        open: true,
        pending: true,
        disabled: false,
      });
      expect(seen.input).toEqual({
        value: "a",
        inputValue: "A",
        open: true,
        pending: true,
        stale: false,
        disabled: false,
      });
      expect(seen.trigger).toEqual({ open: true, pending: false, disabled: false });
      expect(seen.clear).toEqual({ value: "a", inputValue: "A", disabled: false });
      expect(seen.popup).toEqual({ open: true, stale: false, query: "A" });
      expect(seen.list).toEqual({ query: "A", stale: false, empty: false });
      expect(seen.option).toEqual({
        value: "a",
        selected: true,
        active: true,
        pending: true,
        disabled: false,
      });
      expect(input()).toHaveClass("in");
      expect(popup()).toHaveClass("pop");
      await act(async () => save.resolve());
      await flushTasks(2);
    });

    it("render={<input type=search />} keeps the role and the handlers", async () => {
      const user = setupUser();
      render(<Harness root={{}} results={(q) => <Options query={q} />} popup={{}} />);
      document.body.innerHTML = "";
      render(
        <Combobox.Root>
          <Combobox.Input render={<input type="search" className="s" />} data-testid="input" />
          <Combobox.Popup data-testid="popup">
            <Combobox.List>{({ query }) => <Options query={query} />}</Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>,
      );
      expect(input()).toHaveAttribute("type", "search");
      expect(input()).toHaveAttribute("role", "combobox");
      expect(input()).toHaveClass("s");
      await typeText(user, "fr");
      expect(isOpen()).toBe(true);
      expect(optionTexts()).toEqual(["France"]);
    });

    it("warns about an Input rendered as something else", () => {
      const error = silenceErrors();
      render(
        <Combobox.Root>
          <Combobox.Input render={<button type="button" />} />
        </Combobox.Root>,
      );
      expect(
        error.mock.calls.some(([m]) => String(m).includes("Combobox.Input: rendered <button")),
      ).toBe(true);
    });

    it("Popup render element merges className and keeps the popover attributes", () => {
      render(<Harness popup={{ className: "a", render: <div className="b" /> }} />);
      expect(popup()).toHaveClass("a", "b");
      expect(popup()).toHaveAttribute("popover", "auto");
    });

    it("consumer style wins per property over the inline placement", () => {
      render(<Harness popup={{ style: { positionTryFallbacks: "none" } }} />);
      expect(popup().style.getPropertyValue("position-try-fallbacks")).toBe("none");
      expect(popup().style.getPropertyValue("position-area")).toBe(
        "self-block-end span-self-inline-end",
      );
    });

    it("forwards refs", () => {
      let inputEl: HTMLInputElement | null = null;
      let popupEl: HTMLDivElement | null = null;
      render(
        <Combobox.Root>
          <Combobox.Input
            ref={(el) => {
              inputEl = el;
            }}
          />
          <Combobox.Popup
            ref={(el) => {
              popupEl = el;
            }}
          />
        </Combobox.Root>,
      );
      expect(inputEl).toBeInstanceOf(HTMLInputElement);
      expect(popupEl).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("transition", () => {
    it("renders with and without transition", async () => {
      const user = setupUser();
      const { unmount } = render(<Harness popup={{ transition: "pop" }} />);
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
      unmount();
      render(<Harness />);
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
    });

    it("an accept-close holds the children through the close commit without transition, unmounts them with it", async () => {
      for (const transition of [undefined, { default: "none" } as const]) {
        const user = setupUser();
        let childrenAtHide = -1;
        const original = HTMLElement.prototype.hidePopover;
        const spy = vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(function (
          this: HTMLElement,
        ) {
          childrenAtHide = screen.queryAllByRole("option").length;
          return original.call(this);
        });
        const { unmount } = render(<Harness popup={transition ? { transition } : {}} />);
        await typeText(user, "j");
        await user.click(option("jp"));
        await flushTasks(2);
        if (transition) expect(childrenAtHide).toBe(0);
        else expect(childrenAtHide).toBeGreaterThan(0);
        spy.mockRestore();
        unmount();
      }
    });
  });

  it("types: UrgentChangeHandler is exported, UrgentChangeAction and inputValueChangeAction are not, multiple is not a prop", () => {
    expectTypeOf<ComboboxRootProps["onInputValueChange"]>().toEqualTypeOf<
      UrgentChangeHandler<string, ComboboxInputValueChangeDetails> | undefined
    >();
    const anySync: UrgentChangeHandler<string> = (next) => {
      void next;
    };
    void anySync;
    // @ts-expect-error `inputValueChangeAction` was renamed `onInputValueChange` (#96), no alias.
    const renamed: ComboboxRootProps = { inputValueChangeAction: () => {} };
    void renamed;
    // @ts-expect-error `multiple` is not in v1 (design 13).
    const props: ComboboxRootProps = { multiple: true };
    void props;
  });
});

// --- helpers ---------------------------------------------------------------------------------

interface TrackedPromise extends Promise<void> {
  status?: "pending" | "fulfilled";
  value?: undefined;
}

/**
 * A search cache keyed by query (design 6.1): `<Results query>` suspends until `resolve(query)`,
 * then renders the matching countries. A resolved query renders synchronously.
 */
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
  /** Suspends until `resolve(gate)`; for content that is not a result list. */
  function Gate({ gate, children }: { gate: string; children: ReactNode }) {
    use(entry(gate).promise);
    return children;
  }
  return {
    Results,
    Gate,
    resolve(query: string): void {
      const found = entry(query);
      (found.promise as TrackedPromise).status = "fulfilled";
      found.resolve();
    },
  };
}
// design/components/field-form.md 13.1, "Controls inside a Field".
describe("Combobox inside a Field.Root", () => {
  it("the Input is the Field's control; the List is named by Field.Label; name / disabled / required from the Field", async () => {
    const own = deferred();
    const submission = deferred();
    render(
      <Form.Root action={() => submission.promise}>
        <Field.Root name="country" required data-testid="root">
          <Field.Label data-testid="label">Country</Field.Label>
          <Combobox.Root valueChangeAction={() => own.promise}>
            <Combobox.Input data-testid="input" />
            <Combobox.Popup>
              <Combobox.List data-testid="list">
                <Combobox.Option value="jp" data-testid="opt-jp">
                  Japan
                </Combobox.Option>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Root>
          <Field.Description data-testid="desc">Where you live.</Field.Description>
          <Field.Error data-testid="error" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await act(async () => {});
    const i = input();
    expect(screen.getByTestId("label")).toHaveAttribute("for", i.id);
    expect(i).toHaveAccessibleName("Country");
    expect(i).toBeRequired();
    expect(i).toHaveAttribute("aria-describedby", screen.getByTestId("desc").id);
    expect(i).toHaveAttribute("aria-invalid", "false");
    expect(hidden()).toHaveAttribute("name", "country");

    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(i).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(i);

    await typeText(user, "j");
    expect(list()).toHaveAttribute("aria-labelledby", screen.getByTestId("label").id);
    await user.click(option("jp"));
    expectPending(i);
    expectNotPending(screen.getByTestId("root"));
    await act(async () => own.resolve());
    expect(hidden()).toHaveValue("jp");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expectPending(screen.getByTestId("root"));
    expectNotPending(i);
    await act(async () => submission.resolve());
  });

  // Review H1: React writes the hidden input with no `input` / `change` event; the Field is told
  // after the commit.
  function Country({
    errors,
    validate,
    action,
    cities = false,
  }: {
    errors?: FormErrors;
    validate?: (value: string) => string | null;
    action: (formData: FormData) => unknown;
    cities?: boolean;
  }) {
    return (
      <Form.Root action={action} errors={errors} autoReset={false}>
        <Field.Root name="country" validate={validate} data-testid="root">
          <Field.Label>Country</Field.Label>
          <Combobox.Root openOnClick>
            <Combobox.Input data-testid="input" />
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Option value="jp" data-testid="opt-jp">
                  Japan
                </Combobox.Option>
                <Combobox.Option value="fr" data-testid="opt-fr">
                  France
                </Combobox.Option>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
        {cities && (
          <Field.Root
            name="city"
            validate={(_value, formData) =>
              formData.get("country") === "" ? "Pick a country first." : null
            }
          >
            <Field.Label>City</Field.Label>
            <Field.Control data-testid="city" />
          </Field.Root>
        )}
        <Form.Submit>Save</Form.Submit>
      </Form.Root>
    );
  }

  it("a selection re-runs validate at once: Enter right after picking submits", async () => {
    const action = vi.fn();
    render(
      <Country action={action} validate={(v) => (v === "" ? "Pick a country." : null)} cities />,
    );
    await act(async () => {});
    expect(input().validationMessage).toBe("Pick a country.");
    expect((screen.getByTestId("city") as HTMLInputElement).validationMessage).toBe(
      "Pick a country first.",
    );
    const user = setupUser();
    await typeText(user, "Jap");
    await user.keyboard("{ArrowDown}{Enter}");
    await act(async () => {});
    expect(hidden()).toHaveValue("jp");
    expect(input().validationMessage).toBe("");
    // A cross-field rule on another Field of the Form follows too.
    expect((screen.getByTestId("city") as HTMLInputElement).validationMessage).toBe("");
    await user.keyboard("{Enter}");
    await act(async () => {});
    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![0] as FormData).get("country")).toBe("jp");
    expect(screen.queryByTestId("error")).toBeNull();
  });

  it("picking another option dismisses a server error, so the corrected value can be saved", async () => {
    const action = vi.fn();
    render(<Country action={action} errors={{ country: "We do not ship there." }} />);
    await act(async () => {});
    expect(screen.getByTestId("error")).toHaveTextContent("We do not ship there.");
    const user = setupUser();
    await user.click(input());
    await user.click(option("fr"));
    await act(async () => {});
    expect(hidden()).toHaveValue("fr");
    expect(screen.queryByTestId("error")).toBeNull();
    expect(input()).toHaveAttribute("aria-invalid", "false");
    expect(input().validationMessage).toBe("");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![0] as FormData).get("country")).toBe("fr");
  });

  it("Field disabled disables the Input", async () => {
    render(
      <Field.Root name="country" disabled>
        <Field.Label>Country</Field.Label>
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>
      </Field.Root>,
    );
    await act(async () => {});
    expect(input()).toBeDisabled();
  });
});
