// The extension points of the shared popover hooks that Menu (#39, design/components/menu.md 14)
// uses and Popover does not: a forced library mode, `onDispatch`, `resolveInitialFocus`, a
// `<div popover>` popup (no dialog focusing steps), `renderContent` with a Menu-style
// `requestClose`, and `whileShown` (Menu and Combobox). Popover's own behaviour is covered by
// src/popover/popover.test.tsx.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ComponentPropsWithRef, Ref, ViewTransitionClass } from "react";
import { describe, expect, it, vi } from "vitest";
import { onCleanup } from "../__tests__/cleanups.js";
import { setupUser, flushTasks } from "../__tests__/helpers.js";
import { resetFocusVisibleOption } from "./focus-visible.js";
import type { QuietFocusTarget } from "./focus-visible.js";
import type { ChangeReason } from "./types.js";
import { usePopoverPopup } from "./use-popover-popup.js";
import { popoverDetails, useOverlayRoot } from "./use-overlay-root.js";
import type { OverlayDetails, PopoverRootValue } from "./use-overlay-root.js";
import { usePopoverTrigger } from "./use-popover-trigger.js";

function Mini({
  open,
  onOpenChange,
  onDispatch,
  resolve,
  transition,
  whileShown,
  inlineRef = false,
  link = false,
}: {
  /** Controlled open state (with `onOpenChange`); default uncontrolled. */
  open?: boolean;
  onOpenChange?: (next: boolean, details: OverlayDetails) => void;
  onDispatch?: (next: boolean, details: OverlayDetails) => void;
  resolve?: (popup: HTMLElement) => HTMLElement | QuietFocusTarget | null;
  transition?: ViewTransitionClass;
  whileShown?: (popup: HTMLElement) => () => void;
  /** Pass the Popup a fresh callback ref every render (an inline consumer `ref`). */
  inlineRef?: boolean;
  /** Render the Trigger as a link (no invoker) instead of a `<button>`. */
  link?: boolean;
}) {
  const ctx = useOverlayRoot<OverlayDetails>({
    component: "menu",
    part: "Mini.Root",
    mode: "library",
    open,
    defaultOpen: undefined,
    openChangeAction: undefined,
    onOpenChange,
    details: popoverDetails,
    onDispatch,
  });
  // Destructured: React Compiler's ref inference taints an object once one of its members is
  // passed as `ref`, and would then flag reading `visible` from it during render.
  const { libraryProps: triggerProps, ref: triggerRef } = usePopoverTrigger(ctx, {
    part: "Mini.Trigger",
    disabled: false,
    render: link ? <a href="#" /> : undefined,
  });
  const { setElement, renderContent } = usePopoverPopup(ctx, {
    part: "Mini.Popup",
    initialFocus: undefined,
    resolveInitialFocus: resolve,
    keepMounted: undefined,
    transition,
    whileShown,
  });
  return (
    <>
      {link ? (
        <a
          href="#"
          {...(triggerProps as ComponentPropsWithRef<"a">)}
          ref={triggerRef as Ref<HTMLAnchorElement>}
          data-testid="trigger"
        >
          Menu
        </a>
      ) : (
        <button {...triggerProps} ref={triggerRef as Ref<HTMLButtonElement>} data-testid="trigger">
          Menu
        </button>
      )}
      <div
        id={ctx.ids.popup}
        popover="auto"
        role="menu"
        aria-label="Mini"
        ref={inlineRef ? (element: HTMLDivElement) => setElement(element) : setElement}
        data-testid="popup"
      >
        {renderContent(() => (
          <>
            <button
              type="button"
              data-testid="one"
              // Menu's item activation: a library-owned close.
              onClick={(event) => ctx.requestClose(event.nativeEvent, "activate")}
            >
              One
            </button>
            <button type="button" data-testid="two">
              Two
            </button>
          </>
        ))}
      </div>
    </>
  );
}

