"use client";
import {
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import { announce, canAnnounce } from "../internal/announce.js";
import { FieldContext } from "../internal/form/field-context.js";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import { capturePointer } from "../internal/pointer-capture.js";
import { resolveFieldDefaults, useFieldValueChange } from "../internal/form/use-field-control.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  StateValue,
  UrgentChangeHandler,
} from "../internal/types.js";
import { transitionTypes } from "../internal/transition-types.js";
import { useControllableAction } from "../internal/action/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useLatest } from "../internal/use-latest.js";
import { popoverDetails, usePopoverRoot } from "../internal/overlay/use-overlay-root.js";
import { resolveStateValue } from "../internal/use-render.js";
import { sortByDocumentOrder } from "../internal/dom-order.js";
import { useResetTarget } from "../internal/form/use-form-reset.js";
import { useMountFixed } from "../internal/use-mount-fixed.js";
import { toSet } from "../internal/value-set.js";
import type { SetPatch } from "../internal/value-set.js";
import { ComboboxContext } from "./combobox-context.js";
import { chipText } from "./chip-text.js";
import { useActiveOption } from "./use-active-option.js";
import { useComboboxForm } from "./use-combobox-form.js";
import { createComboboxKeyDown } from "./combobox-keyboard.js";
import type { ComboboxMultipleKeys } from "./combobox-keyboard.js";
import { useComboboxText } from "./use-combobox-text.js";
import { useDeferredLeave } from "./use-deferred-leave.js";
import { useMultipleSelection } from "./use-multiple-selection.js";
import { useOptionRegistry } from "./use-option-registry.js";
import type {
  ComboboxChipEntry,
  ComboboxChipsValue,
  ComboboxContextValue,
} from "./combobox-context.js";

const NO_LABELS: ReadonlyMap<string, string> = new Map();

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

/** Details passed as the second argument of `Combobox.Root`'s `openChangeAction` and `onOpenChange`. */
export interface ComboboxOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: typing, ArrowDown / ArrowUp / Alt+ArrowDown, the Trigger, a click on the input
   * with `openOnClick`, an accepted option (the close after it), Alt+ArrowUp, a foreign
   * `showPopover()`; with `multiple`, a chip taking focus while an open is on its way (the cancel).
   * `"dismiss"`: Escape, light dismiss, focus leaving the combobox, another top-layer element.
   * `"platform"`: the popup was found open on mount (only script can cause it).
   */
  readonly reason: ChangeReason;
}

/** State of `Combobox.Root`, passed to the function forms of `announce` and `children`. */
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
  /** The `disabled` prop, or the enclosing Field's. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `valueChangeAction` with `multiple` (design 15.2). */
export interface ComboboxMultipleValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user toggled an option (Enter, click), added free text
   * (`allowCustomValue`), removed a chip (Backspace or Delete: the `keydown`; `ChipRemove`: the
   * `click`) or pressed Clear.
   * `"platform"`: a form reset (`details.event` is the `reset` event).
   */
  readonly reason: ChangeReason;
  /** Values this dispatch added, in the order they join the value. */
  readonly added: readonly string[];
  /** Values this dispatch removed, in value order. */
  readonly removed: readonly string[];
  /** `true` when `added` is free text committed under `allowCustomValue`. */
  readonly custom: boolean;
}

/** State of `Combobox.Root multiple`: as `ComboboxRootState`, with the selection as a list. */
export interface ComboboxMultipleRootState extends Omit<ComboboxRootState, "value"> {
  /** Optimistic selection, in pick order. Content rendered from it must not suspend. */
  readonly value: readonly string[];
}

/** The props `Combobox.Root` has in both modes (design 15.2). */
export interface ComboboxRootBaseProps {
  /** Controlled input text. `undefined`: uncontrolled. */
  inputValue?: string;
  /**
   * Initial input text. Single selection: pass the selected value's label when `defaultValue`
   * is set (the library never derives the text from the value). With `multiple` the text is only
   * a search and usually starts empty; the chips show the selection.
   *
   * @defaultValue `""`
   */
  defaultInputValue?: string;
  /**
   * The urgent lane, a handler and not an action: called synchronously, outside any Transition,
   * on every change of the text (typing, and the library's own writes: an accepted option's
   * label, a revert, Clear, a form reset, text typed before hydration). Not awaited; nothing is
   * pending for it. A controlled parent updates its state in the body (an urgent update, which is
   * what a controlled text input needs). It may return a promise; a rejection, like a throw,
   * goes to `reportError` (the rule of every `on*` handler). A fetch that results should render
   * belongs in a transition (`useDeferredValue` of `inputValue`).
   */
  onInputValueChange?: UrgentChangeHandler<string, ComboboxInputValueChangeDetails>;

