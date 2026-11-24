"use client";
import { isValidElement, useRef, useState } from "react";
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
import { useDevWarning } from "../internal/use-dev-warning.js";
import { usePureTrigger } from "../internal/use-pure-trigger.js";
import { disabledButton, rendersButton, useRender } from "../internal/use-render.js";

const isDev = process.env.NODE_ENV !== "production";

/** Details passed to `Button`'s `action`. Serialisable; `event` is virtual (conventions 2.2). */
export interface ButtonActionDetails extends ActionDetails {}

/**
 * State of `Button`, passed to the function forms of `className`, `style`, `children` and `render`.
 */
export interface ButtonState {
  /**
   * This Button's own `action` is in flight, or it submitted the form through its own function
   * `formAction` and the form's submissions have not all finished yet.
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
   * form. With a function, the Button is `pending` from its own submission until the form's
   * submissions have all finished (never for another submitter's alone) and defaults to
   * `type="submit"`. A click meanwhile submits again
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
   * Never dispatches. With `focusableWhenDisabled` or inside a `Toolbar.Root`, renders
   * `aria-disabled="true"` instead and cancels the click. So does a host element of another tag
   * (`render={<a href />}`), and a component `render` whose click only the Button acts on. A
   * component or `<input>` `render` whose click the browser also acts on (`type="submit"` /
   * `"reset"`, the `formAction` default, `commandfor` / `popoverTarget`; with or without
   * `action`) keeps native `disabled`: only that stops a submission or command before
   * hydration. Native `disabled`
   * wins over the pending `aria-disabled`.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Keep a disabled Button focusable: `aria-disabled="true"` instead of native `disabled`, so
   * keyboard and screen-reader users still find it and a Tooltip on it still opens. Before
   * hydration a focusable disabled submitter still submits (nothing native stops it).
   *
   * @defaultValue `false`; implied `true` inside a `Toolbar.Root` (APG Toolbar)
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
 * `formAction` it is a form submitter, pending from its own submission until the form's
 * submissions have all finished. Inside a
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
  const resolvedType = type ?? (formAction !== undefined ? "submit" : "button");
  // The browser acts on the click (with or without `action`) when it submits, resets or runs a
  // JS-free invoker command. Then an element that may be a button keeps native `disabled`, the
  // only state that stops it before hydration (conventions 1.2, #158). Otherwise the Button's
  // handler is all the click does, and a link or component render takes `aria-disabled` with
  // the cancelled click. A host `<input>` render keeps its own `type` (the Button owns `type` on
  // a button only), so that is the type the browser acts on.
  const clickType =
    isValidElement<{ type?: unknown }>(render) && render.type === "input"
      ? ["submit", "image", "reset"].includes(String(render.props.type))
        ? "submit"
        : "button"
      : resolvedType;
  const browserRun =
    clickType !== "button" || rest.commandfor !== undefined || rest.popoverTarget !== undefined;
  // `focusableWhenDisabled` and a Toolbar opt into the focusable disabled control (APG Toolbar).
  const disabledProps = disabledButton(render, disabled, {
    handlesClick: !browserRun,
    alwaysFocusable: focusableWhenDisabled || toolbar !== null,
  }).props;
  // Button is the fully user-owned trigger: every activation runs unless the consumer opts in
  // (conventions 2.5.1, design 18).
  const trigger = usePureTrigger({ whilePending, defaultWhilePending: "run" });
  const { ignoring } = trigger;

  // Per-submitter pending (design 6.2): React reports the latest submitter's function as
  // `status.action`. `submittedWith` keeps the function this Button last submitted with, so an
  // inline `formAction` whose identity changes during the submission still matches. Another
  // submission overwrites `status.action` while this one still runs, so `submitted` latches the
  // first render that named this Button and holds until the form status is idle: pending from its
  // own submission until the form's submissions have all finished (#154).
  const status = useFormStatus();
  const submittedWith = useRef<unknown>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const named =
    status.pending &&
    typeof formAction === "function" &&
    // Written only by the click handler, before the submission whose status this render shows,
    // so the render that reads it is never stale for that submission.
    // oxlint-disable-next-line react/refs
    (status.action === formAction || status.action === submittedWith.current);
  // Derived state, updated during render (React re-renders this component before committing).
  if (named && !submitted) setSubmitted(true);
  if (!status.pending && submitted) setSubmitted(false);
  // Gated as a whole: a latch left from a function `formAction` that became a URL or `action`
  // must not keep the Button pending (a URL has no pending and no guard, 6.2).
  const formPending = typeof formAction === "function" && (named || (status.pending && submitted));
  const pending = trigger.pending || formPending;

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
      ...(rendersButton(render) && { type: resolvedType }),
      // `undefined` (not `false`) when enabled or in the focusable branch, so the owned key
      // removes a render element's `disabled` too.
      disabled: disabledProps.disabled === true ? true : undefined,
      // `aria-disabled` while pending only when ignoring: a Button that still acts is not
      // unavailable (3.6). Native `disabled` wins over it. Both channels' pending.
      ...trigger.pendingProps(disabledProps, pending),
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
        trigger.runActivation(event, () => action(details));
      },
    },
  });

  return useTransitionBoundary("Button", transition, element);
}

Button.displayName = "Button";
