"use client";
import { useCallback, useMemo } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useOTPFieldContext } from "./otp-field-context.js";
import type { OTPFieldState } from "./otp-field-root.js";

/** The state a Slot's function props receive. */
export interface OTPFieldSlotState extends OTPFieldState {
  /** The Slot's `index`. */
  readonly index: number;
  /** The character at `index`, or `null`. */
  readonly char: string | null;
  /** A character is at `index`. */
  readonly filled: boolean;
  /** The input is focused and the caret, or part of the selection, is at this position. */
  readonly active: boolean;
}

/**
 * Props of `OTPField.Slot`.
 *
 * @see https://ui.funstack.work/components/otp-field
 */
export interface OTPFieldSlotProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  /** Which character position this slot shows, from `0`. */
  index: number;
  /** Class name, or a function of the state that returns one. */
  className?: StateValue<string | undefined, OTPFieldSlotState>;
  /** Inline style, or a function of the state that returns one. */
  style?: StateValue<CSSProperties | undefined, OTPFieldSlotState>;
  /**
   * The content. Default: the character at `index`, or nothing. A function draws a placeholder,
   * a dot, a caret element.
   */
  children?: StateValue<ReactNode, OTPFieldSlotState>;
  /** Replace the default `<span>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"span">, OTPFieldSlotState>;
}

function defaultChildren(state: OTPFieldSlotState): ReactNode {
  return state.char;
}

/**
 * One character position of an OTPField (design/components/otp-field.md 1): a `span` drawn from
 * the Input's text, `aria-hidden` (the input already says everything). Not focusable and never
 * the pointer's target: the Input lies over it.
 *
 * Owned keys (conventions 1.2): `aria-hidden`, `data-index`, `data-filled`, `data-active`. The
 * Root's attributes (`data-pending`, `data-complete`, …) style the Slots from above.
 *
 * @see https://ui.funstack.work/components/otp-field
 */
export function OTPFieldSlot({
  index,
  className,
  style,
  children,
  render,
  ...rest
}: OTPFieldSlotProps) {
  const ctx = useOTPFieldContext("OTPField.Slot");
  const { state, active, registerSlot } = ctx;
  const char = state.value[index] ?? null;
  const isActive = index >= active[0] && index < active[1];

  const slotState = useMemo<OTPFieldSlotState>(
    () => ({ ...state, index, char, filled: char !== null, active: isActive }),
    [state, index, char, isActive],
  );

  const ref = useCallback(
    (element: HTMLElement) => registerSlot(index, element),
    [registerSlot, index],
  );

  const libraryProps: Partial<ComponentPropsWithRef<"span">> & DataAttributes = {
    "aria-hidden": true,
    "data-index": String(index),
    "data-filled": dataAttr(char !== null),
    "data-active": dataAttr(isActive),
  };

  return useRender<ComponentPropsWithRef<"span">, OTPFieldSlotState>({
    defaultElement: "span",
    render,
    state: slotState,
    className,
    style,
    children: children ?? defaultChildren,
    props: rest,
    libraryProps,
    ref,
  });
}

OTPFieldSlot.displayName = "OTPFieldSlot";
