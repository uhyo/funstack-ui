"use client";
import { use, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useMultipleSelection } from "../internal/action/use-multiple-selection.js";
import { FieldContext } from "../internal/form/field-context.js";
import { HiddenValues } from "../internal/form/hidden-values.js";
import type { FormAssociatedElement } from "../internal/form/use-form-owner-event.js";
import { useFormReset, useResetTarget } from "../internal/form/use-form-reset.js";
import { resolveFieldDefaults, useFieldValueChange } from "../internal/form/use-field-control.js";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import { toggleFromTrigger } from "../internal/overlay/use-popover-trigger.js";
import { popoverDetails, usePopoverRoot } from "../internal/overlay/use-overlay-root.js";
import { createTypeaheadBuffer } from "../internal/typeahead.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  StateValue,
  UrgentChangeHandler,
} from "../internal/types.js";
import { useActiveOption } from "../internal/use-active-option.js";
import type { PendingEdge } from "../internal/use-active-option.js";
import { useDeferredLeave } from "../internal/use-deferred-leave.js";
import { useLatest } from "../internal/use-latest.js";
import { optionLabel, useOptionRegistry } from "../internal/use-option-registry.js";
import { resolveStateValue } from "../internal/use-render.js";
import { toSet } from "../internal/value-set.js";
import { MultiSelectContext } from "./multi-select-context.js";
import type { MultiSelectContextValue } from "./multi-select-context.js";
import { createMultiSelectKeyDown } from "./multi-select-keyboard.js";

const NO_LABELS: ReadonlyMap<string, string> = new Map();

/** Details passed as the second argument of `MultiSelect.Root`'s `valueChangeAction`. */
export interface MultiSelectValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user toggled an option (Enter, Space, click; `details.event` is the
   * `keydown` or `click`).
   * `"platform"`: a form reset (`details.event` is the `reset` event).
   */
  readonly reason: ChangeReason;
  /** Values this dispatch added, in the order they join the value. */
  readonly added: readonly string[];
  /** Values this dispatch removed, in value order. */
  readonly removed: readonly string[];
}

/** Details passed as the second argument of `MultiSelect.Root`'s `openChangeAction` and `onOpenChange`. */
export interface MultiSelectOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the Trigger (click, Enter, Space, arrows, Home, End, a typed character),
   * Alt+ArrowUp, a foreign invoker or `showPopover()`.
   * `"dismiss"`: Escape, light dismiss, focus leaving, another top-layer element.
   * `"platform"`: the popup was found open at mount.
   */
  readonly reason: ChangeReason;
}

/** State of `MultiSelect.Root`, passed to the function form of `children`. */
export interface MultiSelectRootState {
  /** Optimistic selection, in pick order. Content rendered from it must not suspend. */
  readonly value: readonly string[];
  /** The value of the option `aria-activedescendant` points at, or `null`. */
  readonly activeValue: string | null;
  /** Optimistic open state. */
  readonly open: boolean;
  /** A `valueChangeAction` or `openChangeAction` dispatched through this Root is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop, or the enclosing Field's. */
  readonly disabled: boolean;
  /** The `required` prop, or the enclosing Field's. */
  readonly required: boolean;
}

