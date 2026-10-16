"use client";
import { ViewTransition } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { useTabsContext } from "./tabs-context.js";
import type { TabsOrientation } from "./tabs-context.js";
import { anchorName, panelId, tabId } from "./tabs-ids.js";

export interface TabsTabState {
  readonly value: string;
  /** Optimistic: true as soon as the user selects this tab, before the action settles. */
  readonly selected: boolean;
  /** The Root is pending and this tab is the optimistic target. */
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly orientation: TabsOrientation;
}

export interface TabsTabProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "onKeyDown" | "onFocus" | "id" | "value" | "className" | "style" | "children"
> {
  /** The value this tab selects. Must be unique within the Root. */
  value: string;
  /** Focusable but inert: `aria-disabled="true"`, never dispatches. */
  disabled?: boolean;
  /**
   * Forwarded to the Tab's `<ViewTransition default>`. Default `"none"`. Fires only on the commit
   * that settles the action (or rolls it back), never on the optimistic selection; animate the
   * selection itself with a CSS `transition` on `[data-selected]`.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, TabsTabState>;
  style?: StateValue<CSSProperties | undefined, TabsTabState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, TabsTabState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, TabsTabState>;
}

function isActivationKey(event: KeyboardEvent): boolean {
  return (
    (event.key === "Enter" || event.key === " ") &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

/**
 * A `button[role=tab]`. Renders the optimistic selection (`aria-selected`, `data-selected`,
 * roving `tabindex`) and carries `anchor-name` for the Indicator.
 */
export function TabsTab({
  value,
  disabled: disabledProp = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: TabsTabProps) {
  const ctx = useTabsContext("Tabs.Tab");
  const selected = ctx.optimistic === value;
  const pending = ctx.pending && selected;
  const disabled = ctx.disabled || disabledProp;
  const anchor = anchorName(ctx.rootId, value);

  const state: TabsTabState = {
    value,
    selected,
    pending,
    disabled,
    orientation: ctx.orientation,
  };

  const element = useRender<ComponentPropsWithRef<"button">, TabsTabState>({
    defaultElement: "button",
    render,
    state,
    className,
    // `anchor-name` sits under the consumer's style: the consumer wins (design 13.5).
    style: (s) => ({ anchorName: anchor, ...resolveStateValue(style, s) }),
    children,
    props: {
      ...rest,
      type: "button",
    },
    libraryProps: {
      role: "tab",
      id: tabId(ctx.rootId, value),
      "aria-selected": selected,
      "aria-controls": panelId(ctx.rootId, value),
      "aria-disabled": disabled ? true : undefined,
      tabIndex: selected ? 0 : -1,
      "data-selected": dataAttr(selected),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      "data-orientation": ctx.orientation,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        ctx.select(value, event.nativeEvent, "activate");
      },
      // Enter and Space are handled on keydown so a `render`ed non-button element (a link)
      // behaves the same; `preventDefault` also stops the native click / navigation.
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!isActivationKey(event)) return;
        event.preventDefault();
        if (disabled) return;
        ctx.select(value, event.nativeEvent, "activate");
      },
      // Automatic activation is selection-follows-focus (design 4.1): the arrow-key path, the
      // native `focusgroup` path, Tab into the list and programmatic focus all end here.
      onFocus: (event: FocusEvent<HTMLButtonElement>) => {
        if (ctx.activationMode !== "automatic" || disabled || selected) return;
        ctx.select(value, event.nativeEvent, "activate");
      },
    },
  });

  return <ViewTransition default={transition ?? "none"}>{element}</ViewTransition>;
}

TabsTab.displayName = "TabsTab";
