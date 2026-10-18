"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { isAtBound } from "./number-field-arithmetic.js";
import { useNumberFieldContext } from "./number-field-context.js";
import type { StepDirection } from "./number-field-context.js";
import { useStepButton } from "./use-step-button.js";

export interface NumberFieldButtonState {
  /** The Root is pending and the latest step or commit came from this button. */
  readonly pending: boolean;
  /** The prop, the Root's `disabled` or `readOnly`, or the next step would change nothing. */
  readonly disabled: boolean;
}

export interface NumberFieldIncrementProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "type"
  | "tabIndex"
  | "disabled"
  | "onPointerDown"
  | "onClick"
  | "onContextMenu"
  | "aria-controls"
  | "className"
  | "style"
  | "children"
> {
  disabled?: boolean;
  className?: StateValue<string | undefined, NumberFieldButtonState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldButtonState>;
  children?: StateValue<ReactNode, NumberFieldButtonState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, NumberFieldButtonState>;
}

export type NumberFieldDecrementProps = NumberFieldIncrementProps;

const LABELS: Record<StepDirection, string> = { increment: "Increase", decrement: "Decrease" };

/** Shared by `NumberField.Increment` and `NumberField.Decrement` (design 3.3, 4.3). */
export function useStepButtonElement(
  direction: StepDirection,
  part: string,
  props: NumberFieldIncrementProps,
): ReactNode {
  const { disabled: disabledProp = false, className, style, children, render, ...rest } = props;
  const ctx = useNumberFieldContext(part);
  const { state } = ctx;
  const atBound = isAtBound(state.value, direction === "increment" ? 1 : -1, ctx.bounds);
  const disabled = disabledProp || state.disabled || state.readOnly || atBound;
  const pending = ctx.pendingSource === direction;
  const buttonState: NumberFieldButtonState = { pending, disabled };
  const handlers = useStepButton(ctx, direction, disabled);

  useDevWarning(
    rest["aria-label"] === "",
    `${part}: \`aria-label=""\` leaves the button without a name. Pass the label text instead ` +
      `(the default is "${LABELS[direction]}").`,
  );

  // The built-in name is a default the consumer's `aria-label` or `aria-labelledby` replaces.
  const props$ = {
    ...(rest["aria-labelledby"] === undefined ? { "aria-label": LABELS[direction] } : {}),
    ...rest,
  };

  return useRender<ComponentPropsWithRef<"button">, NumberFieldButtonState>({
    defaultElement: "button",
    render,
    state: buttonState,
    className,
    style,
    children,
    props: props$,
    libraryProps: {
      ...(rendersButton(render) ? { type: "button" as const } : {}),
      tabIndex: -1,
      "aria-controls": ctx.inputId,
      disabled,
      onPointerDown: handlers.onPointerDown,
      onClick: handlers.onClick,
      onContextMenu: handlers.onContextMenu,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    } as Partial<ComponentPropsWithRef<"button">> & DataAttributes,
  });
}

/**
 * Steps the value up: `button[type=button][tabindex=-1]` with `aria-controls` → the input and the
 * default `aria-label` `"Increase"`; one step at the press, then repeated while held, one commit
 * at the release. Natively `disabled` when the next step would change nothing.
 *
 * Owned keys: `type`, `tabIndex`, `aria-controls`, `disabled`, `onPointerDown`, `onClick`,
 * `onContextMenu`, `data-pending`, `data-disabled`.
 */
export function NumberFieldIncrement(props: NumberFieldIncrementProps) {
  return useStepButtonElement("increment", "NumberField.Increment", props);
}

NumberFieldIncrement.displayName = "NumberFieldIncrement";
