"use client";
import { useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { useToolbarContext } from "../internal/toolbar-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { disabledButton, rendersButton, useRender } from "../internal/use-render.js";
import { useToggleGroupContext } from "./toggle-group-context.js";
import type { ToggleGroupOrientation } from "./toggle-group-context.js";

/**
 * State of `ToggleGroup.Item`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ToggleGroupItemState {
  /** The Item's `value` prop. */
  readonly value: string;
  /** Optimistic pressed state. */
  readonly pressed: boolean;
  /** The group's action is in flight and this Item's optimistic state differs from its committed one. */
  readonly pending: boolean;
  /** Own `disabled` or the Root's. */
  readonly disabled: boolean;
  /** The Root's effective orientation (the Toolbar's inside one). */
  readonly orientation: ToggleGroupOrientation;
}

/**
 * Props of `ToggleGroup.Item`.
 *
 * @see https://ui.funstack.work/components/toggle-group
 */
export interface ToggleGroupItemProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "type"
  | "value"
  | "tabIndex"
  | "aria-pressed"
  | "aria-disabled"
  | "className"
  | "style"
  | "children"
> {
  /** The value this Item presses. Unique within the group. */
  value: string;
  /**
   * Never dispatches. Standalone: native `disabled` on a `<button>` (skipped by the arrow keys);
   * with a link or component `render`, `aria-disabled="true"` instead. Inside a `Toolbar.Root`
   * (its own `disabled` or the group's): `aria-disabled="true"` on every element, so the Item
   * stays focusable and in the Toolbar's arrow sequence (APG Toolbar, conventions 3.6).
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToggleGroupItemState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToggleGroupItemState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, ToggleGroupItemState>;
  /** Must be, or render, a `<button>` (a toggle is a button). */
  render?: RenderProp<ComponentPropsWithRef<"button">, ToggleGroupItemState>;
}

/**
 * One toggle of a ToggleGroup: the `Toggle` element (`<button type="button" aria-pressed>`) whose
 * pressed state is the Root's (design/components/toggle-group.md 16.3). Its `tabindex` is written
 * by the roving engine (the group's, or the enclosing Toolbar's). No `transition` prop: everything
 * it renders is optimistic (conventions 5.1); animate the flip with a CSS `transition` on
 * `[data-pressed]`.
 *
 * Owned keys (conventions 1.5): `type` (on a `<button>`), `tabIndex` (the engine's),
 * `aria-pressed`, `disabled`, `aria-disabled` (inside a Toolbar, or a link or component
 * `render`), `data-pressed`, `data-pending`, `data-disabled`, `data-orientation`, `onClick`, and
 * `focusgroupstart` while the Root renders `focusgroup`.
 *
 * @see https://ui.funstack.work/components/toggle-group
 */
export function ToggleGroupItem({
  value,
  disabled: disabledProp = false,
  className,
  style,
  children,
  render,
  ...rest
}: ToggleGroupItemProps) {
  const ctx = useToggleGroupContext("ToggleGroup.Item");
  const toolbar = useToolbarContext();
  const pressed = ctx.optimistic.has(value);
  const pending = ctx.pending && pressed !== ctx.committed.has(value);
  const disabled = ctx.disabled || disabledProp;
  const { registerItem } = ctx;
  const registerRef = useCallback(
    (el: HTMLElement) => registerItem(el, value),
    [registerItem, value],
  );

  const state: ToggleGroupItemState = {
    value,
    pressed,
    pending,
    disabled,
    orientation: ctx.orientation,
  };

  const element = useRender<ComponentPropsWithRef<"button">, ToggleGroupItemState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    // Pass-through layer, as Toggle: a `render` element's own `type` wins.
    props: rendersButton(render) ? { ...rest, type: "button" } : rest,
    libraryProps: {
      // Inside a Toolbar a disabled Item stays focusable and in the arrow sequence (3.6).
      ...disabledButton(render, disabled, { alwaysFocusable: toolbar !== null }).props,
      "aria-pressed": pressed,
      "data-pressed": dataAttr(pressed),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      "data-orientation": ctx.orientation,
      ...(ctx.focusgroupStartValue !== null && {
        focusgroupstart: ctx.focusgroupStartValue === value ? "" : undefined,
      }),
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        // Native buttons do not fire `click` when disabled; the guard covers `render` elements
        // (a link must not navigate either).
        if (disabled) {
          event.preventDefault();
          return;
        }
        ctx.toggle(value, event.nativeEvent);
      },
    },
    ref: registerRef,
  });

  return element;
}

ToggleGroupItem.displayName = "ToggleGroupItem";
