"use client";
import { useCallback, useEffectEvent, useId, useLayoutEffect, useMemo, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import { focusWithRing, isPlainKey, resolveArrowKey } from "../internal/arrow-keys.js";
import type { ArrowMove } from "../internal/arrow-keys.js";
import { dataAttr } from "../internal/data-attr.js";
import { noteOpen, writeOpen } from "../internal/details-summary.js";
import { compareDocumentOrder, sortByDocumentOrder } from "../internal/dom-order.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import {
  intendedValue,
  useControllableAction,
} from "../internal/action/use-controllable-action.js";
import { useItemOrder } from "../internal/use-item-order.js";
import type { ItemLayout } from "../internal/use-item-order.js";
import { useMountFixed } from "../internal/use-mount-fixed.js";
import { useLatest } from "../internal/use-latest.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { useValueSet } from "../internal/use-value-set.js";
import { applyPatch, EMPTY_SET, setsEqual, sortByOrder } from "../internal/value-set.js";
import type { SetPatch, ValueSet } from "../internal/value-set.js";
import { AccordionRootContext } from "./accordion-context.js";
import type { AccordionMode, AccordionRootContextValue } from "./accordion-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Accordion.Root`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface AccordionRootState {
  /**
   * The optimistic open items in document order, always an array (one entry at most with
   * `exclusive`), so one function of state serves both modes. `[]` in JS-free mode, where the
   * browser owns `open` (style with `:open`). Content rendered from it must not suspend.
   */
  readonly value: readonly string[];
  /** An action dispatched through this Accordion is in flight (library mode only). */
  readonly pending: boolean;
  /** The Root's `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Details passed as the second argument of `valueChangeAction`: the set diff of every set-valued
 * component (conventions 2.2), computed against the optimistic set, in document order.
 */
export interface AccordionValueChangeDetails extends ActionDetails {
  /**
   * The shared vocabulary (conventions 2.2); Accordion dispatches two of its values.
   * `"activate"`: the user activated a Trigger. `"platform"`: the browser changed `open` itself
   * (find-in-page, a text fragment, a click before hydration); `event` is then the `toggle`
   * event, or `undefined` when the mismatch was found on mount.
   */
  readonly reason: ChangeReason;
  /** The items this change opened. */
  readonly added: readonly string[];
  /**
   * The items this change closed. With `exclusive`, the item that closed because another opened
   * is listed here: a switch from A to B is `added: ["b"]`, `removed: ["a"]`.
   */
  readonly removed: readonly string[];
}

/**
 * The props both variants of `Accordion.Root` share.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export interface AccordionRootBaseProps extends Omit<
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
   * ArrowDown on the last trigger moves to the first and ArrowUp on the first to the last; with
   * `false` the arrows stop at the ends (conventions 3.10).
   *
   * @defaultValue `true`
   */
  loop?: boolean;
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
  value?: readonly string[];
  /** Initial open items in uncontrolled library mode. */
  defaultValue?: readonly string[];
  /**
   * Called with the next open items on every change. Runs inside the Root's transition; may be
   * sync or async (also a Server Function). Rejections reach the nearest Error Boundary.
   *
   * May also be called with `details.reason === "platform"` when the browser opened an item
   * itself (find-in-page, a click before hydration); committed state is re-applied to the DOM
   * once the action settles.
   *
   * Persist `details.added` / `details.removed` rather than `next`: `next` is the intended set
   * and can contain an earlier change whose action fails later.
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

/** The next set for one item's change: add/remove it, or replace when exclusive (design 4.1). */
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

/** The diff from `from` to `to` (conventions 2.2), each side in `order` (document order). */
function diff(from: OpenSet, to: OpenSet, order: readonly string[]): SetPatch {
  return {
    added: sortByOrder(
      [...to].filter((v) => !from.has(v)),
      order,
    ),
    removed: sortByOrder(
      [...from].filter((v) => !to.has(v)),
      order,
    ),
  };
}

/**
 * Picks the trigger to focus for a move (ArrowDown / ArrowUp / Home / End, `resolveArrowKey` on
 * the vertical axis; conventions 3.10): `sorted` is every registered trigger in document order,
 * the `aria-disabled` ones included (they are focusable and in the sequence, rule 3). The arrows
 * wrap with `loop` and stop at the ends without it.
 */
function nextTrigger(
  sorted: readonly HTMLElement[],
  current: HTMLElement,
  move: ArrowMove,
  loop: boolean,
): HTMLElement | undefined {
  const last = sorted.length - 1;
  if (last < 0) return undefined;
  if (move === "first") return sorted[0];
  if (move === "last") return sorted[last];
  const index = sorted.indexOf(current);
  if (move === "next") return sorted[index >= last ? (loop ? 0 : last) : index + 1];
  return sorted[index <= 0 ? (loop ? last : 0) : index - 1];
}

/** The Items' values in document order, as of the Root's last commit (`state.value`). */
const NO_LAYOUT: ItemLayout = { order: [] };

