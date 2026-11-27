"use client";
import { useCallback } from "react";
import type { ComponentPropsWithRef, DOMAttributes, MouseEvent } from "react";
import { dataAttr } from "../data-attr.js";
import { isPopoverOpen } from "./popover-open.js";
import { registerTrigger } from "./trigger-ref.js";
import type { RenderProp } from "../types.js";
import { useElementCheck } from "../use-element-check.js";
import { cancelClick, disabledButton, rendersButton } from "../use-render.js";
import type { DataAttributes } from "../use-render.js";
import type { PopoverRootValue } from "./use-overlay-root.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * The click rule of a Trigger that toggles a popover-kind Root (popover.md 2.8): Popover.Trigger,
 * Menu.Trigger, Menu.SubmenuTrigger (through `usePopoverTrigger`) and Combobox.Trigger. It toggles
 * against what the user already intends (`intended()`, conventions 3.8 rule 1), not the DOM:
 *
 * - intended open, and the browser already hid the popup (a non-button Trigger, #115: light
 *   dismiss hid it at `pointerup`, before this click): the hide is a fact, reported by its pending
 *   `toggle`; the click only names its cause, an `"activate"` close intent;
 * - intended open otherwise: `requestClose(event, "activate")`;
 * - intended closed: `beforeOpen()`, then `requestOpen(event, "activate")`. First, because what
 *   it records (Menu's open cause) must be in place before anything can show the popup. Today the
 *   show waits for the apply effect, so the order is not observable.
 *
 * The caller cancels the click and checks `disabled` first. Handlers only.
 */
export function toggleFromTrigger(
  ctx: PopoverRootValue,
  event: Event,
  beforeOpen?: () => void,
): void {
  if (ctx.intended()) {
    if (ctx.hiddenBeforeToggle()) {
      ctx.recordCloseIntent({ reason: "activate", event });
      return;
    }
    ctx.requestClose(event, "activate");
  } else {
    beforeOpen?.();
    ctx.requestOpen(event, "activate");
  }
}

/**
 * Owned and never written on an overlay Trigger (Popover, Menu, Combobox): the default
 * `popovertarget` action, which a render element must not change, and an Invoker Command, which
 * would take precedence over `popovertarget` and act on another element.
 */
export const RESERVED_INVOKER_KEYS = {
  popoverTargetAction: undefined,
  commandfor: undefined,
  command: undefined,
} as const;

/**
 * The library-mode dev warning for a Trigger rendered as another element than a `<button>`: only
 * an invoker button is spared by the popover's light dismiss, so a press while the popup is open
 * hides it before the click. `popover` and `popup` are the nouns the text uses for it.
 */
export function nonInvokerMessage(
  part: string,
  tag: string,
  popover: string,
  popup: string,
): string {
  return (
    `${part}: rendered a <${tag}>. Only a <button> is the ${popover}'s invoker: a press on ` +
    `this element while the ${popup} is open closes it through light dismiss before the ` +
    "click, so the close is a dismissal (reported to onOpenChange) rather than a request: " +
    "openChangeAction(false) is not called, cannot veto it and there is no view transition. " +
    "Render a <button>."
  );
}

/** The state of an overlay Trigger (Popover.Trigger, Menu.Trigger and its siblings). */
export interface PopoverTriggerHookState {
  /** Optimistic open state. A Popover in JS-free mode (the browser owns it) reports `false`. */
  readonly open: boolean;
  /** The Root's transition is pending: an open or a part-initiated close (never a dismissal). */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Event handlers a component layers onto the Trigger's own (Menu's keys and hover intent). */
export type PopoverTriggerHandlers = Pick<
  DOMAttributes<HTMLButtonElement>,
  "onClick" | "onKeyDown" | "onMouseDown" | "onPointerMove" | "onPointerEnter" | "onPointerLeave"
>;

export interface UsePopoverTriggerOptions<State> {
  /** Public name of the part for development warnings (`"Popover.Trigger"`). */
  readonly part: string;
  readonly disabled: boolean;
  readonly render: RenderProp<ComponentPropsWithRef<"button">, State> | undefined;
  /**
   * Extra handlers, merged in front of the Trigger's own: for a key both define, the extra one
   * runs first (the consumer's pass-through handler still runs before both, conventions 1.2).
   */
  readonly handlers?: PopoverTriggerHandlers;
  /**
   * What a click does in library mode, after the command has been cancelled and `disabled`
   * checked. Default: `toggleFromTrigger(ctx, event.nativeEvent)`, the toggle against
   * `intended()` (`requestOpen` / `requestClose`). Menu.Trigger toggles with its open cause;
   * Menu.SubmenuTrigger opens, or moves focus into an already open submenu.
   */
  readonly onActivate?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Menu.SubmenuTrigger: the Trigger is also an item of the parent menu, whose click
   * (`onActivate`) never closes the popup. `disabled` renders `aria-disabled="true"` and no
   * `disabled` attribute, so the item stays focusable (the click handler still refuses); without
   * it `disabled` is the native attribute, so the button is no invoker at all (in library mode a
   * link or component `render` still gets `aria-disabled`, because native `disabled` means
   * nothing on a link and the installed click handler is what refuses). And the library-mode
   * non-button warning says a press while open dismisses the popup instead of moving focus into
   * it.
   */
  readonly submenuItem?: boolean;
  /**
   * `Menu.Trigger` inside a `Menubar`: an item of the bar, so `disabled` renders
   * `aria-disabled="true"` and the element stays focusable, as with `submenuItem`; the click
   * still toggles and the non-button warning is the ordinary one
   * (design/components/menubar.md 5).
   */
  readonly alwaysFocusable?: boolean;
}

export interface PopoverTriggerHook {
  readonly state: PopoverTriggerHookState;
  /** Owned props (conventions 1.2) for `useRender`'s `libraryProps`. */
  readonly libraryProps: ComponentPropsWithRef<"button"> & DataAttributes;
  /** Registers the element as the Root's Trigger; pass as `useRender`'s `ref`. */
  readonly ref: (element: HTMLElement) => () => void;
}

/**
 * The Trigger of a popover-like component (design/components/popover.md 14.3):
 * `button[popoverTarget]`, with no `aria-expanded` on an invoker: every engine exposes the
 * popover's shown state from the invoker relationship. In JS-free mode the browser toggles
 * the popover and the Popup keeps `data-open` current on the element. In library mode the click
 * is cancelled (so the activation does not run) and toggles against what the user already
 * intends: an open through `requestOpen`, a library-owned close through `requestClose`. There
 * `data-open` and `state.open` are optimistic; a non-button `render` (no invoker) renders
 * `aria-expanded` from whether the popup is shown (in the top layer).
 *
 * Menu adds `aria-haspopup="menu"` and its own key handling on top.
 */
export function usePopoverTrigger<State>(
  ctx: PopoverRootValue,
  options: UsePopoverTriggerOptions<State>,
): PopoverTriggerHook {
  const {
    part,
    disabled,
    render,
    handlers,
    onActivate,
    submenuItem = false,
    alwaysFocusable = false,
  } = options;
  const isLibrary = ctx.mode === "library";
  const { ids, triggerRef, popupRef } = ctx;

  const state: PopoverTriggerHookState = {
    open: ctx.optimistic,
    // Opens and part-initiated closes belong to the Trigger (4.2); a dismissal is a fact and
    // pends nothing (conventions 3.9.7).
    pending: ctx.pending,
    disabled,
  };

  const checkElement = useElementCheck(
    isDev &&
      ((element) => {
        if (element.tagName === "BUTTON") return null;
        const tag = element.tagName.toLowerCase();
        // Library mode: the click handler works, but only an invoker button is spared by the
        // popover's light dismiss, so a press while open hides the popup before the click.
        if (isLibrary && submenuItem) {
          return (
            `${part}: rendered a <${tag}>. Only a <button> is the popover's invoker: a press on ` +
            "this element while its popup is open dismisses the popup through light dismiss " +
            "instead of moving focus into it. Render a <button>."
          );
        }
        return isLibrary
          ? nonInvokerMessage(part, tag, "popover", "popup")
          : `${part}: rendered a <${tag}> in JS-free mode. Only a <button> is a ` +
              "`popovertarget` invoker; this trigger will not open the popover. Render a " +
              "<button>, or put the component in library mode (`defaultOpen={false}`).";
      }),
  );
  const ref = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      const unregister = registerTrigger(triggerRef, element, part);
      // JS-free mode: the DOM owns `data-open` (design 9). A Trigger that mounts after the
      // Popup (or is re-created) picks up the current state here.
      if (!isLibrary && popupRef.current !== null) {
        element.toggleAttribute("data-open", isPopoverOpen(popupRef.current));
      }
      return unregister;
    },
    [isLibrary, checkElement, triggerRef, popupRef, part],
  );

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Cancelling the click cancels the popover toggle (it runs as the button's activation
    // behaviour, only if the click was not cancelled). Enter and Space synthesise the same click.
    event.preventDefault();
    if (disabled) return;
    if (onActivate !== undefined) onActivate(event);
    else toggleFromTrigger(ctx, event.nativeEvent);
  };

  // The component's handlers first, then the Trigger's (design/components/menu.md 14). The click
  // handler is only owned when installed, so a render element keeps its own `onClick` in JS-free
  // mode.
  const merged: PopoverTriggerHandlers = { ...handlers };
  if (isLibrary) {
    const extra = handlers?.onClick;
    merged.onClick =
      extra === undefined
        ? onClick
        : (event) => {
            extra(event);
            onClick(event);
          };
  }
  // The click handler is installed in library mode only; in JS-free mode the activation needs
  // native `disabled` to stop it.
  const disabledProps = disabledButton(render, disabled, {
    handlesClick: isLibrary,
    alwaysFocusable: submenuItem || alwaysFocusable,
  });
  if (!isLibrary && !disabledProps.invoker) {
    // JS-free mode, disabled in the `aria-disabled` branch (a host link): nothing native stops the
    // click, so cancel it (a disabled link must not navigate). Only while disabled, after the
    // component's own handler.
    const extra = handlers?.onClick;
    merged.onClick =
      extra === undefined
        ? cancelClick
        : (event) => {
            extra(event);
            cancelClick(event);
          };
  }

  const invoker = disabledProps.invoker && rendersButton(render);

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    // `type` only applies to a <button>; on any other element the key is not owned.
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Trigger (in JS-free mode the browser
    // would toggle the popover).
    ...disabledProps.props,
    // Only on a button (or a component, assumed to render one): another element is no invoker,
    // and the attribute would claim otherwise.
    popoverTarget: invoker ? ids.popup : undefined,
    ...RESERVED_INVOKER_KEYS,
    // No `aria-expanded` on an invoker: every engine exposes the popover's shown state from
    // `popovertarget`, and ARIA in HTML forbids the attribute there. Otherwise nothing else
    // exposes the state: library mode renders shown (the popup is in the top layer; `data-open`
    // is the optimistic one), JS-free mode cannot know it and renders "false".
    "aria-expanded": invoker ? undefined : isLibrary ? ctx.shown : false,
    ...merged,
    "data-open": dataAttr(state.open),
    "data-pending": dataAttr(state.pending),
    // Every mode: the styling hook agrees with the rendered `disabled` / `aria-disabled`
    // (conventions 1.2).
    "data-disabled": dataAttr(disabled),
  };

  return { state, libraryProps, ref };
}
