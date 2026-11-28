"use client";
import { useCallback } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import { collectInvalid } from "../internal/form/focus-first-invalid.js";
import { useFieldControl } from "../internal/form/use-field-control.js";
import { supportsUserInvalid } from "../internal/form/validity.js";
import { RESERVED_INVOKER_KEYS } from "../internal/overlay/use-popover-trigger.js";
import { registerTrigger } from "../internal/overlay/trigger-ref.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { optionId } from "../internal/use-option-registry.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useMultiSelectContext } from "./multi-select-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `MultiSelect.Trigger`, passed to the function forms of `className`, `style`,
 * `children` and `render`.
 */
export interface MultiSelectTriggerState {
  /** Optimistic selection, in pick order. */
  readonly value: readonly string[];
  /** Optimistic open state. */
  readonly open: boolean;
  /** The Root's `pending`: a value or open transition is in flight. */
  readonly pending: boolean;
  /** Disabled by its own prop or by the Root. */
  readonly disabled: boolean;
  /** Inside a `Field.Root`: an error is shown for the field (`data-invalid`). `false` outside. */
  readonly invalid: boolean;
  /** The Root's `required`, or the enclosing Field's (`data-required`). */
  readonly required: boolean;
}

/**
 * Props of `MultiSelect.Trigger`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "type"
  | "role"
  | "onClick"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
  | "popoverTarget"
  | "popoverTargetAction"
  | "commandfor"
  | "command"
  | "aria-expanded"
  | "aria-controls"
  | "aria-activedescendant"
  | "aria-required"
  | "form"
  | "disabled"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Disables this button; the Root's `disabled` does too. Native `disabled`.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectTriggerState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectTriggerState>;
  /** Non-interactive content only (a `<button>` may not contain interactive content). Must not suspend. */
  children?: StateValue<ReactNode, MultiSelectTriggerState>;
  /** Must render a `<button>`: the `popovertarget` light-dismiss exemption is defined for buttons. */
  render?: RenderProp<ComponentPropsWithRef<"button">, MultiSelectTriggerState>;
}

/** Visually hidden, out of the user's reach and out of the accessibility tree (B.10). */
const VALIDITY_STYLE: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  border: 0,
  opacity: 0,
  overflow: "hidden",
  clipPath: "inset(50%)",
  pointerEvents: "none",
};

const preventDefault = (event: { preventDefault(): void }) => event.preventDefault();