/**
 * Props of `MultiSelect.Root`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectRootProps {
  /** Controlled selection. `[]`: nothing selected. `undefined`: uncontrolled. Duplicates are ignored. */
  value?: readonly string[];
  /**
   * Initial selection in uncontrolled mode; also the form-reset target (the latest value).
   *
   * @defaultValue `[]`
   */
  defaultValue?: readonly string[];
  /**
   * Runs inside the Root's transition for every change of the selection. `next` is the whole
   * intended selection as a fresh array; `details.added` / `details.removed` say what this
   * dispatch changed. Awaited; a rejection rolls this change back and nothing else. May be a
   * Server Function. Persist the diff, not `next`: `next` can contain an earlier change that
   * fails later.
   */
  valueChangeAction?: ChangeAction<string[], MultiSelectValueChangeDetails>;

  /** Controlled open state. `undefined`: uncontrolled. */
  open?: boolean;
  /**
   * Initial open state when uncontrolled. Opens after hydration.
   *
   * @defaultValue `false`
   */
  defaultOpen?: boolean;
  /**
   * Requests only: awaited for opens and for the closes the parts ask for (the Trigger,
   * Alt+ArrowUp). Never called for a dismissal: that goes to `onOpenChange`.
   */
  openChangeAction?: ChangeAction<boolean, MultiSelectOpenChangeDetails>;
  /**
   * Facts only: the listbox was closed without the library closing it on request (Escape, light
   * dismiss, focus leaving the Trigger, another top-layer element, script). Always `false`.
   * Called synchronously, outside any Transition, and not awaited: nothing is pending.
   * Controlled: set your state **directly** here (`onOpenChange={setOpen}`). May return a
   * promise; a rejection or a throw goes to `reportError`.
   */
  onOpenChange?: UrgentChangeHandler<boolean, MultiSelectOpenChangeDetails>;

  /**
   * Wrap from the last option to the first and back with the arrow keys.
   *
   * @defaultValue `false`
   */
  loop?: boolean;
  /** Form participation: one hidden input with this name per value (nothing posted for `[]`). */
  name?: string;
  /** The `form` attribute of the hidden inputs and of the validity element. */
  form?: string;
  /**
   * At least one value must be selected for the form to submit: a visually hidden validity
   * element after the Trigger is `required` while the optimistic selection is empty, and the
   * Trigger carries `aria-required`.
   *
   * @defaultValue `false`
   */
  required?: boolean;
  /**
   * Disables the Trigger natively; nothing opens or dispatches. The hidden inputs still post.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** The parts, or a function of the Root's state. */
  children?: StateValue<ReactNode, MultiSelectRootState>;
}

