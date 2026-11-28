"use client";
import { use, useCallback, useLayoutEffect, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { BUTTON_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { disabledButton, rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { ComboboxChipContext, useComboboxContext } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

const NO_VALUES: readonly string[] = [];

const preventDefault = (event: { preventDefault(): void }) => event.preventDefault();

/**
 * State of `Combobox.Chips`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ComboboxChipsState {
  /** Optimistic selection, in pick order: render one `Chip` per value. */
  readonly value: readonly string[];
  /** The Root's value action is in flight. */
  readonly pending: boolean;
  /** No chips: nothing is selected (`data-empty`). */
  readonly empty: boolean;
  /** The Root's `disabled` (or the Field's). */
  readonly disabled: boolean;
  /** The Root's `readOnly` (or the Field's). */
  readonly readOnly: boolean;
}

/**
 * Props of `Combobox.Chips`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export interface ComboboxChipsProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "role"
  | "onKeyDown"
  | "onPointerDown"
  | "onMouseDown"
  | "onClick"
  | "onFocus"
  | "onBlur"
  | "className"
  | "style"
  | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ComboboxChipsState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ComboboxChipsState>;
  /**
   * Usually a function of `{ value }` rendering one `Chip` per value, keyed by the value.
   * Rendered from optimistic state; must not suspend.
   */
  children?: StateValue<ReactNode, ComboboxChipsState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxChipsState>;
}

/**
 * The selected values of `Combobox.Root multiple` as a list: `<div role="list"
 * aria-labelledby={label}>` (no role while empty: an empty list lacks its required children).
 * It holds the chips, not the Input: the box around both is yours. A press in it keeps focus
 * where it is and its click focuses the Input; a focused chip takes the keys of design 15.6
 * (arrows, Home / End, Backspace / Delete, Escape; a printable key types into the Input).
 *
 * Owned keys (conventions 1.2): `role`, `aria-labelledby` (token-merged, while not empty),
 * `onKeyDown`, `onPointerDown`, `onMouseDown`, `onClick`, `onFocus`, `onBlur`, `data-empty`,
 * `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export function ComboboxChips({ className, style, children, render, ...rest }: ComboboxChipsProps) {
  const ctx = useComboboxContext("Combobox.Chips");
  useDevWarning(
    !ctx.multiple,
    isDev &&
      "Combobox.Chips: rendered under a Combobox.Root without `multiple`. Chips show a multiple selection; " +
        "add `multiple` to the Root.",
  );
  const { chips } = ctx;
  const { chipsRef } = chips;

  const ref = useCallback(
    (element: HTMLElement) => {
      chipsRef.current = element;
      return () => {
        if (chipsRef.current === element) chipsRef.current = null;
      };
    },
    [chipsRef],
  );

  const values = ctx.multiple ? ctx.values : NO_VALUES;
  const empty = values.length === 0;
  const state: ComboboxChipsState = {
    value: values,
    pending: ctx.multiple && ctx.valuePending,
    empty,
    disabled: ctx.disabled,
    readOnly: ctx.readOnly,
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    role: empty ? undefined : "list",
    // Named like the List: by the Label while one is mounted, else the Field's label. While
    // empty there is no role, and a role-less `div` may not be named: the consumer's
    // `aria-label` / `aria-labelledby` are removed too (owned keys set to `undefined`).
    ...(empty
      ? { "aria-label": undefined, "aria-labelledby": undefined }
      : ctx.hasLabel
        ? { "aria-labelledby": ctx.ids.label }
        : ctx.fieldLabelId !== undefined && { "aria-labelledby": ctx.fieldLabelId }),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => chips.keyDown(event.nativeEvent),
    // The Input keeps focus (a chip is focused by keys only, design 15.6).
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => preventDefault(event),
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => preventDefault(event),
    onClick: (event: MouseEvent<HTMLDivElement>) => chips.click(event.nativeEvent),
    onFocus: (event: FocusEvent<HTMLDivElement>) => chips.focusIn(event.nativeEvent),
    onBlur: (event: FocusEvent<HTMLDivElement>) => chips.focusOut(event.nativeEvent),
    "data-empty": dataAttr(empty),
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(ctx.disabled),
    "data-readonly": dataAttr(ctx.readOnly),
  };

  return useRender<ComponentPropsWithRef<"div">, ComboboxChipsState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref,
  });
}

ComboboxChips.displayName = "ComboboxChips";

/**
 * State of `Combobox.Chip`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ComboboxChipState {
  /** The Chip's `value` prop. */
  readonly value: string;
  /**
   * The text of the option with this value as the library last saw it (written at the pick);
   * `undefined` if no Option for it was ever mounted (a preselected value before the listbox
   * first opens).
   */
  readonly label: string | undefined;
  /** The Root's value action is pending and this value is not in the committed selection yet. */
  readonly pending: boolean;
  /** The Root's `disabled` (or the Field's). */
  readonly disabled: boolean;
  /** The Root's `readOnly` (or the Field's). */
  readonly readOnly: boolean;
}

/**
 * Props of `Combobox.Chip`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export interface ComboboxChipProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "tabIndex" | "className" | "style" | "children"
> {
  /** The selected value this chip shows. */
  value: string;
  /**
   * The chip's text for the removal announcement.
   *
   * @defaultValue `state.label`, else the element's trimmed `textContent`
   */
  label?: string;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ComboboxChipState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ComboboxChipState>;
  /**
   * Content, or a function of the part's state. Rendered from optimistic state; must not
   * suspend.
   *
   * @defaultValue `label ?? value` (the state's `label`)
   */
  children?: StateValue<ReactNode, ComboboxChipState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxChipState>;
}

