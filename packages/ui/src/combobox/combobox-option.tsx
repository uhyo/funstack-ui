"use client";
import { use, useCallback, useLayoutEffect, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { ComboboxListContext, optionId, useComboboxContext } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

export interface ComboboxOptionState {
  readonly value: string;
  /** Optimistic: this option's value is the (optimistic) selection. */
  readonly selected: boolean;
  /** `aria-activedescendant` points here (urgent). */
  readonly active: boolean;
  /** The selection is pending and this option is its optimistic target. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface ComboboxOptionProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "id"
  | "role"
  | "aria-selected"
  | "aria-disabled"
  | "onClick"
  | "onPointerDown"
  | "onMouseDown"
  | "onPointerMove"
  | "className"
  | "style"
  | "children"
> {
  /** The selection this option stands for. Unique within the Combobox; also its id fragment. */
  value: string;
  /**
   * The text written into the input when this option is accepted. Default: the element's
   * trimmed `textContent` at that moment. Not used for matching: the library filters nothing.
   */
  label?: string;
  /** `aria-disabled`: shown, skipped by the arrow keys, never accepted. */
  disabled?: boolean;
  className?: StateValue<string | undefined, ComboboxOptionState>;
  style?: StateValue<CSSProperties | undefined, ComboboxOptionState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, ComboboxOptionState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxOptionState>;
}

const preventDefault = (event: { preventDefault(): void }) => event.preventDefault();

/**
 * One result: `<div role="option" id aria-selected>`, never focused (virtual focus through the
 * input's `aria-activedescendant`). A click (or Enter while it is active) accepts it: the input
 * text becomes its label at once, it shows `data-selected` and `data-pending`, and the listbox
 * closes when `valueChangeAction` settles. Hovering makes it active.
 *
 * Owned keys (conventions 1.2): `id` (derived from `value`), `role`, `aria-selected`,
 * `aria-disabled`, `onClick`, `onPointerDown`, `onMouseDown`, `onPointerMove`, `data-selected`,
 * `data-active`, `data-pending`, `data-disabled`.
 */
export function ComboboxOption({
  value,
  label,
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxOptionProps) {
  const ctx = useComboboxContext("Combobox.Option");
  const inList = use(ComboboxListContext);
  useDevWarning(
    !inList,
    isDev && "Combobox.Option: rendered outside a Combobox.List. Options belong in the listbox.",
  );
  const { registerOption } = ctx;

  const elementRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((element: HTMLElement) => {
    elementRef.current = element;
    return () => {
      if (elementRef.current === element) elementRef.current = null;
    };
  }, []);

  // Registration (design 14): the Root's registry drives the arrow keys, `Empty`, the active
  // option's revalidation, the announcements and the label cache.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element === null) return;
    return registerOption(value, { element, label, disabled });
  }, [registerOption, value, label, disabled]);

  const selected = ctx.value === value;
  const state: ComboboxOptionState = {
    value,
    selected,
    active: ctx.activeValue === value,
    pending: ctx.valuePending && selected,
    disabled,
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: optionId(ctx.ids.optionPrefix, value),
    role: "option",
    "aria-selected": selected,
    "aria-disabled": disabled ? true : undefined,
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      ctx.accept(value, event.nativeEvent);
    },
    // The input keeps focus (design 7.1), also for an Option rendered outside a Popup.
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => preventDefault(event),
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => preventDefault(event),
    onPointerMove: () => {
      if (!disabled && ctx.activeValue !== value) ctx.setActive(value);
    },
    "data-selected": dataAttr(selected),
    "data-active": dataAttr(state.active),
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"div">, ComboboxOptionState>({
    defaultElement: "div",
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

ComboboxOption.displayName = "ComboboxOption";
