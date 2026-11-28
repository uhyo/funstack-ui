"use client";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "../data-attr.js";
import type {
  Action,
  Rejectable,
  ActionDetails,
  RenderProp,
  StateValue,
  WhilePending,
} from "../types.js";
import { useElementCheck } from "../use-element-check.js";
import { usePureTrigger } from "../action/use-pure-trigger.js";
import { callAction } from "../action/call-action.js";
import { cancelClick, disabledButton, rendersButton, useRender } from "../use-render.js";
import type { DataAttributes } from "../use-render.js";

const isDev = process.env.NODE_ENV !== "production";

/** The state of Popover.Close and Dialog.Close. */
export interface OverlayCloseState {
  /**
   * From the click until the close this part asked for has committed: the `action` in flight,
   * then the Root's close (an awaited `openChangeAction(false)`, or an async action the close is
   * entangled with), with or without `action` (conventions 4.3).
   */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface OverlayCloseOptions<Details extends ActionDetails> {
  /** Public name of the part (`"Popover.Close"`). */
  readonly part: string;
  /** What the part closes, for the development warning (`"popover"`). */
  readonly noun: string;
  readonly isLibrary: boolean;
  /** The popup's id (`commandfor`) and the native command. */
  readonly popupId: string;
  readonly command: "hide-popover" | "request-close";
  readonly openGeneration: () => number;
  readonly action: Action<[details: Details & Rejectable]> | undefined;
  /**
   * The part's `whilePending` prop; `"ignore"` when omitted, and `"run"` whatever it says
   * without `action` (conventions 2.5.1).
   */
  readonly whilePending: WhilePending | undefined;
  /** The `action`'s details, built at the click. */
  readonly details: (event: Event) => Details;
  /** The close after the action (or at once without one): through the Root, or natively. */
  readonly close: (event: Event) => void;
  /** Owned keys after `command` (Dialog.Close's `value`). */
  readonly ownProps?: ComponentPropsWithRef<"button">;
  readonly disabled: boolean;
  readonly className: StateValue<string | undefined, OverlayCloseState> | undefined;
  readonly style: StateValue<CSSProperties | undefined, OverlayCloseState> | undefined;
  readonly children: StateValue<ReactNode, OverlayCloseState> | undefined;
  readonly render: RenderProp<ComponentPropsWithRef<"button">, OverlayCloseState> | undefined;
  readonly rest: Omit<ComponentPropsWithRef<"button">, "className" | "style" | "children">;
}

/**
 * The Close part of a popover-like or dialog overlay (design/components/popover.md 3.4,
 * dialog.md 3.4): `<button type="button" commandfor command>` without `action`, a plain
 * `<button type="button">` with one (#182). In JS-free mode without `action`
 * the browser runs the command. Otherwise the click is cancelled, refused while disabled, and
 * `close` runs, after the `action` when there is one, inside this part's own transition, so the
 * part is pending until that close has committed (conventions 4.3). Without `action` the close
 * is requested synchronously in the click and a second click requests it again (`whilePending`
 * resolves to `"run"`: no pending `aria-disabled`). With one, a second click meanwhile starts
 * nothing (`whilePending`, default `"ignore"`) or runs the action again (`"run"`; the close
 * happens once, after the last run and only if the latest one resolved), and a close whose open
 * was superseded by a
 * newer one (dismissed and re-opened meanwhile) is dropped (the open-generation guard).
 */
export function useOverlayClose<Details extends ActionDetails>(
  options: OverlayCloseOptions<Details>,
): ReactNode {
  const { part, noun, isLibrary, popupId, command, action, disabled, render } = options;
  // A Close with `action` is no native invoker (#182, alert-dialog.md 3.2): before hydration a
  // click would close the popup without running the action. It renders a plain button, and the
  // click handler is the only thing that closes it.
  const nativeCommand = action === undefined;
  // The library owns the close, so a Close ignores clicks while pending by default (2.5.1).
  // Without `action` there is no run of its own to guard: `"run"`, no pending `aria-disabled`.
  const trigger = usePureTrigger({
    whilePending: action === undefined ? "run" : options.whilePending,
    defaultWhilePending: "ignore",
    openGeneration: options.openGeneration,
  });
  const { pending } = trigger;
  const installClick = isLibrary || action !== undefined;
  // JS-free mode without `action` is the browser's command, which only native `disabled` stops.
  const disabledProps = disabledButton(render, disabled, { handlesClick: installClick });

  const ref = useElementCheck(
    isDev &&
      ((element) =>
        !installClick && element.tagName !== "BUTTON"
          ? `${part}: rendered a <${element.tagName.toLowerCase()}> in JS-free mode without ` +
            `\`action\`. Only a <button> runs \`command="${command}"\`; this element will not ` +
            `close the ${noun}.`
          : null),
    [installClick],
  );

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Cancelling the click cancels the command.
    event.preventDefault();
    if (disabled) return;
    const native = event.nativeEvent;
    if (action === undefined) {
      // In the part's own transition, so it shows `data-pending` until the close commits
      // (conventions 4.3). The request is made synchronously in the click: the synchronous
      // prefix of `openChangeAction` still runs during the event dispatch (2.3 item 3).
      trigger.run(() => options.close(native));
      return;
    }
    const details = options.details(native);
    // An ignored run needs no extra cancel: the click is already cancelled above.
    trigger.run(
      () => callAction(part, details, action),
      () => options.close(native),
    );
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Close.
    disabled: disabledProps.props.disabled,
    // Only on a button (or a component, assumed to render one): another element is no invoker.
    // Not rendered with `action` (above).
    commandfor:
      nativeCommand && disabledProps.invoker && rendersButton(render) ? popupId : undefined,
    command: nativeCommand && disabledProps.invoker && rendersButton(render) ? command : undefined,
    ...options.ownProps,
    ...(installClick && { onClick }),
    // JS-free mode without `action`, disabled in the `aria-disabled` branch (a host link):
    // nothing native stops the click, so it is cancelled (a disabled link must not navigate).
    ...(!installClick && !disabledProps.invoker && { onClick: cancelClick }),
    // Exactly while `data-pending` when ignoring: a Close that will not act is unavailable to
    // AT; one that runs again is not; native `disabled` wins. Owned, so an idle Close removes a
    // render element's own.
    ...trigger.pendingProps(disabledProps.props),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"button">, OverlayCloseState>({
    defaultElement: "button",
    render,
    state: { pending, disabled },
    className: options.className,
    style: options.style,
    children: options.children,
    props: options.rest,
    libraryProps,
    ref,
  });
}
