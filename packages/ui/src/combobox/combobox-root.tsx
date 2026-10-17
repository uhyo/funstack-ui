"use client";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type { ReactNode, RefObject } from "react";
import { createActionDetails } from "../internal/action-details.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  StateValue,
  UrgentChangeAction,
} from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useFormReset } from "../internal/use-form-reset.js";
import type { FormAssociatedElement } from "../internal/use-form-reset.js";
import { usePopoverRoot } from "../internal/use-popover-root.js";
import { resolveStateValue } from "../internal/use-render.js";
import { ComboboxContext } from "./combobox-context.js";
import type { ComboboxContextValue, ComboboxOptionEntry } from "./combobox-context.js";

/** Details passed as the second argument of `Combobox.Root`'s `valueChangeAction`. */
export interface ComboboxValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user accepted an option (Enter, click; `details.event` is the `keydown` or
   * `click`), committed free text with `allowCustomValue` (Enter: the `keydown`; focus leaving:
   * the `focusout`), or pressed Clear (`click`).
   * `"platform"`: a form reset (`details.event` is the `reset` event).
   */
  readonly reason: ChangeReason;
  /** `true` when `next` is free text committed under `allowCustomValue`, not an option's value. */
  readonly custom: boolean;
}

/** Details passed as the second argument of `Combobox.Root`'s `inputValueChangeAction`. */
export interface ComboboxInputValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: typing (the `input` event), an accepted option's label, Clear.
   * `"dismiss"`: a revert: focus left with unmatched text, or the selection rolled back.
   * `"platform"`: form reset (the `reset` event), or text found in the input at mount
   * (`undefined`).
   */
  readonly reason: ChangeReason;
}

/** Details passed as the second argument of `Combobox.Root`'s `openChangeAction`. */
export interface ComboboxOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: typing, ArrowDown / ArrowUp / Alt+ArrowDown, the Trigger, a click on the input
   * with `openOnClick`, an accepted option (the close after it), a foreign `showPopover()`.
   * `"dismiss"`: Escape, light dismiss, focus leaving the combobox, another top-layer element.
   * `"platform"`: the popup was found open on mount (only script can cause it).
   */
  readonly reason: ChangeReason;
}

export interface ComboboxRootState {
  /** Optimistic selection. Content rendered from it must not suspend. */
  readonly value: string | null;
  /** The text in the input (urgent). */
  readonly inputValue: string;
  /** The deferred text the mounted results are for. */
  readonly query: string;
  /** `inputValue !== query`: the results shown are for an older text. */
  readonly stale: boolean;
  /** The value of the option `aria-activedescendant` points at, or `null`. */
  readonly activeValue: string | null;
  /** Optimistic open state. */
  readonly open: boolean;
  /** A `valueChangeAction` or `openChangeAction` dispatched through this Combobox is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface ComboboxRootProps {
  /** Controlled selection. `null`: nothing selected. `undefined`: uncontrolled. */
  value?: string | null;
  /** Initial selection in uncontrolled mode. Default `null`. */
  defaultValue?: string | null;
  /**
   * Runs inside the Root's transition when the user accepts an option, commits free text
   * (`allowCustomValue`), presses Clear, or the form resets. Awaited; the listbox closes in the
   * commit that ends it; a rejection rolls the input text and `data-selected` back and leaves
   * the listbox open. May be a Server Function. A `setState` after your own `await` needs
   * `startTransition`.
   */
  valueChangeAction?: ChangeAction<string | null, ComboboxValueChangeDetails>;

  /** Controlled input text. `undefined`: uncontrolled. */
  inputValue?: string;
  /**
   * Initial input text. Default `""`. Pass the selected value's label when `defaultValue` is
   * set: the library never derives the text from the value.
   */
  defaultInputValue?: string;
  /**
   * The urgent lane: called synchronously, outside any Transition, on every change of the text
   * (typing, and the library's own writes: an accepted option's label, a revert, Clear, a form
   * reset, text typed before hydration). Not awaited; nothing is pending for it. A controlled
   * parent updates its state in the body (an urgent update, which is what a controlled text
   * input needs).
   */
  inputValueChangeAction?: UrgentChangeAction<string, ComboboxInputValueChangeDetails>;

