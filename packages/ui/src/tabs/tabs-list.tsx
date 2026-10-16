"use client";
import { useEffect, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useTabsContext } from "./tabs-context.js";
import type { TabsOrientation } from "./tabs-context.js";

export interface TabsListState {
  readonly orientation: TabsOrientation;
  readonly disabled: boolean;
}

export interface TabsListProps extends Omit<
  ComponentPropsWithRef<"div">,
  "onKeyDown" | "onFocus" | "className" | "style" | "children"
> {
  /**
   * Render `focusgroup="tablist …"` and, where the browser implements it, let the browser handle
   * arrow keys, Home and End. Chromium 150+ only; elsewhere the JS path stays active.
   * Default `false`.
   */
  experimental_focusgroup?: boolean;
  className?: StateValue<string | undefined, TabsListState>;
  style?: StateValue<CSSProperties | undefined, TabsListState>;
  children?: StateValue<ReactNode, TabsListState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, TabsListState>;
}

type Move = "next" | "prev" | "first" | "last";

function resolveKey(key: string, orientation: TabsOrientation, rtl: boolean): Move | null {
  switch (key) {
    case "Home":
      return "first";
    case "End":
      return "last";
    case "ArrowRight":
      return orientation === "horizontal" ? (rtl ? "prev" : "next") : null;
    case "ArrowLeft":
      return orientation === "horizontal" ? (rtl ? "next" : "prev") : null;
    case "ArrowDown":
      return orientation === "vertical" ? "next" : null;
    case "ArrowUp":
      return orientation === "vertical" ? "prev" : null;
    default:
      return null;
  }
}

/** The tabs that belong to `list` (not to a nested tablist), in DOM order. Disabled included. */
function tabsOf(list: Element): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (tab) => tab.closest('[role="tablist"]') === list,
  );
}

function focusTab(tab: HTMLElement): void {
  // `focusVisible` shows the ring even where the engine's heuristic would not (survey: adopt).
  tab.focus({ focusVisible: true } as FocusOptions);
}

/**
 * The `role="tablist"` container. Owns arrow-key / Home / End navigation between Tabs: it only
 * moves focus; automatic activation happens in the Tab's focus handler.
 */
export function TabsList({
  experimental_focusgroup = false,
  className,
  style,
  children,
  render,
  ...rest
}: TabsListProps) {
  const ctx = useTabsContext("Tabs.List");
  const { orientation, loop, disabled, optimistic } = ctx;

  // Feature detection only when the flag is on, and only in an effect (conventions 8): markup
  // never differs between server and client.
  const nativeFocusgroup = useRef(false);
  useEffect(() => {
    nativeFocusgroup.current = experimental_focusgroup && "focusgroup" in HTMLElement.prototype;
  }, [experimental_focusgroup]);

  const state: TabsListState = { orientation, disabled };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const list = event.currentTarget;
    const target = event.target as Element;
    if (target.getAttribute("role") !== "tab" || target.closest('[role="tablist"]') !== list) {
      return;
    }
    const rtl = orientation === "horizontal" && getComputedStyle(list).direction === "rtl";
    const move = resolveKey(event.key, orientation, rtl);
    if (move === null) return;
    // The browser moves focus itself where `focusgroup` is implemented.
    if (nativeFocusgroup.current) return;

    event.preventDefault();
    const tabs = tabsOf(list);
    if (tabs.length === 0) return;
    const index = tabs.indexOf(target as HTMLElement);
    const last = tabs.length - 1;
    let nextIndex: number;
    switch (move) {
      case "first":
        nextIndex = 0;
        break;
      case "last":
        nextIndex = last;
        break;
      case "next":
        nextIndex = index >= last ? (loop ? 0 : last) : index + 1;
        break;
      case "prev":
        nextIndex = index <= 0 ? (loop ? last : 0) : index - 1;
        break;
    }
    const next = tabs[nextIndex];
    if (next !== undefined && next !== target) focusTab(next);
  };

  // With no selection no Tab has tabindex=0, so the list itself is the tab stop and hands focus
  // to the first enabled tab (design section 8). Only when focus arrives from outside the list:
  // Shift+Tab from a tab inside would otherwise bounce straight back.
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const list = event.currentTarget;
    if (event.target !== list || optimistic !== null) return;
    const from = event.relatedTarget;
    if (from instanceof Node && list.contains(from)) return;
    const tabs = tabsOf(list);
    const first = tabs.find((tab) => tab.getAttribute("aria-disabled") !== "true") ?? tabs[0];
    if (first !== undefined) focusTab(first);
  };

  const focusgroup = experimental_focusgroup
    ? `tablist ${orientation === "vertical" ? "block" : "inline"} ${loop ? "wrap" : "nowrap"}`
    : undefined;

  return useRender<ComponentPropsWithRef<"div">, TabsListState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      role: "tablist",
      "aria-orientation": orientation,
      "data-orientation": orientation,
      "data-disabled": dataAttr(disabled),
      tabIndex: optimistic === null ? 0 : undefined,
      focusgroup,
      onKeyDown,
      onFocus,
    },
  });
}

TabsList.displayName = "TabsList";
