"use client";
import { useLayoutEffect, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import type { Action, RenderProp, StateValue, WhilePending } from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import {
  disabledButton,
  pendingAriaDisabled,
  rendersButton,
  useRender,
} from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import type { ToastActionDetails, ToastItem } from "./toast.js";
import { useToastRootContext } from "./toast-context.js";

/**
 * State of `Toast.Action`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ToastActionState {
  /** This part's action is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. Not set by pending. */
  readonly disabled: boolean;
  /** The toast this Action belongs to. */
  readonly toast: ToastItem;
}

/**
 * Props of `Toast.Action`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export interface ToastActionProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"
> {
  /**
   * Runs in this part's own transition: `data-pending` on the Action and the Root, the toast's
   * timer paused. When it resolves the toast closes with `reason: "activate"` (unless
   * `closeOnSettle` is `false`); a rejection keeps the toast and reaches the nearest Error
   * Boundary above the Viewport. A caught error counts as success and closes the toast: rethrow
   * after `toast.update`, or use `closeOnSettle={false}`.
   *
   * @defaultValue the toast's `action.action`
   */
  action?: Action<[details: ToastActionDetails]>;
  /**
   * Close the toast when the action resolves.
   *
   * @defaultValue `true`
   */
  closeOnSettle?: boolean;
  /**
   * What a click does while this part's action is pending. `"ignore"`: nothing (the click is
   * cancelled, `aria-disabled="true"` meanwhile): one Undo, one Retry. `"run"`: the action runs
   * again; the Action and the Root stay `data-pending` and the timer paused until every run has
   * settled. With `closeOnSettle` the toast then closes once, if the latest run resolved; a
   * rejected latest run keeps it, as in `"ignore"` mode.
   *
   * @defaultValue `"ignore"`, or `"run"` with `closeOnSettle={false}`
   */
  whilePending?: WhilePending;
  /**
   * Never runs the action. Native `disabled` on a `<button>` (owned; a `render` element cannot
   * re-enable it) and `data-disabled`. With a link or component `render`, `aria-disabled="true"`
   * instead and the click is cancelled (a disabled link does not navigate).
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * The button's content, or a function of the part's state.
   *
   * @defaultValue the toast's `action.label`
   */
  children?: StateValue<ReactNode, ToastActionState>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToastActionState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToastActionState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, ToastActionState>;
}

/**
 * The toast's action button (Undo, Retry, View): a `button type="button"` whose `action` runs as
 * a transition. Renders nothing when neither the part nor the toast has an action. Never natively
 * disabled while pending: a second click meanwhile is ignored and the Action is `aria-disabled`,
 * unless `whilePending` is `"run"` (the default with `closeOnSettle={false}`).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `onClick`,
 * `aria-disabled`, `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export function ToastAction({
  action,
  closeOnSettle = true,
  whilePending,
  disabled = false,
  children,
  className,
  style,
  render,
  ...rest
}: ToastActionProps) {
  const root = useToastRootContext("Toast.Action");
  // Mixed ownership (conventions 2.5.1): ignore while the library closes the toast after the
  // action; a toast that stays makes the Action a user-owned trigger.
  const ignoring = (whilePending ?? (closeOnSettle ? "ignore" : "run")) === "ignore";
  const { pending, run } = useActionTrigger({ ignoreWhilePending: ignoring });
  const [token] = useState(() => ({}));
  const effective = action ?? root.toast.action?.action;
  const { setActionPending } = root;

  // The Root (and through it the Viewport's timer) sees this part's pending state.
  useLayoutEffect(() => {
    if (!pending) return;
    setActionPending(token, true);
    return () => setActionPending(token, false);
  }, [pending, setActionPending, token]);

  const disabledProps = disabledButton(render, disabled).props;
  const state: ToastActionState = { pending, disabled, toast: root.toast };

  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if (disabled) {
      // A disabled link must not navigate either.
      event.preventDefault();
      return;
    }
    if (effective === undefined) return;
    const native = event.nativeEvent;
    const details = createActionDetails(native, { id: root.toast.id });
    // When ignoring, a second click while this Action's own run is in flight starts nothing and
    // is cancelled (the hook's guard): one Undo, one Retry.
    const started = run(
      () => effective(details),
      () => {
        // Closing is idempotent: a dismissal meanwhile already closed it.
        if (closeOnSettle) root.close("activate", native);
      },
    );
    if (!started) event.preventDefault();
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    disabled: disabledProps.disabled,
    onClick,
    // While `data-pending` exactly when ignoring (conventions 3.6), and when disabled on a link
    // or component `render`; native `disabled` wins. Owned, so an idle Action removes a render
    // element's own.
    "aria-disabled": pendingAriaDisabled(disabledProps, pending && ignoring),
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
  };

  const element = useRender<ComponentPropsWithRef<"button">, ToastActionState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children: children ?? root.toast.action?.label,
    props: rest,
    libraryProps,
  });
  return effective === undefined ? null : element;
}

ToastAction.displayName = "ToastAction";