  /** Controlled open state. `undefined`: uncontrolled. */
  open?: boolean;
  /** Initial open state when uncontrolled. Opens after hydration. */
  defaultOpen?: boolean;
  /**
   * Awaited for opens and for the close after an accepted option (or the Trigger); a
   * notification for dismissals (Escape, a click outside, focus leaving).
   */
  openChangeAction?: ChangeAction<boolean, ComboboxOpenChangeDetails>;

  /**
   * Free text is a value: Enter with no active option, or focus leaving with text that is not
   * the selected option's label, dispatches the text with `details.custom: true` (empty text
   * dispatches `null`). Default `false`: unmatched text reverts to the selection's label when
   * focus leaves.
   */
  allowCustomValue?: boolean;
  /**
   * Make the first enabled option active when the results for an open or an edit settle (APG
   * "automatic selection"). Stale results are never highlighted. Default `false`.
   */
  autoHighlight?: boolean;
  /** Open the listbox on a pointer click in the input (not on focus). Default `false`. */
  openOnClick?: boolean;
  /** Wrap from the last option to the first and back with the arrow keys. Default `false`. */
  loop?: boolean;
  /**
   * The message `ariaNotify()` announces on the List when the results settle, from the number
   * of mounted options. Default (English): `"No results"`, `"1 result"`, `"N results"`. Override
   * for localisation or a richer message; return `null` to announce nothing. Ignored where
   * `ariaNotify` is missing.
   */
  announce?: (count: number, state: ComboboxRootState) => string | null;

  /** Form participation through a hidden input with this name (value `""` for `null`). */
  name?: string;
  /** The `form` attribute of the hidden input. */
  form?: string;
  /** Disables the Input, Trigger and Clear; nothing dispatches for user interaction. */
  disabled?: boolean;
  children?: StateValue<ReactNode, ComboboxRootState>;
}

/** The default announcement (design 6.4; conventions 11: English, always overridable). */
export function defaultComboboxAnnouncement(count: number): string {
  if (count === 0) return "No results";
  if (count === 1) return "1 result";
  return `${count} results`;
}

const VALUE_TRANSITION_TYPES = ["fsui-combobox", "fsui-combobox-select"] as const;

const isDev = process.env.NODE_ENV !== "production";

