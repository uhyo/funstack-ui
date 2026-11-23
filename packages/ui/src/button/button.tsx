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
import type {
  Action,
  ActionDetails,
  RenderProp,
  StateValue,
  WhilePending,
} from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { isHostButton, rendersButton, useRender } from "../internal/use-render.js";

const isDev = process.env.NODE_ENV !== "production";

/** Details passed to `Button`'s `action`. Serialisable; `event` is virtual (conventions 2.2). */
export interface ButtonActionDetails extends ActionDetails {}

/**
 * State of `Button`, passed to the function forms of `className`, `style`, `children` and `render`.
 */
export interface ButtonState {
  /**
   * This Button's own `action` is in flight, or a submission it started through its own
   * function `formAction` is pending.
   */
  readonly pending: boolean;
  /** The `disabled` prop. Not set by pending. */
  readonly disabled: boolean;
}

/**
 * Props of `Button`.
 *
 * @see https://ui.funstack.work/components/button
 */
export interface ButtonProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "aria-disabled" | "className" | "style" | "children" | "type" | "formAction"
> {
  /**
   * Runs inside this Button's own transition on click, Enter or Space (`data-pending`
   * meanwhile). Sync or async; may be a Server Function. A rejection reaches the nearest Error
   * Boundary above the Button. A click while it is pending runs it again unless `whilePending`
   * is `"ignore"`. Not combinable with `formAction` (development error).
   */
  action?: Action<[details: ButtonActionDetails]>;
  /**
   * React's `formAction`: a function (a Server Function, a `useActionState` dispatch, a client
   * function) or a URL, run by React instead of the form's `action` when this Button submits the
   * form. With a function, the Button is `pending` while its own submission runs (not while
   * another submitter's does) and defaults to `type="submit"`. A click meanwhile submits again
   * unless `whilePending` is `"ignore"`; React drops the rejection of an older overlapping
   * submission, so use `"ignore"` (or `useActionState`) for a submission that must not overlap.
   */
  formAction?: ComponentPropsWithRef<"button">["formAction"];
  /**
   * What a click, Enter or Space does while this Button's own `action` (or its own function
   * `formAction` submission) is pending. `"run"`: it runs as well; the Button shows
   * `data-pending` until every run has settled. `"ignore"`: it starts nothing, its default action
   * is cancelled (no second submission, navigation or command), and the Button renders
   * `aria-disabled="true"` while pending. Use `"ignore"` for an action that must not run twice
   * (Save, Pay, Delete). No effect on a Button with neither `action` nor a function `formAction`.
   *
   * @defaultValue `"run"`
   */
  whilePending?: WhilePending;
  /**
   * Owned on a `<button>` and on a component `render` element (set it here, not on the element; a
   * component should spread it); omitted for a host element of another tag (`<a>`). `action`
   * together with `"submit"` / `"reset"` warns in development: one click would do two things.
   *
   * @defaultValue `"button"`, or `"submit"` when `formAction` is given
   */
  type?: "button" | "submit" | "reset";
  /**
   * Native `disabled` (owned; a `render` element cannot re-enable it) and `data-disabled`.
   * Never dispatches. With `focusableWhenDisabled`, inside a `Toolbar.Root`, or when the
   * rendered element is not a host `<button>` (`render={<a href />}`, a component), renders
   * `aria-disabled="true"` instead.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Keep a disabled Button focusable: `aria-disabled="true"` instead of native `disabled`, so
   * keyboard and screen-reader users still find it and a Tooltip on it still opens.
   *
   * @defaultValue `false`; implied `true` inside a `Toolbar.Root` (APG Toolbar) and for a `render`
   * element that is not a host `<button>`
   */
  focusableWhenDisabled?: boolean;
  /**
   * Forwarded as `default` to the Button's `<ViewTransition>`: animates the commit that ends the
   * action (content keyed on `pending`), not a click.
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ButtonState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ButtonState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, ButtonState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, ButtonState>;
}

/**
 * A button whose click is a transition (design/components/button.md): `<button type="button">`
 * that runs `action` in its own transition, with `data-pending` while it runs. A click meanwhile
 * runs it again, or with `whilePending="ignore"` is ignored while the Button is `aria-disabled`
 * (conventions 2.5.1). With a function
 * `formAction` it is a form submitter with its own per-submitter pending. Inside a
 * `Toolbar.Root` a disabled Button stays focusable (`aria-disabled`).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `aria-disabled`,
 * `data-pending`, `data-disabled`, `onClick`.
 *
 * @see https://ui.funstack.work/components/button
 */
export function Button({
  action,
  formAction,
  whilePending,
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
  // browser and hide the state from AT, so the focusable-disabled branch.
  const focusable = focusableWhenDisabled || toolbar !== null || !isHostButton(render);
  // Button is the fully user-owned trigger: every activation runs unless the consumer opts in
  // (conventions 2.5.1, design 18).
  const ignoring = (whilePending ?? "run") === "ignore";
  const { pending: ownPending, run } = useActionTrigger({ ignoreWhilePending: ignoring });

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
    isDev &&
      "Button: `action` and `formAction` were both given. One click would run two actions; the " +
        "Button runs `action` and leaves `formAction` to the form submission. Pass one of them.",
  );
  useDevWarning(
    action !== undefined && (type === "submit" || type === "reset"),
    isDev &&
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
      // While pending only when ignoring: a Button that still acts is not unavailable (3.6).
      "aria-disabled": (pending && ignoring) || (disabled && focusable) ? true : undefined,
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
          if (ignoring && formPending) {
            event.preventDefault();
            return;
          }
          submittedWith.current = formAction;
          return;
        }
        const details: ButtonActionDetails = createActionDetails(event.nativeEvent, {});
        // Ignored while pending (`"ignore"` only): do not navigate, submit or run a command either.
        if (!run(() => action(details))) event.preventDefault();
      },
    },
  });

  return useTransitionBoundary("Button", transition, element);
}

Button.displayName = "Button";
