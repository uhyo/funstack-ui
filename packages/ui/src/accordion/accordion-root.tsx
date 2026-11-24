"use client";
import {
  useCallback,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithRef, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { compareDocumentOrder, sortByDocumentOrder } from "../internal/dom-order.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { intendedValue, useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useLatest } from "../internal/use-latest.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { useValueSet } from "../internal/use-value-set.js";
import { EMPTY_SET, setsEqual, sortByOrder } from "../internal/value-set.js";
import type { ValueSet } from "../internal/value-set.js";
import { AccordionRootContext } from "./accordion-context.js";
import type { AccordionMode, AccordionRootContextValue } from "./accordion-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Accordion.Root`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface AccordionRootState {
  /** An action dispatched through this Accordion is in flight (library mode only). */
  readonly pending: boolean;
  /** The Root's `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `valueChangeAction`. */
export interface AccordionValueChangeDetails extends ActionDetails {
  /**
   * The shared vocabulary (conventions 2.2); Accordion dispatches two of its values.
   * `"activate"`: the user activated a Trigger. `"platform"`: the browser changed `open` itself
   * (find-in-page, a text fragment, a click before hydration); `event` is then the `toggle`
   * event, or `undefined` when the mismatch was found on mount.
   */
  readonly reason: ChangeReason;
  /** The item whose open state changed. */
  readonly item: string;
  /** That item's new open state. */
  readonly open: boolean;
}

interface AccordionRootBaseProps extends Omit<
  ComponentPropsWithRef<"div">,
  // `defaultValue` is also a native HTMLAttributes member; the Accordion's own definition wins.
  "onKeyDown" | "defaultValue" | "className" | "style" | "children"
> {
  /**
   * Disables every item: triggers render `aria-disabled` and never dispatch.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Renders `interpolate-size: allow-keywords` on the root so `::details-content` can transition
   * `height` to `auto`. Chromium-only polish today; use the `grid-template-rows` form for a
   * cross-engine animation. Merged with `style`; the consumer's declaration wins.
   *
   * @defaultValue `false`
   */
  experimental_interpolateSize?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, AccordionRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, AccordionRootState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, AccordionRootState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, AccordionRootState>;
}

/**
 * Props of `Accordion.Root` in multiple mode (the default): any number of items open, `value` is
 * a `string[]`.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export interface AccordionRootMultipleProps extends AccordionRootBaseProps {
  /**
   * Any number of items may be open.
   *
   * @defaultValue `false`
   */
  exclusive?: false;
  /** Controlled open items. `undefined` means uncontrolled; `[]` means none open. */
  value?: string[];
  /** Initial open items in uncontrolled library mode. */
  defaultValue?: string[];
  /**
   * Called with the next open items on every change. Runs inside the Root's transition; may be
   * sync or async (also a Server Function). Rejections reach the nearest Error Boundary.
   *
   * May also be called with `details.reason === "platform"` when the browser opened an item
   * itself (find-in-page, a click before hydration); committed state is re-applied to the DOM
   * once the action settles.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  valueChangeAction?: ChangeAction<string[], AccordionValueChangeDetails>;
}

/**
 * Props of `Accordion.Root` in exclusive mode (`exclusive`): at most one item open, `value` is
 * `string | null`.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export interface AccordionRootExclusiveProps extends AccordionRootBaseProps {
  /**
   * At most one item open. JS-free mode: renders the same `name` on every `<details>` (the
   * platform's exclusive group). Library mode: the value is a single item or `null`.
   */
  exclusive: true;
  /** Controlled open item. `undefined` means uncontrolled; `null` means none open. */
  value?: string | null;
  /** Initial open item in uncontrolled library mode. */
  defaultValue?: string | null;
  /** See {@link AccordionRootMultipleProps.valueChangeAction}. */
  valueChangeAction?: ChangeAction<string | null, AccordionValueChangeDetails>;
}

