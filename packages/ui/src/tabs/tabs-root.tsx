"use client";
import { useId, useMemo, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { TabsContext } from "./tabs-context.js";
import type { TabsActivationMode, TabsContextValue, TabsOrientation } from "./tabs-context.js";
import { tabId } from "./tabs-ids.js";

const isDev = process.env.NODE_ENV !== "production";

export type { TabsActivationMode, TabsOrientation } from "./tabs-context.js";

/** Details passed as the second argument of `valueChangeAction`. */
export interface TabsValueChangeDetails extends ActionDetails {
  /**
   * The shared vocabulary (conventions 2.2); Tabs dispatches two of its values.
   * `"activate"`: the user selected the tab (click, Enter/Space, or focus in automatic mode).
   * `"platform"`: the browser revealed a `keepMounted="until-found"` panel through find-in-page or a
   * text fragment (`details.event` is the `beforematch` event).
   */
  readonly reason: ChangeReason;
}

/**
 * State of `Tabs.Root`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface TabsRootState {
  /** Optimistic selected value, or `null`. Content rendered from it must not suspend. */
  readonly value: string | null;
  /** An action dispatched through this Tabs is in flight. */
  readonly pending: boolean;
  /** The `orientation` prop. */
  readonly orientation: TabsOrientation;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Tabs.Root`.
 *
 * @see https://ui.funstack.work/components/tabs
 */
export interface TabsRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children" | "defaultValue"
> {
  /** Controlled selected value. `null` selects nothing; `undefined` means uncontrolled. */
  value?: string | null;
  /**
   * Initial value in uncontrolled mode.
   *
   * @defaultValue `null` (no panel shown)
   */
  defaultValue?: string | null;
  /**
   * Runs inside the Root's transition whenever the user selects a tab. May be sync or async;
   * rejections reach the nearest Error Boundary and roll the selection back.
   *
   * With `activationMode="automatic"` every arrow key press calls it; prefer `"manual"` when the
   * action awaits a server round trip. A `setState` placed after your own `await` is not a
   * Transition update; wrap it in `startTransition` (React limitation).
   */
  valueChangeAction?: ChangeAction<string, TabsValueChangeDetails>;
  /**
   * Layout and arrow-key axis.
   *
   * @defaultValue `"horizontal"`
   */
  orientation?: TabsOrientation;
  /**
   * `"automatic"`: selection follows focus. `"manual"`: Enter, Space or click selects.
   *
   * @defaultValue `"automatic"`
   */
  activationMode?: TabsActivationMode;
  /**
   * Whether arrow keys wrap from the last tab to the first.
   *
   * @defaultValue `true`
   */
  loop?: boolean;
  /**
   * Disables every Tab (focusable, never dispatches).
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, TabsRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, TabsRootState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, TabsRootState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, TabsRootState>;
}

/** Looks up an element by id in the tree that contains `node` (document or shadow root). */
function findById(node: Node | null, id: string): Element | null {
  const root = node?.getRootNode() ?? (typeof document === "undefined" ? null : document);
  if (root !== null && "getElementById" in root) {
    return (root as Document | ShadowRoot).getElementById(id);
  }
  return null;
}

/**
 * Owns the Tabs state (`value`), the transition, the ids and the context. Renders a `div` with
 * `data-pending` while a selection is in flight (including a suspending panel's wait).
 *
 * Owned keys (conventions 1.2): `data-pending`, `data-orientation`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/tabs
 */
export function TabsRoot({
  value,
  defaultValue,
  valueChangeAction,
  orientation = "horizontal",
  activationMode = "automatic",
  loop = true,
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: TabsRootProps) {
  const rootId = useId();
  const rootRef = useRef<HTMLElement | null>(null);

  const { committed, optimistic, pending, dispatch } = useControllableAction<
    string | null,
    TabsValueChangeDetails
  >({
    controlled: value,
    defaultValue,
    initialValue: null,
    // Only ever dispatched with a string: the Tabs UI cannot deselect.
    action:
      valueChangeAction === undefined
        ? undefined
        : (next, details) => valueChangeAction(next as string, details),
    transitionTypes: (next, prev) => {
      // Direction is relative to the committed tab (design 10.2), by DOM order of the two tabs.
      if (next === null || prev === null || next === prev) return transitionTypes("tabs");
      const prevTab = findById(rootRef.current, tabId(rootId, prev));
      const nextTab = findById(rootRef.current, tabId(rootId, next));
      if (prevTab === null || nextTab === null) return transitionTypes("tabs");
      const following = prevTab.compareDocumentPosition(nextTab) & Node.DOCUMENT_POSITION_FOLLOWING;
      return transitionTypes("tabs", following ? "next" : "prev");
    },
    warn: { component: "Tabs.Root", prop: "value" },
  });
  // `null` is a legitimate default (no panel), but forgetting both props is the likelier cause
  // of an empty Tabs (design/components/tabs.md, resolved question 2).
  useDevWarning(
    value === undefined && defaultValue === undefined,
    isDev &&
      "Tabs.Root: neither `value` nor `defaultValue` was passed, so no tab is selected and no " +
        "panel is shown. Pass `defaultValue`, or `defaultValue={null}` to start with no selection.",
  );

  // Memoised: `dispatch` is stable, so this changes only with the state and the props below.
  const context = useMemo<TabsContextValue>(
    () => ({
      rootId,
      committed,
      optimistic,
      pending,
      orientation,
      activationMode,
      loop,
      disabled,
      select: (next, event, reason) => {
        // No-op rule against the optimistic value (conventions 2.3 item 7, design section 9.4).
        if (next === optimistic) return;
        dispatch(next, createActionDetails(event, { reason }));
      },
    }),
    [rootId, committed, optimistic, pending, orientation, activationMode, loop, disabled, dispatch],
  );

  const state: TabsRootState = { value: optimistic, pending, orientation, disabled };

  const element = useRender<ComponentPropsWithRef<"div">, TabsRootState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      "data-pending": dataAttr(pending),
      "data-orientation": orientation,
      "data-disabled": dataAttr(disabled),
    },
    ref: rootRef,
  });

  return <TabsContext value={context}>{element}</TabsContext>;
}

TabsRoot.displayName = "TabsRoot";