describe("shared popover hooks: Menu's extension points", () => {
  it('mode: "library" without any prop: the Trigger click is intercepted and opens', async () => {
    const user = setupUser();
    const onDispatch = vi.fn<(next: boolean, details: OverlayDetails) => void>();
    render(<Mini onDispatch={onDispatch} />);
    expect(screen.queryByTestId("one")).toBeNull();
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(onDispatch).toHaveBeenCalledTimes(1);
    const [next, details] = onDispatch.mock.calls[0]!;
    expect(next).toBe(true);
    expect(details.reason satisfies ChangeReason).toBe("activate");
    expect(details.event!.defaultPrevented).toBe(true);
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    // A `popovertarget` invoker: the browser exposes the state, no `aria-expanded` (#121).
    expect(screen.getByTestId("trigger")).toHaveAttribute(
      "popovertarget",
      screen.getByTestId("popup").id,
    );
    expect(screen.getByTestId("trigger")).not.toHaveAttribute("aria-expanded");
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(onDispatch.mock.calls.map(([n]) => n)).toEqual([true, false]);
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
  });

  // #121
  it("a non-button render is no invoker and renders aria-expanded from the shown popup", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // the non-button warning
    const user = setupUser();
    render(<Mini link />);
    const trigger = screen.getByTestId("trigger");
    expect(trigger).not.toHaveAttribute("popovertarget");
    expect(trigger).not.toHaveAttribute("popovertargetaction");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await flushTasks();
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger);
    await flushTasks();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("resolveInitialFocus writes autofocus on its result right before showPopover()", async () => {
    const user = setupUser();
    let autofocused: string | null | undefined;
    const show = HTMLElement.prototype.showPopover;
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
      this: HTMLElement,
      options,
    ) {
      autofocused = this.querySelector("[autofocus]")?.getAttribute("data-testid");
      show.call(this, options);
    });
    render(<Mini resolve={(popup) => popup.querySelector("[data-testid=two]")} />);
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(autofocused).toBe("two");
    expect(screen.getByTestId("two")).not.toHaveAttribute("autofocus");
  });

  it("a <div popover> keeps focus on the Trigger without autofocus", async () => {
    const user = setupUser();
    render(<Mini />);
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(screen.getByTestId("trigger")).toHaveFocus();
  });

  it("whileShown installs at the open's toggle and cleans up at the close's toggle", async () => {
    const user = setupUser();
    const stop = vi.fn();
    const whileShown = vi.fn((_popup: HTMLElement) => stop);
    render(<Mini whileShown={whileShown} />);
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(whileShown).toHaveBeenCalledTimes(1);
    expect(whileShown).toHaveBeenCalledWith(screen.getByTestId("popup"));
    expect(stop).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(whileShown).toHaveBeenCalledTimes(1);
  });

  it("whileShown is reinstalled when an inline ref re-runs on a shown popup", async () => {
    const user = setupUser();
    // How many installs are live: every ref re-run stops and reinstalls, so only the balance and
    // the growth of the install count are fixed.
    let active = 0;
    const whileShown = vi.fn((_popup: HTMLElement) => {
      active++;
      return () => void active--;
    });
    const { rerender } = render(<Mini whileShown={whileShown} inlineRef />);
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(active).toBe(1);
    const installs = whileShown.mock.calls.length;
    rerender(<Mini whileShown={whileShown} inlineRef />);
    // The detach stopped the listeners and the attach installed them again.
    expect(whileShown.mock.calls.length).toBe(installs + 1);
    expect(active).toBe(1);
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(active).toBe(0);
  });

  it("whileShown cleans up when the popup unmounts while shown", async () => {
    const user = setupUser();
    const stop = vi.fn();
    const { unmount } = render(<Mini whileShown={() => stop} />);
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  // #48
  it("useOverlayRoot returns the same value across re-renders with unchanged state", async () => {
    const user = setupUser();
    const values: PopoverRootValue[] = [];
    const first = vi.fn();
    const second = vi.fn();
    function Root({ onDispatch }: { onDispatch: () => void }) {
      const ctx = useOverlayRoot<OverlayDetails>({
        component: "menu",
        part: "Stable.Root",
        mode: "library",
        open: undefined,
        defaultOpen: undefined,
        openChangeAction: () => {},
        onOpenChange: undefined,
        // Inline, new on every render.
        details: (event, reason) => ({ event, reason }),
        onDispatch: () => onDispatch(),
      });
      values.push(ctx);
      return (
        <button type="button" onClick={(e) => ctx.requestOpen(e.nativeEvent, "activate")}>
          {String(ctx.optimistic)}
        </button>
      );
    }
    const view = render(<Root onDispatch={first} />);
    view.rerender(<Root onDispatch={first} />);
    view.rerender(<Root onDispatch={second} />);
    for (const v of values) expect(v).toBe(values[0]);

    // The stable `requestOpen` reaches the `onDispatch` of the last committed render.
    await user.click(screen.getByRole("button"));
    await flushTasks();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    const last = values.at(-1)!;
    expect(last).not.toBe(values[0]);
    expect(last.optimistic).toBe(true);
    for (const key of ["requestOpen", "requestClose", "notifyClosed", "intended", "ids"] as const) {
      expect(last[key]).toBe(values[0]![key]);
    }
  });

  it.each([["pop"], [undefined]] as const)(
    "requestClose from an item (transition %s): focus returns to the Trigger",
    async (transition) => {
      const user = setupUser();
      render(<Mini transition={transition} resolve={(popup) => popup.querySelector("button")} />);
      await user.click(screen.getByTestId("trigger"));
      await flushTasks();
      expect(screen.getByTestId("one")).toHaveFocus();
      await user.keyboard("{Enter}");
      await flushTasks();
      expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
      expect(screen.queryByTestId("one")).toBeNull();
      expect(screen.getByTestId("trigger")).toHaveFocus();
    },
  );

  // #157 safety net (memo/reviewer/refactor-test-safety.md UOR8): a fact goes through
  // `onDispatch` (Menu cancels its hover timers and forgets the open cause there), before
  // `onOpenChange`.
  it("a dismissal calls onDispatch(false, details) before onOpenChange", async () => {
    const user = setupUser();
    const order: string[] = [];
    const facts: OverlayDetails[] = [];
    const dispatched: OverlayDetails[] = [];
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Mini
          open={open}
          onOpenChange={(next, details) => {
            order.push(`fact ${String(next)} ${details.reason}`);
            facts.push(details);
            setOpen(next);
          }}
          onDispatch={(next, details) => {
            order.push(`dispatch ${String(next)} ${details.reason}`);
            dispatched.push(details);
            // No `openChangeAction`: the parent adopts a requested open itself.
            if (next) startTransition(() => setOpen(true));
          }}
        />
      );
    }
    render(<Controlled />);
    await user.click(screen.getByTestId("trigger"));
    await flushTasks();
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    await act(async () => screen.getByTestId("popup").hidePopover());
    await flushTasks();
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
    expect(order).toEqual([
      "dispatch true activate",
      "dispatch false dismiss",
      "fact false dismiss",
    ]);
    expect(dispatched[1]).toBe(facts[0]);
  });

  // #157 safety net (UPP2, #155): a refused re-open resolves no initial focus, not even a quiet
  // one (`focus({ focusVisible: false })` after the show, Menu's pointer open), which the `inert`
  // window around `showPopover()` does not cover.
  it("a refused re-open with a quiet initial focus target leaves focus where the dismissal put it", async () => {
    // jsdom does not read `focusVisible`: make the probe see an engine that does.
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      void (options as { focusVisible?: boolean } | undefined)?.focusVisible;
      focus.call(this, options);
    });
    resetFocusVisibleOption();
    onCleanup(resetFocusVisibleOption);
    const quiet = (popup: HTMLElement): QuietFocusTarget => ({
      element: popup.querySelector<HTMLElement>("[data-testid=two]")!,
      focusVisible: false,
    });
    render(
      <>
        <button type="button" data-testid="elsewhere">
          Elsewhere
        </button>
        {/* A parent that keeps `open={true}`: every dismissal is refused. */}
        <Mini open onOpenChange={() => {}} resolve={quiet} />
      </>,
    );
    await flushTasks();
    const popup = screen.getByTestId("popup");
    expect(popup.matches(":popover-open")).toBe(true);
    // The first open took the quiet path.
    expect(screen.getByTestId("two")).toHaveFocus();
    // The dismissal moved focus out (a click outside, as the platform's light dismiss).
    screen.getByTestId("elsewhere").focus();
    await act(async () => popup.hidePopover());
    await flushTasks(2);
    expect(popup.matches(":popover-open")).toBe(true);
    expect(screen.getByTestId("elsewhere")).toHaveFocus();
  });

  // #157 safety net (UPP6): after the library's own hide, focus that the close commit dropped
  // with the content is returned at once, in the same commit, not a task later at `toggle`.
  it("a library close with transition returns focus before the close's toggle task", async () => {
    // Only the timers are faked: the shim's `toggle` task waits, promises still run.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onCleanup(() => vi.useRealTimers());
    render(<Mini transition="pop" resolve={(popup) => popup.querySelector("button")} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    act(() => screen.getByTestId("one").focus());
    await act(async () => {
      fireEvent.click(screen.getByTestId("one"));
    });
    // Hidden, the content unmounted with focus in it, and the `toggle` task not run yet.
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
    expect(screen.queryByTestId("one")).toBeNull();
    expect(screen.getByTestId("trigger")).toHaveFocus();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId("trigger")).toHaveFocus();
  });
});