/**
 * Props of `Accordion.Root`, discriminated on `exclusive`.
 *
 * Without `value`, `defaultValue` and `valueChangeAction` the Accordion runs in **JS-free mode**:
 * the browser owns each `<details open>`, nothing runs on toggle, and `exclusive` renders `name`.
 * With any of them it runs in **library mode**: the summary click is intercepted, `open` is driven
 * by committed state inside a transition, and triggers show optimistic `data-open`.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export type AccordionRootProps = AccordionRootMultipleProps | AccordionRootExclusiveProps;

type AccordionValue = string[] | string | null;
type OpenSet = ValueSet;

/**
 * Converts the open set back to the public value. Multiple mode lists the items in `order` (the
 * registered Items' values in document order, design 2.3), not in the order they were opened;
 * unregistered values keep their insertion order at the end.
 */
function fromSet(set: OpenSet, exclusive: boolean, order: readonly string[]): AccordionValue {
  if (exclusive) {
    const [first] = set;
    return first ?? null;
  }
  return sortByOrder(set, order);
}

/** The optimistic reducer of design 4.1: add/remove one item, or replace when exclusive. */
function reduce(set: OpenSet, item: string, open: boolean, exclusive: boolean): OpenSet {
  if (!open) {
    if (!set.has(item)) return set;
    const next = new Set(set);
    next.delete(item);
    return next;
  }
  if (exclusive) return new Set([item]);
  return set.has(item) ? set : new Set(set).add(item);
}

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

/** Writes `open` to the DOM; it fires `toggle`, whose handler sees DOM === committed and returns. */
function applyOpen(element: HTMLDetailsElement, open: boolean): void {
  if (element.open !== open) element.open = open;
}

function isEnabledTrigger(el: HTMLElement): boolean {
  return el.getAttribute("aria-disabled") !== "true";
}

/**
 * Picks the trigger to focus for an arrow/Home/End key: `sorted` is every registered trigger in
 * document order; disabled ones are skipped; arrows wrap. Works when `current` is itself disabled
 * (disabled triggers stay focusable).
 */
function nextTrigger(
  sorted: readonly HTMLElement[],
  current: HTMLElement,
  key: string,
): HTMLElement | undefined {
  const enabled = sorted.filter(isEnabledTrigger);
  if (enabled.length === 0) return undefined;
  if (key === "Home") return enabled[0];
  if (key === "End") return enabled[enabled.length - 1];
  const position = sorted.indexOf(current);
  if (key === "ArrowDown") {
    return enabled.find((el) => sorted.indexOf(el) > position) ?? enabled[0];
  }
  return enabled.findLast((el) => sorted.indexOf(el) < position) ?? enabled[enabled.length - 1];
}

