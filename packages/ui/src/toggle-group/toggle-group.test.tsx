import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Suspense, startTransition, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  sequencedDeferreds,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  silenceErrors,
  PlainButton,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { toggleGroupDriver } from "../__tests__/drivers/toggle-group.js";
import { describeValueAction } from "../__tests__/value-action-suite.js";
import { ToggleGroup } from "./index.js";
import type {
  ToggleGroupItemState,
  ToggleGroupMultipleProps,
  ToggleGroupRootState,
  ToggleGroupValueChangeDetails,
} from "./index.js";

type ActionFn = (next: string[], details: ToggleGroupValueChangeDetails) => unknown;
type ExclusiveActionFn = (next: string | null, details: ToggleGroupValueChangeDetails) => unknown;

const STYLES = ["bold", "italic", "underline"] as const;

interface HarnessProps extends Omit<
  ToggleGroupMultipleProps,
  "value" | "defaultValue" | "valueChangeAction" | "exclusive"
> {
  mode: ControlMode;
  initial?: string[];
  action?: ActionFn;
  catchErrors?: boolean;
  boundary?: (error: unknown) => void;
  suspender?: ReturnType<typeof createSuspender>;
}

/**
 * Controlled variant: "update on success" with the functional update keyed by `added` /
 * `removed` (design 2.3). Uncontrolled: the committed value is mirrored in a sibling.
 */
