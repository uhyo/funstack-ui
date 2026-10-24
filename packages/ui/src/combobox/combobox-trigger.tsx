"use client";
import { useCallback } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { BUTTON_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { disabledButton, rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useComboboxContext } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

export interface ComboboxTriggerState {
  /** Optimistic open state. */
  readonly open: boolean;
  /** The open (or close) transition is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface ComboboxTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "onPointerDown"
  | "onMouseDown"
  | "tabIndex"
  | "aria-expanded"
  | "aria-controls"
  | "commandfor"
  | "command"
  | "popoverTarget"
  | "popoverTargetAction"
  | "disabled"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Disables this button; the Root's `disabled` does too. Native `disabled` on a `<button>`; with
   * a link or component `render`, `aria-disabled="true"` instead.
   */
  disabled?: boolean;
  className?: StateValue<string | undefined, ComboboxTriggerState>;
  style?: StateValue<CSSProperties | undefined, ComboboxTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, ComboboxTriggerState>;
  /** Should render a `<button>`. */
  render?: RenderProp<ComponentPropsWithRef<"button">, ComboboxTriggerState>;
}

/**
 * The optional button that toggles the listbox: `<button type="button" tabindex="-1"
 * aria-controls>` (the APG keeps it out of the Tab sequence; the input is the one stop). A press
 * does not take focus from the input, and a click focuses the input. After hydration a `<button>`
 * also names the Popup as its invoker (`popovertarget`, written through the ref, never
 * server-rendered), so a press while the listbox is open is not a light dismiss and the click's
 * close is the only one (design 3.3, #112, #121), and the browser exposes the listbox's state on
 * it: a `<button>` renders no `aria-expanded`, another element renders it from the shown listbox.
 * Every click is cancelled, so the toggle never runs: the listbox stays anchored to the input
 * (design 1).
 *
 * Owned keys: `type` (on a `<button>`), `tabIndex`, `disabled`, `aria-disabled` (link or
 * component `render`), `aria-expanded`, `aria-controls` (token-merged), `popovertarget`,
 * `onClick`, `onPointerDown`, `onMouseDown`, `data-open`, `data-pending`, `data-disabled`;
 * `commandfor`, `command` and `popoverTargetAction` are reserved.
 */
export function ComboboxTrigger({
  disabled: ownDisabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxTriggerProps) {
  const ctx = useComboboxContext("Combobox.Trigger");
  const { popover } = ctx;
  const disabled = ownDisabled || ctx.disabled;
  // Development check (design 9): an icon-only Trigger needs a name from the consumer.
  const checkName = useNameWarning(
    isDev && "Combobox.Trigger: the button has no accessible name. Give it an `aria-label`.",
    BUTTON_NAME,
  );
  const checkElement = useElementCheck(
    isDev &&
      ((element) =>
        element.tagName === "BUTTON"
          ? null
          : `Combobox.Trigger: rendered a <${element.tagName.toLowerCase()}>. Only a <button> ` +
            "is the listbox's invoker: a press on this element while the listbox is open closes " +
            "it through light dismiss before the click, so the close is not awaited, " +
            "openChangeAction(false) cannot veto it and there is no exit transition. Render a " +
            "<button>."),
  );
  const popupId = popover.ids.popup;
  // After hydration a `<button>` becomes the popup's invoker (design 3.3, #112): the platform's
  // light dismiss exempts a press on an invoker of the open popover. Written here, not rendered,
  // so the server HTML has no `popovertarget` and a click before hydration opens nothing (#121).
  const ref = useCallback(
    (element: HTMLElement) => {
      checkName?.(element);
      checkElement?.(element);
      if (element.tagName !== "BUTTON") return () => {};
      element.setAttribute("popovertarget", popupId);
      return () => {
        element.removeAttribute("popovertarget");
      };
    },
    [checkName, checkElement, popupId],
  );

  const state: ComboboxTriggerState = {
    open: popover.optimistic,
    pending: popover.pending,
    disabled,
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    tabIndex: -1,
    ...disabledButton(render, disabled).props,
    // A `<button>` is the invoker after hydration and the browser exposes the listbox's state on
    // it (#121). Another element: shown (the listbox is in the top layer); `data-open` is the
    // optimistic one (#118).
    "aria-expanded": rendersButton(render) ? undefined : popover.shown,
    "aria-controls": ctx.ids.list,
    // Owned: the ref writes `popovertarget` after hydration; a render element sets neither.
    popoverTarget: undefined,
    popoverTargetAction: undefined,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      // Cancelled first, whatever follows: the popover toggle must never run (the library opens the
      // listbox anchored to the input), and a disabled link must not navigate either.
      event.preventDefault();
      if (disabled) return;
      const native = event.nativeEvent;
      if (popover.intended()) popover.requestClose(native, "activate");
      else popover.requestOpen(native, "activate");
      ctx.inputRef.current?.focus();
    },
    "data-open": dataAttr(popover.optimistic),
    "data-pending": dataAttr(popover.pending),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"button">, ComboboxTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref,
  });
}

ComboboxTrigger.displayName = "ComboboxTrigger";
