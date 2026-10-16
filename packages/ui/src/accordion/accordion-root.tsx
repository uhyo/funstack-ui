"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type { ActionDetails, ChangeAction, RenderProp, StateValue } from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { AccordionRootContext } from "./accordion-context.js";
import type {
  AccordionChangeReason,
  AccordionMode,
  AccordionRootContextValue,
} from "./accordion-context.js";

export interface AccordionRootState {
  /** An action dispatched through this Accordion is in flight (library mode only). */
  readonly pending: boolean;
  /** The Root's `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `valueChangeAction`. */
export interface AccordionValueChangeDetails extends ActionDetails {
  /**
   * `"trigger"`: the user activated a Trigger. `"platform"`: the browser changed `open` itself
   * (find-in-page, a text fragment, a click before hydration); `event` is then the `toggle`
   * event, or `undefined` when the mismatch was found on mount.
   */
  readonly reason: AccordionChangeReason;
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
  /** Disables every item: triggers render `aria-disabled` and never dispatch. Default `false`. */
  disabled?: boolean;
  /**
   * Renders `interpolate-size: allow-keywords` on the root so `::details-content` can transition
   * `height` to `auto`. Chromium-only polish today; use the `grid-template-rows` form for a
   * cross-engine animation. Merged with `style`; the consumer's declaration wins.
   */
  experimental_interpolateSize?: boolean;
  className?: StateValue<string | undefined, AccordionRootState>;
  style?: StateValue<CSSProperties | undefined, AccordionRootState>;
  children?: StateValue<ReactNode, AccordionRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, AccordionRootState>;
}

export interface AccordionRootMultipleProps extends AccordionRootBaseProps {
  /** Any number of items may be open. */
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
 */
export type AccordionRootProps = AccordionRootMultipleProps | AccordionRootExclusiveProps;

type AccordionValue = string[] | string | null;
type OpenSet = ReadonlySet<string>;

const EMPTY: OpenSet = new Set();

function toSet(value: AccordionValue): OpenSet {
  if (value === null) return EMPTY;
  return typeof value === "string" ? new Set([value]) : new Set(value);
}

function fromSet(set: OpenSet, exclusive: boolean): AccordionValue {
  if (exclusive) {
    const [first] = set;
    return first ?? null;
  }
  return [...set];
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

function setsEqual(a: OpenSet, b: OpenSet): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function byDocumentOrder<T extends Node>(a: T, b: T): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

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
 */
export function AccordionRoot(props: AccordionRootProps) {
  const {
    exclusive = false,
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
    "Accordion.Root: the mode changed after mount (`value`, `defaultValue` and `valueChangeAction` " +
      "were all absent on one render and present on another). Switching between JS-free and " +
      "library mode is not supported.",
  );

  // Both prop variants are narrowed by `exclusive` at the call site; internally one signature.
  const action = valueChangeAction as
    | ChangeAction<AccordionValue, AccordionValueChangeDetails>
    | undefined;

  // Keep the committed set's identity stable while the consumer's `value` is, so `useOptimistic`
  // only re-bases when the controlled value really changed.
  const controlledSet = useMemo(() => (value === undefined ? undefined : toSet(value)), [value]);

  const { committed, optimistic, pending, dispatch } = useControllableAction<
    OpenSet,
    AccordionValueChangeDetails
  >({
    controlled: controlledSet,
    defaultValue: defaultValue === undefined ? undefined : toSet(defaultValue),
    initialValue: EMPTY,
    action: action && ((next, details) => action(fromSet(next, exclusive), details)),
    transitionTypes: (_next, _prev, details) =>
      transitionTypes("accordion", details.open ? "expand" : "collapse"),
    reducer: (prev, _next, details) => reduce(prev, details.item, details.open, exclusive),
    warn: { component: "Accordion.Root", prop: "value" },
  });

  const items = useRef(new Map<HTMLDetailsElement, string>());
  const triggers = useRef(new Set<HTMLElement>());
  // The most recently dispatched `next` while an action is in flight; lets the platform path skip
  // a dispatch that would repeat the one just made (two items reconciled in the same commit).
  const lastDispatched = useRef<OpenSet | null>(null);
  useEffect(() => {
    if (!pending) lastDispatched.current = null;
  }, [pending]);

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

  function dispatchChange(
    next: OpenSet,
    item: string,
    open: boolean,
    reason: AccordionChangeReason,
    event: Event | undefined,
  ): void {
    lastDispatched.current = next;
    dispatch(next, createActionDetails(event, { reason, item, open }));
  }

  const dispatchFromTrigger: AccordionRootContextValue["dispatch"] = (item, open, event) => {
    // `next` comes from the optimistic set: what the user sees and intends (design 2.2).
    dispatchChange(reduce(optimistic, item, open, exclusive), item, open, "trigger", event);
  };

  const dispatchFromDom: AccordionRootContextValue["dispatchFromDom"] = (item, open, event) => {
    // Recompute `next` from the DOM state of every registered item (design 2.3). Exclusive mode:
    // the toggled item wins when it is open, otherwise the first open item in document order.
    const entries = [...items.current].sort(([a], [b]) => byDocumentOrder(a, b));
    const openItems = entries.filter(([el]) => el.open).map(([, v]) => v);
    let next: OpenSet;
    if (exclusive) {
      const first = open ? item : openItems[0];
      next = first === undefined ? EMPTY : new Set([first]);
    } else {
      next = new Set(openItems);
    }
    if (setsEqual(next, lastDispatched.current ?? optimistic)) return;
    dispatchChange(next, item, open, "platform", event);
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!NAV_KEYS.has(event.key)) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !triggers.current.has(target)) return;
    const sorted = [...triggers.current].sort(byDocumentOrder);
    const next = nextTrigger(sorted, target, event.key);
    if (next === undefined) return;
    event.preventDefault();
    // A nested Root handles its own triggers; the outer one must not move focus again.
    event.stopPropagation();
    next.focus();
  }

  const id = useId();
  const isLibrary = mode === "library";
  const state: AccordionRootState = { pending: isLibrary && pending, disabled };

  const context: AccordionRootContextValue = {
    mode,
    exclusive,
    name: !isLibrary && exclusive ? id : undefined,
    disabled,
    pending: state.pending,
    committed: isLibrary ? committed : EMPTY,
    optimistic: isLibrary ? optimistic : EMPTY,
    dispatch: dispatchFromTrigger,
    dispatchFromDom,
    registerItem,
    registerTrigger,
  };

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
