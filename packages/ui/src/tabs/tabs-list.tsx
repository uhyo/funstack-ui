"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { TabsListContext, useTabsContext } from "./tabs-context.js";
import type { TabsListContextValue, TabsOrientation } from "./tabs-context.js";
import { focusWithRing, resolveArrowKey } from "../internal/arrow-keys.js";
import { useNativeFocusgroup } from "../internal/use-native-focusgroup.js";

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

/** The tabs that belong to `list` (not to a nested tablist), in DOM order. Disabled included. */
function tabsOf(list: Element): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (tab) => tab.closest('[role="tablist"]') === list,
  );
}

/**
 * The `role="tablist"` container. Owns arrow-key / Home / End navigation between Tabs: it only
 * moves focus; automatic activation happens in the Tab's focus handler.
 *
 * Owned keys (a `render` element cannot override them, conventions 1.2): `role`,
 * `aria-orientation`, `data-orientation`, `data-disabled`, `tabIndex`, `onKeyDown`, `onFocus`,
 * and `focusgroup` when `experimental_focusgroup` is on.
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

  // The Tabs read it too: they drop `tabindex="-1"` on the native path (TabsListContextValue).
  const nativeFocusgroup = useNativeFocusgroup(experimental_focusgroup);
  const listContext = useMemo<TabsListContextValue>(
    () => ({ focusgroup: experimental_focusgroup, nativeFocusgroup }),
    [experimental_focusgroup, nativeFocusgroup],
  );

  // A value that matches no Tab (a controlled `value` for a route without a tab, design 11.5)
  // leaves no tab with tabindex=0, so the List takes over as the tab stop exactly as for `null`.
  // Read from the DOM (Tabs register nowhere) whenever the value or the List's children change; a
  // Tab added or removed by a component below that re-renders on its own is picked up on the
  // List's next render. The state only changes when the answer does.
  const listRef = useRef<HTMLElement | null>(null);
  const [unmatched, setUnmatched] = useState(false);
  useLayoutEffect(() => {
    const list = listRef.current;
    const next =
      optimistic !== null &&
      list !== null &&
      !tabsOf(list).some((tab) => tab.getAttribute("tabindex") === "0");
    if (next !== unmatched) setUnmatched(next);
  }, [optimistic, children, unmatched]);
  useDevWarning(
    unmatched,
    `Tabs: the value ${JSON.stringify(optimistic)} matches no Tabs.Tab. No tab is selected; the ` +
      "tablist itself is the tab stop. Pass null to select nothing on purpose.",
  );
  const listIsTabStop = optimistic === null || unmatched;

  const state: TabsListState = { orientation, disabled };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const list = event.currentTarget;
    const target = event.target as Element;
    if (target.getAttribute("role") !== "tab" || target.closest('[role="tablist"]') !== list) {
      return;
    }
    const rtl = orientation === "horizontal" && getComputedStyle(list).direction === "rtl";
    const move = resolveArrowKey(event.key, orientation, rtl);
    if (move === null) return;
    // The browser moves focus itself where `focusgroup` is implemented.
    if (nativeFocusgroup) return;

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
    if (next !== undefined && next !== target) focusWithRing(next);
  };

  // With no selected tab (value null or matching no Tab) no Tab has tabindex=0, so the list
  // itself is the tab stop and hands focus to the first enabled tab (design section 8). Only when
  // focus arrives from outside the list: Shift+Tab from a tab inside would otherwise bounce
  // straight back. The redirect never selects: the Tab only dispatches on focus that moves
  // between tabs.
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const list = event.currentTarget;
    if (event.target !== list || !listIsTabStop) return;
    const from = event.relatedTarget;
    if (from instanceof Node && list.contains(from)) return;
    const tabs = tabsOf(list);
    const first = tabs.find((tab) => tab.getAttribute("aria-disabled") !== "true") ?? tabs[0];
    if (first !== undefined) focusWithRing(first);
  };

  const focusgroup = experimental_focusgroup
    ? // `nomemory` + `focusgroupstart` on the selected Tab: Tab always enters on the selected tab
      // (APG), not on the last focused one, which differs in manual activation.
      `tablist ${orientation === "vertical" ? "block" : "inline"} ${loop ? "wrap" : "nowrap"} nomemory`
    : undefined;

  const element = useRender<ComponentPropsWithRef<"div">, TabsListState>({
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
      tabIndex: listIsTabStop ? 0 : undefined,
      // Owned only while the flag is on; otherwise the key is omitted, not `undefined`, so it is not
      // owned (conventions 1.2).
      ...(focusgroup !== undefined && { focusgroup }),
      onKeyDown,
      onFocus,
    },
    ref: listRef,
  });

  return <TabsListContext value={listContext}>{element}</TabsListContext>;
}

TabsList.displayName = "TabsList";
