"use client";
import { useCallback, useDeferredValue, useInsertionEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import { callUrgentHandler } from "../internal/action/call-urgent-handler.js";
import type { ChangeReason, UrgentChangeHandler } from "../internal/types.js";
import { useLatest } from "../internal/use-latest.js";
import type { ComboboxInputValueChangeDetails } from "./combobox-root.js";

export interface ComboboxTextOptions {
  /** The Root's props of the text. */
  readonly inputValue: string | undefined;
  readonly defaultInputValue: string | undefined;
  readonly onInputValueChange:
    | UrgentChangeHandler<string, ComboboxInputValueChangeDetails>
    | undefined;
}

export interface ComboboxText {
  /** The text in the input (urgent): the controlled `inputValue`, else the internal text. */
  readonly text: string;
  /** `useDeferredValue(text)`: the text the mounted results are for. */
  readonly query: string;
  /** `text !== query`. */
  readonly stale: boolean;
  /** The latest text, for handlers, effects and code after an `await`. */
  readonly textRef: RefObject<string>;
  /** Writes the text and calls `onInputValueChange` (design 2.2). */
  readonly writeText: (next: string, reason: ChangeReason, event: Event | undefined) => void;
}

/**
 * The text of a combobox, the library's urgent lane (design/components/combobox.md 2.2 and 4):
 * the controlled or internal `inputValue`, its deferred `query`, and the write that calls
 * `onInputValueChange` synchronously, outside any transition.
 */
export function useComboboxText({
  inputValue,
  defaultInputValue,
  onInputValueChange,
}: ComboboxTextOptions): ComboboxText {
  const latest = useLatest({ inputValue, onInputValueChange });

  const [internalText, setInternalText] = useState(() => defaultInputValue ?? inputValue ?? "");
  const text = inputValue ?? internalText;
  const query = useDeferredValue(text);
  const stale = text !== query;
  const textRef = useRef(text);
  useInsertionEffect(() => {
    textRef.current = text;
  });

  /**
   * Writes the text (urgent) and calls `onInputValueChange` synchronously (design 2.2), under the
   * handler rule (`callUrgentHandler`: a throw or a returned promise's rejection goes to
   * `reportError`, the write above stands).
   */
  const writeText = useCallback(
    (next: string, reason: ChangeReason, event: Event | undefined): void => {
      const props = latest.current;
      if (props.inputValue === undefined) setInternalText(next);
      textRef.current = next;
      const handler = props.onInputValueChange;
      if (handler === undefined) return;
      callUrgentHandler(handler, next, createActionDetails(event, { reason }));
    },
    [latest],
  );

  return { text, query, stale, textRef, writeText };
}
