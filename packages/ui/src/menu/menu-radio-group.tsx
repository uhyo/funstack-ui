"use client";
import { useId, useMemo, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import { callAction } from "../internal/action/call-action.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useControllableAction } from "../internal/action/use-controllable-action.js";
import { useRender } from "../internal/use-render.js";
import { MenuGroupContext, MenuRadioGroupContext } from "./menu-context.js";
import type { MenuRadioGroupContextValue } from "./menu-context.js";

/**
 * State of `Menu.RadioGroup`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface MenuRadioGroupState {
  /** Optimistic value; `null` when no item is selected. */
  readonly value: string | null;
  /** `valueChangeAction` is in flight. */
  readonly pending: boolean;
}

/** Details passed as the second argument of `Menu.RadioGroup`'s `valueChangeAction`. */
export interface MenuRadioGroupValueChangeDetails extends ActionDetails {
  /**
   * Always `"activate"`: a `Menu.RadioItem` was chosen (click, Enter or Space); `event` is the
   * native `click` or `keydown` event.
   */
  readonly reason: ChangeReason;
}

/**
 * Props of `Menu.RadioGroup`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export interface MenuRadioGroupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "defaultValue" | "className" | "style" | "children"
> {
  /** Controlled value; `null` selects nothing, `undefined` means uncontrolled. */
  value?: string | null;
  /**
   * Initial value when uncontrolled.
   *
   * @defaultValue `null`
   */
  defaultValue?: string | null;
  /**
   * Receives the chosen item's `value`, awaited inside the group's transition; the items'
   * `aria-checked` follow at once and roll back on rejection. Re-activating the selected item
   * dispatches nothing. May be a Server Function.
   */
  valueChangeAction?: ChangeAction<string, MenuRadioGroupValueChangeDetails>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuRadioGroupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuRadioGroupState>;
  /** The RadioItems and a GroupLabel. May be a function of the part's state. */
  children?: StateValue<ReactNode, MenuRadioGroupState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuRadioGroupState>;
}

/**
 * The state owner of a set of `Menu.RadioItem`s: `<div role="group" aria-labelledby>` (named by
 * a `Menu.GroupLabel` inside it). Emits `data-pending` while `valueChangeAction` runs.
 *
 * Owned keys (conventions 1.2): `role`, `aria-labelledby` (token-merged), `data-pending`.
 *
 * @see https://ui.funstack.work/components/menu
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

  const { optimistic, pending, dispatch } = useControllableAction<
    string | null,
    MenuRadioGroupValueChangeDetails
  >({
    controlled: value,
    defaultValue,
    initialValue: null,
    action: async (next, details) => {
      // Through `callAction`: a `details.reject()` must skip the close too (conventions 2.4.1).
      if (next !== null) {
        await (valueChangeAction === undefined
          ? undefined
          : callAction("Menu.RadioGroup", details, (d) => valueChangeAction(next, d)));
      }
      after.current.get(details)?.();
    },
    transitionTypes: () => transitionTypes("menu", "select"),
    warn: { component: "Menu.RadioGroup", prop: "value" },
  });

  // Memoised: `dispatch` is stable.
  const context = useMemo<MenuRadioGroupContextValue>(
    () => ({
      value: optimistic,
      pending,
      select: (next, event, then) => {
        const details = createActionDetails(event, { reason: "activate" as const });
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
