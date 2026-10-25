"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useSelectContext } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";
import type { SelectRootState } from "./select-root.js";

/**
 * Props of `Select.Trigger`.
 *
 * @see https://ui.funstack.work/components/select
 */
export interface SelectTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  "type" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SelectRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  /**
   * Non-interactive content only (HTML content model of a select's button), usually
   * `<Select.Value />`. Not rendered by engines without customizable select (Firefox today).
   */
  children?: StateValue<ReactNode, SelectRootState>;
  /** Replace the rendered element. Must keep a `<button>`. */
  render?: RenderProp<ComponentPropsWithRef<"button">, SelectRootState>;
}

function firstChildOfSelect(el: HTMLButtonElement): string | null {
  const parent = el.parentElement;
  if (parent?.tagName === "SELECT" && parent.firstElementChild === el) return null;
  return (
    "must be the first child of Select.Root's <select> (HTML content model); elsewhere the " +
    "browser does not use it as the select's button."
  );
}

/**
 * The select's own `<button>` (customizable select): replaces the UA button in engines with
 * `appearance: base-select`. Optional; **must be the first child** of `Select.Root`. Its state is
 * the Root's state, so a pending indicator next to `<Select.Value />` goes in its function
 * `children`.
 *
 * Owned keys: `type` (always `"button"`), `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/select
 */
export function SelectTrigger({ className, style, children, render, ...rest }: SelectTriggerProps) {
  const ctx = useSelectContext("Select.Trigger");
  const state: SelectRootState = {
    value: ctx.optimistic,
    pending: ctx.pending,
    disabled: ctx.disabled,
  };
  const { ref } = useSelectPartRef<HTMLButtonElement>(
    "Select.Trigger",
    "button",
    firstChildOfSelect,
  );
  return useRender<ComponentPropsWithRef<"button">, SelectRootState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      // Explicit: Chromium 156 reports `.type === "submit"` for a select's button.
      type: "button",
      "data-pending": dataAttr(ctx.pending),
      "data-disabled": dataAttr(ctx.disabled),
    },
    ref,
  });
}

SelectTrigger.displayName = "SelectTrigger";
