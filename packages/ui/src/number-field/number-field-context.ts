"use client";
import { createContext, use } from "react";
import type { RefObject } from "react";
import type { StepBounds } from "./number-field-arithmetic.js";
import type { NumberFieldState } from "./number-field-root.js";

/** A step button's direction. */
export type StepDirection = "increment" | "decrement";

/** What produced a step or a commit (`details.source`). */
export type NumberFieldSource = "input" | "increment" | "decrement" | "keyboard" | "wheel" | null;

export interface NumberFieldContextValue {
  /** The state every part's function props receive. */
  readonly state: NumberFieldState;
  readonly bounds: StepBounds;
  /** What a button steps from: the parsed draft while one is open, else the shown value. */
  readonly stepBase: number | null;
  /** The Root is pending and the latest step or commit came from this source. */
  readonly pendingSource: NumberFieldSource;
  /** Ids: the visible input (the Root's, or a Field's control id) and the Label. */
  readonly inputId: string;
  readonly labelId: string;
  readonly name: string | undefined;
  readonly form: string | undefined;
  /** `inputmode="decimal"` rather than `"numeric"` (8.5). */
  readonly allowsFractions: boolean;
  readonly stepOnWheel: boolean;
  /** The hidden input's `defaultValue`: the reset target as `String(number)` or `""`. */
  readonly resetTargetText: string;
  /** Inside a `Field.Root`: `data-invalid` on the Root and the Input. */
  readonly fieldInvalid: boolean | undefined;
  readonly visibleRef: RefObject<HTMLInputElement | null>;
  readonly hiddenRef: RefObject<HTMLInputElement | null>;

  /** `input` on the visible input: the urgent draft. */
  readonly typed: (text: string) => void;
  /** `focusout` on the visible input: commit the draft (4.1). */
  readonly commitDraft: (event: Event) => void;
  /** `keydown` on the visible input (4.2). */
  readonly keyDown: (event: KeyboardEvent) => void;
  /** The native `wheel` listener on the visible input (4.4). */
  readonly wheel: (event: WheelEvent) => void;
  /** `pointerdown` on a button: the first step; `false` when no hold is open afterwards. */
  readonly beginHold: (direction: StepDirection, event: Event) => boolean;
  /** One tick of the hold; `false` when the hold ended (the bound was reached). */
  readonly tickHold: (direction: StepDirection, event: Event | undefined) => boolean;
  /** The hold's release (or cancel): one commit. */
  readonly endHold: (direction: StepDirection, event: Event) => void;
  /** A click with no pointer gesture (assistive technology): step + commit. */
  readonly activate: (direction: StepDirection, event: Event) => void;
  /** Mirrors the hidden input's `validationMessage` onto the visible input (6.2). */
  readonly mirror: () => void;
  /** Called by the Label from a layout effect; returns the unregistration. */
  readonly registerLabel: () => () => void;
  /** Called by the Input from its mount layout effect (late mount reconciliation). */
  readonly onInputMounted: () => void;
}

export const NumberFieldContext = createContext<NumberFieldContextValue | null>(null);

export function useNumberFieldContext(part: string): NumberFieldContextValue {
  const context = use(NumberFieldContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a NumberField.Root.`);
  }
  return context;
}
