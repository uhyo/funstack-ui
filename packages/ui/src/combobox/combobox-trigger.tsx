"use client";
import { useRef } from "react";
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
import { isHostButton, rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useComboboxContext } from "./combobox-context.js";

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
  | "onPointerCancel"
  | "tabIndex"
  | "aria-expanded"
  | "aria-controls"
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
 * aria-expanded aria-controls>` (the APG keeps it out of the Tab sequence; the input is the one
 * stop). A press does not take focus from the input, and a click focuses the input. No
 * `commandfor`: the listbox is anchored to the input, never to this button (design 1).
 *
 * Owned keys: `type` (on a `<button>`), `tabIndex`, `disabled`, `aria-disabled` (link or
 * component `render`), `aria-expanded`,
 * `aria-controls` (token-merged), `onClick`, `onPointerDown`, `onPointerCancel`, `onMouseDown`,
 * `data-open`, `data-pending`, `data-disabled`.
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
  // What the user saw at the press: a press outside the popup light-dismisses it before the
  // click arrives, so the toggle is decided against the state at `pointerdown`.
  const openAtPress = useRef<boolean | null>(null);
  // Development check (design 9): an icon-only Trigger needs a name from the consumer.
  const ref = useNameWarning(
    "Combobox.Trigger: the button has no accessible name. Give it an `aria-label`.",
    BUTTON_NAME,
  );

  // A link or component render: native `disabled` would mean nothing on a link; the click
  // handler refuses, so `aria-disabled`.
  const focusable = !isHostButton(render);

  const state: ComboboxTriggerState = {
    open: popover.optimistic,
    pending: popover.pending,
    disabled,
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    tabIndex: -1,
    disabled: focusable ? undefined : disabled,
    ...(focusable && { "aria-disabled": disabled ? true : undefined }),
    "aria-expanded": popover.optimistic,
    "aria-controls": ctx.ids.list,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      openAtPress.current = popover.intended();
      event.preventDefault();
    },
    onPointerCancel: () => {
      // The press never becomes a click.
      openAtPress.current = null;
    },
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      // `detail === 0`: a click without a press (assistive technology, `element.click()`); a
      // snapshot left by a press that never clicked (dragged off) does not belong to it.
      const pressed = event.detail === 0 ? null : openAtPress.current;
      const wasOpen = pressed ?? popover.intended();
      openAtPress.current = null;
      if (disabled) {
        // A disabled link must not navigate either.
        event.preventDefault();
        return;
      }
      const native = event.nativeEvent;
      if (wasOpen) popover.requestClose(native, "activate");
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