function isPopoverOpen(element: Element | null): boolean {
  if (element === null) return false;
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

function isThenable(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** What a value dispatch carries for the Root's own follow-up (by `details` identity). */
interface DispatchMeta {
  readonly id: number;
  /** The open this dispatch belongs to (Popover 3.4): a newer open drops the close. */
  readonly generation: number;
  /** Close the listbox once the action settled (an accepted option, Enter on free text). */
  readonly close: boolean;
  /** The text the library wrote with the dispatch: typing since then keeps the listbox open. */
  readonly text: string | undefined;
}

/** The text the library wrote for a user dispatch, reverted if the value does not land. */
interface TextRecord {
  readonly id: number;
  readonly value: string | null;
  readonly text: string;
  settled: boolean;
}

interface OrderedOption extends ComboboxOptionEntry {
  readonly value: string;
}

/**
 * Owns the two states of a combobox (design/components/combobox.md 2): the selection (`value`,
 * a transition with `useOptimistic`, like every other value) and the text (`inputValue`, the
 * library's **urgent** lane: `inputValueChangeAction` is called synchronously, outside any
 * transition). The results render from `useDeferredValue(inputValue)`; the active option is
 * urgent virtual focus (`aria-activedescendant`); the listbox is a `popover="auto"` opened by the
 * library with the input as `source`. Renders no DOM, except one `<input type="hidden">` when
 * `name` is given.
 */
export function ComboboxRoot(props: ComboboxRootProps) {
  const {
    value,
    defaultValue,
    valueChangeAction,
    inputValue: inputValueProp,
    defaultInputValue,
    open,
    defaultOpen,
    openChangeAction,
    allowCustomValue = false,
    autoHighlight = false,
    openOnClick = false,
    loop = false,
    name,
    form,
    disabled = false,
    children,
  } = props;

  const id = useId();
  const ids = useMemo(
    () => ({
      input: `${id}-input`,
      label: `${id}-label`,
      list: `${id}-list`,
      optionPrefix: `${id}-option-`,
    }),
    [id],
  );

  const popover = usePopoverRoot<ComboboxOpenChangeDetails>({
    component: "combobox",
    part: "Combobox.Root",
    mode: "library",
    open,
    defaultOpen,
    openChangeAction,
  });

  // --- Refs the handlers read after an `await` or from a timer ------------------------------

  const propsRef = useRef(props);
  const popoverRef = useRef(popover);
  useInsertionEffect(() => {
    propsRef.current = props;
    popoverRef.current = popover;
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  // --- Text: the urgent lane (design 4) ------------------------------------------------------

  const [internalText, setInternalText] = useState(() => defaultInputValue ?? inputValueProp ?? "");
  const text = inputValueProp ?? internalText;
  const query = useDeferredValue(text);
  const stale = text !== query;
  const textRef = useRef(text);
  useInsertionEffect(() => {
    textRef.current = text;
  });

  const warnedThenable = useRef(false);
  /** Writes the text (urgent) and calls `inputValueChangeAction` synchronously (design 2.2). */
  const writeText = useCallback(
    (next: string, reason: ChangeReason, event: Event | undefined): void => {
      const latest = propsRef.current;
      if (latest.inputValue === undefined) setInternalText(next);
      textRef.current = next;
      const action = latest.inputValueChangeAction;
      if (action === undefined) return;
      const result: unknown = action(next, createActionDetails(event, { reason }));
      if (isDev && !warnedThenable.current && isThenable(result)) {
        warnedThenable.current = true;
        console.error(
          "Combobox.Root: `inputValueChangeAction` returned a promise. It is the urgent lane: " +
            "called synchronously and never awaited. Put async work in `valueChangeAction`, or " +
            "derive the results from the deferred `query`.",
        );
      }
    },
    [],
  );

  // --- Labels (design 2.3) -------------------------------------------------------------------

  const [labels] = useState(() => {
    const map = new Map<string, string>();
    const initialValue = value !== undefined ? value : (defaultValue ?? null);
    if (initialValue !== null) map.set(initialValue, defaultInputValue ?? inputValueProp ?? "");
    return map;
  });
  const labelFor = useCallback(
    (v: string | null): string => (v === null ? "" : (labels.get(v) ?? "")),
    [labels],
  );

  // --- Selection: a transition (design 3.1, 5.2) --------------------------------------------

  const dispatchSeq = useRef(0);
  const [dispatchMeta] = useState(() => new WeakMap<object, DispatchMeta>());
  const textRecord = useRef<TextRecord | null>(null);
  const committedRef = useRef<string | null>(null);

  const runValueAction = async (
    next: string | null,
    details: ComboboxValueChangeDetails,
  ): Promise<void> => {
    const meta = dispatchMeta.get(details);
    try {
      await valueChangeAction?.(next, details);
    } catch (error) {
      // Walkthrough 4: the text rolls back with the optimistic value. A synchronous throw lands
      // here inside the Root's `startTransition` callback; yield once so the write (and the
      // consumer's `inputValueChangeAction`) is urgent, as every text write (conventions 2.6).
      await undefined;
      const record = textRecord.current;
      if (meta !== undefined && record !== null && record.id === meta.id) {
        textRecord.current = null;
        if (textRef.current === record.text) {
          writeText(labelFor(committedRef.current), "dismiss", undefined);
        }
      }
      throw error;
    }
    const record = textRecord.current;
    if (meta !== undefined && record !== null && record.id === meta.id) record.settled = true;
    // Menu decision 3: close in the commit that ends the action, unless a newer dispatch took
    // over, the user dismissed and re-opened meanwhile, or the user is typing a new search.
    const current = popoverRef.current;
    if (
      meta !== undefined &&
      meta.close &&
      meta.id === dispatchSeq.current &&
      current.openGeneration() === meta.generation &&
      (meta.text === undefined || textRef.current === meta.text)
    ) {
      current.requestClose(details.event, "activate");
    }
  };

  const selection = useControllableAction<string | null, ComboboxValueChangeDetails>({
    controlled: value,
    defaultValue,
    initialValue: null,
    action: runValueAction,
    transitionTypes: () => VALUE_TRANSITION_TYPES,
    warn: { component: "Combobox.Root", prop: "value" },
  });
  useInsertionEffect(() => {
    committedRef.current = selection.committed;
  });

  const dispatchValue = (
    next: string | null,
    event: Event | undefined,
    fields: { reason: ChangeReason; custom: boolean },
    options: { close: boolean; text: string | undefined },
  ): void => {
    const details = createActionDetails(event, fields);
    const dispatchId = ++dispatchSeq.current;
    dispatchMeta.set(details, {
      id: dispatchId,
      generation: popover.openGeneration(),
      close: options.close,
      text: options.text,
    });
    textRecord.current =
      options.text === undefined
        ? null
        : { id: dispatchId, value: next, text: options.text, settled: false };
    selection.dispatch(next, details);
  };

  // --- Option registry and the active option (design 2, 6.5) --------------------------------

  const [registry] = useState(() => new Map<string, ComboboxOptionEntry>());
  const [optionCount, setOptionCount] = useState(0);
  const [statusCount, setStatusCount] = useState(0);
  // The same count for the announcement effect: the open commit's passive effects can run before
  // the re-render the Status's registration scheduled (the race `registry` avoids for options).
  const statusCountRef = useRef(0);
  const [labelCount, setLabelCount] = useState(0);
  const warnedDuplicate = useRef(false);

  const registerOption = useCallback(
    (optionValue: string, entry: ComboboxOptionEntry) => {
      const existing = registry.get(optionValue);
      if (
        isDev &&
        !warnedDuplicate.current &&
        existing !== undefined &&
        existing.element !== entry.element &&
        existing.element.isConnected
      ) {
        warnedDuplicate.current = true;
        console.error(
          `Combobox.Option: two options have the value ${JSON.stringify(optionValue)}. ` +
            "Option ids are derived from the value, so they must be unique within one Combobox.",
        );
      }
      registry.set(optionValue, entry);
      labels.set(optionValue, entry.label ?? (entry.element.textContent ?? "").trim());
      setOptionCount(registry.size);
      return () => {
        if (registry.get(optionValue) === entry) registry.delete(optionValue);
        setOptionCount(registry.size);
      };
    },
    [registry, labels],
  );

  const registerStatus = useCallback(() => {
    statusCountRef.current += 1;
    setStatusCount((count) => count + 1);
    return () => {
      statusCountRef.current -= 1;
      setStatusCount((count) => count - 1);
    };
  }, []);

  const registerLabel = useCallback(() => {
    setLabelCount((count) => count + 1);
    return () => setLabelCount((count) => count - 1);
  }, []);

  const [activeValue, setActiveValue] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const setActive = useCallback((next: string | null) => {
    activeRef.current = next;
    setActiveValue(next);
  }, []);
  // The edge to activate once the open has options (ArrowDown / ArrowUp while closed).
  const pendingEdge = useRef<"first" | "last" | null>(null);
  // `autoHighlight` (APG automatic selection) highlights once per open and once per edit, when
  // the results for it settle. Home / End / Left / Right clear the active option without
  // re-arming it, so the caret keys really return visual focus to the input.
  const autoArmed = useRef(true);

  const orderedOptions = useCallback((): OrderedOption[] => {
    const options: OrderedOption[] = [];
    for (const [optionValue, entry] of registry) options.push({ value: optionValue, ...entry });
    options.sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    return options;
  }, [registry]);

  // A Status inside the List is a Suspense fallback: the results are loading (design 6.3).
  const loading = statusCount > 0;
  const empty = optionCount === 0 && !stale && !loading;

  // Revalidation (design 6.5): urgent, in a layout effect after every commit; never dispatches.
  useLayoutEffect(() => {
    const current = activeRef.current;
    if (!popover.committed) {
      // Keep the edge of an open that is on its way (the optimistic commit comes first).
      if (!popover.intended()) pendingEdge.current = null;
      autoArmed.current = true;
      if (current !== null) setActive(null);
      return;
    }
    const enabled = orderedOptions().filter((option) => !option.disabled);
    let next = current;
    if (pendingEdge.current !== null && enabled.length > 0) {
      next = (pendingEdge.current === "first" ? enabled[0] : enabled.at(-1))!.value;
      pendingEdge.current = null;
    } else if (next !== null && !enabled.some((option) => option.value === next)) {
      next = null;
    }
    if (next !== null) {
      // Something is active (keys, hover): nothing to highlight for these results.
      autoArmed.current = false;
    } else if (autoHighlight && autoArmed.current && !stale && enabled.length > 0) {
      // Only settled results: a stale list's first option is never auto-highlighted, so a fast
      // Enter commits the typed text or does nothing (design L5).
      next = enabled[0]!.value;
      autoArmed.current = false;
    }
    if (next !== current) setActive(next);
  });

  // The selection did not land (a controlled parent refused it, or the caught-inside variant of
  // a controlled parent): the text goes back to the committed value's label (design 2.2).
  // Labels for values set from outside are learnt from the text the consumer passed with them.
  const prevCommitted = useRef(selection.committed);
  useLayoutEffect(() => {
    const record = textRecord.current;
    if (
      record !== null &&
      record.settled &&
      !selection.pending &&
      selection.latestInFlight() === null
    ) {
      textRecord.current = null;
      if (selection.committed !== record.value && textRef.current === record.text) {
        writeText(labelFor(selection.committed), "dismiss", undefined);
      }
    }
    if (prevCommitted.current !== selection.committed) {
      prevCommitted.current = selection.committed;
      const committed = selection.committed;
      if (committed !== null && textRecord.current === null && !labels.has(committed)) {
        labels.set(committed, textRef.current);
      }
    }
  });

  // --- Announcements (design 6.4) -----------------------------------------------------------

  const state: ComboboxRootState = {
    value: selection.optimistic,
    inputValue: text,
    query,
    stale,
    activeValue,
    open: popover.optimistic,
    pending: selection.pending || popover.pending,
    disabled,
  };

  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (!popover.committed) {
      lastAnnounced.current = null;
      return;
    }
    if (stale || statusCountRef.current > 0) return;
    // The registry, not `optionCount`: a commit's passive effects can run before the re-render
    // that the Options' registration scheduled.
    const count = registry.size;
    const key = `${count}\u0000${query}`;
    if (lastAnnounced.current === key) return;
    lastAnnounced.current = key;
    const list = listRef.current as (HTMLElement & { ariaNotify?: (m: string) => void }) | null;
    if (list === null || typeof list.ariaNotify !== "function") return;
    const announce = propsRef.current.announce ?? defaultComboboxAnnouncement;
    const message = announce(count, state);
    if (message !== null) list.ariaNotify(message);
  });

  // --- Form: hidden input, reset, mount reconciliation (design 11.1, walkthroughs 10, 11) ----

  const [mountValue] = useState(value);
  const [mountText] = useState(inputValueProp);
  // Reset targets (conventions 3.8 rule 6): uncontrolled, the latest default props; controlled,
  // the mount-time values.
  const valueResetTarget = value !== undefined ? (mountValue ?? null) : (defaultValue ?? null);
  const inputDefaultValue =
    inputValueProp !== undefined ? (mountText ?? "") : (defaultInputValue ?? "");
  // After a form reset a controlled parent may not adopt the text: put React's value back into
  // the DOM (react-dom only does that after its own input events).
  const [resync, setResync] = useState(0);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (resync > 0 && input !== null && input.value !== textRef.current) {
      input.value = textRef.current;
    }
  }, [resync]);

  const formElement = useMemo<RefObject<FormAssociatedElement | null>>(
    () => ({
      get current() {
        return hiddenRef.current ?? inputRef.current;
      },
      set current(_ignored) {},
    }),
    [],
  );
  useFormReset(
    formElement,
    (event) => {
      const input = inputRef.current;
      const domText = input?.value ?? inputDefaultValue;
      if (domText !== textRef.current) writeText(domText, "platform", event);
      // A controlled parent that does not adopt the text gets the DOM re-synced.
      setResync((n) => n + 1);
      if (valueResetTarget !== selection.optimistic) {
        dispatchValue(
          valueResetTarget,
          event,
          { reason: "platform", custom: false },
          { close: false, text: undefined },
        );
      }
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
  }, [writeText]);

  const [missingText] = useState(
    () =>
      (value ?? defaultValue ?? null) !== null &&
      inputValueProp === undefined &&
      defaultInputValue === undefined,
  );
  useDevWarning(
    missingText,
    "Combobox.Root: `value` / `defaultValue` is set but neither `inputValue` nor " +
      "`defaultInputValue` is: the input will show no text for the selection. The library never " +
      "derives the text from the value; pass the selected option's label as well.",
  );

  // --- Interaction (design 5, 8) -------------------------------------------------------------

  const accept = (optionValue: string, event: Event): void => {
    if (disabled) return;
    const entry = registry.get(optionValue);
    if (entry === undefined || entry.disabled) return;
    const label = entry.label ?? (entry.element.textContent ?? "").trim();
    labels.set(optionValue, label);
    pendingEdge.current = null;
    if (activeRef.current !== optionValue) setActive(optionValue);
    writeText(label, "activate", event);
    // Re-accepting the selected option dispatches nothing and closes (conventions 2.3 item 8).
    if (optionValue === selection.optimistic) {
      popover.requestClose(event, "activate");
      return;
    }
    dispatchValue(
      optionValue,
      event,
      { reason: "activate", custom: false },
      { close: true, text: label },
    );
  };

  /** Free text as the value (design 5.3). Returns whether it dispatched. */
  const commitText = (event: Event, close: boolean): boolean => {
    const current = selection.optimistic;
    const typed = textRef.current;
    if (typed === labelFor(current)) return false;
    const next = typed === "" ? null : typed;
    if (next === current) return false;
    if (next !== null) labels.set(next, typed);
    dispatchValue(
      next,
      event,
      { reason: "activate", custom: next !== null },
      { close, text: typed },
    );
    return true;
  };

  const clear = (event: Event): void => {
    if (disabled) return;
    if (textRef.current !== "") writeText("", "activate", event);
    if (selection.optimistic !== null) {
      dispatchValue(null, event, { reason: "activate", custom: false }, { close: false, text: "" });
    }
    inputRef.current?.focus();
  };

  const typed = (next: string, event: Event): void => {
    if (disabled) return;
    writeText(next, "activate", event);
    pendingEdge.current = null;
    // APG: editing moves visual focus back to the input; `autoHighlight` picks the first option
    // again once the results for the new text settle.
    if (activeRef.current !== null) setActive(null);
    autoArmed.current = true;
    popover.requestOpen(event, "activate");
  };

  const move = (direction: 1 | -1): void => {
    const enabled = orderedOptions().filter((option) => !option.disabled);
    if (enabled.length === 0) return;
    const last = enabled.length - 1;
    const index = enabled.findIndex((option) => option.value === activeRef.current);
    let next: number;
    if (direction === 1) next = index < 0 ? 0 : index >= last ? (loop ? 0 : last) : index + 1;
    else next = index < 0 ? last : index <= 0 ? (loop ? last : 0) : index - 1;
    const target = enabled[next]!;
    setActive(target.value);
    if (typeof target.element.scrollIntoView === "function") {
      target.element.scrollIntoView({ block: "nearest" });
    }
  };

  const activeEnabled = (): string | null => {
    const current = activeRef.current;
    if (current === null) return null;
    const entry = registry.get(current);
    return entry !== undefined && !entry.disabled ? current : null;
  };

  const keyDown = (event: KeyboardEvent): boolean => {
    if (disabled || event.ctrlKey || event.metaKey) return false;
    // IME: the key belongs to the composition (Enter commits it, arrows pick a candidate).
    if (event.isComposing || event.keyCode === 229) return false;
    // What the user sees, not what is intended: right after Escape the platform has hidden the
    // popup but its `toggle` (and the library's notification) is still queued, and an open that
    // is still committing shows nothing yet. Enter must submit and arrows must open in both.
    const isOpen = isPopoverOpen(popover.popupRef.current);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (event.altKey) {
          if (!isOpen) popover.requestOpen(event, "activate");
        } else if (!isOpen) {
          pendingEdge.current = "first";
          popover.requestOpen(event, "activate");
        } else {
          move(1);
        }
        return true;
      case "ArrowUp":
        event.preventDefault();
        if (event.altKey) {
          if (isOpen) {
            const active = activeEnabled();
            if (active !== null) accept(active, event);
            else popover.requestClose(event, "activate");
          }
        } else if (!isOpen) {
          pendingEdge.current = "last";
          popover.requestOpen(event, "activate");
        } else {
          move(-1);
        }
        return true;
      case "Enter": {
        if (isOpen) {
          // An open listbox means the user is choosing: never submit from here.
          event.preventDefault();
          const active = activeEnabled();
          if (active !== null) accept(active, event);
          else if (allowCustomValue && !commitText(event, true)) {
            popover.requestClose(event, "activate");
          }
          return true;
        }
        // Closed: not prevented, so a form still submits. The key's default action (implicit
        // submission) must see the optimistic hidden value: Firefox submits before React's
        // scheduled flush of the optimistic render, so it is flushed here (design 5.3).
        if (allowCustomValue) flushSync(() => commitText(event, false));
        return false;
      }
      case "Home":
      case "End":
      case "ArrowLeft":
      case "ArrowRight":
        // APG: the caret keys move visual focus to the input (not prevented: the caret moves).
        if (activeRef.current !== null) setActive(null);
        return false;
      default:
        return false;
    }
  };

  /** Focus has left the input and the popup (design 5.4). */
  const leave = (event: Event): void => {
    // `disabled`: nothing dispatches (disabling a focused input blurs it).
    if (disabled) return;
    const popup = popover.popupRef.current;
    if (popup !== null && isPopoverOpen(popup)) {
      popover.recordCloseIntent({ reason: "dismiss", event });
      popup.hidePopover();
    }
    pendingEdge.current = null;
    if (allowCustomValue) {
      commitText(event, false);
      return;
    }
    const label = labelFor(selection.optimistic);
    if (textRef.current !== label) writeText(label, "dismiss", event);
  };
  const leaveRef = useRef(leave);
  useInsertionEffect(() => {
    leaveRef.current = leave;
  });

  const focusOut = (event: FocusEvent): void => {
    const input = inputRef.current;
    const popup = popover.popupRef.current;
    const next = event.relatedTarget;
    if (next instanceof Node) {
      if (next === input || (popup !== null && popup.contains(next))) return;
      leave(event);
      return;
    }
    // No related target: the window lost focus (nothing to do), or a click landed on something
    // that takes no focus (the page itself: focus moved to <body>). Decide after the click.
    if (input === null) return;
    const doc = input.ownerDocument;
    setTimeout(() => {
      if (!doc.hasFocus()) return;
      const active = doc.activeElement;
      if (active === input || (active !== null && popup !== null && popup.contains(active))) {
        return;
      }
      if (input.isConnected) leaveRef.current(event);
    }, 0);
  };

  const inputClick = (event: MouseEvent): void => {
    if (disabled || !openOnClick) return;
    popover.requestOpen(event, "activate");
  };

  const context: ComboboxContextValue = {
    popover,
    ids,
    value: selection.optimistic,
    valuePending: selection.pending,
    pending: state.pending,
    inputValue: text,
    query,
    stale,
    activeValue,
    empty,
    loading,
    hasLabel: labelCount > 0,
    disabled,
    inputRef,
    listRef,
    registerOption,
    registerStatus,
    registerLabel,
    setActive,
    accept,
    clear,
    typed,
    keyDown,
    focusOut,
    inputClick,
  };

  return (
    <ComboboxContext value={context}>
      {name !== undefined && (
        <input
          ref={hiddenRef}
          type="hidden"
          name={name}
          form={form}
          value={selection.optimistic ?? ""}
        />
      )}
      {resolveStateValue(children, state)}
    </ComboboxContext>
  );
}

ComboboxRoot.displayName = "ComboboxRoot";
