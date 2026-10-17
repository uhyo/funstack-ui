"use client";
import { useCallback, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { rendersButton, useRender } from "../internal/use-render.js";
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
  | "tabIndex"
  | "aria-expanded"
  | "aria-controls"
  | "disabled"
  | "className"
  | "style"
  | "children"
> {
  /** Disables this button; the Root's `disabled` does too. */
  disabled?: boolean;
  className?: StateValue<string | undefined, ComboboxTriggerState>;
  style?: StateValue<CSSProperties | undefined, ComboboxTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, ComboboxTriggerState>;
  /** Should render a `<button>`. */
  render?: RenderProp<ComponentPropsWithRef<"button">, ComboboxTriggerState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Development check (design 9): an icon-only Trigger needs a name from the consumer. Checked a
 * microtask after the element attaches, once per instance.
 */
export function useNameWarning(part: string): (element: HTMLElement) => () => void {
  const warned = useRef(false);
  return useCallback(
    (element: HTMLElement) => {
      if (!isDev || warned.current) return () => {};
      queueMicrotask(() => {
        if (warned.current || !element.isConnected) return;
        if (element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby")) return;
        if ((element.textContent ?? "").trim() !== "" || element.hasAttribute("title")) return;
        warned.current = true;
        console.error(`${part}: the button has no accessible name. Give it an \`aria-label\`.`);
      });
      return () => {};
    },
    [part],
  );
}

/**
 * The optional button that toggles the listbox: `<button type="button" tabindex="-1"
 * aria-expanded aria-controls>` (the APG keeps it out of the Tab sequence; the input is the one
 * stop). A press does not take focus from the input, and a click focuses the input. No
 * `commandfor`: the listbox is anchored to the input, never to this button (design 1).
 *
 * Owned keys: `type` (on a `<button>`), `tabIndex`, `disabled`, `aria-expanded`,
 * `aria-controls` (token-merged), `onClick`, `onPointerDown`, `onMouseDown`, `data-open`,
 * `data-pending`, `data-disabled`.
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
  const ref = useNameWarning("Combobox.Trigger");

  const state: ComboboxTriggerState = {
    open: popover.optimistic,
    pending: popover.pending,
    disabled,
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    tabIndex: -1,
    disabled,
    "aria-expanded": popover.optimistic,
    "aria-controls": ctx.ids.list,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      openAtPress.current = popover.intended();
      event.preventDefault();
    },
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      const wasOpen = openAtPress.current ?? popover.intended();
      openAtPress.current = null;
      if (disabled) return;
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
