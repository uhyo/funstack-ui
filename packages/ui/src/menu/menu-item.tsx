"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import type {
  Action,
  ActionDetails,
  RenderProp,
  StateValue,
  WhilePending,
} from "../internal/types.js";
import { usePureTrigger } from "../internal/action/use-pure-trigger.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import { useMenuContext } from "./menu-context.js";
import { useMenuItem } from "./use-menu-item.js";

/** Details passed to `Menu.Item`'s `action`. */
export interface MenuItemDetails extends ActionDetails {}

/**
 * State of `Menu.Item`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface MenuItemState {
  /** This item's `action` is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Menu.Item`.
 *
 * @see https://ui.funstack.work/components/menu
 */
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
  /**
   * Close the whole menu once `action` settles.
   *
   * @defaultValue `true`
   */
  closeOnActivate?: boolean;
  /**
   * What a click, Enter or Space does while this item's `action` is pending. `"ignore"`:
   * nothing (the event is cancelled, `aria-disabled="true"` meanwhile). `"run"`: the action runs
   * again (`data-pending` until every run has settled); a closing item closes the menu once,
   * when the last run settles and only if the latest run resolved (a rejection keeps the menu
   * open, as in `"ignore"` mode). No effect without `action`.
   *
   * @defaultValue `"ignore"`, or `"run"` with `closeOnActivate={false}`
   */
  whilePending?: WhilePending;
  /**
   * Renders `aria-disabled` and `data-disabled`: the item stays focusable and never activates.
   * It is an ordinary item for navigation; only the open focus skips items with `disabled`.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Text typeahead matches when the item's text content is not representative (an icon). */
  label?: string;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuItemState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuItemState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MenuItemState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuItemState>;
}

/**
 * A menu command: `<button type="button" role="menuitem" tabindex="-1">`. Click, Enter or Space
 * runs `action` in the item's own transition (`data-pending` on the item; a second activation
 * meanwhile is ignored and the item `aria-disabled`, unless `whilePending` is `"run"`, the
 * default of a `closeOnActivate={false}` item); once it resolves the whole menu stack closes
 * through the top-level Root (`openChangeAction(false, { reason: "activate" })` awaited, view
 * transition if set). Hovering the item focuses it.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>`), `role`, `tabIndex`, `disabled`
 * (always absent), `aria-disabled`, `onClick`, `onKeyDown`, `onPointerMove`, `data-pending`,
 * `data-disabled`, `data-typeahead`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export function MenuItem({
  action,
  closeOnActivate = true,
  whilePending,
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
  // Mixed ownership (conventions 2.5.1): an item the library closes the menu after ignores by
  // default; a keep-open item is a user-owned trigger and runs every activation.
  const trigger = usePureTrigger({
    whilePending,
    defaultWhilePending: closeOnActivate ? "ignore" : "run",
    openGeneration: menu.root.popover.openGeneration,
  });
  const { pending } = trigger;

  const { libraryProps } = useMenuItem({
    part: "Menu.Item",
    role: "menuitem",
    disabled,
    label,
    activate: (event) => {
      const details: MenuItemDetails = createActionDetails(event, {});
      // When ignoring, a second activation while this item's own run is in flight starts
      // nothing and is cancelled (the hook's guard): a link does not navigate, a composed
      // command does not run. Enter / Space reach here through the element's click, their keydown is cancelled.
      trigger.runActivation(
        event,
        () => action?.(details),
        closeOnActivate ? () => menu.root.popover.requestClose(event, "activate") : undefined,
      );
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
      // Also while pending when ignoring: an item that will not act is unavailable to AT. The
      // item is never natively disabled (`useMenuItem`'s focusable branch). Navigation keys on
      // `data-disabled` (the `disabled` prop), so a pending item is still an enabled item.
      // `libraryProps` stands in for a `disabledButton` result: its `disabled` (always
      // `undefined`) and `aria-disabled` (the `disabled` prop) are the item's disabled branch.
      ...trigger.pendingProps(libraryProps),
    },
  });
}

MenuItem.displayName = "MenuItem";