/**
 * The accordion container: a `div` that owns the open state, the transition, the context the
 * other parts read, and ArrowUp/ArrowDown/Home/End navigation between triggers.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export function AccordionRoot(props: AccordionRootProps) {
  const {
    exclusive: exclusiveProp = false,
    value,
    defaultValue,
    valueChangeAction,
    disabled = false,
    experimental_interpolateSize = false,
    className,
    style,
    children,
    render,
    ...rest
  } = props;

  // Mode is decided once, from the first render's props (design 12).
  const isLibraryNow =
    value !== undefined || defaultValue !== undefined || valueChangeAction !== undefined;
  const [mode] = useState<AccordionMode>(isLibraryNow ? "library" : "static");
  useDevWarning(
    (mode === "library") !== isLibraryNow,
    isDev &&
      "Accordion.Root: the mode changed after mount (`value`, `defaultValue` and `valueChangeAction` " +
        "were all absent on one render and present on another). Switching between JS-free and " +
        "library mode is not supported.",
  );

  // Exclusive or multiple is decided once too, like ToggleGroup's mode (design 12): the reducer,
  // the value shape handed to the action and the static `name` all follow the mounted mode.
  const [exclusive] = useState(exclusiveProp);
  useDevWarning(
    exclusive !== exclusiveProp,
    isDev &&
      "Accordion.Root: `exclusive` changed after mount. Switching between exclusive and " +
        "multiple mode is not supported; the accordion keeps the mode it mounted with.",
  );

  // Both prop variants are narrowed by `exclusive` at the call site; internally one signature.
  const action = valueChangeAction as
    | ChangeAction<AccordionValue, AccordionValueChangeDetails>
    | undefined;

  const controlledSet = useValueSet(value);
  const defaultSet = useValueSet(defaultValue);

  const items = useRef(new Map<HTMLDetailsElement, string>());
  const triggers = useRef(new Set<HTMLElement>());
  /** The registered Items in document order. Reads the DOM: handlers and effects only. */
  const sortedItems = (): [HTMLDetailsElement, string][] =>
    sortByDocumentOrder([...items.current], ([element]) => element);
  const registeredValues = () => sortedItems().map(([, v]) => v);

  const { committed, optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    OpenSet,
    AccordionValueChangeDetails
  >({
    controlled: controlledSet,
    defaultValue: defaultSet,
    initialValue: EMPTY_SET,
    action:
      action && ((next, details) => action(fromSet(next, exclusive, registeredValues()), details)),
    transitionTypes: (_next, _prev, details) =>
      transitionTypes("accordion", details.open ? "expand" : "collapse"),
    // Multiple: one item per dispatch, re-based on the committed set; it is also how the
    // uncontrolled commit is folded over the resolved dispatches (#150). Exclusive is
    // single-valued: no reducer, so the optimistic value is `next` and the latest dispatch
    // commits it, like Tabs.
    //
    // The mount reconciliation folds every pre-hydration click into one `next` and is dispatched
    // with `whole` (adopted whole, bypassing the reducer). It never sits in a burst behind a
    // click whose action later rejects: it runs only from the Root's mount layout effect, the
    // Root's first possible dispatch (children do not dispatch from layout effects, and no user
    // event can run between a commit and its layout effects). It runs again only when an
    // `<Activity>` re-shows the Root; a pending click's item then has DOM `open` equal to the
    // optimistic value, so `next` equals the intended value and nothing is dispatched.
    reducer: exclusive
      ? undefined
      : (prev, _next, details) => reduce(prev, details.item, details.open, false),
    warn: { component: "Accordion.Root", prop: "value" },
  });

  const registerItem = useCallback((itemValue: string, element: HTMLDetailsElement) => {
    items.current.set(element, itemValue);
    return () => {
      items.current.delete(element);
    };
  }, []);

  const registerTrigger = useCallback((element: HTMLElement) => {
    triggers.current.add(element);
    return () => {
      triggers.current.delete(element);
    };
  }, []);

  const dispatchChange = useCallback(
    (
      next: OpenSet,
      item: string,
      open: boolean,
      reason: ChangeReason,
      event: Event | undefined,
      whole = false,
    ): void => {
      dispatch(next, createActionDetails(event, { reason, item, open }), { whole });
    },
    [dispatch],
  );

  // The two dispatchers below read the last committed optimistic set through `latest`, so they
  // keep one identity and the Items' contexts are reused across open-state changes: a
  // handler only ever runs against the committed UI, so this is the set it closed over before.
  const latest = useLatest({ optimistic, exclusive });

  const dispatchFromTrigger = useCallback<AccordionRootContextValue["dispatch"]>(
    (item, open, event) => {
      const { optimistic, exclusive } = latest.current;
      // `next` comes from the optimistic set: what the user sees and intends (design 2.2).
      dispatchChange(reduce(optimistic, item, open, exclusive), item, open, "activate", event);
    },
    [dispatchChange, latest],
  );

  const dispatchFromDom = useCallback<AccordionRootContextValue["dispatchFromDom"]>(
    (item, open, event) => {
      const { optimistic, exclusive } = latest.current;
      // The browser flipped one item (design 2.3). `next` builds on what the user already
      // intends (the latest in-flight dispatch, else the optimistic set), never on the DOM: a
      // pending optimistic open would otherwise be lost to latest-wins. Exclusive mode therefore
      // lets the toggled item win when it opened (design walkthrough 9.6).
      const base = intendedValue(latestInFlight, optimistic);
      const next = reduce(base, item, open, exclusive);
      if (setsEqual(next, base)) return;
      dispatchChange(next, item, open, "platform", event);
    },
    [dispatchChange, latestInFlight, latest],
  );

  const isLibrary = mode === "library";

  // Mount reconciliation (design 2.3): clicks before hydration left some `<details open>` out of
  // step with committed state. Every mismatch is folded into ONE dispatch with reason "platform"
  // and no event; disabled items are simply put back. Runs once per mount; the StrictMode re-run
  // is deduplicated against the dispatch just made.
  const reconcileOnMount = useEffectEvent(() => {
    const base = intendedValue(latestInFlight, optimistic);
    const mismatches: { item: string; open: boolean }[] = [];
    for (const [element, item] of sortedItems()) {
      const want = committed.has(item);
      if (element.open === want) continue;
      if (element.hasAttribute("data-disabled")) applyOpen(element, want);
      else mismatches.push({ item, open: element.open });
    }
    if (mismatches.length === 0) return;
    // Exclusive mode: the first opened item in document order wins (the others are re-closed
    // by the re-apply effect); otherwise fold every flip onto the base.
    const opened = exclusive ? mismatches.find((m) => m.open) : undefined;
    const chosen = opened ?? mismatches[0]!;
    const next = opened
      ? new Set([opened.item])
      : mismatches.reduce((set, m) => reduce(set, m.item, m.open, exclusive), base);
    if (setsEqual(next, base)) return;
    dispatchChange(next, chosen.item, chosen.open, "platform", undefined, true);
  });
  useLayoutEffect(() => {
    if (isLibrary) reconcileOnMount();
  }, [isLibrary]);

  // Re-apply committed state to the DOM once nothing is in flight: closes what find-in-page
  // revealed and the parent refused, or what a rejected action left open. Writing `open` fires
  // `toggle`, whose handler sees DOM === committed and does nothing.
  useLayoutEffect(() => {
    if (!isLibrary || pending || latestInFlight() !== null) return;
    for (const [element, item] of items.current) applyOpen(element, committed.has(item));
  }, [isLibrary, pending, committed, latestInFlight]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!NAV_KEYS.has(event.key)) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !triggers.current.has(target)) return;
    const sorted = [...triggers.current].sort(compareDocumentOrder);
    const next = nextTrigger(sorted, target, event.key);
    if (next === undefined) return;
    event.preventDefault();
    // A nested Root handles its own triggers; the outer one must not move focus again.
    event.stopPropagation();
    next.focus();
  }

  const id = useId();
  const name = !isLibrary && exclusive ? id : undefined;
  const rootPending = isLibrary && pending;
  const state: AccordionRootState = { pending: rootPending, disabled };
  const contextCommitted = isLibrary ? committed : EMPTY_SET;
  const contextOptimistic = isLibrary ? optimistic : EMPTY_SET;

  // Memoised (design 12): the dispatchers are stable, so this changes only with the open
  // sets, pending and the props below.
  const context = useMemo<AccordionRootContextValue>(
    () => ({
      mode,
      exclusive,
      name,
      disabled,
      pending: rootPending,
      committed: contextCommitted,
      optimistic: contextOptimistic,
      dispatch: dispatchFromTrigger,
      dispatchFromDom,
      registerItem,
      registerTrigger,
    }),
    [
      mode,
      exclusive,
      name,
      disabled,
      rootPending,
      contextCommitted,
      contextOptimistic,
      dispatchFromTrigger,
      dispatchFromDom,
      registerItem,
      registerTrigger,
    ],
  );

  const resolvedStyle = resolveStateValue(style, state);
  const finalStyle: CSSProperties | undefined = experimental_interpolateSize
    ? { interpolateSize: "allow-keywords", ...resolvedStyle }
    : resolvedStyle;

  const element = useRender<ComponentPropsWithRef<"div">, AccordionRootState>({
    defaultElement: "div",
    render,
    state,
    className,
    style: finalStyle,
    children,
    props: rest,
    // Library-controlled layer: wins over a `render` element's props (conventions 1.2).
    libraryProps: {
      "data-pending": dataAttr(state.pending),
      "data-disabled": dataAttr(disabled),
      onKeyDown,
    },
  });

  return <AccordionRootContext value={context}>{element}</AccordionRootContext>;
}

AccordionRoot.displayName = "AccordionRoot";
