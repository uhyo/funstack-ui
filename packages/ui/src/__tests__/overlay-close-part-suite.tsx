// Shared rows for an overlay's Close part with an `action` (Dialog.Close, Popover.Close): the part
// runs its action (Button's re-entry rules, design/components/button.md 16.4), then the library
// closes the popup. The rows are the same for both; what differs is the native close
// (`close(value)` / `hidePopover()`), the part's value (Dialog's `returnValue`) and how a JS-free
// popup is opened. Component-specific rows (Dialog's forms and `returnValue` leaks, Popover's
// native invoker without `action`) stay in the components' files.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ComponentPropsWithRef, ComponentType, ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import type { ActionDetails } from "../internal/types.js";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  flushTasks,
  recordClicks,
  renderBoth,
  setupUser,
  silenceErrors,
} from "./helpers.js";
import type { OpenChangeFn, OverlaySuiteHarnessProps } from "./overlay-open-state-suite.js";

/** The props the suite renders the Close part with. */
export interface ClosePartProps {
  readonly "data-testid": string;
  readonly action?: (details: ActionDetails) => unknown;
  readonly disabled?: boolean;
  readonly render?: ReactElement<ComponentPropsWithRef<"button">>;
  readonly children?: ReactNode;
}

export interface OverlayClosePartConfig<D extends { readonly reason: string }> {
  /** The describe block's name (`"Dialog"`). */
  readonly name: string;
  readonly Harness: ComponentType<OverlaySuiteHarnessProps<D>>;
  /** Whether the popup is shown. */
  readonly isOpen: () => boolean;
  /** The Close part (Dialog's with `value`). */
  readonly Close: ComponentType<ClosePartProps>;
  /** Spies on the native close the library calls (`close`, `hidePopover`). */
  readonly spyClose: () => MockInstance;
  /** The arguments of that call (Dialog: the part's value). */
  readonly closeArgs: readonly unknown[];
  /**
   * The part's value, reported as `returnValue` in its action's details and in the Root's
   * `openChangeAction` details (Dialog); `undefined` where the component has none.
   */
  readonly value?: string;
  /** The platform closes the popup (Escape, light dismiss). Called inside `act`. */
  readonly dismiss: () => void;
  /** Opens the JS-free (no open-state props) popup natively, as its Trigger would. */
  readonly openStatic: () => Promise<void>;
}

type User = ReturnType<typeof setupUser>;

