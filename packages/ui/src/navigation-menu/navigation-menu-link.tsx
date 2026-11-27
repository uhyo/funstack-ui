"use client";
import { use, useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useLatest } from "../internal/use-latest.js";
import { useRender } from "../internal/use-render.js";
import { NavigationMenuPopupContext } from "./navigation-menu-context.js";

/** `NavigationMenu.Link` has no state. */
export type NavigationMenuLinkState = Record<string, never>;

const EMPTY: Record<string, never> = {};

/**
 * Props of `NavigationMenu.Link`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export interface NavigationMenuLinkProps extends Omit<
  ComponentPropsWithRef<"a">,
  "className" | "style" | "children"
> {
  /**
   * Inside a Popup: following the link (a primary-button click with no modifier key) closes the
   * panel. `false` keeps it open (a link that changes something inside the panel). Ignored
   * outside a Popup.
   *
   * @defaultValue `true`
   */
  closeOnActivate?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, NavigationMenuLinkState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, NavigationMenuLinkState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, NavigationMenuLinkState>;
  /** Replace the default `<a>`: a router's link component (`render={<Link to="/" />}`). */
  render?: RenderProp<ComponentPropsWithRef<"a">, NavigationMenuLinkState>;
}

/** The click that navigates this page: primary button, no modifier (design 4). */
function followsInPlace(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

/** Closes the panel `item` owns: a request in library mode, `hidePopover()` in JS-free mode. */
function closePanel(item: PopoverRootValue, event: MouseEvent): void {
  if (item.mode === "library") {
    item.requestClose(event, "activate");
    return;
  }
  const popup = item.popupRef.current;
  if (popup !== null && isPopoverOpen(popup)) popup.hidePopover();
}

/**
 * A link: an `<a>` with every anchor prop passed through; the current page is marked with the
 * native `aria-current="page"`. Inside a `NavigationMenu.Popup`, following it closes the panel
 * (design 4): with a client-side router the `nav` stays mounted and a click inside a popover is
 * no light dismiss. In library mode the close is a request (`openChangeAction(false, { reason:
 * "activate" })`, a transition like a router's navigation); in JS-free mode `hidePopover()`. A
 * modified click (new tab, new window, download) leaves the panel open. Outside a Popup it does
 * nothing beyond rendering the `<a>`.
 *
 * The close is attached with `addEventListener` through the ref, so `onClick` is not owned and
 * a consumer's or a router link's own click handling runs untouched. No owned keys.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export function NavigationMenuLink({
  closeOnActivate = true,
  className,
  style,
  children,
  render,
  ...rest
}: NavigationMenuLinkProps) {
  const item = use(NavigationMenuPopupContext);
  // Read at the click: the latest committed props and Item.
  const latest = useLatest({ item, closeOnActivate });
  const ref = useCallback(
    (element: HTMLElement) => {
      const onClick = (event: MouseEvent) => {
        const { item, closeOnActivate } = latest.current;
        if (item === null || !closeOnActivate || !followsInPlace(event)) return;
        closePanel(item, event);
      };
      element.addEventListener("click", onClick);
      return () => element.removeEventListener("click", onClick);
    },
    [latest],
  );

  return useRender<ComponentPropsWithRef<"a">, NavigationMenuLinkState>({
    defaultElement: "a",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    ref,
  });
}

NavigationMenuLink.displayName = "NavigationMenuLink";
