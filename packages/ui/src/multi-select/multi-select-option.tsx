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
import { optionId } from "../internal/use-option-registry.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { MultiSelectListContext, useMultiSelectContext } from "./multi-select-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `MultiSelect.Option`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface MultiSelectOptionState {
  /** The Option's `value` prop. */
  readonly value: string;
  /** Optimistic: this option's value is in the optimistic selection. */
  readonly selected: boolean;
  /** `aria-activedescendant` points here (urgent). */
  readonly active: boolean;
  /** The value action is in flight and this option is being added or removed. */
  readonly pending: boolean;
  /** The Option's `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `MultiSelect.Option`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectOptionProps extends Omit<
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
  /** The value this option stands for. Unique within the MultiSelect; also its id fragment. */
  value: string;
  /**
   * The option's text for typeahead and for the label cache (`MultiSelect.Value`). Renders
   * nothing.
   *
   * @defaultValue the element's trimmed `textContent` at that moment
   */
  label?: string;
  /**
   * `aria-disabled`: shown, skipped by the arrow keys and typeahead, never toggled.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectOptionState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectOptionState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, MultiSelectOptionState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MultiSelectOptionState>;
}

const preventDefault = (event: { preventDefault(): void }) => event.preventDefault();

/**
 * One choice: `<div role="option" id aria-selected>`, never focused (virtual focus through the
 * Trigger's `aria-activedescendant`). A click (or Enter or Space while it is active) toggles it:
 * `aria-selected` and `data-selected` flip at once, it shows `data-pending` until the change
 * commits, and the listbox stays open (design/components/multi-select.md B.5). Hovering makes it
 * active.
 *
 * Owned keys (conventions 1.2): `id` (derived from `value`), `role`, `aria-selected`,
 * `aria-disabled`, `onClick`, `onPointerDown`, `onMouseDown`, `onPointerMove`, `data-selected`,
 * `data-active`, `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectOption({
  value,
  label,
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectOptionProps) {
  const ctx = useMultiSelectContext("MultiSelect.Option");
  const inList = use(MultiSelectListContext);
  useDevWarning(
    !inList,
    isDev &&
      "MultiSelect.Option: rendered outside a MultiSelect.List. Options belong in the listbox.",
  );
  const { registerOption } = ctx;

  const elementRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((element: HTMLElement) => {
    elementRef.current = element;
    return () => {
      if (elementRef.current === element) elementRef.current = null;
    };
  }, []);

  // Registration: the Root's registry drives the keys, typeahead, `Empty`, the active option's
  // revalidation and the label cache.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element === null) return;
    return registerOption(value, { element, label, disabled });
  }, [registerOption, value, label, disabled]);

  const selected = ctx.isSelected(value);
  const state: MultiSelectOptionState = {
    value,
    selected,
    active: ctx.activeValue === value,
    pending: ctx.isPending(value),
    disabled,
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: optionId(ctx.ids.optionPrefix, value),
    role: "option",
    "aria-selected": selected,
    "aria-disabled": disabled ? true : undefined,
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      ctx.toggle(value, event.nativeEvent);
    },
    // The Trigger keeps focus (B.4), also for an Option rendered outside a Popup.
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

  return useRender<ComponentPropsWithRef<"div">, MultiSelectOptionState>({
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

MultiSelectOption.displayName = "MultiSelectOption";
