"use client";
import { use } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { MenuCheckboxItemProps } from "./menu-checkbox-item.js";
import { closeStackLater, MenuRadioGroupContext, useMenuContext } from "./menu-context.js";
import { useMenuItem } from "./use-menu-item.js";

export interface MenuRadioItemState {
  /** This item is the group's optimistic value (`aria-checked`). */
  readonly checked: boolean;
  /** The group's change to this item is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

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
  className?: StateValue<string | undefined, MenuRadioItemState>;
  style?: StateValue<CSSProperties | undefined, MenuRadioItemState>;
  children?: StateValue<ReactNode, MenuRadioItemState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuRadioItemState>;
}

/**
 * One option of a `Menu.RadioGroup`: `<button type="button" role="menuitemradio" aria-checked>`.
 * Activation selects it through the group's transition (nothing is dispatched when it is already
 * selected); the menu stays open unless `closeOnActivate`.
 *
 * Owned keys (conventions 1.2): those of `Menu.Item`, plus `aria-checked`, `data-checked`, and
 * `value` (not rendered: a menu item is not a form control).
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

  const state: MenuRadioItemState = { checked, pending, disabled };

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
