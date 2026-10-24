"use client";
import {
  use,
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
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createActionDetails } from "../internal/action-details.js";
import type { AriaNotifyTarget } from "../internal/announce.js";
import { FieldContext } from "../internal/field-context.js";
import { isPopoverOpen } from "../internal/popover-open.js";
import { useFieldValueChange } from "../internal/use-field-control.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  StateValue,
  UrgentChangeHandler,
} from "../internal/types.js";
import { transitionTypes } from "../internal/transition-types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useLatest } from "../internal/use-latest.js";
import { popoverDetails, useOverlayRoot } from "../internal/use-overlay-root.js";
import { resolveStateValue } from "../internal/use-render.js";
import { ComboboxContext } from "./combobox-context.js";
import { useComboboxForm } from "./use-combobox-form.js";
import { useOptionRegistry } from "./use-option-registry.js";
import type { ComboboxContextValue } from "./combobox-context.js";

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

/** Details passed as the second argument of `Combobox.Root`'s `onInputValueChange`. */
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
   * The urgent lane, a handler and not an action: called synchronously, outside any Transition,
   * on every change of the text (typing, and the library's own writes: an accepted option's
   * label, a revert, Clear, a form reset, text typed before hydration). Not awaited; nothing is
   * pending for it. A controlled parent updates its state in the body (an urgent update, which is
   * what a controlled text input needs). A returned promise is ignored (development warns once: a
   * fetch belongs in a transition).
   */
  onInputValueChange?: UrgentChangeHandler<string, ComboboxInputValueChangeDetails>;

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
function defaultComboboxAnnouncement(count: number): string {
  if (count === 0) return "No results";
  if (count === 1) return "1 result";
  return `${count} results`;
}

const VALUE_TRANSITION_TYPES = transitionTypes("combobox", "select");

const isDev = process.env.NODE_ENV !== "production";

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

