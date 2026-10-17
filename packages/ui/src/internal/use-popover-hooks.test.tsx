// The extension points of the shared popover hooks that Menu (#39, design/components/menu.md 14)
// uses and Popover does not: a forced library mode, `onDispatch`, `resolveInitialFocus`, a
// `<div popover>` popup (no dialog focusing steps), and `wrapContent` with a Menu-style
// `requestClose`. Popover's own behaviour is covered by src/popover/popover.test.tsx.
import { act, render, screen } from "@testing-library/react";
import type { Ref, ViewTransitionClass } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import type { ChangeReason } from "./types.js";
import { usePopoverPopup } from "./use-popover-popup.js";
import { usePopoverRoot } from "./use-popover-root.js";
import type { PopoverLikeDetails, PopoverRootValue } from "./use-popover-root.js";
import { usePopoverTrigger } from "./use-popover-trigger.js";

function Mini({
  onDispatch,
  resolve,
  transition,
}: {
  onDispatch?: (next: boolean, details: PopoverLikeDetails) => void;
  resolve?: (popup: HTMLElement) => HTMLElement | null;
  transition?: ViewTransitionClass;
}) {
  const ctx = usePopoverRoot<PopoverLikeDetails>({
    component: "menu",
    part: "Mini.Root",
    mode: "library",
    open: undefined,
    defaultOpen: undefined,
    openChangeAction: undefined,
    onDispatch,
  });
  // Destructured: React Compiler's ref inference taints an object once one of its members is
  // passed as `ref`, and would then flag reading `visible` from it during render.
  const { libraryProps: triggerProps, ref: triggerRef } = usePopoverTrigger(ctx, {
    part: "Mini.Trigger",
    disabled: false,
    render: undefined,
  });
  const { setElement, visible, wrapContent } = usePopoverPopup(ctx, {
    part: "Mini.Popup",
    initialFocus: undefined,
    resolveInitialFocus: resolve,
    keepMounted: undefined,
    transition,
  });
  return (
    <>
      <button {...triggerProps} ref={triggerRef as Ref<HTMLButtonElement>} data-testid="trigger">
        Menu
      </button>
      <div
        id={ctx.ids.popup}
        popover="auto"
        role="menu"
        aria-label="Mini"
        ref={setElement as Ref<HTMLDivElement>}
        data-testid="popup"
      >
        {visible &&
          wrapContent(
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
            </>,
          )}
      </div>
    </>
  );
}

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shared popover hooks: Menu's extension points", () => {
  it('mode: "library" without any prop: the Trigger click is intercepted and opens', async () => {
    const user = setupUser();
    const onDispatch = vi.fn<(next: boolean, details: PopoverLikeDetails) => void>();
    render(<Mini onDispatch={onDispatch} />);
    expect(screen.queryByTestId("one")).toBeNull();
    await user.click(screen.getByTestId("trigger"));
    await flush();
    expect(onDispatch).toHaveBeenCalledTimes(1);
    const [next, details] = onDispatch.mock.calls[0]!;
    expect(next).toBe(true);
    expect(details.reason satisfies ChangeReason).toBe("activate");
    expect(details.event!.defaultPrevented).toBe(true);
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(true);
    expect(screen.getByTestId("trigger")).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByTestId("trigger"));
    await flush();
    expect(onDispatch.mock.calls.map(([n]) => n)).toEqual([true, false]);
    expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
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
    await flush();
    expect(autofocused).toBe("two");
    expect(screen.getByTestId("two")).not.toHaveAttribute("autofocus");
  });

  it("a <div popover> keeps focus on the Trigger without autofocus", async () => {
    const user = setupUser();
    render(<Mini />);
    await user.click(screen.getByTestId("trigger"));
    await flush();
    expect(screen.getByTestId("trigger")).toHaveFocus();
  });

  it("usePopoverRoot returns the same value across re-renders with unchanged state (#48)", async () => {
    const user = setupUser();
    const values: PopoverRootValue[] = [];
    const first = vi.fn();
    const second = vi.fn();
    function Root({ onDispatch }: { onDispatch: () => void }) {
      const ctx = usePopoverRoot<PopoverLikeDetails>({
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
    await flush();
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
      await flush();
      expect(screen.getByTestId("one")).toHaveFocus();
      await user.keyboard("{Enter}");
      await flush();
      expect(screen.getByTestId("popup").matches(":popover-open")).toBe(false);
      expect(screen.queryByTestId("one")).toBeNull();
      expect(screen.getByTestId("trigger")).toHaveFocus();
    },
  );
});
