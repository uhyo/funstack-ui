"use client";
import { Activity } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, ViewTransitionClass } from "react";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useUntilFound } from "../internal/use-until-found.js";
import { useTabsContext } from "./tabs-context.js";
import type { TabsContextValue, TabsOrientation } from "./tabs-context.js";
import { panelId, tabId } from "./tabs-ids.js";

/**
 * State of `Tabs.Panel`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface TabsPanelState {
  /** The Panel's `value` prop. */
  readonly value: string;
  /** Committed: true only once the action has resolved and the render has committed. */
  readonly selected: boolean;
  /** The Root's `orientation`. */
  readonly orientation: TabsOrientation;
}

/**
 * Props of `Tabs.Panel`.
 *
 * @see https://ui.funstack.work/components/tabs
 */
export interface TabsPanelProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "hidden" | "className" | "style" | "children"
> {
  /** The tab value this panel belongs to. */
  value: string;
  /**
   * What happens while this panel is not the committed selection.
   * - `false` (default): the panel is not rendered.
   * - `true`: rendered inside `<Activity mode="hidden">`: DOM and state are preserved, effects
   *   are stopped, content is pre-rendered at low priority. Not part of server-rendered HTML.
   * - `"until-found"`: rendered with `hidden="until-found"`: DOM, state and effects stay live,
   *   the content is in server-rendered HTML, and find-in-page or a text fragment selects the
   *   tab (`details.reason === "platform"`).
   *
   * @defaultValue `false`
   */
  keepMounted?: boolean | "until-found";
  /**
   * Forwarded to the Panel's `<ViewTransition default>`. Default: no boundary.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, TabsPanelState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, TabsPanelState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, TabsPanelState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, TabsPanelState>;
}

/**
 * A `div[role=tabpanel]`. Renders the **committed** selection, so a newly selected panel that
 * suspends keeps the current panel on screen while the Root shows `data-pending`.
 *
 * Owned keys (conventions 1.2): `role`, `id`, `aria-labelledby` (token-merged), `data-selected`,
 * `hidden`.
 *
 * @see https://ui.funstack.work/components/tabs
 */
export function TabsPanel(props: TabsPanelProps) {
  const ctx = useTabsContext("Tabs.Panel");
  const { value, keepMounted = false } = props;
  const selected = ctx.committed === value;

  if (keepMounted === false) {
    return selected ? <PanelElement {...props} ctx={ctx} selected untilFound={false} /> : null;
  }
  if (keepMounted === true) {
    // The mode only changes when `committed` does, i.e. inside the Root's transition, so the
    // nested `<ViewTransition>` gets enter / exit (conventions 5.5).
    return (
      <Activity mode={selected ? "visible" : "hidden"}>
        <PanelElement {...props} ctx={ctx} selected={selected} untilFound={false} />
      </Activity>
    );
  }
  return <PanelElement {...props} ctx={ctx} selected={selected} untilFound />;
}

TabsPanel.displayName = "TabsPanel";

interface PanelElementProps extends TabsPanelProps {
  ctx: TabsContextValue;
  selected: boolean;
  untilFound: boolean;
}

/** Split out so that an unrendered panel resolves none of its function props. */
function PanelElement({
  ctx,
  selected,
  untilFound,
  value,
  keepMounted: _keepMounted,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: PanelElementProps) {
  const untilFoundRef = useUntilFound<HTMLDivElement>({
    // Not while this panel is the optimistic target: the browser has revealed it (or the user
    // selected its tab) and the action is pending; re-hiding it would undo the reveal. A
    // rejection or veto reverts the optimistic value, which re-activates the hook.
    active: untilFound && !selected && ctx.optimistic !== value,
    onMatch: (event) => ctx.select(value, event, "platform"),
  });

  const state: TabsPanelState = { value, selected, orientation: ctx.orientation };

  const element = useRender<ComponentPropsWithRef<"div">, TabsPanelState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    // `tabIndex` defaults to 0 (APG: the panel is a tab stop) and passes through.
    props: { tabIndex: 0, ...rest },
    libraryProps: {
      role: "tabpanel",
      id: panelId(ctx.rootId, value),
      "aria-labelledby": tabId(ctx.rootId, value),
      "data-selected": dataAttr(selected),
      // Boolean form for SSR; `useUntilFound` upgrades it to "until-found" (conventions 7.4).
      hidden: untilFound ? !selected : undefined,
    },
    ref: untilFound ? untilFoundRef : undefined,
  });

  return useTransitionBoundary("Tabs.Panel", transition, element);
}
