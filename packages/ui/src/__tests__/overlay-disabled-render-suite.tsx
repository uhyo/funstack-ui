// Shared jsdom rows for `disabled` on the overlay parts' link and component renders
// (design/components/button.md 17.3, #83): Dialog, Popover and Menu (#109). A disabled part that
// renders a link or a component cannot be natively disabled, so it is `aria-disabled` and the
// library cancels its click; a host `<button>` render (or none) is natively disabled; a disabled
// component render is no invoker (no `commandfor` / `command`), except a JS-free part without an
// action, whose native command the platform must skip (native `disabled`).
//
// Each component's test file calls `describeOverlayDisabledRenders` with its open-state harness
// (`createOverlayHarness`); the Close rows run where the overlay has a Close part and a JS-free
// mode (Dialog, Popover). Component-specific rows (Dialog's non-modal JS-free Trigger and its
// owned `disabled`, Popover's own `aria-disabled` on a host render) stay in those files.
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentPropsWithRef, ComponentType, ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { flushTasks, PlainButton, setupUser } from "./helpers.js";
import type { OpenChangeFn, OverlayHarnessProps } from "./overlay-open-state-suite.js";

type User = ReturnType<typeof setupUser>;

/** The props the suite gives a disabled part. */
export interface DisabledPartProps {
  disabled?: boolean;
  render?: ReactElement<Partial<ComponentPropsWithRef<"button">>>;
  action?: () => unknown;
}

export interface OverlayDisabledRenderConfig<D, P extends object> {
  /** The describe block's name (`"Dialog"`). */
  readonly name: string;
  /**
   * The component's open-state harness. The Trigger is `data-testid="trigger"`, the Popup
   * `data-testid="popup"`, and `trigger` props go to the Trigger.
   */
  readonly Harness: ComponentType<OverlayHarnessProps<D> & { trigger?: DisabledPartProps } & P>;
  /** Whether the popup is shown (`dialog.open`, `:popover-open`). */
  readonly isOpen: () => boolean;
  /** Spies on the method the library opens the popup with (`showModal`, `showPopover`). */
  readonly spyOpen: () => MockInstance;
  /** The Trigger rows run once per variant, with its extra Harness props (Dialog: `modal`). */
  readonly triggerVariants?: readonly (readonly [label: string, props: P])[];
  /** The Close part (`data-testid="close"`) and the JS-free mode, where the overlay has them. */
  readonly close?: {
    /** Harness props that render the Close part with `props`. */
    readonly props: (props: DisabledPartProps) => P;
    /** Spies on the method the library closes the popup with (`close`, `hidePopover`). */
    readonly spyClose: () => MockInstance;
    /** Opens the JS-free popup (Dialog: `showModal()`; Popover: the Trigger's command). */
    readonly openStatic: (user: User) => Promise<void>;
  };
}

const renders = [
  ["a link", <a key="link" href="#x" />],
  ["a component", <PlainButton key="component" />],
] as const;

const nativeRenders = [
  ["a host <button> render", <button key="button" type="button" />],
  ["no render", undefined],
] as const;

/** Dispatches a cancelable click and reports whether it was cancelled. */
const cancelled = (el: Element) => !fireEvent.click(el);

function expectAriaDisabled(el: Element) {
  expect(el).toHaveAttribute("aria-disabled", "true");
  expect(el).not.toHaveAttribute("disabled");
  expect(el).toHaveAttribute("data-disabled", "");
}

function expectNoInvoker(el: Element) {
  expect(el).not.toHaveAttribute("commandfor");
  expect(el).not.toHaveAttribute("command");
}

