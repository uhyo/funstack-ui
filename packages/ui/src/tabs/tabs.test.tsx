// Tabs tests (design/components/tabs.md section 12; conventions 10.1).
//
// Transition types (fsui-tabs, -next, -prev) are asserted in tabs-transition-types.test.tsx,
// which mocks React's addTransitionType. The Indicator's actual anchored position needs layout
// and lives in tabs.browser.test.tsx; here only the anchor-name / position-anchor wiring is
// checked. Not automated (example app only, design section 12): panel cross-fade / slide view
// transitions, `focusgroup` in Chromium 150+, real find-in-page reveal.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { Tabs } from "./index.js";
import type {
  TabsIndicatorState,
  TabsListState,
  TabsPanelProps,
  TabsPanelState,
  TabsRootProps,
  TabsRootState,
  TabsTabState,
  TabsValueChangeDetails,
} from "./index.js";
import { anchorName, slug } from "./tabs-ids.js";

type ActionFn = (next: string, details: TabsValueChangeDetails) => unknown;

interface HarnessProps {
  mode: ControlMode;
  initial?: string | null;
  /** The consumer's work; awaited by the harness's change action. */
  action?: ActionFn;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /** Controlled only: never adopt the value (the parent vetoes). */
  veto?: boolean;
  /** Wrap the Tabs in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  values?: readonly string[];
  disabledValues?: readonly string[];
  rootProps?: Partial<TabsRootProps>;
  panelProps?: Partial<TabsPanelProps>;
  /** Panel content; defaults to `Panel <value>`. */
  panel?: (value: string) => ReactNode;
  /** Wrap everything in one Suspense boundary (already revealed after the first render). */
  suspense?: boolean;
}

/**
 * Harness for controlled/uncontrolled parity. The controlled variant follows the "update on
 * success" pattern (conventions 3.1); both variants mirror the committed value in an `output`.
 */