export function describeOverlayClosePart<D extends { readonly reason: string }>(
  config: OverlayClosePartConfig<D>,
): void {
  const { Harness, isOpen, Close, spyClose } = config;
  type Action = OpenChangeFn<D>;
  const part = () => screen.getByTestId("part");
  const trigger = () => screen.getByTestId("trigger");
  const returnValueOf = (details: unknown) => (details as { returnValue?: unknown }).returnValue;

  async function openThroughTrigger(user: User) {
    await user.click(trigger());
    await flushTasks(2);
    expect(isOpen()).toBe(true);
  }

  /** A Close part with `action`, as the popup's whole content. */
  const withClose = (props: Omit<ClosePartProps, "data-testid">): ReactNode => (
    <Close data-testid="part" {...props}>
      Done
    </Close>
  );

  describe(`${config.name} Close part with action (shared suite)`, () => {
    renderBoth("library mode", (mode) => {
      it("the click is cancelled, data-pending while it runs, then the library closes", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const work = deferred();
        const closeAction = vi.fn<NonNullable<ClosePartProps["action"]>>(() => work.promise);
        render(
          <Harness mode={mode} action={action} content={withClose({ action: closeAction })} />,
        );
        await openThroughTrigger(user);
        const close = spyClose();
        const button = part();
        await user.click(button);
        expect(closeAction).toHaveBeenCalledTimes(1);
        const details = closeAction.mock.calls[0]![0];
        // The native close command was cancelled: the library closes after the action.
        expect(details.event!.defaultPrevented).toBe(true);
        if (config.value !== undefined) expect(returnValueOf(details)).toBe(config.value);
        expectPending(button);
        // The Root's pending is for `openChangeAction` only.
        expectNotPending(trigger());
        expect(isOpen()).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1);
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledWith(...config.closeArgs);
        expect(isOpen()).toBe(false);
        expectNotPending(button);
        expect(action).toHaveBeenCalledTimes(2);
        const [next, notify] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(notify.reason).toBe("activate");
        expect((notify as unknown as { event?: Event }).event!.type).toBe("click");
        if (config.value !== undefined) expect(returnValueOf(notify)).toBe(config.value);
      });

      it("a rejection reaches the boundary inside the popup; the popup stays open", async () => {
        const user = setupUser();
        silenceErrors();
        const action = vi.fn<Action>();
        const caught = vi.fn();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <ErrorCatcher onError={caught}>
                {withClose({
                  action: async () => {
                    throw new Error("save failed");
                  },
                })}
              </ErrorCatcher>
            }
          />,
        );
        await openThroughTrigger(user);
        const close = spyClose();
        await user.click(part());
        await flushTasks(2);
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
        expect(close).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
      });

      it("a rejection reaches the boundary; after a reset the Close runs again", async () => {
        const user = setupUser();
        silenceErrors();
        const action = vi.fn<Action>();
        const caught = vi.fn();
        const runs = [deferred(), deferred()];
        let call = 0;
        function Resettable() {
          const [key, setKey] = useState(0);
          return (
            <>
              <button type="button" data-testid="reset" onClick={() => setKey((k) => k + 1)} />
              <ErrorCatcher key={key} onError={caught}>
                {withClose({ action: () => runs[call++]!.promise })}
              </ErrorCatcher>
            </>
          );
        }
        render(<Harness mode={mode} action={action} content={<Resettable />} />);
        await openThroughTrigger(user);
        const close = spyClose();
        await user.click(part());
        await act(async () => runs[0]!.reject(new Error("first failed")));
        await flushTasks(2);
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "first failed" }));
        expect(screen.getByTestId("error-catcher")).toBeInTheDocument();
        expect(isOpen()).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1);
        // The boundary sits above the Close: reset it and the next click runs the action again.
        fireEvent.click(screen.getByTestId("reset"));
        await user.click(part());
        expect(call).toBe(2);
        await act(async () => runs[1]!.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
        expect(isOpen()).toBe(false);
      });

      it("re-entry: a second click, Enter and Space while pending are ignored and cancelled", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <Harness mode={mode} action={action} content={withClose({ action: closeAction })} />,
        );
        await openThroughTrigger(user);
        const close = spyClose();
        const button = part();
        expect(button).not.toHaveAttribute("aria-disabled");
        const clicks = recordClicks();
        await user.click(button);
        await user.click(button);
        button.focus();
        await user.keyboard("{Enter}");
        await user.keyboard(" ");
        expect(closeAction).toHaveBeenCalledTimes(1);
        // Library mode cancels every Close click (the command); the ignored ones are no exception.
        expect(clicks).toEqual([true, true, true, true]);
        expect(button).toHaveAttribute("aria-disabled", "true");
        expectPending(button);
        expect(button).not.toHaveAttribute("data-disabled");
        expect(button).not.toBeDisabled();
        expect(document.activeElement).toBe(button);
        expect(action).toHaveBeenCalledTimes(1); // the open only
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
          [true, "activate"],
          [false, "activate"],
        ]);
        expect(close).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledWith(...config.closeArgs);
        expect(isOpen()).toBe(false);
        // The element reference: the attributes are gone with the settle.
        expect(button).not.toHaveAttribute("aria-disabled");
        expectNotPending(button);
      });

      it("two clicks in one task call the action once", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <Harness mode={mode} action={action} content={withClose({ action: closeAction })} />,
        );
        await openThroughTrigger(user);
        act(() => {
          fireEvent.click(part());
          fireEvent.click(part());
        });
        expect(closeAction).toHaveBeenCalledTimes(1);
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(2);
        expect(isOpen()).toBe(false);
      });

      it("dismissed and re-opened while the action runs: the stale close is dropped", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const work = deferred();
        render(
          <Harness
            mode={mode}
            action={action}
            content={withClose({ action: () => work.promise })}
          />,
        );
        await openThroughTrigger(user);
        await user.click(part());
        expectPending(part());
        // A dismissal while the action runs, then the user opens the popup again.
        await act(async () => config.dismiss());
        await flushTasks(2);
        expect(isOpen()).toBe(false);
        // The re-open is entangled with the Close's pending async transition (React batches
        // them), so it commits together with the action's end.
        await user.click(trigger());
        const close = spyClose();
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false, true]);
      });

      it("a disabled Close never runs its action or closes", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const closeAction = vi.fn();
        render(
          <Harness
            mode={mode}
            action={action}
            content={withClose({ action: closeAction, disabled: true })}
          />,
        );
        await openThroughTrigger(user);
        fireEvent.click(part());
        await user.click(part());
        await flushTasks(2);
        expect(closeAction).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
        expect(part()).toHaveAttribute("data-disabled", "");
      });
    });

    describe("JS-free mode", () => {
      it("re-entry: a second click and Enter while pending are ignored; one native close after the action", async () => {
        const user = setupUser();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(<Harness mode="static" content={withClose({ action: closeAction })} />);
        await config.openStatic();
        expect(isOpen()).toBe(true);
        const close = spyClose();
        const button = part();
        const clicks = recordClicks();
        await user.click(button);
        await user.click(button);
        button.focus();
        await user.keyboard("{Enter}");
        expect(closeAction).toHaveBeenCalledTimes(1);
        expect(clicks).toEqual([true, true, true]);
        expect(button).toHaveAttribute("aria-disabled", "true");
        expectPending(button);
        expect(isOpen()).toBe(true);
        expect(close).not.toHaveBeenCalled();
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledWith(...config.closeArgs);
        expect(isOpen()).toBe(false);
        expect(button).not.toHaveAttribute("aria-disabled");
      });

      it("a render element's aria-disabled is removed while the Close is idle (owned)", () => {
        render(
          <Harness
            mode="static"
            content={withClose({
              action: () => {},
              render: <button type="button" aria-disabled="true" />,
            })}
          />,
        );
        expect(part()).not.toHaveAttribute("aria-disabled");
      });
    });
  });
}