/**
 * Owns a multi-select listbox (design/components/multi-select.md): the selection (`value`, a set
 * in pick order under the shared set-valued rules, a transition with `useOptimistic`), the open
 * state (`usePopoverRoot`, library mode), the active option (urgent virtual focus through the
 * Trigger's `aria-activedescendant`), the Option and Status registries, the label cache and the
 * form-reset listener. Renders no DOM, except one `<input type="hidden">` per value when `name`
 * is given.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectRoot(props: MultiSelectRootProps) {
  const {
    value,
    defaultValue,
    valueChangeAction,
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    loop = false,
    form,
    children,
  } = props;

  // Inside a Field.Root (design/components/field-form.md 7.2): the Trigger is the Field's control
  // (its id is the Field's, so `Field.Label` points at it); `name`, `disabled` and `required`
  // default from the Field, and the List is named by `Field.Label` when no Label is mounted.
  const field = use(FieldContext);
  const { name, disabled, required } = resolveFieldDefaults(field, {
    name: props.name,
    disabled: props.disabled ?? false,
    required: props.required ?? false,
  });
  const fieldControlId = field?.ids.control;

  const id = useId();
  const ids = useMemo(
    () => ({
      trigger: fieldControlId ?? `${id}-trigger`,
      label: `${id}-label`,
      list: `${id}-list`,
      optionPrefix: `${id}-option-`,
    }),
    [id, fieldControlId],
  );

  const popover = usePopoverRoot<MultiSelectOpenChangeDetails>({
    component: "multi-select",
    part: "MultiSelect.Root",
    mode: "library",
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    details: popoverDetails,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const validityRef = useRef<HTMLSelectElement | null>(null);

  // --- Selection: a set, pick order (B.6) ---------------------------------------------------

  const multi = useMultipleSelection<Record<never, never>>({
    component: "multi-select",
    part: "MultiSelect.Root",
    enabled: true,
    value,
    defaultValue,
    valueChangeAction,
    resetFields: {},
  });
  const selectedRef = useLatest(multi.optimistic);

  /** The next change of the optimistic selection comes from the user (a dispatch). */
  const userEdit = useRef(false);
  // Inside a Field: React writes the hidden inputs with no `input` / `change` event, so the
  // Field is told after the commit (a user's pick dismisses a shown server error like typing).
  useFieldValueChange(multi.values, () => {
    const edit = userEdit.current;
    userEdit.current = false;
    return edit;
  });

  // --- Labels (B.7; the label cache of combobox.md 2.3) --------------------------------------

  const [labels] = useState(() => new Map<string, string>());
  // The cache is a mutable map read by handlers; `Value` renders from this snapshot of its
  // entries for the selected values, written in the pick's event and when an Option for a
  // selected value registers.
  const [valueLabels, setValueLabels] = useState<ReadonlyMap<string, string>>(NO_LABELS);
  const learnLabels = useCallback((entries: readonly (readonly [string, string])[]) => {
    if (entries.length === 0) return;
    setValueLabels((prev) => {
      let next: Map<string, string> | null = null;
      for (const [v, label] of entries) {
        if (prev.get(v) === label) continue;
        next ??= new Map(prev);
        next.set(v, label);
      }
      return next ?? prev;
    });
  }, []);

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
  } = useOptionRegistry("MultiSelect", labels, (optionValue, label) => {
    if (selectedRef.current.has(optionValue)) learnLabels([[optionValue, label]]);
  });
  // A value that joined the selection from outside (a controlled parent, a reset) takes the
  // cache's entry, if an Option for it was ever mounted.
  useLayoutEffect(() => {
    const entries: [string, string][] = [];
    for (const v of multi.values) {
      const label = labels.get(v);
      if (label !== undefined) entries.push([v, label]);
    }
    // oxlint-disable-next-line react/set-state-in-effect -- the cache is a ref map render cannot read
    learnLabels(entries);
  }, [multi.values, labels, learnLabels]);

  // A Status inside the List is a Suspense fallback: the options are loading (combobox.md 6.3).
  const loading = statusCount > 0;
  const empty = optionCount === 0 && !loading;

  const active = useActiveOption({
    popover,
    orderedOptions,
    autoHighlight: false,
    stale: false,
    loading: () => statusCountRef.current > 0,
  });
  const { activeValue, activeRef, setActive, pendingEdgeRef } = active;

  /** The initial active option (B.8): the first selected option, else the first or last one. */
  const selectedEdge = (fallback: "first" | "last"): PendingEdge => {
    return (enabled) => {
      const selected = selectedRef.current;
      const first = enabled.find((option) => selected.has(option.value));
      if (first !== undefined) return first.value;
      return (fallback === "first" ? enabled[0] : enabled.at(-1))?.value ?? null;
    };
  };

  // --- Form: hidden inputs, reset (B.10) -----------------------------------------------------

  // Reset targets (conventions 3.8 rule 6): uncontrolled, the latest `defaultValue`; controlled,
  // the mount-time `value`.
  const resetTarget = useResetTarget(value, defaultValue);
  const formElement = useMemo<RefObject<FormAssociatedElement | null>>(
    () => ({
      get current() {
        // A button has a form owner too: the reset listener works without `name` and `required`.
        return (hiddenRef.current ??
          validityRef.current ??
          triggerRef.current) as FormAssociatedElement | null;
      },
      set current(_ignored) {},
    }),
    [],
  );
  useFormReset(formElement, (event) => {
    multi.reset(toSet(resetTarget ?? []), event);
  });

  // --- Interaction (B.4, B.5, B.8) -----------------------------------------------------------

  const toggle = (optionValue: string, event: Event): void => {
    if (disabled) return;
    const entry = registry.get(optionValue);
    if (entry === undefined || entry.disabled) return;
    const label = optionLabel(entry);
    labels.set(optionValue, label);
    // Before the dispatch: the Value's first render with the value already has its label.
    learnLabels([[optionValue, label]]);
    pendingEdgeRef.current = null;
    if (activeRef.current !== optionValue) setActive(optionValue);
    const patch = multi.optimistic.has(optionValue)
      ? { added: [], removed: [optionValue] }
      : { added: [optionValue], removed: [] };
    if (multi.change(patch, { reason: "activate" }, event)) userEdit.current = true;
    // No close, no focus move: the listbox stays open (B.5).
  };

  const typeahead = useRef(createTypeaheadBuffer());
  // The factory only builds the `keydown` handler: the refs it reads are read when a key is
  // pressed, never during render.
  // oxlint-disable-next-line react/refs
  const keyDown = createMultiSelectKeyDown({
    disabled,
    loop,
    popover,
    options: { registry, orderedOptions },
    active,
    typeahead,
    selectedEdge,
    toggle,
  });

  const triggerClick = (event: MouseEvent): void => {
    // Cancelled first, whatever follows: the popover toggle of `popovertarget` never runs (the
    // library opens the listbox), so the click toggles against the state the user saw (B.4).
    event.preventDefault();
    if (disabled) return;
    // WebKit does not focus a button on a mouse press; the keys and the leave rule need focus.
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.ownerDocument.activeElement !== trigger) trigger.focus();
    toggleFromTrigger(popover, event, () => {
      pendingEdgeRef.current = selectedEdge("first");
    });
  };

  /** Focus has left the Trigger and the Popup (B.4): a shown listbox closes as a dismissal. */
  const leave = (event: Event): void => {
    pendingEdgeRef.current = null;
    if (disabled) return;
    const popup = popover.popupRef.current;
    if (popup !== null && isPopoverOpen(popup)) {
      popover.recordCloseIntent({ reason: "dismiss", event });
      popup.hidePopover();
    }
  };
  const { focusIn, focusOut } = useDeferredLeave({
    surfaceRef: triggerRef,
    popupRef: popover.popupRef,
    leave,
  });

  const labelClick = (event: MouseEvent): void => {
    // A `<label for>` on a button forwards the click, which would open the listbox; a label on
    // a native `<select>` only focuses it (B.8).
    event.preventDefault();
    if (!disabled) triggerRef.current?.focus();
  };

  const valueLabelsList = useMemo(
    () => multi.values.map((v) => valueLabels.get(v)),
    [multi.values, valueLabels],
  );

  const pending = multi.pending || popover.pending;
  const context: MultiSelectContextValue = {
    popover,
    ids,
    values: multi.values,
    labels: valueLabelsList,
    isSelected: (v) => multi.optimistic.has(v),
    isPending: (v) => multi.pending && multi.optimistic.has(v) !== multi.committed.has(v),
    pending,
    activeValue,
    empty,
    loading,
    hasLabel: labelCount > 0,
    fieldLabelId: field?.ids.label,
    disabled,
    required,
    form,
    triggerRef,
    listRef,
    validityRef,
    registerOption,
    registerStatus,
    registerLabel,
    // Hover on an option: as the keys, it disarms an edge waiting for the options to load.
    setActive: (v) => {
      pendingEdgeRef.current = null;
      setActive(v);
    },
    toggle,
    triggerClick,
    keyDown,
    focusIn,
    focusOut,
    labelClick,
  };

  const state: MultiSelectRootState = {
    value: multi.values,
    activeValue,
    open: popover.optimistic,
    pending,
    disabled,
    required,
  };

  return (
    <MultiSelectContext value={context}>
      {/* A disabled MultiSelect is not submitted (conventions 3.6, design B.10). */}
      <HiddenValues
        name={name}
        form={form}
        values={multi.values}
        inputRef={hiddenRef}
        disabled={disabled}
      />
      {resolveStateValue(children, state)}
    </MultiSelectContext>
  );
}

MultiSelectRoot.displayName = "MultiSelectRoot";