/**
 * The combobox itself: `<button type="button" role="combobox">`, the one Tab stop of the
 * MultiSelect (design/components/multi-select.md B.1, B.4). DOM focus stays here while the listbox
 * is open; the options are virtual focus through `aria-activedescendant`. After hydration it names
 * the Popup as its invoker (`popovertarget`, written through the ref, never server-rendered), so
 * a press on it while the listbox is shown is not a light dismiss; every click is cancelled and
 * toggles the listbox against the state the user saw. It renders `aria-expanded` from the shown
 * listbox (the role requires the state, and before hydration there is no invoker). With
 * `required` it renders the **validity element** right after itself: a visually hidden one-option
 * `<select tabindex="-1" aria-hidden="true">`, `required` while the optimistic selection is empty
 * (B.10). It blocks a submission natively; its
 * `invalid` is cancelled (no browser bubble) and the attempt focuses the button, so the message is
 * `Field.Error`'s. Focus it receives passes to the button.
 *
 * Owned keys (conventions 1.2): `id`, `type`, `role`, `disabled`, `aria-expanded`,
 * `aria-controls` (token-merged), `aria-activedescendant`, `aria-required`, `popovertarget`
 * (written after hydration), `form`, `onClick`, `onKeyDown`, `onFocus`, `onBlur`,
 * `data-open`, `data-pending`, `data-disabled`, `data-required`; inside a `Field.Root` also
 * `aria-describedby` (token-merged), `aria-invalid` and `data-invalid`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectTrigger({
  disabled: ownDisabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectTriggerProps) {
  const part = "MultiSelect.Trigger";
  const ctx = useMultiSelectContext(part);
  const { popover, ids, triggerRef, validityRef, required } = ctx;
  const disabled = ownDisabled || ctx.disabled;

  const readValidity = useCallback(() => validityRef.current, [validityRef]);
  // Inside a Field.Root the Trigger is the control and the validity element is the Field's
  // validity element (conventions 3.6, the NumberField case without the message mirror).
  const field = useFieldControl({
    labelable: true,
    required,
    disabled,
    id: rest.id,
    component: part,
    validityElement: required ? readValidity : undefined,
  });

  const checkElement = useElementCheck(
    isDev &&
      ((element) =>
        element.tagName === "BUTTON"
          ? null
          : `${part}: rendered a <${element.tagName.toLowerCase()}>. Render a <button>: the ` +
            "popovertarget invoker relationship, which keeps a press on the Trigger from light " +
            "dismissing the listbox, `disabled` and `<label for>` are defined for buttons."),
  );
  const popupId = popover.ids.popup;
  const ref = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      triggerRef.current = element as HTMLButtonElement;
      // The popover's "trigger": `showPopover({ source })` anchors the listbox here and nests it
      // under the Trigger's popover ancestor (B.4).
      const unregister = registerTrigger(popover.triggerRef, element, part);
      // After hydration the button is the popup's invoker (B.4, combobox.md 3.3): the platform's
      // light dismiss exempts a press on an invoker of the open popover. Never server-rendered,
      // so a click before hydration opens nothing.
      const invoker = element.tagName === "BUTTON";
      if (invoker) element.setAttribute("popovertarget", popupId);
      if (isDev) {
        // A combobox's name does not come from its content (B.9).
        queueMicrotask(() => {
          if (!element.isConnected) return;
          const labels = (element as HTMLButtonElement).labels;
          const named =
            (labels !== undefined && labels !== null && labels.length > 0) ||
            element.hasAttribute("aria-label") ||
            element.hasAttribute("aria-labelledby");
          if (!named) {
            console.error(
              `${part}: the combobox has no accessible name (its content is its value). Render a ` +
                "MultiSelect.Label (or a Field.Label), or give the Trigger an `aria-label` / " +
                "`aria-labelledby`.",
            );
          }
        });
      }
      return () => {
        if (invoker) element.removeAttribute("popovertarget");
        if (triggerRef.current === element) triggerRef.current = null;
        unregister();
      };
    },
    [checkElement, triggerRef, popover.triggerRef, popupId],
  );
  const mergedRef = useMergedRefs<HTMLElement>(ref, field.ref);

  // The browser's bubble is never shown (B.16, the fallback of memo/architect/
  // select-multiple-notes.md): Firefox keeps the bubble of the hidden element after the focus
  // hand-over, over the place where the listbox opens, and it takes the pointer input there. The
  // `invalid` is cancelled and a submission attempt focuses the Trigger, through the same
  // first-invalid collector a Field uses; `Field.Error` shows the message in the page.
  const validityCallbackRef = useCallback(
    (select: HTMLSelectElement) => {
      const onInvalid = (event: Event) => {
        // Inside a Field with a Field.Error, the Field's capture listener (it runs first) has
        // cancelled the event and reported the Trigger already: a second report would start a
        // new batch of the collector (focus out of document order, a stray announcement).
        const handled = event.defaultPrevented;
        event.preventDefault();
        if (handled) return;
        // A submission attempt sets user validity first; `checkValidity()` does not.
        const attempt = supportsUserInvalid() ? select.matches(":user-invalid") : true;
        if (attempt) collectInvalid(triggerRef.current, select.validationMessage, select);
      };
      select.addEventListener("invalid", onInvalid);
      return () => select.removeEventListener("invalid", onInvalid);
    },
    [triggerRef],
  );
  const validityMergedRef = useMergedRefs<HTMLSelectElement>(validityRef, validityCallbackRef);

  const state: MultiSelectTriggerState = {
    value: ctx.values,
    open: popover.optimistic,
    pending: ctx.pending,
    disabled,
    invalid: field.state?.invalid ?? false,
    required,
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...field.attributes,
    id: ids.trigger,
    type: "button",
    // The form owner of the reset listener when there is neither `name` nor `required` (B.10).
    form: ctx.form,
    role: "combobox",
    disabled,
    // Shown (the listbox is in the top layer); `data-open` is the optimistic one (B.9).
    "aria-expanded": popover.shown,
    "aria-controls": ids.list,
    "aria-activedescendant":
      ctx.activeValue === null ? undefined : optionId(ids.optionPrefix, ctx.activeValue),
    "aria-required": required || undefined,
    // Owned: the ref writes `popovertarget` after hydration; a render element sets none of these.
    popoverTarget: undefined,
    ...RESERVED_INVOKER_KEYS,
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      ctx.triggerClick(event.nativeEvent);
    },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      ctx.keyDown(event.nativeEvent);
    },
    onFocus: (event: FocusEvent<HTMLButtonElement>) => {
      ctx.focusIn(event.nativeEvent);
    },
    onBlur: (event: FocusEvent<HTMLButtonElement>) => {
      ctx.focusOut(event.nativeEvent);
    },
    "data-open": dataAttr(popover.optimistic),
    "data-pending": dataAttr(ctx.pending),
    "data-disabled": dataAttr(disabled),
    // A `<button>` has no `:required` (conventions 4.1 rule 2).
    "data-required": dataAttr(required),
  };

  const button = useRender<ComponentPropsWithRef<"button">, MultiSelectTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref: mergedRef,
  });

  if (!required) return button;
  return (
    <>
      {button}
      {/* The validity element (B.10): no name (it posts nothing), one empty option, `required`
          only while nothing is selected. A hidden input or a button cannot hold validity. */}
      <select
        ref={validityMergedRef}
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        form={ctx.form}
        disabled={disabled}
        required={ctx.values.length === 0}
        style={VALIDITY_STYLE}
        onFocus={() => triggerRef.current?.focus()}
        onPointerDown={preventDefault}
        onMouseDown={preventDefault}
      >
        <option value="" />
      </select>
    </>
  );
}

MultiSelectTrigger.displayName = "MultiSelectTrigger";
