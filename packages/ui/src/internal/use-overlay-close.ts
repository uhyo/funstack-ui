"use client";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "./data-attr.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "./types.js";
import { useActionTrigger } from "./use-action-trigger.js";
import { useElementCheck } from "./use-element-check.js";
import { disabledButton, rendersButton, useRender } from "./use-render.js";
import type { DataAttributes } from "./use-render.js";

const isDev = process.env.NODE_ENV !== "production";

/** The state of Popover.Close and Dialog.Close. */
export interface OverlayCloseState {
  /** The `action` is in flight. */
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
  readonly action: Action<[details: Details]> | undefined;
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
 * dialog.md 3.4): `<button type="button" commandfor command>`. In JS-free mode without `action`
 * the browser runs the command. Otherwise the click is cancelled, refused while disabled, and
 * `close` runs, after the `action` when there is one, inside this part's own transition; a
 * second click meanwhile starts nothing, and a close whose open was superseded by a newer one
 * (dismissed and re-opened meanwhile) is dropped (the open-generation guard).
 */
export function useOverlayClose<Details extends ActionDetails>(
  options: OverlayCloseOptions<Details>,
): ReactNode {
  const { part, noun, isLibrary, popupId, command, action, disabled, render } = options;
  const { pending, run } = useActionTrigger({ openGeneration: options.openGeneration });
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
      options.close(native);
      return;
    }
    const details = options.details(native);
    run(
      () => action(details),
      () => options.close(native),
    );
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Close.
    disabled: disabledProps.props.disabled,
    commandfor: disabledProps.invoker ? popupId : undefined,
    command: disabledProps.invoker ? command : undefined,
    ...options.ownProps,
    ...(installClick && { onClick }),
    // Exactly while `data-pending`: a Close that will not act is unavailable to AT. Owned,
    // so an idle Close removes a render element's own `aria-disabled`.
    "aria-disabled": pending || !disabledProps.invoker ? true : undefined,
    "data-pending": dataAttr(pending),
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
