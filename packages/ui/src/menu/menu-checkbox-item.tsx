"use client";
import { useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type { ChangeAction, RenderProp, StateValue } from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import { closeStackLater, useMenuContext } from "./menu-context.js";
import type { MenuItemProps } from "./menu-item.js";
import { useMenuItem } from "./use-menu-item.js";

/**
 * State of `Menu.CheckboxItem`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface MenuCheckboxItemState {
  /** Optimistic checked state (`aria-checked`). */
  readonly checked: boolean;
  /** `checkedChangeAction` is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Menu.CheckboxItem`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export interface MenuCheckboxItemProps extends Omit<
  MenuItemProps,
  "action" | "closeOnActivate" | "className" | "style" | "children" | "render"
> {
  /** Controlled checked state. `undefined` means uncontrolled. */
  checked?: boolean;
  /**
   * Initial checked state when uncontrolled.
   *
   * @defaultValue `false`
   */
  defaultChecked?: boolean;
  /**
   * Awaited inside the item's transition; `aria-checked` flips at once and rolls back on
   * rejection (which reaches the nearest Error Boundary above the item). May be a Server
   * Function.
   */
  checkedChangeAction?: ChangeAction<boolean>;
  /**
   * Close the whole menu once the change settles. When `false` the menu stays open.
   *
   * @defaultValue `false`
   */
  closeOnActivate?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuCheckboxItemState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuCheckboxItemState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MenuCheckboxItemState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuCheckboxItemState>;
}

/**
 * A checkable menu item: `<button type="button" role="menuitemcheckbox" aria-checked>`. Click,
 * Enter or Space toggles it through its own transition with optimistic `aria-checked` /
 * `data-checked` and `data-pending`; the menu stays open unless `closeOnActivate`.
 *
 * Owned keys (conventions 1.2): those of `Menu.Item`, plus `aria-checked` and `data-checked`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export function MenuCheckboxItem({
  checked,
  defaultChecked,
  checkedChangeAction,
  closeOnActivate = false,
  disabled = false,
  label,
  className,
  style,
  children,
  render,
  ...rest
}: MenuCheckboxItemProps) {
  const menu = useMenuContext("Menu.CheckboxItem");
  // The close to run after a dispatch's action resolved, keyed by the dispatch's details.
  const after = useRef(new WeakMap<object, () => void>());
  const { optimistic, pending, dispatch } = useControllableAction<boolean>({
    controlled: checked,
    defaultValue: defaultChecked,
    initialValue: false,
    action: async (next, details) => {
      await checkedChangeAction?.(next, details);
      after.current.get(details)?.();
    },
    transitionTypes: (next) => transitionTypes("menu", next ? "check" : "uncheck"),
    warn: { component: "Menu.CheckboxItem", prop: "checked" },
  });

  const { libraryProps } = useMenuItem({
    part: "Menu.CheckboxItem",
    role: "menuitemcheckbox",
    disabled,
    label,
    activate: (event) => {
      const details = createActionDetails(event, {});
      if (closeOnActivate) after.current.set(details, closeStackLater(menu, event));
      dispatch(!optimistic, details);
    },
  });

  const state: MenuCheckboxItemState = { checked: optimistic, pending, disabled };

  return useRender<ComponentPropsWithRef<"button">, MenuCheckboxItemState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...(rendersButton(render) && { type: "button" as const }),
      ...libraryProps,
      "aria-checked": optimistic,
      "data-checked": dataAttr(optimistic),
      "data-pending": dataAttr(pending),
    },
  });
}

MenuCheckboxItem.displayName = "MenuCheckboxItem";
