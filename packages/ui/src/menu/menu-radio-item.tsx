"use client";
import { use } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { MenuCheckboxItemProps } from "./menu-checkbox-item.js";
import { closeStackLater, MenuRadioGroupContext, useMenuContext } from "./menu-context.js";
import { useMenuItem } from "./use-menu-item.js";

/**
 * State of `Menu.RadioItem`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface MenuRadioItemState {
  /** The item's `value` prop. */
  readonly value: string;
  /** This item is the group's optimistic value (`aria-checked`). */
  readonly checked: boolean;
  /** The group's change to this item is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Menu.RadioItem`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export interface MenuRadioItemProps extends Omit<
  MenuCheckboxItemProps,
  | "checked"
  | "defaultChecked"
  | "checkedChangeAction"
  | "className"
  | "style"
  | "children"
  | "render"
> {
  /** The value the group's `valueChangeAction` receives when this item is chosen. */
  value: string;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuRadioItemState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuRadioItemState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MenuRadioItemState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuRadioItemState>;
}

/**
 * One option of a `Menu.RadioGroup`: `<button type="button" role="menuitemradio" aria-checked>`.
 * Activation selects it through the group's transition (nothing is dispatched when it is already
 * selected); the menu stays open unless `closeOnActivate`.
 *
 * Owned keys (conventions 1.2): those of `Menu.Item`, plus `aria-checked`, `data-checked`, and
 * `value` (not rendered: a menu item is not a form control).
 *
 * @see https://ui.funstack.work/components/menu
 */
export function MenuRadioItem({
  value,
  closeOnActivate = false,
  disabled = false,
  label,
  className,
  style,
  children,
  render,
  ...rest
}: MenuRadioItemProps) {
  const menu = useMenuContext("Menu.RadioItem");
  const group = use(MenuRadioGroupContext);
  if (group === null) throw new Error("Menu.RadioItem must be rendered inside a Menu.RadioGroup.");

  const checked = group.value === value;
  const pending = group.pending && checked;

  const { libraryProps } = useMenuItem({
    part: "Menu.RadioItem",
    role: "menuitemradio",
    disabled,
    label,
    activate: (event) => {
      const close = closeOnActivate ? closeStackLater(menu, event) : undefined;
      // Re-activating the selected item changes nothing (conventions 2.3 item 8); with
      // `closeOnActivate` it still closes the menu, as any activation does.
      if (checked) {
        close?.();
        return;
      }
      group.select(value, event, close);
    },
  });

  const state: MenuRadioItemState = { value, checked, pending, disabled };

  return useRender<ComponentPropsWithRef<"button">, MenuRadioItemState>({
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
      value: undefined,
      "aria-checked": checked,
      "data-checked": dataAttr(checked),
      "data-pending": dataAttr(pending),
    },
  });
}

MenuRadioItem.displayName = "MenuRadioItem";
