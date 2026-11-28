"use client";
import { useCallback, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { registerTrigger } from "../internal/overlay/trigger-ref.js";
import { useToolbarContext } from "../internal/toolbar-context.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { cancelClick, disabledButton, rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";
import type { DialogNamespace } from "./dialog-context.js";

/**
 * State of `Dialog.Trigger`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface DialogTriggerState {
  /**
   * Optimistic open state (library mode); `false` in JS-free mode, where React holds no value
   * (conventions 4.1 rule 3) while the `data-open` attribute follows the dialog's `toggle`.
   */
  readonly open: boolean;
  /**
   * The Root's transition is pending: an open in flight, or a close a part asked for in flight
   * (`openChangeAction(false)` awaited while the dialog is still open). A dismissal is a fact and
   * is never pending.
   */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Dialog.Trigger`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export interface DialogTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "onPointerDown"
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
   * Never dispatches. Native `disabled` on a `<button>` (no longer an invoker); with a link or
   * component `render` where the Trigger handles the click (library mode, or a non-modal
   * dialog), and in every mode inside a `Toolbar.Root` (conventions 3.6), `aria-disabled="true"`
   * instead: the element stays focusable, with no `commandfor` / `command`.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, DialogTriggerState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, DialogTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, DialogTriggerState>;
  /** Should render a `<button>`; another element works only in library mode (click handler). */
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogTriggerState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * The opener: `<button type="button" commandfor command="show-modal">`. In JS-free mode the
 * browser runs the command. In library mode the click is cancelled (so the command does not run)
 * and dispatched through the Root's transition; the button shows optimistic `data-open` and
 * `data-pending` until the dialog has opened. Non-modal dialogs have no command and always use a
 * click handler (`show()`). In JS-free mode `data-open` is written from the dialog's `toggle`,
 * so `[data-open]` styles the Trigger in both modes. Inside a `Toolbar.Root` a disabled Trigger
 * is `aria-disabled` and stays focusable (conventions 3.6).
 *
 * Owned keys (conventions 1.5), omitted from the props type: `type` (on a `<button>` only),
 * `aria-disabled` (a link or component `render` with the click handler installed, or inside a
 * Toolbar), `commandfor`, `command`, `popoverTarget` and `popoverTargetAction` (never written),
 * `onClick`, `onPointerDown` (non-modal JS-free mode). Also owned: `disabled`, `data-open`,
 * `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export function DialogTrigger(props: DialogTriggerProps) {
  return useDialogTrigger(props, "Dialog");
}

DialogTrigger.displayName = "DialogTrigger";

/** The body of `Dialog.Trigger`, also run by `AlertDialog.Trigger` (alert-dialog.md 8). */
export function useDialogTrigger(
  { disabled = false, className, style, children, render, ...rest }: DialogTriggerProps,
  namespace: DialogNamespace,
): ReactNode {
  const ctx = useDialogContext(`${namespace}.Trigger`);
  const isLibrary = ctx.mode === "library";
  const { modal, ids, triggerRef, popupRef } = ctx;

  const state: DialogTriggerState = {
    open: ctx.optimistic,
    // Every Root dispatch is an open or a part-initiated close, and both belong to the Trigger
    // (design 4.2). Not `optimistic !== committed`: a request superseded by a fact still runs
    // and is pending with both `false`.
    pending: ctx.pending,
    disabled,
  };

  const checkElement = useElementCheck(
    isDev &&
      ((element) =>
        !isLibrary && modal && element.tagName !== "BUTTON"
          ? `${namespace}.Trigger: rendered a <${element.tagName.toLowerCase()}> in JS-free mode. ` +
            'Only a <button> runs `command="show-modal"`; this trigger will not open the dialog. ' +
            `Render a <button>, or put the ${namespace} in library mode (\`defaultOpen={false}\`).`
          : null),
  );
  // A Trigger without a Popup opens nothing (design 14, dev warnings). Checked when the Trigger's
  // element attaches: the commit's DOM is complete by then, Popup included.
  const checkPopup = useElementCheck(
    isDev &&
      (() =>
        document.getElementById(ids.popup) === null
          ? `${namespace}.Trigger: no ${namespace}.Popup is rendered for this ${namespace}.Root; ` +
            "the trigger opens nothing."
          : null),
  );
  const libraryRef = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      checkPopup?.(element);
      const unregister = registerTrigger(triggerRef, element, `${namespace}.Trigger`);
      if (isLibrary) return unregister;
      // JS-free mode: the DOM owns `data-open` (conventions 7.4, design 3.2), written from the
      // dialog's `toggle` and read from `dialog.open`, as Popover's Trigger does from its popup.
      // React renders no value for it in this mode, so the write is never overwritten. The
      // dialog is the one the Trigger's `commandfor` names (also without the command: non-modal).
      const dialog = element.ownerDocument.getElementById(ids.popup);
      // A tag check, not `instanceof`: the dialog may belong to another realm (an iframe).
      if (dialog === null || dialog.tagName !== "DIALOG") return unregister;
      const target = dialog as HTMLDialogElement;
      const sync = (): void => {
        element.toggleAttribute("data-open", target.open);
      };
      // A dialog already open (before hydration, or a Trigger mounted later) shows at once.
      sync();
      target.addEventListener("toggle", sync);
      return () => {
        target.removeEventListener("toggle", sync);
        unregister();
      };
    },
    [checkElement, checkPopup, triggerRef, namespace, isLibrary, ids.popup],
  );

  // Library mode (both modal and non-modal) and non-modal JS-free mode need a click handler;
  // modal JS-free mode is the browser's command.
  const installClick = isLibrary || !modal;
  // The modal JS-free command needs native `disabled` to stop it; inside a Toolbar a disabled
  // Trigger stays focusable instead (conventions 3.6): no command is rendered and the click is
  // cancelled.
  const toolbar = useToolbarContext();
  const disabledProps = disabledButton(render, disabled, {
    handlesClick: installClick,
    alwaysFocusable: toolbar !== null,
  });
  // Only on a button (or a component, assumed to render one): another element is no invoker.
  const invoker = modal && disabledProps.invoker && rendersButton(render);
  // Non-modal JS-free mode: whether the dialog was open when the press began. A press on the
  // Trigger of an open `lightDismiss` dialog is a dismissal (the JS listeners or native
  // `closedby="any"` close it before the click), so that click must not `show()` it again.
  // Pointer clicks only (`detail > 0`): a keyboard click has no press, and a press that never
  // became a click must not swallow a later one.
  const pressedOpen = useRef(false);
  const installPress = !isLibrary && !modal;
  const onPointerDown = () => {
    pressedOpen.current = popupRef.current?.open ?? false;
  };
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (isLibrary) {
      // Cancelling the click cancels the command (it runs as the button's activation
      // behaviour, only if the click was not cancelled).
      event.preventDefault();
      if (disabled) return;
      ctx.requestOpen(event.nativeEvent, "activate");
      return;
    }
    if (disabled) {
      // A disabled link must not navigate either.
      event.preventDefault();
      return;
    }
    const wasOpen = event.detail > 0 && pressedOpen.current;
    pressedOpen.current = false;
    const dialog = popupRef.current;
    if (dialog !== null && !dialog.open && !wasOpen && dialog.isConnected) dialog.show();
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    // `type` only applies to a <button>; on any other element the key is not owned.
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Trigger (in JS-free mode the
    // browser would run its command).
    ...disabledProps.props,
    commandfor: invoker ? ids.popup : undefined,
    command: invoker ? "show-modal" : undefined,
    // Only owned when installed, so a render element keeps its own `onClick` in modal JS-free
    // mode (Accordion's rule).
    ...(installClick && { onClick }),
    // Modal JS-free mode, disabled in the `aria-disabled` branch (a host link): nothing native
    // stops the click, so it is cancelled (a disabled link must not navigate).
    ...(!installClick && !disabledProps.invoker && { onClick: cancelClick }),
    ...(installPress && { onPointerDown }),
    "data-open": dataAttr(state.open),
    "data-pending": dataAttr(state.pending),
    // Every mode: the styling hook agrees with the rendered `disabled` / `aria-disabled`
    // (conventions 1.2).
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"button">, DialogTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref: libraryRef,
  });
}