/**
 * One selected value: `<div role="listitem" tabindex="-1">`, focusable by the keys of design 15.6
 * and never a Tab stop (the combobox has one, the Input). Renders from the optimistic value, so a
 * removed chip disappears at once and comes back if its action rejects; `data-pending` while its
 * addition is not committed.
 *
 * Owned keys (conventions 1.2): `role`, `tabIndex`, `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export function ComboboxChip({
  value,
  label,
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxChipProps) {
  const ctx = useComboboxContext("Combobox.Chip");
  useDevWarning(
    !ctx.multiple,
    isDev &&
      "Combobox.Chip: rendered under a Combobox.Root without `multiple`. Chips show a multiple selection; " +
        "add `multiple` to the Root.",
  );
  useDevWarning(
    ctx.multiple && !ctx.isSelected(value),
    isDev &&
      `Combobox.Chip: its value ${JSON.stringify(value)} is not in the selection. Render the ` +
        "chips from the `value` that `Combobox.Chips` passes to its children.",
  );
  const { registerChip } = ctx.chips;

  const elementRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((element: HTMLElement) => {
    elementRef.current = element;
    return () => {
      if (elementRef.current === element) elementRef.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element === null) return;
    return registerChip(value, { element, label });
  }, [registerChip, value, label]);

  const state: ComboboxChipState = {
    value,
    label: ctx.chips.labelOf(value),
    pending: ctx.multiple && ctx.isPending(value),
    disabled: ctx.disabled,
    readOnly: ctx.readOnly,
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    role: "listitem",
    tabIndex: -1,
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(ctx.disabled),
    "data-readonly": dataAttr(ctx.readOnly),
  };

  const element = useRender<ComponentPropsWithRef<"div">, ComboboxChipState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children: children ?? ((s) => s.label ?? s.value),
    props: rest,
    libraryProps,
    ref,
  });
  return <ComboboxChipContext value={value}>{element}</ComboboxChipContext>;
}

ComboboxChip.displayName = "ComboboxChip";

/**
 * State of `Combobox.ChipRemove`, passed to the function forms of `className`, `style`,
 * `children` and `render`.
 */
export interface ComboboxChipRemoveState {
  /** The value of the Chip it is in. */
  readonly value: string;
  /** As the Chip's `pending`. */
  readonly pending: boolean;
  /** The Root's `disabled` (or the Field's), or while the Root is read-only. */
  readonly disabled: boolean;
  /** The Root's `readOnly` (or the Field's): the button is disabled too. */
  readonly readOnly: boolean;
}

/**
 * Props of `Combobox.ChipRemove`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export interface ComboboxChipRemoveProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "onPointerDown"
  | "onMouseDown"
  | "tabIndex"
  | "disabled"
  | "className"
  | "style"
  | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ComboboxChipRemoveState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ComboboxChipRemoveState>;
  /**
   * Content, or a function of the part's state, usually an icon ("×", best in an `aria-hidden`
   * element). It is never part of the chip's text in the removal announcement.
   */
  children?: StateValue<ReactNode, ComboboxChipRemoveState>;
  /** Should render a `<button>`. */
  render?: RenderProp<ComponentPropsWithRef<"button">, ComboboxChipRemoveState>;
}

/**
 * The optional remove button of a chip: `<button type="button" tabindex="-1">`, inside a
 * `Combobox.Chip`. A press keeps focus in the Input (as `Clear`); the click removes the chip's
 * value, announces it and focuses the Input. While the listbox is open the press closes it (the
 * platform's light dismiss: the button is outside the popup). Needs an accessible name
 * (`aria-label`).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>`), `tabIndex`, `disabled`,
 * `aria-disabled` (link or component `render`), `onClick`, `onPointerDown`, `onMouseDown`,
 * `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export function ComboboxChipRemove({
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxChipRemoveProps) {
  const ctx = useComboboxContext("Combobox.ChipRemove");
  const value = use(ComboboxChipContext);
  if (value === null) {
    throw new Error("Combobox.ChipRemove must be rendered inside a Combobox.Chip.");
  }
  useDevWarning(
    !ctx.multiple,
    isDev &&
      "Combobox.ChipRemove: rendered under a Combobox.Root without `multiple`. Chips show a multiple selection; " +
        "add `multiple` to the Root.",
  );
  const nameWarning = useNameWarning(
    isDev && "Combobox.ChipRemove: the button has no accessible name. Give it an `aria-label`.",
    BUTTON_NAME,
  );
  const { registerRemove } = ctx.chips;
  // Registered so that its content (a "×") is not read as part of the chip's label (15.7).
  const registerRef = useCallback(
    (element: HTMLElement) => registerRemove(element),
    [registerRemove],
  );
  const ref = useMergedRefs<HTMLElement>(registerRef, nameWarning);
  // Read-only (conventions 3.6.1 rule 7): a part whose only job is to change the value.
  const disabled = ctx.disabled || ctx.readOnly;
  const state: ComboboxChipRemoveState = {
    value,
    pending: ctx.multiple && ctx.isPending(value),
    disabled,
    readOnly: ctx.readOnly,
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    tabIndex: -1,
    ...disabledButton(render, disabled).props,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => preventDefault(event),
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => preventDefault(event),
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        // A disabled link must not navigate either.
        event.preventDefault();
        return;
      }
      ctx.chips.removeChip(value, event.nativeEvent);
    },
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(disabled),
    "data-readonly": dataAttr(ctx.readOnly),
  };

  return useRender<ComponentPropsWithRef<"button">, ComboboxChipRemoveState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref,
  });
}

ComboboxChipRemove.displayName = "ComboboxChipRemove";
