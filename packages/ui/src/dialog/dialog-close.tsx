"use client";
import { use, useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import type {
  Action,
  ActionDetails,
  RenderProp,
  StateValue,
  WhilePending,
} from "../internal/types.js";
import { useOverlayClose } from "../internal/overlay/use-overlay-close.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { DialogCloseRegistry, useDialogContext } from "./dialog-context.js";
import type { DialogNamespace } from "./dialog-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Dialog.Close`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface DialogCloseState {
  /**
   * From the click until the close this part asked for has committed: the `action` in flight,
   * then the Root's close (an awaited `openChangeAction(false)`, or another pending action the
   * close is entangled with). Also without `action`, in library mode.
   */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed to `Dialog.Close`'s `action`. */
export interface DialogCloseActionDetails extends ActionDetails {
  /** The `value` the dialog closes with (`dialog.returnValue`); `""` without `value`. */
  readonly returnValue: string;
}

/**
 * Props of `Dialog.Close`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export interface DialogCloseProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "value"
  | "type"
  | "commandfor"
  | "command"
  | "popoverTarget"
  | "popoverTargetAction"
  | "aria-disabled"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Runs inside this part's own transition (`data-pending` on the button), then closes the
   * dialog with `value` as `returnValue`: in library mode through the Root
   * (`openChangeAction(false)` awaited, view transition if set), in JS-free mode with
   * `close(value)`. A rejection reaches the nearest Error Boundary above the Close part and
   * leaves the dialog open. If the dialog was dismissed and opened again while the action ran,
   * the close is dropped: it belonged to the earlier open. With `action` the button is no native
   * close invoker (no `commandfor` / `command`), so a click before hydration does nothing
   * instead of closing the dialog without running the action. Without `action` in JS-free mode
   * the button is a native `command="request-close"` invoker.
   */
  action?: Action<[details: DialogCloseActionDetails]>;
  /**
   * What a click does while this part's `action` is pending. `"ignore"`: nothing (the click is
   * cancelled, `aria-disabled="true"` meanwhile). `"run"`: the action runs again (`data-pending`
   * until every run has settled); the dialog closes once, when the last run settles and only if
   * the latest run resolved (a rejection leaves it open, as in `"ignore"` mode). No effect
   * without `action`: the part then shows `data-pending` while the Root's close waits, without
   * `aria-disabled`.
   *
   * @defaultValue `"ignore"`
   */
  whilePending?: WhilePending;
  /** Becomes `dialog.returnValue` (and `details.returnValue` of `openChangeAction(false)`). */
  value?: string;
  /**
   * Never closes. Native `disabled` on a `<button>`; owned, so a `render` element cannot
   * re-enable it. With a link or component `render` whose click this part handles (library mode,
   * or with `action`), `aria-disabled="true"` instead: the element stays focusable.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, DialogCloseState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, DialogCloseState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, DialogCloseState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogCloseState>;
}

/**
 * A close button: `<button type="button" commandfor command="request-close">`, or a plain
 * `<button type="button">` with `action` (it does nothing before hydration). In JS-free mode
 * without `action` the browser closes the dialog (a close request: `cancel`, then `close`), with
 * `value` as the `returnValue`. In library mode the click is always cancelled and the close goes
 * through the Root (`openChangeAction(false)` awaited, then `close(value)` in the commit, inside
 * the view transition if the Popup's `transition` is set). With `action` the action runs first in
 * this part's own transition (`data-pending` and `aria-disabled` on the button; a second click
 * meanwhile is ignored unless `whilePending="run"`); a rejection leaves the dialog open. With or
 * without `action`, the button has `data-pending` until the close it asked for has committed.
 *
 * Owned keys (conventions 1.2), omitted from the props type: `type` (on a `<button>` only),
 * `commandfor`, `command` (neither rendered with `action`), `popoverTarget` and
 * `popoverTargetAction` (never written), `value`, `onClick` (library mode, or with `action`),
 * `aria-disabled`. Also owned: `disabled`, `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export function DialogClose(props: DialogCloseProps) {
  return useDialogClose(props, { part: "Dialog.Close" });
}

DialogClose.displayName = "DialogClose";

/** What a caller of `useDialogClose` sets (design/components/alert-dialog.md 8). */
export interface DialogCloseOptions {
  /** Public name of the part (`"AlertDialog.Cancel"`). */
  readonly part: `${DialogNamespace}.${string}`;
  /** Extra owned keys (AlertDialog.Cancel's `autoFocus`). */
  readonly ownProps?: ComponentPropsWithRef<"button">;
}

/**
 * The body of `Dialog.Close`, also run by `AlertDialog.Cancel` and `AlertDialog.Action`
 * (alert-dialog.md 8).
 */
export function useDialogClose(
  {
    action,
    whilePending,
    value,
    disabled = false,
    className,
    style,
    children,
    render,
    ref,
    ...rest
  }: DialogCloseProps,
  { part, ownProps }: DialogCloseOptions,
): ReactNode {
  const ctx = useDialogContext(part);
  // A Drawer.Popup's development check that the drawer has a Close (drawer.md 7).
  const registerClose = use(DialogCloseRegistry);
  const reportClose = useCallback(
    (element: HTMLElement | null) => {
      if (element !== null) registerClose?.(element);
    },
    [registerClose],
  );
  // Production passes the consumer's ref through untouched.
  const mergedRef = useMergedRefs<HTMLButtonElement | null>(ref, isDev ? reportClose : undefined);
  const { popupRef, recordCloseIntent } = ctx;
  const isLibrary = ctx.mode === "library";
  return useOverlayClose({
    part,
    noun: "dialog",
    isLibrary,
    popupId: ctx.ids.popup,
    command: "request-close",
    openGeneration: ctx.openGeneration,
    action,
    whilePending,
    details: (event) => createActionDetails(event, { returnValue: value ?? "" }),
    close: (event) => {
      const returnValue = value ?? "";
      if (isLibrary) {
        // A library-owned close (design 2.3): awaited, then `close(returnValue)` in the commit. A
        // no-op when `false` is already intended (a repeated click, or a dismissal meanwhile).
        ctx.requestClose(event, "activate", returnValue);
        return;
      }
      // JS-free mode with `action`: a browser-owned close; there is no Root state to go through.
      const dialog = popupRef.current;
      if (dialog === null || !dialog.open) return;
      recordCloseIntent({ reason: "activate", event });
      dialog.close(returnValue);
    },
    ownProps: { value, ...ownProps },
    disabled,
    className,
    style,
    children,
    render,
    rest: { ...rest, ref: mergedRef },
  });
}