/**
 * Owns the two states of a combobox (design/components/combobox.md 2): the selection (`value`,
 * a transition with `useOptimistic`, like every other value) and the text (`inputValue`, the
 * library's **urgent** lane: the `onInputValueChange` handler is called synchronously, outside
 * any transition). The results render from `useDeferredValue(inputValue)`; the active option is
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
    form,
    children,
  } = props;

  // Inside a Field.Root (design/components/field-form.md 7.2): the Input is the Field's control
  // (its id is the Field's, so `Field.Label` points at it), the hidden input's `name` and
  // `disabled` default from the Field, and the List is named by `Field.Label` when no
  // `Combobox.Label` is mounted.
  const field = use(FieldContext);
  const name = props.name ?? field?.name;
  const disabled = (props.disabled ?? false) || (field?.disabled ?? false);
  const fieldControlId = field?.ids.control;

  const id = useId();
  const ids = useMemo(
    () => ({
      input: fieldControlId ?? `${id}-input`,
      label: `${id}-label`,
      list: `${id}-list`,
      optionPrefix: `${id}-option-`,
    }),
    [id, fieldControlId],
  );

  const popover = useOverlayRoot<ComboboxOpenChangeDetails>({
    component: "combobox",
    part: "Combobox.Root",
    mode: "library",
    open,
    defaultOpen,
    openChangeAction,
    details: popoverDetails,
  });

  // --- Refs the handlers read after an `await` or from a timer ------------------------------

  const propsRef = useLatest(props);
  const popoverRef = useLatest(popover);

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
  /** Writes the text (urgent) and calls `onInputValueChange` synchronously (design 2.2). */
  const writeText = useCallback(
    (next: string, reason: ChangeReason, event: Event | undefined): void => {
      const latest = propsRef.current;
      if (latest.inputValue === undefined) setInternalText(next);
      textRef.current = next;
      const handler = latest.onInputValueChange;
      if (handler === undefined) return;
      const result: unknown = handler(next, createActionDetails(event, { reason }));
      if (isDev && !warnedThenable.current && isThenable(result)) {
        warnedThenable.current = true;
        console.error(
          "Combobox.Root: `onInputValueChange` returned a promise. It is the urgent lane: it is " +
            "not awaited. Fetch in a transition instead (`valueChangeAction`, or " +
            "`useDeferredValue` of `inputValue`).",
        );
      }
    },
    [propsRef],
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
      // consumer's `onInputValueChange`) is urgent, as every text write (conventions 2.6).
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
  // Read by `runValueAction` above, which only runs after a commit.
  const committedRef = useLatest(selection.committed);

  /** The next change of the optimistic selection comes from the user (a dispatch). */
  const userEdit = useRef(false);
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
    if (next !== selection.optimistic) userEdit.current = true;
    selection.dispatch(next, details);
  };

  // Inside a Field: React writes the hidden input with no `input` / `change` event, so the Field
  // is told after the commit (its `validate` reads the hidden input; a user's pick dismisses a
  // shown server error like typing would).
  useFieldValueChange(selection.optimistic, () => {
    const edit = userEdit.current;
    userEdit.current = false;
    return edit;
  });

  // --- Option registry and the active option (design 2, 6.5) --------------------------------

  const {
    registry,
    optionCount,
    statusCount,
    statusCountRef,
    labelCount,
    registerOption,
    registerStatus,
    registerLabel,
    orderedOptions,
  } = useOptionRegistry(labels);

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
      // Enter commits the typed text or does nothing (design 6.5).
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
    const list = listRef.current as (HTMLElement & AriaNotifyTarget) | null;
    if (list === null || typeof list.ariaNotify !== "function") return;
    const announce = propsRef.current.announce ?? defaultComboboxAnnouncement;
    const message = announce(count, state);
    if (message !== null) list.ariaNotify(message);
  });

  // --- Form: hidden input, reset, mount reconciliation (design 11.1, walkthroughs 10 and 11) ---

  useComboboxForm({
    value,
    defaultValue,
    inputValue: inputValueProp,
    defaultInputValue,
    inputRef,
    hiddenRef,
    textRef,
    writeText,
    optimistic: selection.optimistic,
    resetValue: (next, event) =>
      dispatchValue(
        next,
        event,
        { reason: "platform", custom: false },
        { close: false, text: undefined },
      ),
  });

  const [missingText] = useState(
    () =>
      (value ?? defaultValue ?? null) !== null &&
      inputValueProp === undefined &&
      defaultInputValue === undefined,
  );
  useDevWarning(
    missingText,
    isDev &&
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
  const leaveRef = useLatest(leave);

  // A press blurs the input at `mousedown`, but its outcome is known only at the `click`, which
  // runs in the `pointerup` task: a `<label for>` (Combobox.Label, Field.Label) refocuses the
  // input there (#111). While a pointer is down, a leave check waits for its release.
  const pressing = useRef(false);
  const afterPress = useRef<(() => void) | null>(null);
  useEffect(() => {
    const doc = inputRef.current?.ownerDocument ?? document;
    const down = () => {
      pressing.current = true;
    };
    const up = () => {
      pressing.current = false;
      const check = afterPress.current;
      afterPress.current = null;
      if (check !== null) setTimeout(check, 0);
    };
    doc.addEventListener("pointerdown", down, true);
    doc.addEventListener("pointerup", up, true);
    doc.addEventListener("pointercancel", up, true);
    return () => {
      doc.removeEventListener("pointerdown", down, true);
      doc.removeEventListener("pointerup", up, true);
      doc.removeEventListener("pointercancel", up, true);
    };
  }, []);

  const focusOut = (event: FocusEvent): void => {
    const input = inputRef.current;
    const popup = popover.popupRef.current;
    const next = event.relatedTarget;
    if (next instanceof Node) {
      if (next === input || (popup !== null && popup.contains(next))) return;
      leave(event);
      return;
    }
    // No related target: the window lost focus (nothing to do), or a press landed on something
    // that takes no focus (a label, the page itself: focus moved to <body>). Decide one task
    // after the press is released (its click has run then), or one task later without a press.
    if (input === null) return;
    const doc = input.ownerDocument;
    const check = () => {
      if (!doc.hasFocus()) return;
      const active = doc.activeElement;
      if (active === input || (active !== null && popup !== null && popup.contains(active))) {
        return;
      }
      if (input.isConnected) leaveRef.current(event);
    };
    if (pressing.current) afterPress.current = check;
    else setTimeout(check, 0);
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
    fieldLabelId: field?.ids.label,
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
