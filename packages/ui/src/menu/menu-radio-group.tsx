"use client";
import { useId, useMemo, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type { ChangeAction, RenderProp, StateValue } from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useRender } from "../internal/use-render.js";
import { MenuGroupContext, MenuRadioGroupContext } from "./menu-context.js";
import type { MenuRadioGroupContextValue } from "./menu-context.js";

export interface MenuRadioGroupState {
  /** Optimistic value; `null` when no item is selected. */
  readonly value: string | null;
  /** `valueChangeAction` is in flight. */
  readonly pending: boolean;
}

export interface MenuRadioGroupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "defaultValue" | "className" | "style" | "children"
> {
  /** Controlled value; `null` selects nothing, `undefined` means uncontrolled. */
  value?: string | null;
  /** Initial value when uncontrolled. Default `null`. */
  defaultValue?: string | null;
  /**
   * Receives the chosen item's `value`, awaited inside the group's transition; the items'
   * `aria-checked` follow at once and roll back on rejection. Re-activating the selected item
   * dispatches nothing. May be a Server Function.
   */
  valueChangeAction?: ChangeAction<string>;
  className?: StateValue<string | undefined, MenuRadioGroupState>;
  style?: StateValue<CSSProperties | undefined, MenuRadioGroupState>;
  children?: StateValue<ReactNode, MenuRadioGroupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuRadioGroupState>;
}

/**
 * The state owner of a set of `Menu.RadioItem`s: `<div role="group" aria-labelledby>` (named by
 * a `Menu.GroupLabel` inside it). Emits `data-pending` while `valueChangeAction` runs.
 *
 * Owned keys (conventions 1.2): `role`, `aria-labelledby` (token-merged), `data-pending`.
 */
export function MenuRadioGroup({
  value,
  defaultValue,
  valueChangeAction,
  className,
  style,
  children,
  render,
  ...rest
}: MenuRadioGroupProps) {
  const labelId = `${useId()}-label`;
  // The work to run after a dispatch's action resolved (an item's `closeOnActivate`), keyed by
  // the dispatch's details object.
  const after = useRef(new WeakMap<object, () => void>());

  const { optimistic, pending, dispatch } = useControllableAction<string | null>({
    controlled: value,
    defaultValue,
    initialValue: null,
    action: async (next, details) => {
      if (next !== null) await valueChangeAction?.(next, details);
      after.current.get(details)?.();
    },
    transitionTypes: () => transitionTypes("menu", "select"),
    warn: { component: "Menu.RadioGroup", prop: "value" },
  });

  // Memoised (#48): `dispatch` is stable.
  const context = useMemo<MenuRadioGroupContextValue>(
    () => ({
      value: optimistic,
      pending,
      select: (next, event, then) => {
        const details = createActionDetails(event, {});
        if (then !== undefined) after.current.set(details, then);
        dispatch(next, details);
      },
    }),
    [optimistic, pending, dispatch],
  );
  const groupContext = useMemo(() => ({ labelId }), [labelId]);

  const state: MenuRadioGroupState = { value: optimistic, pending };

  const element = useRender<ComponentPropsWithRef<"div">, MenuRadioGroupState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      role: "group",
      "aria-labelledby": labelId,
      "data-pending": dataAttr(pending),
    },
  });

  return (
    <MenuGroupContext value={groupContext}>
      <MenuRadioGroupContext value={context}>{element}</MenuRadioGroupContext>
    </MenuGroupContext>
  );
}

MenuRadioGroup.displayName = "MenuRadioGroup";