/**
 * The accordion container: a `div` that owns the open state, the transition, the context the
 * other parts read, and ArrowUp/ArrowDown/Home/End navigation between triggers.
 *
 * Owned keys (conventions 1.5): `data-pending`, `data-disabled`, `onKeyDown`.
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
    loop = true,
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
  const mode = useMountFixed<AccordionMode>(
    isLibraryNow ? "library" : "static",
    isDev &&
      "Accordion.Root: the mode changed after mount (`value`, `defaultValue` and `valueChangeAction` " +
        "were all absent on one render and present on another). Switching between JS-free and " +
        "library mode is not supported.",
  );

  // Exclusive or multiple is decided once too, like ToggleGroup's mode (design 12): the reducer,
  // the value shape handed to the action and the static `name` all follow the mounted mode.
  const exclusive = useMountFixed(
    exclusiveProp,
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
    // One kind per non-empty side of the diff: an exclusive switch carries both (conventions 5.3).
    transitionTypes: (_next, _prev, details) => [
      ...transitionTypes("accordion"),
      ...(details.added.length > 0 ? ["fsui-accordion-open"] : []),
      ...(details.removed.length > 0 ? ["fsui-accordion-close"] : []),
    ],
    // Multiple: the dispatch's diff (one item for a click or a reveal), re-based on the committed
    // set; it is also how the uncontrolled commit is folded over the resolved dispatches (#150). Exclusive is
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
    reducer: exclusive ? undefined : (prev, _next, details) => applyPatch(prev, details),
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

  // `base` is the set `next` was built on (the optimistic or intended set): the diff is what this
  // dispatch changes in what the user sees.
  const dispatchChange = (
    next: OpenSet,
    base: OpenSet,
    reason: ChangeReason,
    event: Event | undefined,
    whole = false,
  ): void => {
    const { added, removed } = diff(base, next, registeredValues());
    dispatch(next, createActionDetails(event, { reason, added, removed }), { whole });
  };
  // Read through a ref so the two dispatchers below keep one identity.
  const latestDispatch = useLatest(dispatchChange);

  // The two dispatchers below read the last committed optimistic set through `latest`, so they
  // keep one identity and the Items' contexts are reused across open-state changes: a
  // handler only ever runs against the committed UI, so this is the set it closed over before.
  const latest = useLatest({ optimistic, exclusive });

  const dispatchFromTrigger = useCallback<AccordionRootContextValue["dispatch"]>(
    (item, open, event) => {
      const { optimistic, exclusive } = latest.current;
      // `next` comes from the optimistic set: what the user sees and intends (design 2.2).
      const next = reduce(optimistic, item, open, exclusive);
      latestDispatch.current(next, optimistic, "activate", event);
    },
    [latestDispatch, latest],
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
      latestDispatch.current(next, base, "platform", event);
    },
    [latestDispatch, latestInFlight, latest],
  );

  const isLibrary = mode === "library";

  // Mount reconciliation (design 2.3): clicks before hydration left some `<details open>` out of
  // step with committed state. Every mismatch is folded into ONE dispatch with reason "platform"
  // and no event, whose diff lists every item that changed; disabled items are simply put back. Runs once per mount; the StrictMode re-run
  // is deduplicated against the dispatch just made.
  const reconcileOnMount = useEffectEvent(() => {
    const base = intendedValue(latestInFlight, optimistic);
    const mismatches: { item: string; open: boolean }[] = [];
    for (const [element, item] of sortedItems()) {
      // The value read becomes the known value (design 2.3), at mount and at an Activity re-show.
      noteOpen(element);
      const want = committed.has(item);
      if (element.open === want) continue;
      if (element.hasAttribute("data-disabled")) writeOpen(element, want);
      else mismatches.push({ item, open: element.open });
    }
    if (mismatches.length === 0) return;
    // Exclusive mode: the first opened item in document order wins (the others are re-closed
    // by the re-apply effect); otherwise fold every flip onto the base.
    const opened = exclusive ? mismatches.find((m) => m.open) : undefined;
    const next = opened
      ? new Set([opened.item])
      : mismatches.reduce((set, m) => reduce(set, m.item, m.open, exclusive), base);
    if (setsEqual(next, base)) return;
    dispatchChange(next, base, "platform", undefined, true);
  });
  useLayoutEffect(() => {
    if (isLibrary) reconcileOnMount();
  }, [isLibrary]);

  // Re-apply committed state to the DOM once nothing is in flight: closes what find-in-page
  // revealed and the parent refused, or what a rejected action left open. The write records the
  // known value, so the `toggle` it fires is an echo.
  useLayoutEffect(() => {
    if (!isLibrary || pending || latestInFlight() !== null) return;
    for (const [element, item] of items.current) writeOpen(element, committed.has(item));
  }, [isLibrary, pending, committed, latestInFlight]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    // A key with Alt, Ctrl or Meta, or one a consumer prevented, is the browser's (3.10 rule 2).
    if (!isPlainKey(event)) return;
    // Vertical only, so no RTL mirroring: ArrowLeft / ArrowRight are not navigation keys.
    const move = resolveArrowKey(event.key, "vertical", false);
    if (move === null) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !triggers.current.has(target)) return;
    const sorted = [...triggers.current].sort(compareDocumentOrder);
    const next = nextTrigger(sorted, target, move, loop);
    if (next === undefined) return;
    event.preventDefault();
    // A nested Root handles its own triggers; the outer one must not move focus again.
    event.stopPropagation();
    if (next !== target) focusWithRing(next);
  }

  // `state.value` in the Items' document order (as ToggleGroup's): read after the Root commits.
  const { renderedValue } = useItemOrder({
    optimistic: mode === "library" ? optimistic : EMPTY_SET,
    initial: NO_LAYOUT,
    read: () => ({ order: registeredValues() }),
    duplicateMessage: false,
  });

  const id = useId();
  const name = !isLibrary && exclusive ? id : undefined;
  const rootPending = isLibrary && pending;
  const state: AccordionRootState = { value: renderedValue, pending: rootPending, disabled };
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
