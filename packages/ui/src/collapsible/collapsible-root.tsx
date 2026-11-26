"use client";
import { useCallback, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  SyntheticEvent,
  ViewTransitionClass,
} from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import {
  intendedValue,
  useControllableAction,
} from "../internal/action/use-controllable-action.js";
import { dataAttr } from "../internal/data-attr.js";
import { useDetailsCheck } from "../internal/details-summary.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useMountFixed } from "../internal/use-mount-fixed.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { CollapsibleContext } from "./collapsible-context.js";
import type { CollapsibleContextValue } from "./collapsible-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Collapsible.Root`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface CollapsibleRootState {
  /** Optimistic open state. `undefined` in JS-free mode (browser-owned, unknown to React). */
  readonly open: boolean | undefined;
  /** An action dispatched through this Collapsible is in flight (library mode only). */
  readonly pending: boolean;
  /** The Root's `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `openChangeAction`. */
export interface CollapsibleOpenChangeDetails extends ActionDetails {
  /**
   * The shared vocabulary (conventions 2.2); Collapsible dispatches two of its values.
   * `"activate"`: the user activated the Trigger. `"platform"`: the browser changed `open` itself
   * (find-in-page, a text fragment, a click before hydration); `event` is then the `toggle`
   * event, or `undefined` when the mismatch was found on mount.
   */
  readonly reason: ChangeReason;
}

/**
 * Props of `Collapsible.Root`.
 *
 * Without `open`, `defaultOpen` and `openChangeAction` the Collapsible runs in **JS-free mode**:
 * the browser owns `<details open>` and nothing runs on toggle. With any of them it runs in
 * **library mode**: the summary click is intercepted, `open` follows committed state inside a
 * transition, and the Root and Trigger show optimistic `data-open`.
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export interface CollapsibleRootProps extends Omit<
  ComponentPropsWithRef<"details">,
  "open" | "name" | "onToggle" | "className" | "style" | "children"
> {
  /** Controlled open state. `undefined` means uncontrolled. Selects library mode. */
  open?: boolean;
  /**
   * Initial open state, uncontrolled. Read once. Its presence selects library mode,
   * `defaultOpen={false}` included.
   *
   * @defaultValue `false`
   */
  defaultOpen?: boolean;
  /**
   * Called with the next open state on every change, inside the Root's transition; may be sync or
   * async (also a Server Function). Rejections reach the nearest Error Boundary. Selects library
   * mode.
   *
   * Also called with `details.reason === "platform"` when the browser opened or closed the
   * `<details>` itself (find-in-page, a click before hydration); committed state is re-applied to
   * the DOM once the action settles.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, CollapsibleOpenChangeDetails>;
  /**
   * The Trigger renders `aria-disabled` and never toggles. Enforced by a click handler, so in
   * JS-free mode it does not hold before hydration or with JS off.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Renders `interpolate-size: allow-keywords` on the `<details>` so `::details-content` can
   * transition `height` to `auto`. Chromium-only polish today; use the `grid-template-rows` form
   * for a cross-engine animation. Merged with `style`; the consumer's declaration wins.
   *
   * @defaultValue `false`
   */
  experimental_interpolateSize?: boolean;
  /**
   * Library mode only. Forwarded as `default` to the `<ViewTransition>` around the `<details>`;
   * animates the commit that ends an action (the `open` attribute flip), not the optimistic
   * `data-open` flip. Ignored (dev warning) in JS-free mode.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, CollapsibleRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, CollapsibleRootState>;
  /** Content, or a function of the part's state. The Trigger must be the first child. */
  children?: StateValue<ReactNode, CollapsibleRootState>;
  /** Must render a `<details>` element. */
  render?: RenderProp<ComponentPropsWithRef<"details">, CollapsibleRootState>;
}

/** Writes `open` to the DOM; it fires `toggle`, whose handler sees DOM === committed and returns. */
function applyOpen(element: HTMLDetailsElement, open: boolean): void {
  if (element.open !== open) element.open = open;
}

