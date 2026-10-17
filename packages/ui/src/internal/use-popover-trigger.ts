"use client";
import { useCallback } from "react";
import type { ComponentPropsWithRef, MouseEvent } from "react";
import { dataAttr } from "./data-attr.js";
import type { RenderProp } from "./types.js";
import { rendersButton } from "./use-render.js";
import type { DataAttributes } from "./use-render.js";
import type { PopoverRootValue } from "./use-popover-root.js";

export interface PopoverTriggerHookState {
  /** Optimistic open state (library mode); `false` in JS-free mode. */
  readonly open: boolean;
  /** The Root's transition is pending (an open, a part-initiated close or a notification). */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface UsePopoverTriggerOptions<State> {
  /** Public name of the part for development warnings (`"Popover.Trigger"`). */
  readonly part: string;
  readonly disabled: boolean;
  readonly render: RenderProp<ComponentPropsWithRef<"button">, State> | undefined;
}

export interface PopoverTriggerHook {
  readonly state: PopoverTriggerHookState;
  /** Owned props (conventions 1.2) for `useRender`'s `libraryProps`. */
  readonly libraryProps: ComponentPropsWithRef<"button"> & DataAttributes;
  /** Registers the element as the Root's Trigger; pass as `useRender`'s `ref`. */
  readonly ref: (element: HTMLElement) => () => void;
}

const isDev = process.env.NODE_ENV !== "production";

function isPopoverOpen(element: Element | null): boolean {
  if (element === null) return false;
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

/**
 * The Trigger of a popover-like component (design/components/popover.md 14.3):
 * `button[commandfor][command="toggle-popover"]` with `aria-expanded`. In JS-free mode the
 * browser runs the command and the Popup keeps `aria-expanded` current on the element. In library
 * mode the click is cancelled (so the command does not run) and toggles against what the user
 * already intends: an open through `requestOpen`, a library-owned close through `requestClose`.
 *
 * Menu adds `aria-haspopup="menu"` and its own key handling on top.
 */
export function usePopoverTrigger<State>(
  ctx: PopoverRootValue,
  options: UsePopoverTriggerOptions<State>,
): PopoverTriggerHook {
  const { part, disabled, render } = options;
  const isLibrary = ctx.mode === "library";
  const { ids, triggerRef, popupRef } = ctx;

  const state: PopoverTriggerHookState = {
    open: ctx.optimistic,
    // Opens, part-initiated closes and dismissal notifications all belong to the Trigger (4.2).
    pending: ctx.pending,
    disabled,
  };

  const ref = useCallback(
    (element: HTMLElement) => {
      if (isDev && !isLibrary && element.tagName !== "BUTTON") {
        console.error(
          `${part}: rendered a <${element.tagName.toLowerCase()}> in JS-free mode. Only a ` +
            '<button> runs `command="toggle-popover"`; this trigger will not open the popover. ' +
            "Render a <button>, or put the component in library mode (`defaultOpen={false}`).",
        );
      }
      triggerRef.current = element;
      // JS-free mode: the DOM owns `aria-expanded` (design 9). A Trigger that mounts after the
      // Popup (or is re-created) picks up the current state here.
      if (!isLibrary && popupRef.current !== null) {
        element.setAttribute("aria-expanded", String(isPopoverOpen(popupRef.current)));
      }
      return () => {
        if (triggerRef.current === element) triggerRef.current = null;
      };
    },
    [isLibrary, part, triggerRef, popupRef],
  );

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Cancelling the click cancels the command (it runs as the button's activation behaviour,
    // only if the click was not cancelled). Enter and Space synthesise the same click.
    event.preventDefault();
    if (disabled) return;
    const native = event.nativeEvent;
    if (ctx.intended()) ctx.requestClose(native, "activate");
    else ctx.requestOpen(native, "activate");
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    // `type` only applies to a <button>; on any other element the key is not owned.
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Trigger (in JS-free mode the browser
    // would run its command).
    disabled,
    commandfor: ids.popup,
    command: "toggle-popover",
    // Library mode: optimistic. JS-free mode: "false" in React; the Popup's `toggle` listener
    // writes the DOM value, and React never rewrites an unchanged prop.
    "aria-expanded": isLibrary ? state.open : false,
    // Only owned when installed, so a render element keeps its own `onClick` in JS-free mode.
    ...(isLibrary && { onClick }),
    "data-open": dataAttr(state.open),
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(isLibrary && disabled),
  };

  return { state, libraryProps, ref };
}
