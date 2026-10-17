"use client";
import { useLayoutEffect, useRef } from "react";
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, ViewTransitionClass } from "react";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { guardCheckableChange, useNativeChecked } from "../internal/use-native-checked.js";
import { useRender } from "../internal/use-render.js";
import { useCheckboxGroupContext } from "./checkbox-group-context.js";
import type { CheckboxGroupPatch } from "./checkbox-group-context.js";
import { syncPresence } from "./sync-presence.js";

export interface CheckboxGroupParentState {
  readonly values: readonly string[];
  /** Every value in `values` is optimistically checked (`false` when `values` is empty). */
  readonly checked: boolean;
  /**
   * Some but not all of `values` are optimistically checked. Never true together with
   * `checked`. Not suspended while pending (it is derived from optimistic state).
   */
  readonly indeterminate: boolean;
  /** The Root is pending and at least one of `values` differs between optimistic and committed. */
  readonly pending: boolean;
  /** Disabled by its own prop or by `Root disabled`. */
  readonly disabled: boolean;
}

export interface CheckboxGroupParentProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "type"
  | "name"
  | "value"
  | "checked"
  | "defaultChecked"
  | "defaultValue"
  | "form"
  | "required"
  | "aria-checked"
  | "onChange"
  | "className"
  | "style"
  | "children"
> {
  /**
   * The Item values this Parent controls (usually every Item of the group). Its checked and
   * mixed states are derived from them; its click checks or unchecks all of them. Values with
   * no Item are still added to / removed from the group's value.
   */
  values: string[];
  /** Native `disabled`: unfocusable, never dispatches. */
  disabled?: boolean;
  /**
   * Forwarded to the Parent's `<ViewTransition default>`. Default: no boundary. Fires only on the
   * commit that settles the action (or rolls it back), never on the optimistic flip; animate the
   * flip itself with CSS on `:checked` / `:indeterminate`.
   *
   * Static: without `transition` the part renders no `<ViewTransition>`; changing it between
   * `undefined` and a value remounts the element. Any value, `"none"` included, makes a mount or
   * `<Activity>` reveal of this part inside a transition start a document view transition: the
   * page cross-fades for about 250 ms and the next transition commit waits for it (issue #35).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CheckboxGroupParentState>;
  style?: StateValue<CSSProperties | undefined, CheckboxGroupParentState>;
  /** Replace the rendered element. Must keep an `<input>`; the library sets `type="checkbox"`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, CheckboxGroupParentState>;
}

/** `checked` / `indeterminate` of a Parent over `values` against `set` (design 6.1). */
function derive(values: readonly string[], set: ReadonlySet<string>) {
  let inSet = 0;
  for (const v of values) if (set.has(v)) inSet += 1;
  const checked = values.length > 0 && inSet === values.length;
  return { checked, indeterminate: inSet > 0 && !checked };
}

/**
 * The mixed-state "select all" checkbox of a group (WAI-ARIA APG "Checkbox (Mixed-State)"):
 * `<input type="checkbox">` checked when every value in `values` is in the group's optimistic
 * set, mixed (`el.indeterminate`, `data-indeterminate`) when some are. A click checks every value
 * when mixed, unchecks every value when checked, and from unchecked restores the last partial
 * combination of its values the group committed (seeded at mount), else checks every value. Each
 * click is one dispatch through the Root's `valueChangeAction`. Never submitted (no `name`).
 *
 * Owned keys (conventions 1.2): `type`, `name` (removed), `value` (removed), `checked`,
 * `defaultChecked`, `indeterminate` (stripped; the property is set), `required` (removed), `form`
 * (removed), `disabled`, `aria-checked` (removed), `data-checked`, `data-indeterminate`,
 * `data-pending`, `data-disabled`. `onChange` is merged.
 */
export function CheckboxGroupParent({
  values,
  disabled: disabledProp = false,
  transition,
  className,
  style,
  render,
  ...rest
}: CheckboxGroupParentProps) {
  const ctx = useCheckboxGroupContext("CheckboxGroup.Parent");
  const { checked, indeterminate } = derive(values, ctx.optimistic);
  const pending = ctx.pending && values.some((v) => ctx.optimistic.has(v) !== ctx.committed.has(v));
  const disabled = ctx.disabled || disabledProp;

  // The APG restore memory: the last partial combination of `values` the group committed
  // (design 6.2). Committed, not optimistic, so a partial state that only ever rolled back is
  // never restored. The first run seeds it from the mount-time value.
  const memory = useRef<readonly string[] | null>(null);
  const { committed } = ctx;
  useLayoutEffect(() => {
    const inCommitted = values.filter((v) => committed.has(v));
    if (inCommitted.length > 0 && inCommitted.length < values.length) {
      memory.current = inCommitted;
    }
  }, [committed, values]);

  const inputRef = useNativeChecked({
    type: "checkbox",
    component: "CheckboxGroup.Parent",
    checked,
    indeterminate,
    group: true,
    onItemMounted: (el) => {
      if (el !== null) {
        // A click before hydration flipped the box (design 8.1): report it as the Parent's
        // semantic before the Root reads the group.
        if (el.checked !== checked) ctx.reportParent(values, el.checked);
        syncPresence(el, "data-checked", checked);
        syncPresence(el, "data-indeterminate", indeterminate);
        syncPresence(el, "data-pending", pending);
        syncPresence(el, "data-disabled", disabled);
      }
      ctx.onItemMounted(el);
    },
    defaultChecked:
      ctx.defaultValue === undefined ? undefined : derive(values, ctx.defaultValue).checked,
  });

  /** The click cycle of design 6.2. */
  const cyclePatch = (): CheckboxGroupPatch => {
    if (checked) return { added: [], removed: values };
    if (indeterminate) return { added: values.filter((v) => !ctx.optimistic.has(v)), removed: [] };
    const restore = memory.current?.filter((v) => values.includes(v)) ?? [];
    return { added: restore.length > 0 ? restore : values, removed: [] };
  };

  const state: CheckboxGroupParentState = { values, checked, indeterminate, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"input">, CheckboxGroupParentState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    ref: inputRef,
    props: rest,
    libraryProps: {
      type: "checkbox",
      // A Parent is not a value: it never posts and is never required.
      name: undefined,
      value: undefined,
      required: undefined,
      form: undefined,
      checked,
      defaultChecked: undefined,
      // Not a DOM attribute; the hook sets the property. Owned so that a `render` element's own
      // `indeterminate` prop (which react-dom would warn about) is stripped.
      ...({ indeterminate: undefined } as object),
      "aria-checked": undefined,
      disabled: disabledProp,
      "data-checked": dataAttr(checked),
      "data-indeterminate": dataAttr(indeterminate),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const nativeEvent = event.nativeEvent;
        guardCheckableChange(
          nativeEvent,
          () => ctx.apply(cyclePatch(), nativeEvent),
          "CheckboxGroup.Parent",
        );
      },
    },
  });

  return useTransitionBoundary("CheckboxGroup.Parent", transition, element);
}

CheckboxGroupParent.displayName = "CheckboxGroupParent";