  /** Controlled open state. `undefined`: uncontrolled. */
  open?: boolean;
  /**
   * Initial open state when uncontrolled. Opens after hydration.
   *
   * @defaultValue `false`
   */
  defaultOpen?: boolean;
  /**
   * Requests only: awaited for opens and for the close after an accepted option (or the
   * Trigger, or Alt+ArrowUp; with `multiple`, the cancel of an open still on its way when a
   * chip takes focus). Never called for a dismissal: that goes to `onOpenChange`.
   */
  openChangeAction?: ChangeAction<boolean, ComboboxOpenChangeDetails>;
  /**
   * Facts only: the listbox was closed without the library closing it on request (Escape, focus
   * leaving the input, a click outside, Clear while open, a foreign invoker, script). Always
   * `false`. Called synchronously, outside any Transition, and not awaited: nothing is pending.
   * Controlled: set your state **directly** here (`onOpenChange={setOpen}`); a parent that keeps
   * `open={true}` gets the listbox re-opened. May return a promise; a rejection or a throw goes
   * to `reportError`.
   */
  onOpenChange?: UrgentChangeHandler<boolean, ComboboxOpenChangeDetails>;

  /**
   * Free text is a value: Enter with no active option, or focus leaving with text that is not
   * the selected option's label, dispatches the text with `details.custom: true` (empty text
   * dispatches `null`). When `false`, unmatched text reverts to the selection's label when focus
   * leaves. With `multiple`: Enter with no active option (the key prevented, listbox open or
   * closed) or focus leaving **adds** the text as a value (`added: [text]`, `custom: true`) and
   * clears it; text already selected adds nothing. When `false`, unmatched text is cleared.
   *
   * @defaultValue `false`
   */
  allowCustomValue?: boolean;
  /**
   * Make the first enabled option active when the results for an open or an edit settle (APG
   * "automatic selection"). Stale results are never highlighted.
   *
   * @defaultValue `false`
   */
  autoHighlight?: boolean;
  /**
   * Open the listbox on a pointer click in the input (not on focus).
   *
   * @defaultValue `false`
   */
  openOnClick?: boolean;
  /**
   * Wrap from the last option to the first and back with the arrow keys.
   *
   * @defaultValue `false`
   */
  loop?: boolean;

  /**
   * Form participation through a hidden input with this name (value `""` for `null`); with
   * `multiple`, one hidden input per value (nothing posted for an empty selection).
   */
  name?: string;
  /** The `form` attribute of the hidden input(s). */
  form?: string;
  /**
   * Disables the Input, Trigger and Clear (and, with `multiple`, every `ChipRemove`); nothing
   * dispatches for user interaction.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
}

/**
 * Props of `Combobox.Root` with a single selection (the default): `value` is `string | null`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export interface ComboboxSingleProps extends ComboboxRootBaseProps {
  /**
   * `true` switches to multiple selection (see `ComboboxMultipleProps`). Fixed at mount.
   *
   * @defaultValue `false`
   */
  multiple?: false;
  /** Controlled selection. `null`: nothing selected. `undefined`: uncontrolled. */
  value?: string | null;
  /**
   * Initial selection in uncontrolled mode.
   *
   * @defaultValue `null`
   */
  defaultValue?: string | null;
  /**
   * Runs inside the Root's transition when the user accepts an option, commits free text
   * (`allowCustomValue`), presses Clear, or the form resets. Awaited; the listbox closes in the
   * commit that ends it; a rejection rolls the input text and `data-selected` back and leaves
   * the listbox open. May be a Server Function. A `setState` after your own `await` needs
   * `startTransition`.
   */
  valueChangeAction?: ChangeAction<string | null, ComboboxValueChangeDetails>;
  /**
   * The message `ariaNotify()` announces on the List when the results settle, from the number
   * of mounted options. Override for localisation or a richer message; return `null` to announce
   * nothing. Ignored where `ariaNotify` is missing.
   *
   * @defaultValue English: `"No results"`, `"1 result"`, `"N results"`
   */
  announce?: (count: number, state: ComboboxRootState) => string | null;
  /** `multiple` only: a type error here (the union's excess-property check would let it through). */
  announceRemoved?: never;
  /** The parts, or a function of the Root's state. */
  children?: StateValue<ReactNode, ComboboxRootState>;
}