function Harness({
  mode,
  initial = [],
  action,
  catchErrors = false,
  boundary,
  suspender,
  ...rest
}: HarnessProps) {
  const [committed, setCommitted] = useState<string[]>(initial);
  const [error, setError] = useState<unknown>(null);
  const valueChangeAction = async (next: string[], details: ToggleGroupValueChangeDetails) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      startTransition(() => setError(e));
      return;
    }
    startTransition(() =>
      setCommitted((prev) => [
        ...prev.filter((v) => !details.removed.includes(v)),
        ...details.added.filter((v) => !prev.includes(v)),
      ]),
    );
  };
  const modeProps = mode === "controlled" ? { value: committed } : { defaultValue: initial };
  let group: ReactNode = (
    <ToggleGroup.Root
      aria-label="Text style"
      data-testid="root"
      {...modeProps}
      valueChangeAction={valueChangeAction}
      {...rest}
    >
      {STYLES.map((v) => (
        <ToggleGroup.Item key={v} value={v}>
          {v}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
  if (boundary) group = <ErrorCatcher onError={boundary}>{group}</ErrorCatcher>;
  const content = (
    <>
      {group}
      <output data-testid="committed">{[...committed].sort().join(",")}</output>
      {error !== null && <output data-testid="error">{String(error)}</output>}
      {suspender && <suspender.Suspender value={[...committed].sort().join(",")} />}
    </>
  );
  return suspender ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

const item = (name: string) => screen.getByRole("button", { name });
const root = () => screen.getByRole("group");
const committedText = () => screen.getByTestId("committed");
const tabStops = () =>
  screen.getAllByRole("button").filter((b) => b.getAttribute("tabindex") === "0");

// The action-prop rows shared by every value component (sync and async actions, rejection,
// overlap, superseded rejection, suspending content, the post-await rule, the controlled veto,
// `transition`, details, the value/defaultValue warnings) come from
// __tests__/value-action-suite.tsx with the driver __tests__/drivers/toggle-group.tsx.
describeValueAction(toggleGroupDriver);

describe("ToggleGroup", () => {
  describe("roles and ARIA (row 1)", () => {
    it("renders a group of aria-pressed buttons", () => {
      render(
        <ToggleGroup.Root aria-label="Text style" defaultValue={["bold"]}>
          <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
          <ToggleGroup.Item value="italic" disabled>
            Italic
          </ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      const group = screen.getByRole("group", { name: "Text style" });
      expect(group.tagName).toBe("DIV");
      expect(group).toHaveAttribute("data-orientation", "horizontal");
      expect(group).not.toHaveAttribute("aria-orientation");
      expect(group).not.toHaveAttribute("data-pending");
      expect(group).not.toHaveAttribute("data-disabled");
      const bold = item("Bold");
      expect(bold).toHaveAttribute("type", "button");
      expect(bold).toHaveAttribute("aria-pressed", "true");
      expect(bold).toHaveAttribute("data-pressed", "");
      expect(bold).toHaveAttribute("data-orientation", "horizontal");
      expect(bold).not.toHaveAttribute("value");
      const italic = item("Italic");
      expect(italic).toHaveAttribute("aria-pressed", "false");
      expect(italic).not.toHaveAttribute("data-pressed");
      expect(italic).toBeDisabled();
      expect(italic).toHaveAttribute("data-disabled", "");
    });

    it("Root disabled disables every Item; vertical orientation is data-only", () => {
      render(
        <ToggleGroup.Root aria-label="x" disabled orientation="vertical">
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(root()).toHaveAttribute("data-disabled", "");
      expect(root()).toHaveAttribute("data-orientation", "vertical");
      expect(root()).not.toHaveAttribute("aria-orientation");
      expect(item("A")).toBeDisabled();
      expect(item("A")).toHaveAttribute("data-orientation", "vertical");
    });

    it("Item outside a Root throws", () => {
      silenceErrors();
      expect(() => render(<ToggleGroup.Item value="a">A</ToggleGroup.Item>)).toThrow(
        /inside a ToggleGroup\.Root/,
      );
    });
  });

  describe("value model (row 2)", () => {
    renderBoth("multiple", (mode) => {
      it("dispatches (next, { added, removed }) with next in document order, a fresh array", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} />);
        const user = setupUser();

        await user.click(item("underline"));
        await user.click(item("bold"));
        expect(action.mock.calls.map(([n, d]) => [n, d.added, d.removed])).toEqual([
          [["underline"], ["underline"], []],
          [["bold", "underline"], ["bold"], []],
        ]);
        expect(action.mock.calls[0]![0]).not.toBe(action.mock.calls[1]![0]);
        expect(action.mock.calls[1]![1].event?.type).toBe("click");
        expect(committedText()).toHaveTextContent("bold,underline");

        await user.click(item("bold"));
        expect(action.mock.calls[2]?.[0]).toEqual(["underline"]);
        expect(action.mock.calls[2]?.[1].removed).toEqual(["bold"]);
        expect(item("bold")).toHaveAttribute("aria-pressed", "false");
        expect(committedText()).toHaveTextContent("underline");
      });

      it("disabled Items (own and Root) never dispatch", async () => {
        const action = vi.fn<ActionFn>();
        const { unmount } = render(<Harness mode={mode} action={action} disabled />);
        const user = setupUser();
        await user.click(item("bold"));
        await act(async () => {
          fireEvent.click(item("bold"));
        });
        expect(action).not.toHaveBeenCalled();
        unmount();

        render(
          <ToggleGroup.Root aria-label="x" valueChangeAction={action}>
            <ToggleGroup.Item value="a" disabled render={<span />}>
              A
            </ToggleGroup.Item>
          </ToggleGroup.Root>,
        );
        await act(async () => {
          fireEvent.click(screen.getByText("A"));
        });
        expect(action).not.toHaveBeenCalled();
      });
    });

    describe("exclusive", () => {
      it("a switch carries added and removed; pressing the pressed Item deselects to null", async () => {
        const action = vi.fn<ExclusiveActionFn>();
        render(
          <ToggleGroup.Root
            exclusive
            aria-label="Alignment"
            defaultValue="left"
            valueChangeAction={action}
          >
            <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
            <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
          </ToggleGroup.Root>,
        );
        const user = setupUser();
        await user.click(item("Center"));
        expect(action.mock.calls[0]?.[0]).toBe("center");
        expect(action.mock.calls[0]?.[1].added).toEqual(["center"]);
        expect(action.mock.calls[0]?.[1].removed).toEqual(["left"]);
        expect(item("Left")).toHaveAttribute("aria-pressed", "false");
        expect(item("Center")).toHaveAttribute("aria-pressed", "true");

        await user.click(item("Center"));
        expect(action.mock.calls[1]?.[0]).toBeNull();
        expect(action.mock.calls[1]?.[1].added).toEqual([]);
        expect(action.mock.calls[1]?.[1].removed).toEqual(["center"]);
        expect(item("Center")).toHaveAttribute("aria-pressed", "false");
      });

      it("deselectable={false}: pressing the pressed Item dispatches nothing", async () => {
        const action = vi.fn<ExclusiveActionFn>();
        render(
          <ToggleGroup.Root
            exclusive
            deselectable={false}
            aria-label="Layout"
            defaultValue="grid"
            valueChangeAction={action}
          >
            <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
            <ToggleGroup.Item value="list">List</ToggleGroup.Item>
          </ToggleGroup.Root>,
        );
        const user = setupUser();
        await user.click(item("Grid"));
        expect(action).not.toHaveBeenCalled();
        expect(item("Grid")).toHaveAttribute("aria-pressed", "true");
        await user.click(item("List"));
        expect(action).toHaveBeenCalledTimes(1);
        expect(action.mock.calls[0]?.[0]).toBe("list");
      });

      it("controlled null presses nothing", () => {
        render(
          <ToggleGroup.Root exclusive aria-label="x" value={null}>
            <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          </ToggleGroup.Root>,
        );
        expect(item("A")).toHaveAttribute("aria-pressed", "false");
      });

      it("deselectable is a type error on the multiple variant", () => {
        // @ts-expect-error `deselectable` exists only with `exclusive`.
        render(<ToggleGroup.Root aria-label="x" deselectable={false} />);
        expect(root()).toBeInTheDocument();
      });
    });
  });

  renderBoth("async action (row 3)", (mode) => {
    it("a second click on the same Item clears its pending while the Root keeps it", async () => {
      const deferreds = sequencedDeferreds(2);
      render(<Harness mode={mode} action={() => deferreds.next()} />);
      const user = setupUser();

      await user.click(item("bold"));
      expectPending(item("bold"));
      await user.click(item("bold"));
      expect(item("bold")).toHaveAttribute("aria-pressed", "false");
      expectNotPending(item("bold"));
      expectPending(root());

      await act(async () => {
        deferreds[0]!.resolve();
        deferreds[1]!.resolve();
      });
      expectNotPending(root());
      expect(item("bold")).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("overlap (row 5)", () => {
    it.each([
      ["while Italic is pending", false],
      ["after Italic resolved", true],
    ] as const)(
      "Bold's save fails %s: Bold rolls back, Italic's pending press re-applies on the reverted base",
      async (_label, italicFirst) => {
        // Controlled "update on success": a failed save (caught by the consumer, so the group
        // stays mounted) leaves the parent's value alone, which is the rejection's rollback.
        const deferreds = sequencedDeferreds(2);
        render(<Harness mode="controlled" action={() => deferreds.next()} catchErrors />);
        const user = setupUser();
        await user.click(item("bold"));
        await user.click(item("italic"));
        expect(item("bold")).toHaveAttribute("aria-pressed", "true");
        expect(item("italic")).toHaveAttribute("aria-pressed", "true");

        const settle = [
          () => deferreds[0]!.reject(new Error("bold failed")),
          () => deferreds[1]!.resolve(),
        ];
        for (const step of italicFirst ? [settle[1]!, settle[0]!] : settle) {
          await act(async () => {
            step();
          });
        }
        expect(screen.getByTestId("error")).toHaveTextContent("bold failed");
        expect(item("bold")).toHaveAttribute("aria-pressed", "false");
        expect(item("italic")).toHaveAttribute("aria-pressed", "true");
        expect(committedText()).toHaveTextContent("italic");
        expectNotPending(root());
      },
    );

    it("pending presses re-base on a committed value that changed under them", async () => {
      // React keeps every optimistic update of an async action scope until the whole scope
      // settles, so the rejection's rollback is only visible at the end (test above). The
      // re-basing itself shows when the committed value changes while presses are pending: the
      // patches re-apply on the new base, rather than a stale whole set replacing it.
      const deferreds = sequencedDeferreds(2);
      function Parent() {
        const [value, setValue] = useState<string[]>([]);
        return (
          <>
            <button type="button" onClick={() => setValue(["underline"])}>
              external
            </button>
            <ToggleGroup.Root
              aria-label="x"
              value={value}
              valueChangeAction={() => deferreds.next()}
            >
              <ToggleGroup.Item value="bold">bold</ToggleGroup.Item>
              <ToggleGroup.Item value="italic">italic</ToggleGroup.Item>
              <ToggleGroup.Item value="underline">underline</ToggleGroup.Item>
            </ToggleGroup.Root>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(item("bold"));
      await user.click(item("italic"));
      await user.click(item("external"));
      expect(item("underline")).toHaveAttribute("aria-pressed", "true");
      expect(item("bold")).toHaveAttribute("aria-pressed", "true");
      expect(item("italic")).toHaveAttribute("aria-pressed", "true");
      await act(async () => {
        deferreds[0]!.resolve();
        deferreds[1]!.resolve();
      });
      expect(item("underline")).toHaveAttribute("aria-pressed", "true");
      expect(item("bold")).toHaveAttribute("aria-pressed", "false");
    });

    it("stacked patches re-base: Italic stays pressed while Bold's save is still in flight", async () => {
      const deferreds = sequencedDeferreds(2);
      render(
        <ToggleGroup.Root aria-label="x" value={[]} valueChangeAction={() => deferreds.next()}>
          <ToggleGroup.Item value="bold">bold</ToggleGroup.Item>
          <ToggleGroup.Item value="italic">italic</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      const user = setupUser();
      await user.click(item("bold"));
      await user.click(item("italic"));
      expect(item("bold")).toHaveAttribute("aria-pressed", "true");
      expect(item("italic")).toHaveAttribute("aria-pressed", "true");
      await act(async () => {
        deferreds[0]!.resolve();
        deferreds[1]!.resolve();
      });
      // Controlled and never updated: both revert to the committed value.
      expect(item("bold")).toHaveAttribute("aria-pressed", "false");
      expect(item("italic")).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("function props and render (row 8)", () => {
    it("Root and Item className / style / children receive the documented state", async () => {
      const d = deferred();
      const rootClass = vi.fn((s: ToggleGroupRootState) => `g${s.pending ? " busy" : ""}`);
      const itemChildren = vi.fn((s: ToggleGroupItemState) =>
        s.pending ? "saving" : s.pressed ? "on" : "off",
      );
      const rootChildren = vi.fn((s: ToggleGroupRootState) => (
        <>
          <ToggleGroup.Item value="a" style={(st) => ({ opacity: st.pressed ? 1 : 0.5 })}>
            {itemChildren}
          </ToggleGroup.Item>
          <output data-testid="value">{s.value.join(",")}</output>
        </>
      ));
      render(
        <ToggleGroup.Root
          aria-label="x"
          className={rootClass}
          style={(s) => ({ color: s.disabled ? "gray" : "black" })}
          valueChangeAction={() => d.promise}
        >
          {rootChildren}
        </ToggleGroup.Root>,
      );
      const user = setupUser();
      expect(rootClass).toHaveBeenLastCalledWith({
        value: [],
        pending: false,
        disabled: false,
        orientation: "horizontal",
      });
      expect(itemChildren).toHaveBeenLastCalledWith({
        value: "a",
        pressed: false,
        pending: false,
        disabled: false,
        orientation: "horizontal",
      });
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("off");
      expect(button).toHaveStyle({ opacity: "0.5" });

      await user.click(button);
      expect(rootClass).toHaveBeenLastCalledWith({
        value: ["a"],
        pending: true,
        disabled: false,
        orientation: "horizontal",
      });
      expect(root()).toHaveClass("g", "busy");
      expect(button).toHaveTextContent("saving");
      expect(screen.getByTestId("value")).toHaveTextContent("a");
      await act(async () => {
        d.resolve();
      });
      expect(button).toHaveTextContent("on");
      expect(button).toHaveStyle({ opacity: "1" });
    });

    it("state.value is in document order, not the value's own order", async () => {
      render(
        <ToggleGroup.Root aria-label="x" defaultValue={["c", "a"]}>
          {(s) => (
            <>
              <ToggleGroup.Item value="a">A</ToggleGroup.Item>
              <ToggleGroup.Item value="b">B</ToggleGroup.Item>
              <ToggleGroup.Item value="c">C</ToggleGroup.Item>
              <output data-testid="value">{s.value.join(",")}</output>
            </>
          )}
        </ToggleGroup.Root>,
      );
      await act(async () => {});
      expect(screen.getByTestId("value")).toHaveTextContent("a,c");
    });

    function MyButton({ ref, ...props }: ComponentPropsWithRef<"button">) {
      return <button ref={ref} data-my-button="" {...props} />;
    }

    it("render element keeps dispatch, class merge and ref", async () => {
      const action = vi.fn<ActionFn>();
      const ref = { current: null as HTMLButtonElement | null };
      render(
        <ToggleGroup.Root aria-label="x" valueChangeAction={action}>
          <ToggleGroup.Item
            value="a"
            ref={ref}
            className="item"
            render={<MyButton className="x" />}
          >
            A
          </ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      const user = setupUser();
      const el = item("A");
      expect(el).toHaveAttribute("data-my-button", "");
      expect(el).toHaveClass("item", "x");
      expect(ref.current).toBe(el);
      await user.click(el);
      expect(action.mock.calls[0]?.[0]).toEqual(["a"]);
      expect(el).toHaveAttribute("aria-pressed", "true");
    });

    it("Root render element", () => {
      render(
        <ToggleGroup.Root aria-label="x" render={<section />}>
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(root().tagName).toBe("SECTION");
    });
  });

  describe("keyboard, standalone (row 10)", () => {
    function Group({
      orientation,
      loop,
      dir,
      disabledB = false,
      action,
    }: {
      orientation?: "horizontal" | "vertical";
      loop?: boolean;
      dir?: "rtl";
      disabledB?: boolean;
      action?: ActionFn;
    }) {
      return (
        <ToggleGroup.Root
          aria-label="x"
          orientation={orientation}
          loop={loop}
          style={dir === "rtl" ? { direction: "rtl" } : undefined}
          valueChangeAction={action}
        >
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <ToggleGroup.Item value="b" disabled={disabledB}>
            B
          </ToggleGroup.Item>
          <ToggleGroup.Item value="c">C</ToggleGroup.Item>
        </ToggleGroup.Root>
      );
    }

    const matrix = [
      // orientation, loop, start, key, expected
      ["horizontal", true, "A", "ArrowRight", "B"],
      ["horizontal", true, "A", "ArrowLeft", "C"],
      ["horizontal", false, "A", "ArrowLeft", "A"],
      ["horizontal", false, "C", "ArrowRight", "C"],
      ["horizontal", true, "C", "ArrowRight", "A"],
      ["horizontal", true, "A", "ArrowDown", "A"],
      ["horizontal", true, "A", "ArrowUp", "A"],
      ["horizontal", true, "B", "Home", "A"],
      ["horizontal", true, "A", "End", "C"],
      ["vertical", true, "A", "ArrowDown", "B"],
      ["vertical", true, "A", "ArrowUp", "C"],
      ["vertical", false, "A", "ArrowUp", "A"],
      ["vertical", false, "C", "ArrowDown", "C"],
      ["vertical", true, "A", "ArrowRight", "A"],
      ["vertical", true, "A", "ArrowLeft", "A"],
      ["vertical", true, "B", "Home", "A"],
      ["vertical", true, "A", "End", "C"],
    ] as const;

    it.each(matrix)("%s loop=%s: %s + %s → %s", async (orientation, loop, start, key, expected) => {
      const action = vi.fn<ActionFn>();
      render(<Group orientation={orientation} loop={loop} action={action} />);
      act(() => item(start).focus());
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      await act(async () => {
        item(start).dispatchEvent(event);
      });
      expect(item(expected)).toHaveFocus();
      // A key on the group's axis (and Home / End) is handled, even when it cannot move.
      const onAxis =
        orientation === "horizontal"
          ? key === "ArrowLeft" || key === "ArrowRight"
          : key === "ArrowUp" || key === "ArrowDown";
      expect(event.defaultPrevented).toBe(onAxis || key === "Home" || key === "End");
      // Arrows never press.
      expect(action).not.toHaveBeenCalled();
      expect(item(expected)).toHaveAttribute("aria-pressed", "false");
    });

    it("RTL swaps the horizontal arrows", async () => {
      render(<Group dir="rtl" />);
      const user = setupUser();
      act(() => item("A").focus());
      await user.keyboard("{ArrowLeft}");
      expect(item("B")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(item("A")).toHaveFocus();
    });

    it("skips disabled Items and ignores modifier keys", async () => {
      render(<Group disabledB />);
      const user = setupUser();
      act(() => item("A").focus());
      await user.keyboard("{ArrowRight}");
      expect(item("C")).toHaveFocus();
      await user.keyboard("{Control>}{ArrowRight}{/Control}");
      expect(item("C")).toHaveFocus();
      await user.keyboard("{Alt>}{Home}{/Alt}");
      expect(item("C")).toHaveFocus();
    });
  });

  describe("disabled on link and component renders (#83, design/components/button.md 17.3)", () => {
    it.each([
      ["a link", <a key="link" href="#b" />],
      ["a component", <PlainButton key="component" />],
    ] as const)(
      "a disabled Item with %s render: aria-disabled, reached by the arrows, never dispatches",
      async (_, element) => {
        const action = vi.fn<ActionFn>();
        render(
          <ToggleGroup.Root aria-label="x" valueChangeAction={action}>
            <ToggleGroup.Item value="a">A</ToggleGroup.Item>
            <ToggleGroup.Item value="b" disabled render={element}>
              B
            </ToggleGroup.Item>
            <ToggleGroup.Item value="c">C</ToggleGroup.Item>
          </ToggleGroup.Root>,
        );
        const b = screen.getByText("B");
        expect(b).toHaveAttribute("aria-disabled", "true");
        expect(b).not.toHaveAttribute("disabled");
        expect(b).toHaveAttribute("data-disabled", "");
        expect(b).toHaveAttribute("aria-pressed", "false");
        const user = setupUser();
        act(() => item("A").focus());
        // The roving engine skips `:disabled` only: the APG Toolbar behaviour (documented).
        await user.keyboard("{ArrowRight}");
        expect(b).toHaveFocus();
        await user.keyboard(" ");
        await user.keyboard("{Enter}");
        expect(fireEvent.click(b)).toBe(false); // cancelled: a link does not navigate
        await user.click(b);
        expect(action).not.toHaveBeenCalled();
        expect(b).toHaveAttribute("aria-pressed", "false");
      },
    );

    it("a disabled host-button Item stays natively disabled and is skipped (unchanged)", async () => {
      render(
        <ToggleGroup.Root aria-label="x">
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <ToggleGroup.Item value="b" disabled render={<button />}>
            B
          </ToggleGroup.Item>
          <ToggleGroup.Item value="c">C</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(item("B")).toBeDisabled();
      expect(item("B")).not.toHaveAttribute("aria-disabled");
      const user = setupUser();
      act(() => item("A").focus());
      await user.keyboard("{ArrowRight}");
      expect(item("C")).toHaveFocus();
    });
  });

  describe("roving tab stop, standalone (row 11)", () => {
    it("one tab stop: the first pressed enabled Item, else the first enabled", () => {
      const { unmount } = render(
        <ToggleGroup.Root aria-label="x" defaultValue={["c"]}>
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <ToggleGroup.Item value="b">B</ToggleGroup.Item>
          <ToggleGroup.Item value="c">C</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(tabStops()).toEqual([item("C")]);
      expect(item("A")).toHaveAttribute("tabindex", "-1");
      unmount();

      render(
        <ToggleGroup.Root aria-label="x" defaultValue={["a"]}>
          <ToggleGroup.Item value="a" disabled>
            A
          </ToggleGroup.Item>
          <ToggleGroup.Item value="b">B</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(tabStops()).toEqual([item("B")]);
    });

    it("follows the optimistic pressed Item and reverts on rollback once focus leaves", async () => {
      silenceErrors();
      const d = deferred();
      render(
        <>
          <ToggleGroup.Root
            exclusive
            aria-label="x"
            value="left"
            valueChangeAction={() => d.promise}
          >
            <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
            <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
            <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
          </ToggleGroup.Root>
          <button type="button">outside</button>
        </>,
      );
      const user = setupUser();
      expect(tabStops()).toEqual([item("Left")]);
      await user.click(item("Center"));
      expect(tabStops()).toEqual([item("Center")]);
      await act(async () => {
        d.resolve();
      });
      // Controlled, never updated: rolled back to Left. Focus is still on Center, which stays
      // the stop while focus is inside; once focus leaves, the pressed Item is the stop again.
      expect(item("Left")).toHaveAttribute("aria-pressed", "true");
      expect(item("Center")).toHaveFocus();
      await user.click(item("outside"));
      expect(tabStops()).toEqual([item("Left")]);
      await user.tab({ shift: true });
      expect(item("Left")).toHaveFocus();
    });

    it("Tab enters on the pressed Item and leaves with the next press", async () => {
      render(
        <>
          <button type="button">before</button>
          <ToggleGroup.Root aria-label="x" defaultValue={["b"]}>
            <ToggleGroup.Item value="a">A</ToggleGroup.Item>
            <ToggleGroup.Item value="b">B</ToggleGroup.Item>
            <ToggleGroup.Item value="c">C</ToggleGroup.Item>
          </ToggleGroup.Root>
          <button type="button">after</button>
        </>,
      );
      const user = setupUser();
      await user.tab();
      await user.tab();
      expect(item("B")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(item("A")).toHaveFocus();
      await user.tab();
      expect(item("after")).toHaveFocus();
      await user.tab({ shift: true });
      expect(item("B")).toHaveFocus();
    });

    it("an Item mounted by a child-only re-render gets tabindex=-1 through the observer", async () => {
      function Late() {
        const [shown, setShown] = useState(false);
        return shown ? (
          <ToggleGroup.Item value="z">Z</ToggleGroup.Item>
        ) : (
          <span data-testid="show" onClick={() => setShown(true)} />
        );
      }
      render(
        <ToggleGroup.Root aria-label="x">
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <Late />
        </ToggleGroup.Root>,
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId("show"));
      });
      expect(item("Z")).toHaveAttribute("tabindex", "-1");
      expect(tabStops()).toEqual([item("A")]);
    });

    it("an element with its own tabIndex={-1} is skipped by arrows", async () => {
      render(
        <ToggleGroup.Root aria-label="x">
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <button type="button" tabIndex={-1}>
            skip
          </button>
          <ToggleGroup.Item value="c">C</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      const user = setupUser();
      act(() => item("A").focus());
      await user.keyboard("{ArrowRight}");
      expect(item("C")).toHaveFocus();
    });

    it("server HTML carries no tabindex", () => {
      const html = renderToString(
        <ToggleGroup.Root aria-label="x" defaultValue={["a"]}>
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <ToggleGroup.Item value="b">B</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(html).not.toContain("tabindex");
      expect(html).toContain('role="group"');
    });
  });

  describe("experimental_focusgroup (row 16)", () => {
    it("renders the toolbar token with nomemory and focusgroupstart on the first pressed Item", async () => {
      render(
        <ToggleGroup.Root
          aria-label="x"
          experimental_focusgroup
          orientation="vertical"
          loop={false}
          defaultValue={["c", "b"]}
        >
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <ToggleGroup.Item value="b">B</ToggleGroup.Item>
          <ToggleGroup.Item value="c">C</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      await act(async () => {});
      expect(root()).toHaveAttribute("focusgroup", "toolbar block nowrap nomemory");
      expect(item("B")).toHaveAttribute("focusgroupstart", "");
      expect(item("A")).not.toHaveAttribute("focusgroupstart");
      expect(item("C")).not.toHaveAttribute("focusgroupstart");
      // jsdom has no `focusGroup`: the JS path still runs.
      act(() => item("A").focus());
      await setupUser().keyboard("{ArrowDown}");
      expect(item("B")).toHaveFocus();
    });

    it("no focusgroupstart when nothing is pressed; no attribute without the flag", () => {
      const { unmount } = render(
        <ToggleGroup.Root aria-label="x" experimental_focusgroup>
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(root()).toHaveAttribute("focusgroup", "toolbar inline wrap nomemory");
      expect(item("A")).not.toHaveAttribute("focusgroupstart");
      unmount();
      render(
        <ToggleGroup.Root aria-label="x" defaultValue={["a"]}>
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(root()).not.toHaveAttribute("focusgroup");
      expect(item("A")).not.toHaveAttribute("focusgroupstart");
    });
  });

  describe("dev warnings (row 17)", () => {
    it("switching exclusive after mount warns", () => {
      const error = silenceErrors();
      const { rerender } = render(<ToggleGroup.Root aria-label="x" />);
      rerender(<ToggleGroup.Root exclusive aria-label="x" />);
      expect(error.mock.calls.some(([m]) => String(m).includes("`exclusive` changed"))).toBe(true);
    });

    it("duplicate Item values warn", () => {
      const error = silenceErrors();
      render(
        <ToggleGroup.Root aria-label="x">
          <ToggleGroup.Item value="a">A1</ToggleGroup.Item>
          <ToggleGroup.Item value="a">A2</ToggleGroup.Item>
        </ToggleGroup.Root>,
      );
      expect(error.mock.calls.some(([m]) => String(m).includes('share the value "a"'))).toBe(true);
    });
  });
});