export function describeOverlayDisabledRenders<D, P extends object>(
  config: OverlayDisabledRenderConfig<D, P>,
): void {
  const { isOpen, close } = config;
  // The component's own props (`P`) are only spread through: TypeScript cannot check a spread of
  // a generic `P` against the intersection, so the rows see the Harness with an open index.
  const Harness = config.Harness as unknown as ComponentType<
    OverlayHarnessProps<D> & { trigger?: DisabledPartProps; [prop: string]: unknown }
  >;
  const variants = config.triggerVariants ?? [["", {} as P]];
  const closeProps = (props: DisabledPartProps): P => (close ? close.props(props) : ({} as P));

  const trigger = () => screen.getByTestId("trigger");
  const closePart = () => screen.getByTestId("close");

  describe(`${config.name} disabled on link and component renders (shared suite, design/components/button.md 17.3)`, () => {
    describe.each(renders)("Trigger, %s render", (_, element) => {
      it.each(variants)(
        "library mode%s: aria-disabled, the click is cancelled; click, Enter and ArrowDown do not open",
        async (_, extra) => {
          const user = setupUser();
          const action = vi.fn<OpenChangeFn<D>>();
          const open = config.spyOpen();
          render(
            <Harness
              mode="uncontrolled"
              action={action}
              trigger={{ disabled: true, render: element }}
              {...extra}
            />,
          );
          expectAriaDisabled(trigger());
          // Cancelled: a link does not navigate.
          expect(cancelled(trigger())).toBe(true);
          trigger().focus();
          await user.keyboard("{Enter}");
          await user.keyboard("{ArrowDown}");
          await flushTasks(2);
          expect(action).not.toHaveBeenCalled();
          expect(open).not.toHaveBeenCalled();
          expect(isOpen()).toBe(false);
        },
      );
    });

    it.each(nativeRenders)(
      "Trigger, %s in library mode: native disabled, no aria-disabled, never opens",
      async (_, element) => {
        const action = vi.fn<OpenChangeFn<D>>();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            trigger={{ disabled: true, render: element }}
          />,
        );
        expect(trigger()).toBeDisabled();
        expect(trigger()).not.toHaveAttribute("aria-disabled");
        fireEvent.keyDown(trigger(), { key: "ArrowDown" });
        fireEvent.click(trigger());
        await flushTasks(2);
        expect(action).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
      },
    );

    // Review M1 of #83.
    it("library mode, disabled component renders are no invokers: no commandfor / command", async () => {
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          trigger={{ disabled: true, render: <PlainButton /> }}
          {...closeProps({ disabled: true, render: <PlainButton /> })}
        />,
      );
      await flushTasks(2);
      expectNoInvoker(trigger());
      if (close) expectNoInvoker(closePart());
    });

    if (!close) return;

    describe.each(renders)("Close, %s render", (_, element) => {
      it("library mode: aria-disabled, the click is cancelled, nothing closes", async () => {
        const user = setupUser();
        const action = vi.fn<OpenChangeFn<D>>();
        const closeAction = vi.fn();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            {...close.props({ disabled: true, action: closeAction, render: element })}
          />,
        );
        await user.click(trigger());
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        const hide = close.spyClose();
        expectAriaDisabled(closePart());
        expect(cancelled(closePart())).toBe(true);
        await flushTasks(2);
        expect(closeAction).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1); // the open only
        expect(hide).not.toHaveBeenCalled();
        expect(isOpen()).toBe(true);
      });

      it("JS-free mode with action: aria-disabled, the click is cancelled, nothing closes", async () => {
        const user = setupUser();
        const closeAction = vi.fn();
        render(
          <Harness
            mode="static"
            {...close.props({ disabled: true, action: closeAction, render: element })}
          />,
        );
        await close.openStatic(user);
        const hide = close.spyClose();
        expectAriaDisabled(closePart());
        expect(cancelled(closePart())).toBe(true);
        await flushTasks(2);
        expect(closeAction).not.toHaveBeenCalled();
        expect(hide).not.toHaveBeenCalled();
        expect(isOpen()).toBe(true);
      });
    });

    it.each(nativeRenders)(
      "Close, %s in library mode: native disabled, no aria-disabled",
      async (_, element) => {
        render(
          <Harness
            mode="uncontrolled"
            initialOpen
            {...close.props({ disabled: true, render: element })}
          />,
        );
        await flushTasks(2);
        expect(closePart()).toBeDisabled();
        expect(closePart()).not.toHaveAttribute("aria-disabled");
      },
    );

    it("JS-free mode, component renders: native disabled on the Trigger and an action-less Close (the commands)", () => {
      render(
        <Harness
          mode="static"
          trigger={{ disabled: true, render: <PlainButton /> }}
          {...close.props({ disabled: true, render: <PlainButton /> })}
        />,
      );
      for (const el of [trigger(), closePart()]) {
        expect(el).toBeDisabled();
        expect(el).not.toHaveAttribute("aria-disabled");
      }
    });

    // Review M1 of #83.
    it("JS-free mode with action, a disabled component-render Close is no invoker", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="static"
          {...close.props({ disabled: true, action: () => {}, render: <PlainButton /> })}
        />,
      );
      await close.openStatic(user);
      expectNoInvoker(closePart());
    });
  });
}