/**
 * Props of `Combobox.Root multiple`: the selection is a list of values shown as chips
 * (`Combobox.Chips`). A pick toggles the option, clears the text and leaves the listbox open.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export interface ComboboxMultipleProps extends ComboboxRootBaseProps {
  /** The selection is a list of values, shown as chips. Fixed at mount. */
  multiple: true;
  /**
   * Controlled selection. `[]`: nothing selected. `undefined`: uncontrolled. The order is the
   * chip order; duplicates are ignored.
   */
  value?: string[];
  /**
   * Initial selection in uncontrolled mode; also the form-reset target (the latest value).
   *
   * @defaultValue `[]`
   */
  defaultValue?: string[];
  /**
   * Runs inside the Root's transition for every change of the selection. `next` is the whole
   * intended selection as a fresh array; `details.added` / `details.removed` say what this
   * dispatch changed. Awaited; a rejection rolls this change back (the chip, `data-selected`)
   * and nothing else. May be a Server Function. Persist the diff, not `next`: `next` can contain
   * an earlier change that fails later.
   */
  valueChangeAction?: ChangeAction<string[], ComboboxMultipleValueChangeDetails>;
  /**
   * The message `ariaNotify()` announces on the Input when chips are removed outside the
   * listbox (Backspace, Delete, `ChipRemove`, Clear), from the removed chips' labels. Return
   * `null` to announce nothing. Ignored where `ariaNotify` is missing.
   *
   * @defaultValue English: the labels joined with `", "`, then `" removed"`
   */
  announceRemoved?: (labels: readonly string[], state: ComboboxMultipleRootState) => string | null;
  /** See {@link ComboboxSingleProps.announce}. */
  announce?: (count: number, state: ComboboxMultipleRootState) => string | null;
  /** The parts, or a function of the Root's state. */
  children?: StateValue<ReactNode, ComboboxMultipleRootState>;
}

/**
 * Props of `Combobox.Root`, discriminated on `multiple`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export type ComboboxRootProps = ComboboxSingleProps | ComboboxMultipleProps;

/** Both variants as one shape, for the implementation. */
interface InternalProps extends ComboboxRootBaseProps {
  multiple?: boolean;
  value?: string | null | string[];
  defaultValue?: string | null | string[];
  valueChangeAction?: (next: never, details: never) => unknown;
  announce?: (count: number, state: never) => string | null;
  announceRemoved?: (labels: readonly string[], state: ComboboxMultipleRootState) => string | null;
  children?: StateValue<ReactNode, never>;
}

/** The default removal announcement (design 15.7; conventions 11). */
function defaultRemovedAnnouncement(labels: readonly string[]): string {
  return `${labels.join(", ")} removed`;
}

/** The default announcement (design 6.4; conventions 11: English, always overridable). */
function defaultComboboxAnnouncement(count: number): string {
  if (count === 0) return "No results";
  if (count === 1) return "1 result";
  return `${count} results`;
}

const VALUE_TRANSITION_TYPES = transitionTypes("combobox", "select");

