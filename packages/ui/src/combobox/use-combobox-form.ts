"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ChangeReason } from "../internal/types.js";
import type { FormAssociatedElement } from "../internal/form/use-form-owner-event.js";
import { syncValueTracker } from "../internal/form/sync-value-tracker.js";
import { useFormReset, useResetTarget } from "../internal/form/use-form-reset.js";

export interface ComboboxFormOptions {
  /** The Root's text props, for the text's reset target. */
  readonly inputValue: string | undefined;
  readonly defaultInputValue: string | undefined;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly hiddenRef: RefObject<HTMLInputElement | null>;
  /** The latest text (the urgent lane). */
  readonly textRef: RefObject<string>;
  readonly writeText: (next: string, reason: ChangeReason, event: Event | undefined) => void;
  /**
   * Dispatches the value's reset target (`"platform"`) unless there is nothing to change. The
   * Root computes the target per mode (design 11.1, 15.8).
   */
  readonly resetValue: (event: Event) => void;
}

/**
 * The Combobox's form behaviour (design/components/combobox.md 11.1, walkthroughs 10 and 11):
 * form reset of the text and the value, the DOM re-sync for a controlled parent that keeps its
 * text, and the mount reconciliation of a text typed before hydration.
 */
export function useComboboxForm(options: ComboboxFormOptions): void {
  const { inputValue, defaultInputValue, inputRef, hiddenRef, textRef } = options;
  const { writeText } = options;

  // The text's reset target (conventions 3.8 rule 6): uncontrolled, the latest default prop;
  // controlled, the mount-time value.
  const inputDefaultValue = useResetTarget(inputValue, defaultInputValue) ?? "";
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
      // The reset algorithm wrote the text past react-dom's value tracker (rule 6).
      syncValueTracker(inputRef.current);
      // The target is computed, not read from the input (conventions 3.8 rule 6): after a click
      // on a reset button this microtask runs before the browser's reset algorithm, so the input
      // still holds the typed text here (#185).
      if (inputDefaultValue !== textRef.current) {
        writeText(inputDefaultValue, "platform", event);
      }
      // A controlled parent that does not adopt the text gets the DOM re-synced.
      setResync((n) => n + 1);
      options.resetValue(event);
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
