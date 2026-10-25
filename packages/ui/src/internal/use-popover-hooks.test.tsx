// The extension points of the shared popover hooks that Menu (#39, design/components/menu.md 14)
// uses and Popover does not: a forced library mode, `onDispatch`, `resolveInitialFocus`, a
// `<div popover>` popup (no dialog focusing steps), `renderContent` with a Menu-style
// `requestClose`, and `whileShown` (Menu and Combobox). Popover's own behaviour is covered by
// src/popover/popover.test.tsx.
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithRef, Ref, ViewTransitionClass } from "react";
import { describe, expect, it, vi } from "vitest";
import { setupUser, flushTasks } from "../__tests__/helpers.js";
import type { ChangeReason } from "./types.js";
import { usePopoverPopup } from "./use-popover-popup.js";
import { popoverDetails, useOverlayRoot } from "./use-overlay-root.js";
import type { OverlayDetails, PopoverRootValue } from "./use-overlay-root.js";
import { usePopoverTrigger } from "./use-popover-trigger.js";

function Mini({
  onDispatch,
  resolve,
  transition,
  whileShown,
  inlineRef = false,
  link = false,
}: {
  onDispatch?: (next: boolean, details: OverlayDetails) => void;
  resolve?: (popup: HTMLElement) => HTMLElement | null;
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
    open: undefined,
    defaultOpen: undefined,
    openChangeAction: undefined,
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

  it("a non-button render is no invoker and renders aria-expanded from the shown popup (#121)", async () => {
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

  it("useOverlayRoot returns the same value across re-renders with unchanged state (#48)", async () => {
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
});