function Harness({
  mode,
  initial = "a",
  action,
  catchErrors = false,
  veto = false,
  boundary,
  values = ["a", "b", "c"],
  disabledValues = [],
  rootProps,
  panelProps,
  panel,
  suspense = false,
}: HarnessProps) {
  const [committed, setCommitted] = useState<string | null>(initial);
  const [error, setError] = useState<unknown>(null);

  const valueChangeAction = async (next: string, details: TabsValueChangeDetails) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      startTransition(() => setError(e));
      return;
    }
    if (!veto) startTransition(() => setCommitted(next));
  };

  const modeProps = mode === "controlled" ? { value: committed } : { defaultValue: initial };
  let tabs: ReactNode = (
    <Tabs.Root {...modeProps} valueChangeAction={valueChangeAction} {...rootProps}>
      <Tabs.List aria-label="Sections">
        {values.map((v) => (
          <Tabs.Tab key={v} value={v} disabled={disabledValues.includes(v)}>
            {v.toUpperCase()}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator data-testid="indicator" />
      </Tabs.List>
      {values.map((v) => (
        <Tabs.Panel key={v} value={v} {...panelProps}>
          {panel ? panel(v) : `Panel ${v}`}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
  if (boundary) tabs = <ErrorCatcher onError={boundary}>{tabs}</ErrorCatcher>;
  const content = (
    <>
      {tabs}
      <output data-testid="committed">{String(committed)}</output>
      {error !== null && <output data-testid="error">{String(error)}</output>}
    </>
  );
  return suspense ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });
const allTabs = () => screen.getAllByRole("tab");
/** The panel a tab controls (via `aria-controls`), or null when it is not mounted. */
const panelOf = (name: string) => document.getElementById(tab(name).getAttribute("aria-controls")!);
const root = () => screen.getByRole("tablist").parentElement!;
const list = () => screen.getByRole("tablist");
const committed = () => screen.getByTestId("committed");
const indicator = () => screen.getByTestId("indicator");

function expectSelected(name: string): void {
  for (const t of allTabs()) {
    const isTarget = t.textContent === name;
    expect(t).toHaveAttribute("aria-selected", String(isTarget));
    expect(t).toHaveAttribute("tabindex", isTarget ? "0" : "-1");
    if (isTarget) expect(t).toHaveAttribute("data-selected", "");
    else expect(t).not.toHaveAttribute("data-selected");
  }
}

/** The Indicator's `position-anchor` names the Tab's `anchor-name`, `--fsui-tab-<tab id>`. */
function expectAnchoredTo(name: string): void {
  const expected = `--fsui-tab-${tab(name).id}`;
  expect(tab(name).style.getPropertyValue("anchor-name")).toBe(expected);
  expect(indicator().style.getPropertyValue("position-anchor")).toBe(expected);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Tabs", () => {
  describe("roles and ARIA", () => {
    it("renders the documented elements, roles and wiring", () => {
      render(<Harness mode="uncontrolled" disabledValues={["c"]} />);

      expect(root().tagName).toBe("DIV");
      expect(root()).toHaveAttribute("data-orientation", "horizontal");
      expect(root()).not.toHaveAttribute("role");

      expect(list().tagName).toBe("DIV");
      expect(list()).toHaveAttribute("aria-orientation", "horizontal");
      expect(list()).toHaveAttribute("data-orientation", "horizontal");
      expect(list()).toHaveAccessibleName("Sections");
      expect(list()).not.toHaveAttribute("tabindex");

      const a = tab("A");
      expect(a.tagName).toBe("BUTTON");
      expect(a).toHaveAttribute("type", "button");
      expect(a).toHaveAttribute("data-orientation", "horizontal");
      expectSelected("A");

      const panel = screen.getByRole("tabpanel");
      expect(panel.tagName).toBe("DIV");
      expect(panel).toHaveTextContent("Panel a");
      expect(panel).toHaveAttribute("tabindex", "0");
      expect(panel).toHaveAttribute("data-selected", "");
      expect(panel).not.toHaveAttribute("hidden");
      expect(panel).not.toHaveAttribute("data-pending");
      expect(panel).toHaveAccessibleName("A");

      // aria-controls <-> id and aria-labelledby <-> id resolve.
      expect(a.getAttribute("aria-controls")).toBe(panel.id);
      expect(panel.getAttribute("aria-labelledby")).toBe(a.id);
      expect(document.getElementById(panel.getAttribute("aria-labelledby")!)).toBe(a);

      // aria-controls is set on every tab even though its panel is not mounted.
      expect(tab("B")).toHaveAttribute("aria-controls");
      expect(document.getElementById(tab("B").getAttribute("aria-controls")!)).toBeNull();
      // Unselected panels are absent by default.
      expect(screen.getAllByRole("tabpanel")).toHaveLength(1);

      const c = tab("C");
      expect(c).toHaveAttribute("aria-disabled", "true");
      expect(c).toHaveAttribute("data-disabled", "");
      expect(c).not.toBeDisabled();
      expect(a).not.toHaveAttribute("aria-disabled");
      expect(a).not.toHaveAttribute("data-disabled");
      expect(a).not.toHaveAttribute("data-pending");
    });

    it("reflects vertical orientation on Root, List and Tab", () => {
      render(<Harness mode="uncontrolled" rootProps={{ orientation: "vertical" }} />);
      expect(root()).toHaveAttribute("data-orientation", "vertical");
      expect(list()).toHaveAttribute("aria-orientation", "vertical");
      expect(list()).toHaveAttribute("data-orientation", "vertical");
      for (const t of allTabs()) expect(t).toHaveAttribute("data-orientation", "vertical");
      // Design 7: data-orientation is not emitted on Panel.
      expect(screen.getByRole("tabpanel")).not.toHaveAttribute("data-orientation");
    });

    it("Root disabled disables every Tab (focusable, aria-disabled)", () => {
      render(<Harness mode="uncontrolled" rootProps={{ disabled: true }} />);
      expect(root()).toHaveAttribute("data-disabled", "");
      expect(list()).toHaveAttribute("data-disabled", "");
      for (const t of allTabs()) {
        expect(t).toHaveAttribute("aria-disabled", "true");
        expect(t).not.toBeDisabled();
      }
    });

    it("Panel tabindex defaults to 0 and can be overridden", () => {
      render(<Harness mode="uncontrolled" panelProps={{ tabIndex: -1 }} />);
      expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "-1");
    });

    it("ids are stable across re-renders and safe for arbitrary values", () => {
      const values = ["a b/c", "a_20_c", "日本"];
      const { rerender } = render(<Harness mode="uncontrolled" values={values} initial="a b/c" />);
      const ids = allTabs().map((t) => t.id);
      const panelId = screen.getByRole("tabpanel").id;
      expect(new Set(ids).size).toBe(3);
      for (const id of [...ids, panelId]) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(tab("A B/C").getAttribute("aria-controls")).toBe(panelId);

      rerender(<Harness mode="uncontrolled" values={values} initial="a b/c" />);
      expect(allTabs().map((t) => t.id)).toEqual(ids);
      expect(screen.getByRole("tabpanel").id).toBe(panelId);
    });

    it("slug is injective and CSS-ident safe", () => {
      expect(slug("general")).toBe("general");
      expect(slug("a b")).toBe("a_20_b");
      expect(slug("a_20_b")).not.toBe(slug("a b"));
      expect(slug("a_b")).toBe("a_5f_b");
      expect(anchorName("_r_1_", "x y")).toBe("--fsui-tab-_r_1_-tab-x_20_y");
    });

    it("value null: no tab selected, the List is the tab stop, no panel rendered", () => {
      render(<Harness mode="controlled" initial={null} />);
      for (const t of allTabs()) {
        expect(t).toHaveAttribute("aria-selected", "false");
        expect(t).toHaveAttribute("tabindex", "-1");
      }
      expect(list()).toHaveAttribute("tabindex", "0");
      expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    });

    it("a value matching no tab: the List is the tab stop and a dev warning fires once", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const action = vi.fn<ActionFn>();
      const { rerender } = render(<Harness mode="controlled" initial="zzz" action={action} />);
      for (const t of allTabs()) {
        expect(t).toHaveAttribute("aria-selected", "false");
        expect(t).toHaveAttribute("tabindex", "-1");
      }
      expect(list()).toHaveAttribute("tabindex", "0");
      expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
      const warnings = () =>
        error.mock.calls.filter((call) => String(call[0]).includes("matches no Tabs.Tab"));
      expect(warnings()).toHaveLength(1);
      expect(String(warnings()[0]?.[0])).toContain('"zzz"');
      rerender(<Harness mode="controlled" initial="zzz" action={action} />);
      expect(warnings()).toHaveLength(1);

      // Tab reaches the tablist and lands on the first enabled tab without selecting it.
      const user = setupUser();
      await user.tab();
      expect(tab("A")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
      await user.keyboard("{ArrowRight}");
      expect(action).toHaveBeenCalledTimes(1);
      expectSelected("B");
      expect(list()).not.toHaveAttribute("tabindex");
      expect(committed()).toHaveTextContent("b");
    });

    it("a matching value gives the List no tabindex and no warning", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<Harness mode="controlled" initial="b" />);
      expect(list()).not.toHaveAttribute("tabindex");
      expect(error).not.toHaveBeenCalled();
    });

    it("warns once in development when neither value nor defaultValue is passed", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const tree = (props: Partial<TabsRootProps>) => (
        <Tabs.Root {...props}>
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a">A</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      );
      const { rerender, unmount } = render(tree({}));
      rerender(tree({}));
      const warnings = () =>
        error.mock.calls.filter((call) => String(call[0]).includes("neither `value` nor"));
      expect(warnings()).toHaveLength(1);
      expect(String(warnings()[0]?.[0])).toContain("Tabs.Root");
      unmount();

      error.mockClear();
      for (const props of [{ defaultValue: null }, { defaultValue: "a" }, { value: null }]) {
        render(tree(props)).unmount();
      }
      expect(error).not.toHaveBeenCalled();
    });

    it("throws a helpful error outside Tabs.Root", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<Tabs.Tab value="x">X</Tabs.Tab>)).toThrow(
        "Tabs.Tab must be rendered inside a Tabs.Root.",
      );
    });
  });

  describe("keyboard", () => {
    type Orientation = "horizontal" | "vertical";
    const matrix: [Orientation, string, string][] = [
      ["horizontal", "{ArrowRight}", "C"],
      ["horizontal", "{ArrowLeft}", "A"],
      ["horizontal", "{ArrowDown}", "B"],
      ["horizontal", "{ArrowUp}", "B"],
      ["horizontal", "{Home}", "A"],
      ["horizontal", "{End}", "C"],
      ["vertical", "{ArrowRight}", "B"],
      ["vertical", "{ArrowLeft}", "B"],
      ["vertical", "{ArrowDown}", "C"],
      ["vertical", "{ArrowUp}", "A"],
      ["vertical", "{Home}", "A"],
      ["vertical", "{End}", "C"],
    ];

    it.each(matrix)("%s %s from B focuses %s", async (orientation, key, target) => {
      render(
        <Harness
          mode="uncontrolled"
          initial="b"
          rootProps={{ orientation, activationMode: "manual" }}
        />,
      );
      const user = setupUser();
      await user.tab();
      expect(tab("B")).toHaveFocus();
      await user.keyboard(key);
      expect(tab(target)).toHaveFocus();
    });

    it.each([
      [true, "{ArrowRight}", "C", "A"],
      [true, "{ArrowLeft}", "A", "C"],
      [false, "{ArrowRight}", "C", "C"],
      [false, "{ArrowLeft}", "A", "A"],
    ] as const)("loop=%s: %s at %s focuses %s", async (loop, key, from, to) => {
      render(
        <Harness
          mode="uncontrolled"
          initial={from.toLowerCase()}
          rootProps={{ loop, activationMode: "manual" }}
        />,
      );
      const user = setupUser();
      await user.tab();
      expect(tab(from)).toHaveFocus();
      await user.keyboard(key);
      expect(tab(to)).toHaveFocus();
    });

    it("swaps horizontal arrows under direction: rtl", async () => {
      render(
        <Tabs.Root defaultValue="b" activationMode="manual">
          <Tabs.List aria-label="Sections" style={{ direction: "rtl" }}>
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
            <Tabs.Tab value="c">C</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      const user = setupUser();
      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(tab("A")).toHaveFocus();
      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(tab("C")).toHaveFocus();
    });

    it("disabled tabs are reachable with arrows but never selected", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} disabledValues={["b"]} />);
      const user = setupUser();
      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(tab("B")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
      expectSelected("A");
      await user.keyboard("{Enter}[Space]");
      expect(action).not.toHaveBeenCalled();
      await user.keyboard("{ArrowRight}");
      expect(tab("C")).toHaveFocus();
      expect(action).toHaveBeenCalledTimes(1);
      expectSelected("C");
    });

    it("Enter and Space select in manual mode", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Harness mode="uncontrolled" action={action} rootProps={{ activationMode: "manual" }} />,
      );
      const user = setupUser();
      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(action).not.toHaveBeenCalled();
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("b");
      expect(action.mock.calls[0]?.[1].event?.type).toBe("keydown");
      expectSelected("B");

      await user.keyboard("{ArrowRight}[Space]");
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe("c");
      expect(action.mock.calls[1]?.[1].event?.type).toBe("keydown");
      expectSelected("C");
    });

    it("Enter and Space on the selected tab are no-ops in automatic mode", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      await user.tab();
      await user.keyboard("{Enter}[Space]");
      expect(action).not.toHaveBeenCalled();
    });

    it("calls preventDefault for handled keys only", () => {
      render(<Harness mode="uncontrolled" rootProps={{ activationMode: "manual" }} />);
      const a = tab("A");
      act(() => a.focus());
      // fireEvent returns false when the event was cancelled.
      expect(fireEvent.keyDown(a, { key: "ArrowRight" })).toBe(false);
      expect(fireEvent.keyDown(tab("B"), { key: "End" })).toBe(false);
      expect(fireEvent.keyDown(tab("C"), { key: "Home" })).toBe(false);
      expect(fireEvent.keyDown(tab("A"), { key: "ArrowDown" })).toBe(true);
      expect(fireEvent.keyDown(tab("A"), { key: "x" })).toBe(true);
      expect(fireEvent.keyDown(tab("A"), { key: "ArrowRight", ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(tab("A"), { key: "Enter" })).toBe(false);
    });

    it.each(["altKey", "metaKey", "ctrlKey"] as const)(
      "ignores arrows, Home, End, Enter and Space with %s",
      (modifier) => {
        const action = vi.fn<ActionFn>();
        render(
          <Harness mode="uncontrolled" action={action} rootProps={{ activationMode: "manual" }} />,
        );
        const a = tab("A");
        act(() => a.focus());
        for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
          // Not cancelled: the browser / OS shortcut keeps working.
          expect(fireEvent.keyDown(a, { key, [modifier]: true })).toBe(true);
          expect(a).toHaveFocus();
        }
        act(() => tab("B").focus());
        for (const key of ["Enter", " "]) {
          expect(fireEvent.keyDown(tab("B"), { key, [modifier]: true })).toBe(true);
        }
        expect(action).not.toHaveBeenCalled();
        expectSelected("A");
      },
    );

    it("Tab from a tab lands on the selected panel; Shift+Tab returns to the selected tab", async () => {
      render(
        <>
          <Harness mode="uncontrolled" initial="b" />
          <button type="button">after</button>
        </>,
      );
      const user = setupUser();
      await user.tab();
      expect(tab("B")).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("tabpanel")).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      expect(tab("B")).toHaveFocus();
    });
  });

  describe("activation", () => {
    it("automatic: an arrow press dispatches through the focus event", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      await user.tab();
      expect(action).not.toHaveBeenCalled();
      await user.keyboard("{ArrowRight}");
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("b");
      expect(details.reason).toBe("activate");
      // React's onFocus listens to `focusin`; either way it is a FocusEvent.
      expect(details.event).toBeInstanceOf(FocusEvent);
      expect(details.event?.type).toMatch(/^focus/);
      expectSelected("B");
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel b");
    });

    it("automatic: programmatic focus moving from tab to tab dispatches; manual: it does not", async () => {
      const auto = vi.fn<ActionFn>();
      const first = render(<Harness mode="uncontrolled" action={auto} />);
      await act(async () => tab("A").focus());
      await act(async () => tab("C").focus());
      expect(auto).toHaveBeenCalledTimes(1);
      expect(auto.mock.calls[0]?.[0]).toBe("c");
      expectSelected("C");
      first.unmount();

      const manual = vi.fn<ActionFn>();
      render(
        <Harness mode="uncontrolled" action={manual} rootProps={{ activationMode: "manual" }} />,
      );
      await act(async () => tab("A").focus());
      await act(async () => tab("C").focus());
      expect(manual).not.toHaveBeenCalled();
      expectSelected("A");
    });

    it("automatic: focus entering the list from outside never dispatches", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <>
          <button type="button">before</button>
          <Harness mode="uncontrolled" action={action} />
        </>,
      );
      // Programmatic focus from outside (focus restore, a skip link).
      await act(async () => tab("C").focus());
      expect(action).not.toHaveBeenCalled();
      expectSelected("A");
      // From another focusable element outside the list.
      await act(async () => screen.getByRole("button", { name: "before" }).focus());
      await act(async () => tab("B").focus());
      expect(action).not.toHaveBeenCalled();
      expectSelected("A");
    });

    it("automatic: window refocus after a controlled veto does not re-dispatch", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" veto action={action} />);
      const user = setupUser();
      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(action).toHaveBeenCalledTimes(1);
      // The parent ignored the change: A stays selected while focus stays on B.
      expectSelected("A");
      expect(tab("B")).toHaveFocus();
      // Leaving the window and coming back blurs and refocuses B with no relatedTarget.
      await act(async () => {
        tab("B").blur();
        tab("B").focus();
      });
      expect(tab("B")).toHaveFocus();
      expect(action).toHaveBeenCalledTimes(1);
      expectSelected("A");
    });

    it("automatic: autoFocus on an unselected tab does not dispatch", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Tabs.Root defaultValue="a" valueChangeAction={action}>
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b" autoFocus>
              B
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      await act(async () => {});
      expect(tab("B")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
      expectSelected("A");
    });

    it("automatic: a click dispatches exactly once, from outside or from another tab", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      // Focus comes from outside the list: the click handler dispatches.
      await user.click(tab("B"));
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[1].event?.type).toBe("click");
      expectSelected("B");
      // Focus moves from B to C on pointerdown: the focus handler dispatches, the click is a no-op.
      await user.click(tab("C"));
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe("c");
      expectSelected("C");
    });

    it("value=null: tabbing into the list focuses the first enabled tab without selecting (automatic)", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" initial={null} action={action} disabledValues={["a"]} />);
      const user = setupUser();
      await user.tab();
      expect(tab("B")).toHaveFocus();
      // Entering from outside never selects, even through the List's redirect.
      expect(action).not.toHaveBeenCalled();
      expect(list()).toHaveAttribute("tabindex", "0");
      await user.keyboard("{ArrowRight}");
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("c");
      expectSelected("C");
      expect(list()).not.toHaveAttribute("tabindex");
    });

    it("value=null: tabbing into the list focuses the first tab without selecting (manual)", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          initial={null}
          action={action}
          rootProps={{ activationMode: "manual" }}
        />,
      );
      const user = setupUser();
      await user.tab();
      expect(tab("A")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
      // Shift+Tab from inside does not bounce back into the tabs.
      await user.keyboard("{ArrowRight}");
      await user.tab({ shift: true });
      expect(list()).toHaveFocus();
      await user.tab({ shift: true });
      expect(document.body).toHaveFocus();
    });
  });

  renderBoth("sync action", (mode) => {
    it("calls valueChangeAction(next, details) and swaps panels", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(tab("B"));
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("b");
      expect(details.reason).toBe("activate");
      expect(details.event).toBeInstanceOf(window.Event);
      expect(Object.keys(details)).toEqual(["reason"]);
      expectSelected("B");
      expectNotPending(root());
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel b");
      expect(committed()).toHaveTextContent("b");
    });

    it("clicking the selected tab, a disabled tab, or any tab under Root disabled never dispatches", async () => {
      const action = vi.fn<ActionFn>();
      const first = render(<Harness mode={mode} action={action} disabledValues={["c"]} />);
      const user = setupUser();
      await user.click(tab("A"));
      await user.click(tab("C"));
      expect(action).not.toHaveBeenCalled();
      expectSelected("A");
      first.unmount();

      render(<Harness mode={mode} action={action} rootProps={{ disabled: true }} />);
      await user.click(tab("B"));
      await user.keyboard("{ArrowRight}{Enter}");
      expect(action).not.toHaveBeenCalled();
      expectSelected("A");
      expect(committed()).toHaveTextContent("a");
    });
  });

  renderBoth("async action", (mode) => {
    it("pending on Root and the clicked Tab; old panel stays until resolve", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} />);
      const user = setupUser();

      await user.click(tab("B"));
      expectSelected("B");
      expectPending(root());
      expectPending(tab("B"));
      expectNotPending(tab("A"));
      expectNotPending(tab("C"));
      expectPending(indicator());
      expect(panelOf("A")).toBeInTheDocument();
      expect(panelOf("B")).not.toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).not.toHaveAttribute("data-pending");

      await act(async () => {
        d.resolve();
      });
      expectNotPending(root());
      expectNotPending(tab("B"));
      expectNotPending(indicator());
      expect(panelOf("A")).not.toBeInTheDocument();
      expect(panelOf("B")).toHaveTextContent("Panel b");
      expect(committed()).toHaveTextContent("b");
    });
  });

  renderBoth("rejection", (mode) => {
    it("reaches the Error Boundary; committed value unchanged", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={onError} />);
      const user = setupUser();

      await user.click(tab("B"));
      expectSelected("B");
      expect(panelOf("A")).toBeInTheDocument();

      const err = new Error("save failed");
      await act(async () => {
        d.reject(err);
      });
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
      expect(committed()).toHaveTextContent("a");
    });

    it("caught inside the action: resolves; uncontrolled commits, controlled reverts", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} catchErrors />);
      const user = setupUser();

      await user.click(tab("B"));
      expectPending(root());
      await act(async () => {
        d.reject(new Error("vetoed"));
      });
      expectNotPending(root());
      expect(screen.getByTestId("error")).toHaveTextContent("vetoed");
      if (mode === "controlled") {
        expectSelected("A");
        expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel a");
      } else {
        expectSelected("B");
        expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel b");
      }
    });
  });

  describe("controlled veto", () => {
    it("snaps back to the parent's value; focus stays on the clicked tab", async () => {
      const d = deferred();
      render(<Harness mode="controlled" veto action={() => d.promise} />);
      const user = setupUser();
      await user.click(tab("B"));
      expectSelected("B");
      await act(async () => {
        d.resolve();
      });
      expectSelected("A");
      expect(tab("B")).toHaveFocus();
      expect(tab("B")).toHaveAttribute("tabindex", "-1");
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel a");
    });
  });

  describe("overlapping actions (uncontrolled)", () => {
    it("dispatch b then c, resolve b last: optimistic c throughout, committed c", async () => {
      const ds = [deferred(), deferred()];
      let calls = 0;
      render(<Harness mode="uncontrolled" action={() => ds[calls++]!.promise} />);
      const user = setupUser();

      await user.click(tab("B"));
      await user.click(tab("C"));
      expectSelected("C");
      expectPending(tab("C"));
      expectNotPending(tab("B"));

      await act(async () => {
        ds[1]!.resolve();
      });
      expectSelected("C");
      expectPending(root());
      expect(panelOf("A")).toBeInTheDocument();

      await act(async () => {
        ds[0]!.resolve();
      });
      expectSelected("C");
      expectNotPending(root());
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel c");
    });

    it("clicking back to the committed tab cancels the intent; its panel never leaves (9.4)", async () => {
      const ds = [deferred(), deferred()];
      let calls = 0;
      const action = vi.fn<ActionFn>(() => ds[calls++]!.promise);
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();

      await user.click(tab("B"));
      expectSelected("B");
      await user.click(tab("A"));
      // A real dispatch: the no-op rule compares against the optimistic value.
      expect(action.mock.calls.map(([next]) => next)).toEqual(["b", "a"]);
      expectSelected("A");
      expectPending(tab("A"));
      expect(panelOf("A")).toBeInTheDocument();

      await act(async () => {
        ds[0]!.resolve();
      });
      expect(panelOf("A")).toBeInTheDocument();
      expect(panelOf("B")).not.toBeInTheDocument();
      await act(async () => {
        ds[1]!.resolve();
      });
      expectSelected("A");
      expectNotPending(root());
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel a");
    });

    it("rapid arrows in automatic mode commit only the last tab", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} values={["a", "b", "c", "d"]} />);
      const user = setupUser();
      await user.tab();
      await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
      expect(action.mock.calls.map(([next]) => next)).toEqual(["b", "c", "d"]);
      expectSelected("D");
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel d");
    });
  });

  renderBoth("superseded rejection", (mode) => {
    it("older rejects after the newer resolved: reaches the boundary", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const ds = [deferred(), deferred()];
      let calls = 0;
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => ds[calls++]!.promise} boundary={onError} />);
      const user = setupUser();

      await user.click(tab("B"));
      await user.click(tab("C"));
      await act(async () => {
        ds[1]!.resolve();
      });
      expect(onError).not.toHaveBeenCalled();
      expectSelected("C");

      const err = new Error("older failed");
      await act(async () => {
        ds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
    });

    it("older rejects while the newer is pending: reaches the boundary", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const ds = [deferred(), deferred()];
      let calls = 0;
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => ds[calls++]!.promise} boundary={onError} />);
      const user = setupUser();

      await user.click(tab("B"));
      await user.click(tab("C"));
      const err = new Error("older failed");
      await act(async () => {
        ds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      await act(async () => {
        ds[1]!.resolve();
      });
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps the old panel, no fallback, pending until the new panel is ready", async () => {
      const suspender = createSuspender();
      suspender.resolve("a");
      render(<Harness mode={mode} suspense panel={(v) => <suspender.Suspender value={v} />} />);
      const user = setupUser();
      expect(screen.getByRole("tabpanel")).toHaveTextContent("a");

      await user.click(tab("B"));
      expectSelected("B");
      expectPending(root());
      expectPending(tab("B"));
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      expect(panelOf("A")).toBeInTheDocument();
      expect(panelOf("A")).toHaveTextContent("a");
      expect(panelOf("B")).not.toBeInTheDocument();

      await act(async () => {
        suspender.resolve("b");
      });
      expectNotPending(root());
      expect(panelOf("A")).not.toBeInTheDocument();
      expect(panelOf("B")).toHaveTextContent("b");
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
    });

    it("a keyed boundary inside the panel shows its fallback at once and pending drops", async () => {
      const suspender = createSuspender();
      suspender.resolve("a");
      render(
        <Harness
          mode={mode}
          suspense
          panel={(v) => (
            <Suspense key={v} fallback={<span data-testid="inner-fallback">skeleton</span>}>
              <suspender.Suspender value={v} />
            </Suspense>
          )}
        />,
      );
      const user = setupUser();

      await user.click(tab("B"));
      await act(async () => {});
      expect(panelOf("B")).toBeInTheDocument();
      expect(screen.getByTestId("inner-fallback")).toBeInTheDocument();
      expectNotPending(root());
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();

      await act(async () => {
        suspender.resolve("b");
      });
      expect(panelOf("B")).toHaveTextContent("b");
    });
  });

  describe("keepMounted", () => {
    function Counter({ label }: { label: string }) {
      const [count, setCount] = useState(0);
      return (
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          {label} {count}
        </button>
      );
    }

    it("true: inactive panels stay in the DOM, hidden, with state preserved", async () => {
      render(
        <Harness
          mode="uncontrolled"
          panelProps={{ keepMounted: true }}
          panel={(v) => <Counter label={`count-${v}`} />}
        />,
      );
      const user = setupUser();
      // Hidden Activity content renders after the visible content, at low priority.
      await act(async () => {});
      expect(panelOf("A")).toBeVisible();
      expect(panelOf("A")).toHaveAttribute("data-selected", "");
      expect(panelOf("B")).toBeInTheDocument();
      expect(panelOf("B")).not.toBeVisible();
      expect(panelOf("B")).not.toHaveAttribute("data-selected");
      expect(panelOf("B")).not.toHaveAttribute("hidden");

      await user.click(screen.getByRole("button", { name: "count-a 0" }));
      expect(screen.getByRole("button", { name: "count-a 1" })).toBeInTheDocument();

      await user.click(tab("B"));
      expect(panelOf("A")).not.toBeVisible();
      expect(panelOf("B")).toBeVisible();
      await user.click(tab("A"));
      expect(panelOf("A")).toBeVisible();
      expect(screen.getByRole("button", { name: "count-a 1" })).toBeInTheDocument();
    });

    it("true: a suspending hidden panel does not block the visible one", async () => {
      const suspender = createSuspender();
      suspender.resolve("a");
      render(
        <Harness
          mode="uncontrolled"
          suspense
          panelProps={{ keepMounted: true }}
          panel={(v) => <suspender.Suspender value={v} />}
        />,
      );
      await act(async () => {});
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      expect(panelOf("A")).toHaveTextContent("a");
      expect(panelOf("A")).toBeVisible();
    });

    it('"until-found": inactive panels are hidden="until-found" after mount', () => {
      render(<Harness mode="uncontrolled" panelProps={{ keepMounted: "until-found" }} />);
      expect(panelOf("A")).not.toHaveAttribute("hidden");
      expect(panelOf("B")).toHaveAttribute("hidden", "until-found");
      expect(panelOf("C")).toHaveAttribute("hidden", "until-found");
    });

    /** What the browser does on find-in-page: fire `beforematch`, then remove `hidden`. */
    async function reveal(panel: HTMLElement): Promise<Event> {
      const event = new Event("beforematch", { bubbles: true });
      await act(async () => {
        panel.dispatchEvent(event);
        panel.removeAttribute("hidden");
      });
      return event;
    }

    renderBoth('"until-found" beforematch', (mode) => {
      it("selects the tab with reason platform", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} panelProps={{ keepMounted: "until-found" }} />);
        const panelB = panelOf("B")!;
        const event = await reveal(panelB);
        expect(action).toHaveBeenCalledTimes(1);
        expect(action.mock.calls[0]?.[0]).toBe("b");
        expect(action.mock.calls[0]?.[1].reason).toBe("platform");
        expect(action.mock.calls[0]?.[1].event).toBe(event);
        expectSelected("B");
        expect(panelB).not.toHaveAttribute("hidden");
        expect(panelB).toHaveAttribute("data-selected", "");
        expect(panelOf("A")).toHaveAttribute("hidden", "until-found");
      });

      it("a pending find keeps the revealed panel visible across re-renders", async () => {
        const d = deferred();
        const props = {
          mode,
          action: () => d.promise,
          panelProps: { keepMounted: "until-found" },
        } as const;
        const { rerender } = render(<Harness {...props} />);
        const panelB = panelOf("B")!;
        await reveal(panelB);
        expectPending(root());
        expectSelected("B");
        expect(panelB).not.toHaveAttribute("hidden");
        expect(panelB).not.toHaveAttribute("data-selected");
        // A re-render unrelated to the action while it is pending must not re-hide B.
        await act(async () => rerender(<Harness {...props} />));
        expect(panelB).not.toHaveAttribute("hidden");
        // The committed panel stays until the action settles; the others stay hidden.
        expect(panelOf("A")).not.toHaveAttribute("hidden");
        expect(panelOf("C")).toHaveAttribute("hidden", "until-found");

        await act(async () => d.resolve());
        expectNotPending(root());
        expect(panelB).not.toHaveAttribute("hidden");
        expect(panelB).toHaveAttribute("data-selected", "");
        expect(panelOf("A")).toHaveAttribute("hidden", "until-found");
      });
    });

    it('"until-found": a rejected find stays revealed while pending and reaches the boundary', async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const onError = vi.fn();
      const props = {
        mode: "uncontrolled",
        action: () => d.promise,
        boundary: onError,
        panelProps: { keepMounted: "until-found" },
      } as const;
      const { rerender } = render(<Harness {...props} />);
      const panelB = panelOf("B")!;
      await reveal(panelB);
      await act(async () => rerender(<Harness {...props} />));
      expect(panelB).not.toHaveAttribute("hidden");

      // The boundary sits above the Root (where the rejection is thrown), so it replaces the whole
      // Tabs; the re-hide itself is observable through the veto paths below.
      const err = new Error("find rejected");
      await act(async () => d.reject(err));
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("find rejected");
      expect(committed()).toHaveTextContent("a");
    });

    it('"until-found": a find the controlled parent vetoes is hidden again', async () => {
      const d = deferred();
      const props = {
        mode: "controlled",
        veto: true,
        action: () => d.promise,
        panelProps: { keepMounted: "until-found" },
      } as const;
      const { rerender } = render(<Harness {...props} />);
      const panelB = panelOf("B")!;
      await reveal(panelB);
      await act(async () => rerender(<Harness {...props} />));
      expect(panelB).not.toHaveAttribute("hidden");

      await act(async () => d.resolve());
      expectSelected("A");
      expect(panelB).toHaveAttribute("hidden", "until-found");
      expect(panelOf("A")).not.toHaveAttribute("hidden");
    });

    it('"until-found": a find whose error the controlled parent catches is hidden again', async () => {
      const d = deferred();
      render(
        <Harness
          mode="controlled"
          action={() => d.promise}
          catchErrors
          panelProps={{ keepMounted: "until-found" }}
        />,
      );
      const panelB = panelOf("B")!;
      await reveal(panelB);
      expectSelected("B");
      expect(panelB).not.toHaveAttribute("hidden");
      await act(async () => {
        d.reject(new Error("no"));
      });
      expectSelected("A");
      expect(screen.getByTestId("error")).toHaveTextContent("no");
      expect(panelB).toHaveAttribute("hidden", "until-found");
      expect(panelOf("A")).not.toHaveAttribute("hidden");
    });
  });

  describe("Indicator", () => {
    it("is hidden with no selection and aria-hidden always", () => {
      render(<Harness mode="controlled" initial={null} />);
      expect(indicator().tagName).toBe("SPAN");
      expect(indicator()).toHaveAttribute("aria-hidden", "true");
      expect(indicator()).toHaveAttribute("hidden");
      expect(indicator()).not.toHaveAttribute("data-selected");
    });

    it("follows the optimistic selection and reverts on veto", async () => {
      const d = deferred();
      render(<Harness mode="controlled" veto action={() => d.promise} />);
      const user = setupUser();
      expect(indicator()).not.toHaveAttribute("hidden");
      expect(indicator()).toHaveAttribute("data-selected", "");

      expectAnchoredTo("A");
      expect(indicator().getAttribute("style")).toContain("position-anchor");

      await user.click(tab("B"));
      expectPending(indicator());
      expectAnchoredTo("B");
      await act(async () => {
        d.resolve();
      });
      expectNotPending(indicator());
      expectAnchoredTo("A");
      // No view-transition-name: the Indicator renders no <ViewTransition> (design 10.1).
      expect(indicator().style.getPropertyValue("view-transition-name")).toBe("");
    });

    it("the consumer's style wins over the library's anchor properties", () => {
      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a" style={{ anchorName: "--mine", color: "red" }}>
              A
            </Tabs.Tab>
            <Tabs.Indicator data-testid="indicator" style={{ positionAnchor: "--mine" }} />
          </Tabs.List>
        </Tabs.Root>,
      );
      expect(tab("A").style.getPropertyValue("anchor-name")).toBe("--mine");
      expect(tab("A")).toHaveStyle({ color: "rgb(255, 0, 0)" });
      expect(indicator().style.getPropertyValue("position-anchor")).toBe("--mine");
    });

    it("comes after the tabs inside the list", () => {
      render(<Harness mode="uncontrolled" />);
      expect(list().lastElementChild).toBe(indicator());
    });

    it("state.value and className follow the optimistic value", async () => {
      const d = deferred();
      const className = vi.fn((s: TabsIndicatorState) => `ind-${s.value ?? "none"}`);
      render(
        <Tabs.Root defaultValue="a" valueChangeAction={() => d.promise}>
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
            <Tabs.Indicator data-testid="indicator" className={className} />
          </Tabs.List>
        </Tabs.Root>,
      );
      const user = setupUser();
      expect(indicator()).toHaveClass("ind-a");
      await user.click(tab("B"));
      expect(indicator()).toHaveClass("ind-b");
      expect(className).toHaveBeenLastCalledWith({
        value: "b",
        pending: true,
        orientation: "horizontal",
      });
      await act(async () => {
        d.resolve();
      });
      expect(indicator()).toHaveClass("ind-b");
    });
  });

  describe("function props", () => {
    it("every part receives its documented state; Tab optimistic, Panel committed", async () => {
      const d = deferred();
      const rootClass = vi.fn((s: TabsRootState) => (s.pending ? "root busy" : "root"));
      const listClass = vi.fn((s: TabsListState) => `list-${s.orientation}`);
      const tabClass = vi.fn((s: TabsTabState) =>
        [s.value, s.selected && "sel", s.pending && "busy"].filter(Boolean).join(" "),
      );
      const panelClass = vi.fn((s: TabsPanelState) => (s.selected ? "on" : "off"));
      render(
        <Tabs.Root
          defaultValue="a"
          valueChangeAction={() => d.promise}
          className={rootClass}
          style={({ pending }) => ({ opacity: pending ? 0.5 : 1 })}
        >
          {({ value }) => (
            <>
              <output data-testid="root-value">{value}</output>
              <Tabs.List aria-label="x" className={listClass}>
                {({ disabled }) => (
                  <>
                    <Tabs.Tab value="a" className={tabClass}>
                      A
                    </Tabs.Tab>
                    <Tabs.Tab
                      value="b"
                      className={tabClass}
                      style={({ selected }) => ({ fontWeight: selected ? 700 : 400 })}
                    >
                      {({ pending }) => (pending ? "B…" : "B")}
                    </Tabs.Tab>
                    <span data-testid="list-disabled">{String(disabled)}</span>
                  </>
                )}
              </Tabs.List>
              <Tabs.Panel value="a" className={panelClass}>
                {({ selected }) => `A selected=${selected}`}
              </Tabs.Panel>
              <Tabs.Panel value="b" className={panelClass}>
                {({ selected }) => `B selected=${selected}`}
              </Tabs.Panel>
            </>
          )}
        </Tabs.Root>,
      );
      const user = setupUser();

      expect(root()).toHaveClass("root");
      expect(list()).toHaveClass("list-horizontal");
      expect(screen.getByTestId("list-disabled")).toHaveTextContent("false");
      expect(tab("A")).toHaveClass("a", "sel");
      expect(screen.getByRole("tabpanel")).toHaveClass("on");
      expect(screen.getByRole("tabpanel")).toHaveTextContent("A selected=true");

      await user.click(tab("B"));
      expect(root()).toHaveClass("root", "busy");
      expect(root()).toHaveStyle({ opacity: "0.5" });
      expect(screen.getByTestId("root-value")).toHaveTextContent("b");
      const b = screen.getByRole("tab", { name: "B…" });
      expect(b).toHaveClass("b", "sel", "busy");
      expect(b).toHaveStyle({ fontWeight: "700" });
      expect(tabClass).toHaveBeenCalledWith({
        value: "b",
        selected: true,
        pending: true,
        disabled: false,
        orientation: "horizontal",
      });
      // The panel still renders committed state.
      expect(screen.getByRole("tabpanel")).toHaveTextContent("A selected=true");
      expect(panelClass).toHaveBeenLastCalledWith({
        value: "a",
        selected: true,
        orientation: "horizontal",
      });

      await act(async () => {
        d.resolve();
      });
      expect(root()).not.toHaveClass("busy");
      expect(screen.getByRole("tabpanel")).toHaveTextContent("B selected=true");
    });

    it("keepMounted panels receive selected=false while hidden", async () => {
      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a" keepMounted="until-found">
            {({ selected }) => `A ${selected}`}
          </Tabs.Panel>
          <Tabs.Panel value="b" keepMounted="until-found">
            {({ selected }) => `B ${selected}`}
          </Tabs.Panel>
        </Tabs.Root>,
      );
      expect(panelOf("A")).toHaveTextContent("A true");
      expect(panelOf("B")).toHaveTextContent("B false");
    });
  });

  describe("render prop", () => {
    function MyLink({ ref, ...props }: ComponentPropsWithRef<"a">) {
      return <a ref={ref} data-my-link="" {...props} />;
    }

    it("Tab as a link: role and aria win, className merged, Space selects, ref forwarded", async () => {
      const action = vi.fn<ActionFn>();
      const tabRef = { current: null as HTMLButtonElement | null };
      const elementRef = { current: null as HTMLAnchorElement | null };
      const order: string[] = [];
      render(
        <Tabs.Root
          defaultValue="a"
          activationMode="manual"
          valueChangeAction={(next, details) => {
            order.push("library");
            action(next, details);
          }}
        >
          <Tabs.List aria-label="Docs">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab
              value="b"
              ref={tabRef}
              className="tab"
              render={
                <MyLink
                  ref={elementRef}
                  href="#b"
                  className="link"
                  role="link"
                  aria-selected="true"
                  onKeyDown={() => order.push("element")}
                />
              }
            >
              B
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      const user = setupUser();
      const b = tab("B");
      expect(b.tagName).toBe("A");
      expect(b).toHaveAttribute("data-my-link", "");
      expect(b).toHaveAttribute("href", "#b");
      expect(b).not.toHaveAttribute("type");
      expect(b).toHaveAttribute("aria-selected", "false");
      expect(b).toHaveClass("tab", "link");
      expect(tabRef.current).toBe(b);
      expect(elementRef.current).toBe(b);

      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(b).toHaveFocus();
      await user.keyboard("[Space]");
      expect(order).toEqual(["element", "library"]);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("b");
      expect(b).toHaveAttribute("aria-selected", "true");
    });

    it('type="button" only when the rendered element is a button', () => {
      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b" render={<a href="#" />}>
              B
            </Tabs.Tab>
            <Tabs.Tab value="c" render={<button />}>
              C
            </Tabs.Tab>
            <Tabs.Tab value="d" render={(props) => <button {...props} />}>
              D
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      expect(tab("A")).toHaveAttribute("type", "button");
      expect(tab("B").tagName).toBe("A");
      expect(tab("B")).not.toHaveAttribute("type");
      expect(tab("C")).toHaveAttribute("type", "button");
      expect(tab("D")).toHaveAttribute("type", "button");
    });

    it("Panel and Indicator accept custom elements", () => {
      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x" render={<nav />}>
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Indicator render={<i data-testid="indicator" className="mark" />} />
          </Tabs.List>
          <Tabs.Panel value="a" render={<section role="region" />}>
            A
          </Tabs.Panel>
        </Tabs.Root>,
      );
      expect(list().tagName).toBe("NAV");
      const panel = screen.getByRole("tabpanel");
      expect(panel.tagName).toBe("SECTION");
      expect(indicator().tagName).toBe("I");
      expect(indicator()).toHaveClass("mark");
      expect(indicator()).toHaveAttribute("aria-hidden", "true");
    });

    it("function form receives (props, state)", () => {
      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x">
            <Tabs.Tab
              value="a"
              render={(props, state) => <button {...props} data-custom={String(state.selected)} />}
            >
              A
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel
            value="a"
            render={(props, state) => <div {...props} data-custom={String(state.selected)} />}
          >
            A
          </Tabs.Panel>
        </Tabs.Root>,
      );
      expect(tab("A")).toHaveAttribute("data-custom", "true");
      expect(tab("A")).toHaveAttribute("role", "tab");
      expect(screen.getByRole("tabpanel")).toHaveAttribute("data-custom", "true");
    });
  });

  describe("post-await rule", () => {
    it("a controlled parent updating in startTransition after its own await works end to end", async () => {
      const d = deferred();
      function Parent() {
        const [tabValue, setTab] = useState("a");
        return (
          <Tabs.Root
            value={tabValue}
            valueChangeAction={async (next) => {
              await d.promise;
              startTransition(() => setTab(next));
            }}
          >
            <Tabs.List aria-label="x">
              <Tabs.Tab value="a">A</Tabs.Tab>
              <Tabs.Tab value="b">B</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="a">Panel a</Tabs.Panel>
            <Tabs.Panel value="b">Panel b</Tabs.Panel>
          </Tabs.Root>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(tab("B"));
      expectSelected("B");
      expectPending(root());
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel a");
      await act(async () => {
        d.resolve();
      });
      expectSelected("B");
      expectNotPending(root());
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel b");
    });
  });

  describe("transition prop", () => {
    it("Tab and Panel render with and without transition", async () => {
      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a" transition="fade">
              A
            </Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a" transition={{ "fsui-tabs-next": "slide", default: "fade" }}>
            Panel a
          </Tabs.Panel>
          <Tabs.Panel value="b">Panel b</Tabs.Panel>
        </Tabs.Root>,
      );
      const user = setupUser();
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel a");
      await user.click(tab("B"));
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel b");
    });

    it("Indicator has no transition prop (type-level)", () => {
      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a">A</Tabs.Tab>
            {/* @ts-expect-error The Indicator renders no <ViewTransition> (design 10.1). */}
            <Tabs.Indicator transition="fade" />
          </Tabs.List>
        </Tabs.Root>,
      );
      expect(tab("A")).toBeInTheDocument();
    });
  });

  describe("experimental_focusgroup", () => {
    it.each([
      ["horizontal", true, "tablist inline wrap"],
      ["horizontal", false, "tablist inline nowrap"],
      ["vertical", true, "tablist block wrap"],
      ["vertical", false, "tablist block nowrap"],
    ] as const)("%s loop=%s renders focusgroup=%s", (orientation, loop, expected) => {
      render(
        <Tabs.Root defaultValue="a" orientation={orientation} loop={loop}>
          <Tabs.List aria-label="x" experimental_focusgroup>
            <Tabs.Tab value="a">A</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      expect(list()).toHaveAttribute("focusgroup", expected);
    });

    it("is absent by default; JS arrows still work where focusgroup is unsupported", async () => {
      const first = render(<Harness mode="uncontrolled" />);
      expect(list()).not.toHaveAttribute("focusgroup");
      first.unmount();

      render(
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="x" experimental_focusgroup>
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      expect("focusgroup" in HTMLElement.prototype).toBe(false);
      const user = setupUser();
      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(tab("B")).toHaveFocus();
      expectSelected("B");
    });
  });
});