/**
 * One disclosure: the `<details>` element, which owns the open state and the transition. In
 * library mode its `open` attribute follows committed state and `data-open` / `data-pending`
 * follow optimistic state; in JS-free mode the browser owns `open`.
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export function CollapsibleRoot({
  open,
  defaultOpen,
  openChangeAction,
  disabled = false,
  experimental_interpolateSize = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: CollapsibleRootProps) {
  // Mode is decided once, from the first render's props (design 2).
  const isLibraryNow =
    open !== undefined || defaultOpen !== undefined || openChangeAction !== undefined;
  const isLibrary = useMountFixed(
    isLibraryNow,
    isDev &&
      "Collapsible.Root: the mode changed after mount (`open`, `defaultOpen` and " +
        "`openChangeAction` were all absent on one render and present on another). Switching " +
        "between JS-free and library mode is not supported.",
  );

  const { committed, optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    boolean,
    CollapsibleOpenChangeDetails
  >({
    controlled: open,
    defaultValue: defaultOpen,
    initialValue: false,
    action: openChangeAction,
    transitionTypes: (next) => transitionTypes("collapsible", next ? "expand" : "collapse"),
    // Single-valued: no reducer, latest dispatch wins (design 4.1).
    warn: { component: "Collapsible.Root", prop: "open" },
  });

  useDevWarning(
    !isLibrary && transition !== undefined,
    isDev &&
      "Collapsible.Root: `transition` has no effect in JS-free mode; the browser toggles the " +
        "<details> outside any React transition. Animate `::details-content` with CSS instead.",
  );

  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const checkElement = useDetailsCheck("Collapsible.Root");
  const libraryRef = useCallback(
    (element: HTMLDetailsElement) => {
      checkElement?.(element);
      detailsRef.current = element;
      return () => {
        detailsRef.current = null;
      };
    },
    [checkElement],
  );

  const dispatchActivate = useCallback<CollapsibleContextValue["dispatch"]>(
    (next, event) => {
      dispatch(next, createActionDetails(event, { reason: "activate" }));
    },
    [dispatch],
  );

  /**
   * The browser set `details.open` to `next` (design 2.2). Builds on what the user already
   * intends (the latest in-flight dispatch, else the optimistic value), never on the DOM: a
   * reveal equal to it dispatches nothing.
   */
  const dispatchFromDom = (next: boolean, event: Event | undefined): void => {
    if (next === intendedValue(latestInFlight, optimistic)) return;
    dispatch(next, createActionDetails(event, { reason: "platform" }));
  };

  // Platform path (design 2.2): find-in-page, a text fragment or a script flipped `open`.
  const onToggle = isLibrary
    ? (event: SyntheticEvent<HTMLDetailsElement>) => {
        const element = event.currentTarget;
        // Read `details.open`, never `ToggleEvent.newState`: `toggle` is coalesced.
        if (element.open === committed) return; // our own commit echoing back
        if (disabled) {
          // A disabled Collapsible cannot be opened by the browser either; close it again now or,
          // while an action is in flight, when the re-apply effect below runs.
          if (!pending) applyOpen(element, committed);
          return;
        }
        dispatchFromDom(element.open, event.nativeEvent);
      }
    : undefined;

  // Mount reconciliation (design 2.2): a click before hydration left `<details open>` out of step
  // with committed state. One dispatch with reason "platform" and no event; a disabled Root is
  // simply put back. Runs at mount and again when an `<Activity>` re-shows the Root; the
  // StrictMode re-run is deduplicated against the dispatch just made (intended value).
  const reconcileOnMount = useEffectEvent(() => {
    const element = detailsRef.current;
    if (element === null || element.open === committed) return;
    if (disabled) applyOpen(element, committed);
    else dispatchFromDom(element.open, undefined);
  });
  useLayoutEffect(() => {
    if (isLibrary) reconcileOnMount();
  }, [isLibrary]);

  // Re-apply committed state to the DOM once nothing is in flight: closes what find-in-page
  // revealed and the parent refused, or what a rejected action left open.
  useLayoutEffect(() => {
    if (!isLibrary || pending || latestInFlight() !== null) return;
    const element = detailsRef.current;
    if (element !== null) applyOpen(element, committed);
  }, [isLibrary, pending, committed, latestInFlight]);

  const committedOpen = isLibrary ? committed : undefined;
  const optimisticOpen = isLibrary ? optimistic : undefined;
  const rootPending = isLibrary && pending;
  const state: CollapsibleRootState = { open: optimisticOpen, pending: rootPending, disabled };

  // Memoised: the Trigger and Panel re-render only when one of these changes.
  const context = useMemo<CollapsibleContextValue>(
    () => ({
      library: isLibrary,
      disabled,
      pending: rootPending,
      committedOpen,
      optimisticOpen,
      dispatch: dispatchActivate,
    }),
    [isLibrary, disabled, rootPending, committedOpen, optimisticOpen, dispatchActivate],
  );

  const resolvedStyle = resolveStateValue(style, state);
  const finalStyle: CSSProperties | undefined = experimental_interpolateSize
    ? { interpolateSize: "allow-keywords", ...resolvedStyle }
    : resolvedStyle;

  const element = useRender<ComponentPropsWithRef<"details">, CollapsibleRootState>({
    defaultElement: "details",
    render,
    state,
    className,
    style: finalStyle,
    children,
    ref: libraryRef,
    props: rest,
    // Library-controlled layer: `open`, `name` and `onToggle` are owned by the library in at
    // least one mode, so a `render` element cannot override them either (conventions 1.2).
    libraryProps: {
      // JS-free mode: always `false`, so React never rewrites the attribute the browser owns.
      open: isLibrary ? committed : false,
      // A click before hydration changes `open` under React's feet in both modes; the mismatch is
      // expected and reconciled (library mode) or the browser's business (JS-free mode).
      suppressHydrationWarning: true,
      // A second, platform-level writer of `open`; an exclusive group is `Accordion.Root exclusive`.
      name: undefined,
      // Only installed in library mode; owning the key in JS-free mode would strip a render
      // element's own `onToggle`.
      ...(isLibrary && { onToggle }),
      "data-open": dataAttr(optimisticOpen === true),
      "data-pending": dataAttr(rootPending),
      "data-disabled": dataAttr(disabled),
    },
  });

  return useTransitionBoundary(
    "Collapsible.Root",
    isLibrary ? transition : undefined,
    <CollapsibleContext value={context}>{element}</CollapsibleContext>,
  );
}

CollapsibleRoot.displayName = "CollapsibleRoot";
