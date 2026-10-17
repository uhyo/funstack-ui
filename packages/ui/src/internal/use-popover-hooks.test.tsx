// The extension points of the shared popover hooks that Menu (#39, design/components/menu.md 14)
// uses and Popover does not: a forced library mode, `onDispatch`, `resolveInitialFocus`, and a
// `<div popover>` popup (no dialog focusing steps, no focus fallback). Popover's own behaviour is
// covered by src/popover/popover.test.tsx.
import { act, render, screen } from "@testing-library/react";
import type { Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import type { ChangeReason } from "./types.js";
import { usePopoverPopup } from "./use-popover-popup.js";
import { usePopoverRoot } from "./use-popover-root.js";
import type { PopoverLikeDetails } from "./use-popover-root.js";
import { usePopoverTrigger } from "./use-popover-trigger.js";

function Mini({
  onDispatch,
  resolve,
}: {
  onDispatch?: (next: boolean, details: PopoverLikeDetails) => void;
  resolve?: (popup: HTMLElement) => HTMLElement | null;
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
  const trigger = usePopoverTrigger(ctx, {
    part: "Mini.Trigger",
    disabled: false,
    render: undefined,
  });
  const popup = usePopoverPopup(ctx, {
    part: "Mini.Popup",
    initialFocus: undefined,
    resolveInitialFocus: resolve,
    keepMounted: undefined,
    transition: undefined,
  });
  return (
    <>
      <button
        {...trigger.libraryProps}
        ref={trigger.ref as Ref<HTMLButtonElement>}
        data-testid="trigger"
      >
        Menu
      </button>
      <div
        id={ctx.ids.popup}
        popover="auto"
        role="menu"
        aria-label="Mini"
        ref={popup.setElement as Ref<HTMLDivElement>}
        data-testid="popup"
      >
        {popup.visible && (
          <>
            <button type="button" data-testid="one">
              One
            </button>
            <button type="button" data-testid="two">
              Two
            </button>
          </>
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

  it("a <div popover> gets no focus fallback (the Trigger keeps focus without autofocus)", async () => {
    const user = setupUser();
    render(<Mini />);
    await user.click(screen.getByTestId("trigger"));
    await flush();
    expect(screen.getByTestId("trigger")).toHaveFocus();
  });
});