const isDev = process.env.NODE_ENV !== "production";

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
 * `name` is given (with `multiple`, one per value: design 15.8).
 *
 * With `multiple` (fixed at mount, design 15) the selection is a set under the shared set-valued
 * rules (`useMultipleSelection`), a pick toggles the option, clears the text and leaves the
 * listbox open, and the chips (`Combobox.Chips`) render from the optimistic value.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export function ComboboxRoot(publicProps: ComboboxRootProps) {
  const props = publicProps as InternalProps;
  const {
    value: valueProp,
    defaultValue: defaultValueProp,
    inputValue: inputValueProp,
    defaultInputValue,
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    allowCustomValue = false,
    autoHighlight = false,
    openOnClick = false,
    loop = false,
    form,
    children,
  } = props;

  // The mode is fixed at mount (design 15.2): the selection hook below is built for it.
  const multiple = useMountFixed(
    props.multiple === true,
    isDev &&
      "Combobox.Root: `multiple` changed after mount. Switching between single and multiple " +
        "selection is not supported; the combobox keeps the mode it mounted with.",
  );
  const value = multiple ? undefined : (valueProp as string | null | undefined);
  const defaultValue = multiple ? undefined : (defaultValueProp as string | null | undefined);
  const valueChangeAction = multiple
    ? undefined
    : (props.valueChangeAction as
        | ChangeAction<string | null, ComboboxValueChangeDetails>
        | undefined);

  // Inside a Field.Root (design/components/field-form.md 7.2): the Input is the Field's control
  // (its id is the Field's, so `Field.Label` points at it), the hidden input's `name` and
  // `disabled` default from the Field, and the List is named by `Field.Label` when no
  // `Combobox.Label` is mounted.
  const field = use(FieldContext);
  const { name, disabled } = resolveFieldDefaults(field, {
    name: props.name,
    disabled: props.disabled ?? false,
    required: false,
  });
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

  const popover = usePopoverRoot<ComboboxOpenChangeDetails>({
    component: "combobox",
    part: "Combobox.Root",
    mode: "library",
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    details: popoverDetails,
  });

  // --- Refs the handlers read after an `await` or from a timer ------------------------------

  const propsRef = useLatest(props);
  const popoverRef = useLatest(popover);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const chipsRef = useRef<HTMLElement | null>(null);

  // --- Text: the urgent lane (design 4) ------------------------------------------------------

  const { text, query, stale, textRef, writeText } = useComboboxText({
    inputValue: inputValueProp,
    defaultInputValue,
    onInputValueChange: props.onInputValueChange,
  });

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

  // `multiple`: the chips' labels as render state (design 15.1). The cache above is a mutable map
  // read by handlers; a chip renders from this snapshot of its entries for the selected values,
  // written in the pick's event (before the render that shows the chip) and when an Option for a
  // selected value registers.
  const [chipLabels, setChipLabels] = useState<ReadonlyMap<string, string>>(NO_LABELS);
  const learnChipLabels = useCallback((entries: readonly (readonly [string, string])[]) => {
    if (entries.length === 0) return;
    setChipLabels((prev) => {
      let next: Map<string, string> | null = null;
      for (const [v, label] of entries) {
        if (prev.get(v) === label) continue;
        next ??= new Map(prev);
        next.set(v, label);
      }
      return next ?? prev;
    });
  }, []);

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

  // `multiple` (design 15.4): the set-valued selection. Idle in single mode, as the hook above is
  // with `multiple` (hooks are unconditional; the mode is fixed at mount).
  const multi = useMultipleSelection({
    enabled: multiple,
    value: multiple ? (valueProp as string[] | undefined) : undefined,
    defaultValue: multiple ? (defaultValueProp as string[] | undefined) : undefined,
    valueChangeAction: multiple
      ? (props.valueChangeAction as
          | ChangeAction<string[], ComboboxMultipleValueChangeDetails>
          | undefined)
      : undefined,
  });
  /** One user change of the multiple selection (design 15.3). */
  const changeValues = (
    patch: SetPatch,
    fields: { reason: ChangeReason; custom: boolean },
    event: Event | undefined,
  ): void => {
    if (multi.change(patch, fields, event)) userEdit.current = true;
  };

  const valuePending = multiple ? multi.pending : selection.pending;
  const singleValues = useMemo(
    () => (selection.optimistic === null ? [] : [selection.optimistic]),
    [selection.optimistic],
  );
  const values: readonly string[] = multiple ? multi.values : singleValues;
  const isSelected = (v: string): boolean =>
    multiple ? multi.optimistic.has(v) : selection.optimistic === v;
  const isPending = (v: string): boolean =>
    multiple
      ? multi.pending && multi.optimistic.has(v) !== multi.committed.has(v)
      : selection.pending && selection.optimistic === v;

  // Inside a Field: React writes the hidden input with no `input` / `change` event, so the Field
  // is told after the commit (its `validate` reads the hidden input; a user's pick dismisses a
  // shown server error like typing would).
  useFieldValueChange(multiple ? multi.values : selection.optimistic, () => {
    const edit = userEdit.current;
    userEdit.current = false;
    return edit;
  });

  // --- Option registry and the active option (design 2, 6.5) --------------------------------

  // Read by the registration below (an Option's layout effect, after this commit's insertion
  // effects).
  const selectedRef = useLatest(multi.optimistic);
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
  } = useOptionRegistry(labels, (optionValue, label) => {
    // A chip learns the text of an Option for its value as the Option mounts (design 15.1).
    if (multiple && selectedRef.current.has(optionValue)) {
      learnChipLabels([[optionValue, label]]);
    }
  });
  // A value that joined the selection from outside (a controlled parent, a reset) takes the
  // cache's entry, if an Option for it was ever mounted.
  useLayoutEffect(() => {
    if (!multiple) return;
    const entries: [string, string][] = [];
    for (const v of multi.values) {
      const label = labels.get(v);
      if (label !== undefined) entries.push([v, label]);
    }
    // oxlint-disable-next-line react/set-state-in-effect -- the cache is a ref map render cannot read
    learnChipLabels(entries);
  }, [multiple, multi.values, labels, learnChipLabels]);

  const active = useActiveOption({ popover, orderedOptions, autoHighlight, stale });
  const { activeValue, activeRef, setActive, pendingEdgeRef, autoArmedRef } = active;

  // A Status inside the List is a Suspense fallback: the results are loading (design 6.3).
  const loading = statusCount > 0;
  const empty = optionCount === 0 && !stale && !loading;

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

  // --- Announcements (design 6.4, 15.7) -----------------------------------------------------

  const baseState = {
    inputValue: text,
    query,
    stale,
    activeValue,
    open: popover.optimistic,
    pending: valuePending || popover.pending,
    disabled,
  };
  const state: ComboboxRootState | ComboboxMultipleRootState = multiple
    ? { ...baseState, value: multi.values }
    : { ...baseState, value: selection.optimistic };

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
    const list = listRef.current;
    if (list === null || !canAnnounce(list)) return;
    const compose = (propsRef.current.announce ?? defaultComboboxAnnouncement) as (
      count: number,
      state: ComboboxRootState | ComboboxMultipleRootState,
    ) => string | null;
    const message = compose(count, state);
    if (message !== null) announce(list, message);
  });

  // --- Form: hidden inputs, reset, mount reconciliation (design 11.1, 15.8) -------------------

  // Reset targets (conventions 3.8 rule 6): uncontrolled, the latest `defaultValue`; controlled,
  // the mount-time `value`.
  const resetTarget = useResetTarget(valueProp, defaultValueProp);
  useComboboxForm({
    inputValue: inputValueProp,
    defaultInputValue,
    inputRef,
    hiddenRef,
    textRef,
    writeText,
    resetValue: (event) => {
      if (multiple) {
        multi.reset(toSet((resetTarget as string[] | undefined) ?? []), event);
        return;
      }
      const next = (resetTarget as string | null | undefined) ?? null;
      if (next === selection.optimistic) return;
      dispatchValue(
        next,
        event,
        { reason: "platform", custom: false },
        { close: false, text: undefined },
      );
    },
  });

  const [missingText] = useState(
    () =>
      !multiple &&
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

  // --- Chips (design 15.1, 15.6, 15.7) -------------------------------------------------------

  const [chipRegistry] = useState(() => new Map<string, ComboboxChipEntry>());
  /** The mounted `ChipRemove` elements: left out of a chip's announced text (design 15.7). */
  const [chipRemoves] = useState(() => new Set<Element>());
  const registerRemove = useCallback(
    (element: Element) => {
      chipRemoves.add(element);
      return () => {
        chipRemoves.delete(element);
      };
    },
    [chipRemoves],
  );
  /** The mounted chips in document order. Reads the DOM: handlers and effects only. */
  const orderedChips = useCallback(
    (): { value: string; element: HTMLElement }[] =>
      sortByDocumentOrder(
        [...chipRegistry]
          .filter(([, entry]) => entry.element.isConnected)
          .map(([chipValue, entry]) => ({ value: chipValue, element: entry.element })),
        (chip) => chip.element,
      ),
    [chipRegistry],
  );
  /**
   * A chip that held focus as its registration ended (design 15.6): the element, and the chips
   * that may take focus over, next ones first, then the previous ones nearest first.
   */
  const focusedChipGone = useRef<{
    element: HTMLElement;
    candidates: readonly string[];
  } | null>(null);
  const registerChip = useCallback(
    (chipValue: string, entry: ComboboxChipEntry) => {
      chipRegistry.set(chipValue, entry);
      return () => {
        // A layout cleanup runs before React removes the host node, so focus is still there.
        const element = entry.element;
        if (element.contains(element.ownerDocument.activeElement)) {
          const chips = orderedChips();
          const index = chips.findIndex((chip) => chip.element === element);
          if (index >= 0) {
            const record = {
              element,
              candidates: [...chips.slice(index + 1), ...chips.slice(0, index).reverse()].map(
                (chip) => chip.value,
              ),
            };
            focusedChipGone.current = record;
            // Good for this commit only: the Root's layout effect below runs before microtasks
            // when the Root commits too. A cleanup in a commit without the Root (a `label` from
            // state below it, a boundary inside it toggled from below) must not leave a record
            // that a later Root commit acts on, pulling focus back from wherever it went.
            queueMicrotask(() => {
              if (focusedChipGone.current === record) focusedChipGone.current = null;
            });
          }
        }
        if (chipRegistry.get(chipValue) === entry) chipRegistry.delete(chipValue);
      };
    },
    [chipRegistry, orderedChips],
  );
  // A focused chip unmounted by anything but its own keys (a rolled-back addition, a controlled
  // parent dropping the value, a reset): focus goes to the next chip, else the previous one,
  // else the Input, as Backspace and Delete on a chip move it (design 15.6). After the children's
  // layout effects: a chip that only re-registered (a new `label`) is still connected.
  useLayoutEffect(() => {
    const gone = focusedChipGone.current;
    if (gone === null) return;
    focusedChipGone.current = null;
    if (gone.element.isConnected) return;
    const doc = gone.element.ownerDocument;
    const active = doc.activeElement;
    if (active !== null && active !== doc.body) return;
    for (const candidate of gone.candidates) {
      const element = chipRegistry.get(candidate)?.element;
      if (element !== undefined && element.isConnected) {
        element.focus();
        return;
      }
    }
    inputRef.current?.focus();
  });

  /**
   * Announces removed chips on the Input (design 15.7): the Chip's `label`, else the cache's
   * entry, else the chip's text, read before the optimistic render unmounts it.
   */
  const announceRemoval = (removed: readonly string[]): void => {
    const input = inputRef.current;
    if (removed.length === 0 || input === null || !canAnnounce(input)) return;
    const chipTexts = removed.map((v) => {
      const entry = chipRegistry.get(v);
      const text = entry === undefined ? "" : chipText(entry.element, (el) => chipRemoves.has(el));
      return entry?.label ?? labels.get(v) ?? (text !== "" ? text : v);
    });
    const compose = propsRef.current.announceRemoved ?? defaultRemovedAnnouncement;
    const message = compose(chipTexts, state as ComboboxMultipleRootState);
    if (message !== null) announce(input, message);
  };

  /** Removes one value outside the listbox (Backspace, Delete, `ChipRemove`) and announces it. */
  const removeValue = (removedValue: string, event: Event): void => {
    if (disabled || !multi.optimistic.has(removedValue)) return;
    announceRemoval([removedValue]);
    changeValues(
      { added: [], removed: [removedValue] },
      { reason: "activate", custom: false },
      event,
    );
  };

  const focusInput = (): void => {
    inputRef.current?.focus();
  };

  /** Closes a shown listbox at once, as a dismissal (focus left the input, design 5.4, 15.6). */
  const hideListbox = (event: Event): void => {
    const popup = popover.popupRef.current;
    if (popup !== null && isPopoverOpen(popup)) {
      popover.recordCloseIntent({ reason: "dismiss", event });
      popup.hidePopover();
    }
    pendingEdgeRef.current = null;
  };

  // --- Interaction (design 5, 8, 15.3, 15.6) -------------------------------------------------

  const acceptSingle = (optionValue: string, event: Event): void => {
    if (disabled) return;
    const entry = registry.get(optionValue);
    if (entry === undefined || entry.disabled) return;
    const label = entry.label ?? (entry.element.textContent ?? "").trim();
    labels.set(optionValue, label);
    pendingEdgeRef.current = null;
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

  /** A pick with `multiple` (design 15.3): toggle, clear the text, leave the listbox open. */
  const acceptMultiple = (optionValue: string, event: Event): void => {
    if (disabled) return;
    const entry = registry.get(optionValue);
    if (entry === undefined || entry.disabled) return;
    const label = entry.label ?? (entry.element.textContent ?? "").trim();
    labels.set(optionValue, label);
    // Before the dispatch: the chip's first render already has its label.
    learnChipLabels([[optionValue, label]]);
    pendingEdgeRef.current = null;
    if (activeRef.current !== optionValue) setActive(optionValue);
    if (textRef.current !== "") {
      // The search is used up; `autoHighlight` is re-armed by the text change.
      writeText("", "activate", event);
      autoArmedRef.current = true;
    }
    const patch = multi.optimistic.has(optionValue)
      ? { added: [], removed: [optionValue] }
      : { added: [optionValue], removed: [] };
    changeValues(patch, { reason: "activate", custom: false }, event);
  };

  const accept = multiple ? acceptMultiple : acceptSingle;

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

  /**
   * `multiple` with `allowCustomValue` (design 15.9): adds the text as a value (nothing when it
   * already is one) and clears it.
   */
  const addText = (event: Event, reason: ChangeReason): void => {
    const typed = textRef.current;
    if (typed === "") return;
    if (!multi.optimistic.has(typed)) {
      if (!labels.has(typed)) labels.set(typed, typed);
      learnChipLabels([[typed, labels.get(typed) ?? typed]]);
    }
    changeValues({ added: [typed], removed: [] }, { reason: "activate", custom: true }, event);
    writeText("", reason, event);
  };

  const clear = (event: Event): void => {
    if (disabled) return;
    if (textRef.current !== "") writeText("", "activate", event);
    if (multiple) {
      // One change that removes every value (design 15.3).
      const removed = [...multi.optimistic];
      if (removed.length > 0) {
        announceRemoval(removed);
        changeValues({ added: [], removed }, { reason: "activate", custom: false }, event);
      }
    } else if (selection.optimistic !== null) {
      dispatchValue(null, event, { reason: "activate", custom: false }, { close: false, text: "" });
    }
    inputRef.current?.focus();
  };

  const typed = (next: string, event: Event): void => {
    if (disabled) return;
    writeText(next, "activate", event);
    pendingEdgeRef.current = null;
    // APG: editing moves visual focus back to the input; `autoHighlight` picks the first option
    // again once the results for the new text settle.
    if (activeRef.current !== null) setActive(null);
    autoArmedRef.current = true;
    popover.requestOpen(event, "activate");
  };

  const removeLast = (event: Event): void => {
    const last = [...multi.optimistic].at(-1);
    if (last !== undefined) removeValue(last, event);
  };
  const focusLastChip = (): boolean => {
    const last = orderedChips().at(-1);
    if (last === undefined) return false;
    last.element.focus();
    return true;
  };
  const addTypedText = (event: Event): void => addText(event, "activate");
  const clearSearch = (event: Event): void => {
    if (textRef.current !== "") writeText("", "dismiss", event);
  };
  const multipleKeys: ComboboxMultipleKeys = {
    textRef,
    hasChips: () => multi.optimistic.size > 0,
    removeLast,
    focusLastChip,
    addText: addTypedText,
    clearText: clearSearch,
  };

  // The factory only builds the `keydown` handler: the refs the `multiple` keys read are read when
  // a key is pressed, never during render.
  // oxlint-disable-next-line react/refs
  const keyDown = createComboboxKeyDown({
    disabled,
    loop,
    allowCustomValue,
    popover,
    options: { registry, orderedOptions },
    active,
    accept,
    commitText,
    multiple: multiple ? multipleKeys : undefined,
  });

  /** Focus has left the input, the popup and the chips (design 5.4, 15.6). */
  const leave = (event: Event): void => {
    // `disabled`: nothing dispatches (disabling a focused input blurs it).
    if (disabled) return;
    hideListbox(event);
    if (multiple) {
      // The text was a search: added as a value with `allowCustomValue`, else dropped (15.9).
      if (textRef.current === "") return;
      if (allowCustomValue) addText(event, "dismiss");
      else writeText("", "dismiss", event);
      return;
    }
    if (allowCustomValue) {
      commitText(event, false);
      return;
    }
    const label = labelFor(selection.optimistic);
    if (textRef.current !== label) writeText(label, "dismiss", event);
  };
  const { focusIn, focusOut } = useDeferredLeave({
    inputRef,
    popupRef: popover.popupRef,
    chipsRef,
    leave,
  });

  /** The keys of a focused chip (design 15.6). */
  const chipKeyDown = (event: KeyboardEvent): void => {
    if (disabled || !multiple) return;
    const chips = orderedChips();
    const index = chips.findIndex((chip) => chip.element === event.target);
    if (index < 0) return;
    // AltGr is reported as Ctrl+Alt on Windows: a character typed with it is still a character.
    const modified = (event.ctrlKey || event.metaKey) && !event.getModifierState?.("AltGraph");
    // A printable key types into the Input: focused in the `keydown`, the character lands there
    // (an astral character is one code point, two code units). An IME start (`"Process"`,
    // keyCode 229) hands over the same way, so the composition runs in the Input. Space does
    // nothing (a chip has no action of its own).
    if (event.key === "Process" || event.keyCode === 229) {
      focusInput();
      return;
    }
    if ([...event.key].length === 1 && event.key !== " ") {
      if (!modified) focusInput();
      return;
    }
    if (modified) return;
    const element = chips[index]!.element;
    const rtl = element.ownerDocument.defaultView?.getComputedStyle(element).direction === "rtl";
    const focusChip = (i: number): void => {
      chips[i]?.element.focus();
    };
    switch (event.key) {
      case rtl ? "ArrowRight" : "ArrowLeft":
        event.preventDefault();
        if (index > 0) focusChip(index - 1);
        return;
      case rtl ? "ArrowLeft" : "ArrowRight":
        event.preventDefault();
        if (index < chips.length - 1) focusChip(index + 1);
        else focusInput();
        return;
      case "Home":
        event.preventDefault();
        focusChip(0);
        return;
      case "End":
        event.preventDefault();
        focusChip(chips.length - 1);
        return;
      case "Backspace":
      case "Delete": {
        event.preventDefault();
        // Focus moves before the dispatch: the next chip, else the previous one, else the Input.
        const target = chips[index + 1] ?? chips[index - 1];
        if (target !== undefined) target.element.focus();
        else focusInput();
        removeValue(chips[index]!.value, event);
        return;
      }
      case "Escape":
        // Prevented: the close request of an enclosing Dialog or Popover is not run.
        event.preventDefault();
        focusInput();
        return;
    }
    // Enter and the rest: nothing.
  };

  const chips: ComboboxChipsValue = {
    chipsRef,
    labelOf: (chipValue) => chipLabels.get(chipValue),
    registerChip,
    registerRemove,
    removeChip: (chipValue, event) => {
      removeValue(chipValue, event);
      focusInput();
    },
    keyDown: chipKeyDown,
    focusIn: (event) => {
      // With focus on a chip the listbox has no active descendant and cannot be operated: a shown
      // one hides at once, an open still on its way (a slow `openChangeAction`, a commit not
      // landed yet) is cancelled by a close request, so it never shows under the chip. A
      // request, not a dismissal (nothing was shown): `openChangeAction(false)` with
      // `"activate"`, as Alt+ArrowUp (design 15.6).
      const popup = popover.popupRef.current;
      const shown = popup !== null && isPopoverOpen(popup);
      hideListbox(event);
      if (!shown && popover.intended()) popover.requestClose(event, "activate");
      focusIn(event);
    },
    focusOut,
    click: () => {
      if (!disabled) focusInput();
    },
  };

  const inputClick = (event: MouseEvent): void => {
    if (disabled || !openOnClick) return;
    popover.requestOpen(event, "activate");
  };

  // A press on the field while the listbox is shown: `source` is no light-dismiss exemption, so
  // the release goes to the Popup, whose topmost clicked popover is the listbox itself (design
  // 5.4). Judged on `:popover-open`, not the intent: a press during a pending close must
  // not dismiss either. Primary button only (a right click keeps the field's own context menu).
  // The engine releases the capture after `pointerup`; the press tracking above still sees
  // the release on the document.
  const inputPointerDown = (event: PointerEvent): void => {
    if (disabled || event.button !== 0) return;
    const popup = popover.popupRef.current;
    if (popup !== null && isPopoverOpen(popup)) capturePointer(popup, event.pointerId);
  };

  const context: ComboboxContextValue = {
    popover,
    ids,
    value: multiple ? null : selection.optimistic,
    multiple,
    values,
    isSelected,
    isPending,
    valuePending,
    pending: baseState.pending,
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
    focusIn,
    focusOut,
    inputClick,
    inputPointerDown,
    chips,
  };

  // The form value (design 11.1, 15.8): one hidden input, or with `multiple` one per value, in
  // value order. An empty multiple selection keeps one nameless input, which posts nothing but is
  // the form-associated element of the reset listener and an enclosing Field.
  let hidden: ReactNode = null;
  if (name !== undefined) {
    if (!multiple) {
      hidden = (
        <input
          ref={hiddenRef}
          type="hidden"
          name={name}
          form={form}
          value={selection.optimistic ?? ""}
        />
      );
    } else if (multi.values.length === 0) {
      hidden = <input key="" ref={hiddenRef} type="hidden" form={form} value="" />;
    } else {
      hidden = multi.values.map((v, i) => (
        <input
          key={`v:${v}`}
          ref={i === 0 ? hiddenRef : undefined}
          type="hidden"
          name={name}
          form={form}
          value={v}
        />
      ));
    }
  }

  return (
    <ComboboxContext value={context}>
      {hidden}
      {resolveStateValue(children as StateValue<ReactNode, typeof state>, state)}
    </ComboboxContext>
  );
}

ComboboxRoot.displayName = "ComboboxRoot";
