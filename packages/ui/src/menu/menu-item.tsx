"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import { useMenuContext } from "./menu-context.js";
import { useMenuItem } from "./use-menu-item.js";

/** Details passed to `Menu.Item`'s `action`. */
export interface MenuItemDetails extends ActionDetails {}

export interface MenuItemState {
  /** This item's `action` is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface MenuItemProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "onKeyDown" | "onPointerMove" | "disabled" | "className" | "style" | "children"
> {
  /**
   * Runs inside this item's own transition (`data-pending` on the item); the menu stays open
   * until it settles, then the whole menu closes (`closeOnActivate`). May be a Server Function
   * (`details.event` is virtual). A rejection leaves the menu open and reaches the nearest Error
   * Boundary above the item. Without `action`, activation only closes.
   */
  action?: Action<[details: MenuItemDetails]>;
  /** Close the whole menu once `action` settles. Default `true`. */
  closeOnActivate?: boolean;
  /**
   * Renders `aria-disabled` and `data-disabled`: the item stays focusable and never activates;
   * the arrows, Home / End and typeahead skip it.
   */
  disabled?: boolean;
  /** Text typeahead matches when the item's text content is not representative (an icon). */
  label?: string;
  className?: StateValue<string | undefined, MenuItemState>;
  style?: StateValue<CSSProperties | undefined, MenuItemState>;
  children?: StateValue<ReactNode, MenuItemState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuItemState>;
}

/**
 * A menu command: `<button type="button" role="menuitem" tabindex="-1">`. Click, Enter or Space
 * runs `action` in the item's own transition (`data-pending` and `aria-disabled` on the item; a
 * second activation meanwhile is ignored); once it resolves the whole menu stack closes
 * through the top-level Root (`openChangeAction(false, { reason: "activate" })` awaited, view
 * transition if set). Hovering the item focuses it.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>`), `role`, `tabIndex`, `disabled`
 * (always absent), `aria-disabled`, `onClick`, `onKeyDown`, `onPointerMove`, `data-pending`,
 * `data-disabled`, `data-typeahead`.
 */
export function MenuItem({
  action,
  closeOnActivate = true,
  disabled = false,
  label,
  className,
  style,
  children,
  render,
  ...rest
}: MenuItemProps) {
  const menu = useMenuContext("Menu.Item");
  // The close belongs to the top-level menu, so its open generation guards it.
  const { pending, run } = useActionTrigger({ openGeneration: menu.root.popover.openGeneration });

  const { libraryProps } = useMenuItem({
    part: "Menu.Item",
    role: "menuitem",
    disabled,
    label,
    activate: (event) => {
      const details: MenuItemDetails = createActionDetails(event, {});
      // A second activation while this item's own run is in flight starts nothing and is
      // cancelled (the hook's guard, #81): a link does not navigate, a composed command does not
      // run. Enter / Space reach here through the element's click, their keydown is cancelled.
      const started = run(
        () => action?.(details),
        closeOnActivate ? () => menu.root.popover.requestClose(event, "activate") : undefined,
      );
      if (!started) event.preventDefault();
    },
  });

  const state: MenuItemState = { pending, disabled };

  return useRender<ComponentPropsWithRef<"button">, MenuItemState>({
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
      // Also while pending (#81): an item that will not act is unavailable to AT. Navigation keys
      // on `data-disabled` (the `disabled` prop), so a pending item is still an enabled item.
      "aria-disabled": disabled || pending ? true : undefined,
      "data-pending": dataAttr(pending),
    },
  });
}

MenuItem.displayName = "MenuItem";
