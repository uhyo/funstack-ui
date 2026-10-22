"use client";
import { useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { useFormStatus } from "react-dom";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { useToolbarContext } from "../internal/toolbar-context.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { isHostButton, rendersButton, useRender } from "../internal/use-render.js";

/** Details passed to `Button`'s `action`. Serialisable; `event` is virtual (conventions 2.2). */
export interface ButtonActionDetails extends ActionDetails {}

export interface ButtonState {
  /**
   * This Button's own `action` is in flight, or a submission it started through its own
   * function `formAction` is pending.
   */
  readonly pending: boolean;
  /** The `disabled` prop. Not set by pending. */
  readonly disabled: boolean;
}

export interface ButtonProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "aria-disabled" | "className" | "style" | "children" | "type" | "formAction"
> {
  /**
   * Runs inside this Button's own transition on click, Enter or Space (`data-pending`
   * meanwhile). Sync or async; may be a Server Function. A rejection reaches the nearest Error
   * Boundary above the Button. While it is pending the Button ignores further activation and
   * renders `aria-disabled="true"`. Not combinable with `formAction` (development error).
   */
  action?: Action<[details: ButtonActionDetails]>;
  /**
   * React's `formAction`: a function (a Server Function, a `useActionState` dispatch, a client
   * function) or a URL, run by React instead of the form's `action` when this Button submits the
   * form. With a function, the Button is `pending` while its own submission runs (not while
   * another submitter's does), ignores further activation meanwhile, and defaults to
   * `type="submit"`.
   */
  formAction?: ComponentPropsWithRef<"button">["formAction"];
  /**
   * Default `"button"`, or `"submit"` when `formAction` is given. Owned on a `<button>` and on a
   * component `render` element (set it here, not on the element; a component should spread it);
   * omitted for a host element of another tag (`<a>`). `action` together with
   * `"submit"` / `"reset"` warns in development: one click would do two things.
   */
  type?: "button" | "submit" | "reset";
  /**
   * Native `disabled` (owned; a `render` element cannot re-enable it) and `data-disabled`.
   * Never dispatches. With `focusableWhenDisabled`, inside a `Toolbar.Root`, or when the
   * rendered element is not a host `<button>` (`render={<a href />}`, a component), renders
   * `aria-disabled="true"` instead.
   */
  disabled?: boolean;
  /**
   * Keep a disabled Button focusable: `aria-disabled="true"` instead of native `disabled`, so
   * keyboard and screen-reader users still find it and a Tooltip on it still opens. Default
   * `false`; implied `true` inside a `Toolbar.Root` (APG Toolbar) and for a `render` element that
   * is not a host `<button>`.
   */
  focusableWhenDisabled?: boolean;
  /**
   * Forwarded as `default` to the Button's `<ViewTransition>`: animates the commit that ends the
   * action (content keyed on `pending`), not a click. Static; any value makes a mount inside a
   * transition start a document view transition (issue #35).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ButtonState>;
  style?: StateValue<CSSProperties | undefined, ButtonState>;
  children?: StateValue<ReactNode, ButtonState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, ButtonState>;
}

/**
 * A button whose click is a transition (design/components/button.md): `<button type="button">`
 * that runs `action` in its own transition, with `data-pending` and `aria-disabled="true"` while
 * it runs, and ignores further activation meanwhile (conventions 2.5). With a function
 * `formAction` it is a form submitter with its own per-submitter pending. Inside a
 * `Toolbar.Root` a disabled Button stays focusable (`aria-disabled`).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `aria-disabled`,
 * `data-pending`, `data-disabled`, `onClick`.
 */
export function Button({
  action,
  formAction,
  type,
  disabled = false,
  focusableWhenDisabled = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: ButtonProps) {
  const toolbar = useToolbarContext();
  // Not a host <button> (a link, a component): native `disabled` would mean nothing to the
  // browser and hide the state from AT, so the focusable-disabled branch (review fold F1).
  const focusable = focusableWhenDisabled || toolbar !== null || !isHostButton(render);
  const { pending: ownPending, run } = useActionTrigger();

  // Per-submitter pending (design 6.2): React reports the submitter's function as
  // `status.action`. `submittedWith` keeps the function this Button last submitted with, so an
  // inline `formAction` whose identity changes during the submission still matches.
  const status = useFormStatus();
  const submittedWith = useRef<unknown>(undefined);
  const formPending =
    status.pending &&
    typeof formAction === "function" &&
    // Written only by the click handler, before the submission whose status this render shows,
    // so the render that reads it is never stale for that submission.
    // oxlint-disable-next-line react/refs
    (status.action === formAction || status.action === submittedWith.current);
  const pending = ownPending || formPending;

  useDevWarning(
    action !== undefined && formAction !== undefined,
    "Button: `action` and `formAction` were both given. One click would run two actions; the " +
      "Button runs `action` and leaves `formAction` to the form submission. Pass one of them.",
  );
  useDevWarning(
    action !== undefined && (type === "submit" || type === "reset"),
    `Button: \`action\` together with type="${type}". One click would run \`action\` in a ` +
      `transition and ${type === "reset" ? "reset" : "submit"} the form. Use \`formAction\` ` +
      `for a submitter, or drop \`type\`.`,
  );

  const state: ButtonState = { pending, disabled };

  const element = useRender<ComponentPropsWithRef<"button">, ButtonState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: formAction === undefined ? rest : { ...rest, formAction },
    libraryProps: {
      ...(rendersButton(render) && {
        type: type ?? (formAction !== undefined ? "submit" : "button"),
      }),
      // `undefined` (not `false`) in the focusable case, so the owned key removes a render
      // element's `disabled` too.
      disabled: disabled && !focusable ? true : undefined,
      "aria-disabled": pending || (disabled && focusable) ? true : undefined,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        // `event.defaultPrevented` is never read: an outer part (`Dialog.Trigger`) cancels the
        // click as part of its own mechanism and the Button must still run (design 5.1).
        if (disabled) {
          // A disabled link must not navigate either.
          event.preventDefault();
          return;
        }
        if (action === undefined) {
          // A native button (a `formAction` submitter, a command, a link): only the guard.
          if (formPending) {
            event.preventDefault();
            return;
          }
          submittedWith.current = formAction;
          return;
        }
        const details: ButtonActionDetails = createActionDetails(event.nativeEvent, {});
        // Ignored while pending: do not navigate, submit or run a command either.
        if (!run(() => action(details))) event.preventDefault();
      },
    },
  });

  return useTransitionBoundary("Button", transition, element);
}

Button.displayName = "Button";
