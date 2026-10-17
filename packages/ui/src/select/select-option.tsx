"use client";
import { useEffectEvent, useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { syncPresence } from "../internal/sync-presence.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useHydratedMount } from "../internal/use-hydrated-mount.js";
import { useRender } from "../internal/use-render.js";
import { useSelectContext } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";

export interface SelectOptionState {
  readonly value: string;
  /** Optimistic: true as soon as the user picks this option, before the action settles. */
  readonly selected: boolean;
  /** The Root is pending and this option is the optimistic target. */
  readonly pending: boolean;
  /** Disabled by its own prop or by `Root disabled`. */
  readonly disabled: boolean;
}

export interface SelectOptionProps extends Omit<
  ComponentPropsWithRef<"option">,
  "value" | "selected" | "className" | "style" | "children"
> {
  /** The option's value. Required: React cannot infer a value from rich children. */
  value: string;
  /** Native `disabled`: not pickable, skipped by keyboard navigation. */
  disabled?: boolean;
  className?: StateValue<string | undefined, SelectOptionState>;
  style?: StateValue<CSSProperties | undefined, SelectOptionState>;
  /**
   * The option's content. Keep it readable as plain text: engines without customizable select
   * (Firefox today) show only the text. Give icons `aria-hidden` and no text. Avoid the `label`
   * attribute (Chromium names the option from it but shows the content).
   */
  children?: StateValue<ReactNode, SelectOptionState>;
  /** Replace the rendered element. Must keep an `<option>`. */
  render?: RenderProp<ComponentPropsWithRef<"option">, SelectOptionState>;
}

/**
 * One `<option>`. It never renders `selected`: the selection is the Root's `value={optimistic}`
 * plus the Root's re-apply for options that mount after the select's own commit (a Suspense
 * boundary or `use()` inside the select), which the Option reports from its mount layout effect.
 *
 * Owned keys: `value`, `selected` (never rendered), `disabled`, `data-selected`, `data-pending`,
 * `data-disabled`.
 */
export function SelectOption({
  value,
  disabled: disabledProp = false,
  className,
  style,
  children,
  render,
  ...rest
}: SelectOptionProps) {
  const ctx = useSelectContext("Select.Option");
  const selected = ctx.optimistic === value;
  const pending = ctx.pending && selected;
  const disabled = ctx.disabled || disabledProp;
  const hydrated = useHydratedMount();
  const { ref, node } = useSelectPartRef<HTMLOptionElement>("Select.Option", "option");

  // Reads the mount render's values: for a hydrated option that is the hydration render, which
  // used the server snapshot (`hydrated === true`).
  const reportMount = useEffectEvent(() => {
    const el = node.current;
    if (el !== null) {
      // Hydration keeps server attributes that differ from the client render (React only warns);
      // an option hydrating after its Root can render a different state than the server did.
      syncPresence(el, "data-selected", selected);
      syncPresence(el, "data-pending", pending);
      syncPresence(el, "data-disabled", disabled);
    }
    ctx.optionMounted(el, hydrated);
  });
  useLayoutEffect(() => {
    reportMount();
  }, []);

  const state: SelectOptionState = { value, selected, pending, disabled };

  return useRender<ComponentPropsWithRef<"option">, SelectOptionState>({
    defaultElement: "option",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      value,
      selected: undefined,
      // Only the Option's own prop: `Root disabled` disables the whole select natively.
      disabled: disabledProp,
      "data-selected": dataAttr(selected),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    },
    ref,
  });
}

SelectOption.displayName = "SelectOption";
