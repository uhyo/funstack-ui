"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ChangeReason } from "../internal/types.js";
import type { FormAssociatedElement } from "../internal/use-form-owner-event.js";
import { useFormReset } from "../internal/use-form-reset.js";

export interface ComboboxFormOptions {
  /** The Root's props, for the reset targets. */
  readonly value: string | null | undefined;
  readonly defaultValue: string | null | undefined;
  readonly inputValue: string | undefined;
  readonly defaultInputValue: string | undefined;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly hiddenRef: RefObject<HTMLInputElement | null>;
  /** The latest text (the urgent lane). */
  readonly textRef: RefObject<string>;
  readonly writeText: (next: string, reason: ChangeReason, event: Event | undefined) => void;
  /** The optimistic selection. */
  readonly optimistic: string | null;
  /** Dispatches the reset target as the value (`"platform"`). */
  readonly resetValue: (next: string | null, event: Event) => void;
}

/**
 * The Combobox's form behaviour (design/components/combobox.md 11.1, walkthroughs 10 and 11):
 * form reset of the text and the value, the DOM re-sync for a controlled parent that keeps its
 * text, and the mount reconciliation of a text typed before hydration.
 */
export function useComboboxForm(options: ComboboxFormOptions): void {
  const { value, defaultValue, inputValue, defaultInputValue, inputRef, hiddenRef, textRef } =
    options;
  const { writeText } = options;

  const [mountValue] = useState(value);
  const [mountText] = useState(inputValue);
  // Reset targets (conventions 3.8 rule 6): uncontrolled, the latest default props; controlled,
  // the mount-time values.
  const valueResetTarget = value !== undefined ? (mountValue ?? null) : (defaultValue ?? null);
  const inputDefaultValue =
    inputValue !== undefined ? (mountText ?? "") : (defaultInputValue ?? "");
  // After a form reset a controlled parent may not adopt the text: put React's value back into
  // the DOM (react-dom only does that after its own input events).
  const [resync, setResync] = useState(0);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (resync > 0 && input !== null && input.value !== textRef.current) {
      input.value = textRef.current;
    }
  }, [resync, inputRef, textRef]);

  const formElement = useMemo<RefObject<FormAssociatedElement | null>>(
    () => ({
      get current() {
        return hiddenRef.current ?? inputRef.current;
      },
      set current(_ignored) {},
    }),
    [hiddenRef, inputRef],
  );
  useFormReset(
    formElement,
    (event) => {
      const input = inputRef.current;
      const domText = input?.value ?? inputDefaultValue;
      if (domText !== textRef.current) writeText(domText, "platform", event);
      // A controlled parent that does not adopt the text gets the DOM re-synced.
      setResync((n) => n + 1);
      if (valueResetTarget !== options.optimistic) options.resetValue(valueResetTarget, event);
    },
    () => {
      // react-dom writes `defaultValue = value` after every update of a controlled input, so the
      // reset target is written here, right before the browser's reset algorithm reads it.
      const input = inputRef.current;
      if (input !== null && input.defaultValue !== inputDefaultValue) {
        input.defaultValue = inputDefaultValue;
      }
    },
  );

  // Walkthrough 11: react-dom keeps a hydrated text input's DOM value and fires no `onChange`.
  const reconciled = useRef(false);
  useLayoutEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    const input = inputRef.current;
    if (input !== null && input.value !== textRef.current) {
      writeText(input.value, "platform", undefined);
    }
  }, [writeText, inputRef, textRef]);
}
