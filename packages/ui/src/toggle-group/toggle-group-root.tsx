"use client";
import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { useToolbarContext } from "../internal/toolbar-context.js";
import { transitionTypes } from "../internal/transition-types.js";
import type { ActionDetails, ChangeAction, RenderProp, StateValue } from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useLatest } from "../internal/use-latest.js";
import { useRender } from "../internal/use-render.js";
import { useRovingFocus } from "../internal/use-roving-focus.js";
import { ToggleGroupContext } from "./toggle-group-context.js";
import type { ToggleGroupContextValue, ToggleGroupOrientation } from "./toggle-group-context.js";
import { compareDocumentOrder } from "../internal/dom-order.js";
import {
  applyPatch,
  EMPTY_SET,
  arraysEqual,
  firstDuplicate,
  sortByOrder,
  toSet,
} from "../internal/value-set.js";
import type { SetPatch, ValueSet } from "../internal/value-set.js";

export type { ToggleGroupOrientation } from "./toggle-group-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** Details passed as the second argument of `valueChangeAction`, in both modes. */
export interface ToggleGroupValueChangeDetails extends ActionDetails {
  /** Values this dispatch pressed (document order of their Items). Exclusive mode: `[next]` or `[]`. */
  readonly added: readonly string[];
  /** Values this dispatch released. Exclusive mode: `[previous]` or `[]`. */
  readonly removed: readonly string[];
}

export interface ToggleGroupRootState {
  /**
   * Optimistic pressed values in document order of the Items (exclusive mode: `[value]` or `[]`,
   * so one state shape serves both modes). The server render and the first client render use the
   * value's own order. Content rendered from it must not suspend.
   */
  readonly value: readonly string[];
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
  /** The effective orientation: the Toolbar's when inside one. */
  readonly orientation: ToggleGroupOrientation;
}

interface ToggleGroupRootBaseProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "role"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
  | "onPointerDown"
  | "defaultValue"
  | "className"
  | "style"
  | "children"
> {
  /** Axis of the arrow keys and `data-orientation`. Default `"horizontal"`. Ignored inside a Toolbar (dev warning). */
  orientation?: ToggleGroupOrientation;
  /** Whether arrows wrap from the last Item to the first. Default `true`. Ignored inside a Toolbar (dev warning). */
  loop?: boolean;
  /** Disables every Item (native `disabled`). */
  disabled?: boolean;
  /**
   * Render `focusgroup="toolbar …"` and, where the browser implements it, let the browser move
   * focus between the Items. Chromium 150+ only; elsewhere the JS path stays active. Ignored
   * inside a Toolbar (a nested focusgroup would split the Toolbar's sequence; dev warning).
   * Default `false`.
   */
  experimental_focusgroup?: boolean;
  className?: StateValue<string | undefined, ToggleGroupRootState>;
  style?: StateValue<CSSProperties | undefined, ToggleGroupRootState>;
  children?: StateValue<ReactNode, ToggleGroupRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ToggleGroupRootState>;
}

export interface ToggleGroupMultipleProps extends ToggleGroupRootBaseProps {
  exclusive?: false;
  /** Controlled pressed values. `[]` presses nothing; `undefined` means uncontrolled. Order is not significant; duplicates ignored. */
  value?: string[];
  /** Initial pressed values in uncontrolled mode. Default `[]`. */
  defaultValue?: string[];
  /**
   * Runs inside the Root's transition whenever the set of pressed Items changes. Sync or async (a
   * Server Function may be passed directly); rejections reach the nearest Error Boundary and roll
   * the change back. `next` is the whole set as a fresh array in document order;
   * `details.added` / `details.removed` say what changed. A `setState` after your own `await` is
   * not a Transition update; wrap it in `startTransition`. Prefer a functional update keyed by
   * `added` / `removed` when controlled.
   */
  valueChangeAction?: ChangeAction<string[], ToggleGroupValueChangeDetails>;
  /** Exclusive mode only: a type error here (TypeScript's union excess-property check would let it through otherwise). */
  deselectable?: never;
}

export interface ToggleGroupExclusiveProps extends ToggleGroupRootBaseProps {
  /** At most one Item is pressed; `value` is `string | null`. */
  exclusive: true;
  /** Controlled pressed value. `null` presses nothing; `undefined` means uncontrolled. */
  value?: string | null;
  /** Initial pressed value in uncontrolled mode. Default `null`. */
  defaultValue?: string | null;
  /**
   * Whether pressing the pressed Item releases it (`next === null`). Default `true`. With
   * `false` that press is a no-op and dispatches nothing; `value` stays `string | null` because
   * the group may start with nothing pressed, but the action is then never called with `null`.
   */
  deselectable?: boolean;
  /** See {@link ToggleGroupMultipleProps.valueChangeAction}; `next` is the pressed value or `null`. */
  valueChangeAction?: ChangeAction<string | null, ToggleGroupValueChangeDetails>;
}

/** Props of `ToggleGroup.Root`, discriminated on `exclusive`. */
export type ToggleGroupRootProps = ToggleGroupMultipleProps | ToggleGroupExclusiveProps;

type GroupValue = string[] | string | null;

/** Both variants as one shape, for the implementation. */
interface InternalProps extends ToggleGroupRootBaseProps {
  exclusive?: boolean;
  value?: GroupValue;
  defaultValue?: GroupValue;
  deselectable?: boolean;
  valueChangeAction?: ChangeAction<GroupValue, ToggleGroupValueChangeDetails>;
}

/** Standalone entry (design 6.2): the first pressed item, else the first item (radio-like). */
function pressedFirst(items: readonly HTMLElement[]): HTMLElement | undefined {
  return items.find((el) => el.getAttribute("aria-pressed") === "true") ?? items[0];
}

/** Engine capabilities never change while the page lives. */
const subscribeNever = () => () => {};

/** The Items' document order and their disabled values, as of the Root's last commit. */
interface ItemLayout {
  readonly order: readonly string[];
  readonly disabled: readonly string[];
}

const NO_LAYOUT: ItemLayout = { order: [], disabled: [] };

/**
 * `<div role="group">` that owns the pressed set, the transition and, when standalone, the roving
 * focus over its Items (design/components/toggle-group.md 16.2). Inside a `Toolbar.Root` it runs
 * no engine of its own: its Items are members of the Toolbar's sequence.
 *
 * Owned keys (conventions 1.2): `role`, `data-orientation`, `data-pending`, `data-disabled`;
 * standalone also `onKeyDown`, `onFocus`, `onBlur`, `onPointerDown` and, with the flag,
 * `focusgroup`.
 */
export function ToggleGroupRoot(props: ToggleGroupRootProps) {
  const {
    exclusive = false,
    value,
    defaultValue,
    valueChangeAction,
    deselectable = true,
    orientation: orientationProp,
    loop: loopProp,
    disabled = false,
    experimental_focusgroup: focusgroupProp,
    className,
    style,
    children,
    render,
    ...rest
  } = props as InternalProps;

  const toolbar = useToolbarContext();
  const inToolbar = toolbar !== null;
  useDevWarning(
    inToolbar && orientationProp !== undefined,
    "ToggleGroup.Root: `orientation` is ignored inside a Toolbar.Root; the group follows the " +
      "Toolbar's orientation.",
  );
  useDevWarning(
    inToolbar && loopProp !== undefined,
    "ToggleGroup.Root: `loop` is ignored inside a Toolbar.Root; the Toolbar's `loop` applies.",
  );
  useDevWarning(
    inToolbar && focusgroupProp === true,
    "ToggleGroup.Root: `experimental_focusgroup` is ignored inside a Toolbar.Root. A nested " +
      "focusgroup would split the Toolbar's single Tab stop; set the flag on the Toolbar.Root.",
  );
  const orientation: ToggleGroupOrientation =
    toolbar?.orientation ?? orientationProp ?? "horizontal";
  const loop = loopProp ?? true;
  const flag = !inToolbar && focusgroupProp === true;

  // The mode is fixed at mount (design 3.1).
  const [mountExclusive] = useState(exclusive);
  useDevWarning(
    mountExclusive !== exclusive,
    "ToggleGroup.Root: `exclusive` changed after mount. Switching between exclusive and " +
      "multiple mode is not supported; the group keeps the mode it mounted with.",
  );

  // Committed set keyed on the contents, so an inline `value={["a"]}` does not re-base every render.
  const controlledKey = value === undefined ? undefined : JSON.stringify(value);
  const controlledSet = useMemo(
    () =>
      controlledKey === undefined ? undefined : toSet(JSON.parse(controlledKey) as GroupValue),
    [controlledKey],
  );
  const defaultKey = defaultValue === undefined ? undefined : JSON.stringify(defaultValue);
  const defaultSet = useMemo(
    () => (defaultKey === undefined ? undefined : toSet(JSON.parse(defaultKey) as GroupValue)),
    [defaultKey],
  );

  // Item registration (design 16.2): element → value, written from the Items' callback refs.
  const registry = useRef(new Map<HTMLElement, string>());
  const register = useCallback((element: HTMLElement, itemValue: string) => {
    registry.current.set(element, itemValue);
    return () => {
      registry.current.delete(element);
    };
  }, []);
  const sortedItems = (): [HTMLElement, string][] =>
    [...registry.current].sort(([a], [b]) => compareDocumentOrder(a, b));
  /** Sorts by the Items' current document order. Reads the DOM: handlers and effects only. */
  const sortByDocument = (values: Iterable<string>): string[] =>
    sortByOrder(
      values,
      sortedItems().map(([, v]) => v),
    );

  const { optimistic, committed, pending, dispatch } = useControllableAction<
    ValueSet,
    ToggleGroupValueChangeDetails
  >({
    controlled: controlledSet,
    defaultValue: defaultSet,
    initialValue: EMPTY_SET,
    action:
      valueChangeAction &&
      ((next, details) =>
        valueChangeAction(mountExclusive ? ([...next][0] ?? null) : sortByDocument(next), details)),
    transitionTypes: (_next, _prev, details) => [
      ...transitionTypes("toggle-group"),
      ...(details.added.length > 0 ? ["fsui-toggle-group-press"] : []),
      ...(details.removed.length > 0 ? ["fsui-toggle-group-release"] : []),
    ],
    reducer: (prev, _next, details) => applyPatch(prev, details),
    warn: { component: "ToggleGroup.Root", prop: "value" },
  });

  // Read by the stable `toggle` (#48): a handler only runs against the committed UI.
  const latest = useLatest({ optimistic, exclusive: mountExclusive, deselectable });
  const toggle = useCallback(
    (itemValue: string, event: Event) => {
      const { optimistic, exclusive, deselectable } = latest.current;
      let patch: SetPatch;
      if (optimistic.has(itemValue)) {
        // Exclusive and not deselectable: pressing the pressed Item is a no-op (design 5.2).
        if (exclusive && !deselectable) return;
        patch = { added: [], removed: [itemValue] };
      } else {
        patch = { added: [itemValue], removed: exclusive ? [...optimistic] : [] };
      }
      dispatch(applyPatch(optimistic, patch), createActionDetails(event, patch));
    },
    [dispatch, latest],
  );

  // `state.value` is in document order. Render cannot read the DOM, so the Items' order (and,
  // for `focusgroupstart`, which values have a disabled Item) is kept in state, refreshed after a
  // commit of the Root only when what renders from it would change (CheckboxGroup's approach).
  const [layout, setLayout] = useState<ItemLayout>(NO_LAYOUT);
  const renderedValue = sortByOrder(optimistic, layout.order);
  const warnedDuplicate = useRef(false);
  const syncLayout = useEffectEvent(() => {
    const items = sortedItems();
    const order = items.map(([, v]) => v);
    const disabledValues = items.filter(([el]) => el.matches(":disabled")).map(([, v]) => v);
    const valueChanged = !arraysEqual(sortByOrder(optimistic, order), renderedValue);
    const startChanged =
      flag && (!arraysEqual(order, layout.order) || !arraysEqual(disabledValues, layout.disabled));
    // A DOM read (the Items' order) that render cannot do; the comparison ends the chain.
    if (valueChanged || startChanged) setLayout({ order, disabled: disabledValues });

    if (!isDev || warnedDuplicate.current) return;
    const duplicate = firstDuplicate(order);
    if (duplicate !== undefined) {
      warnedDuplicate.current = true;
      console.error(
        `ToggleGroup.Item: two Items share the value "${duplicate}" in one ToggleGroup.Root. ` +
          "Item values must be unique; both follow the same pressed state.",
      );
    }
  });
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a DOM read render cannot do (as CheckboxGroup.Root)
    syncLayout();
  });

  // Feature detection only when the flag is on, never during SSR or hydration (conventions 8).
  const native = useSyncExternalStore(
    subscribeNever,
    () => flag && "focusGroup" in HTMLElement.prototype,
    () => false,
  );

  const focusgroupStartValue =
    flag && !disabled
      ? (renderedValue.find(
          (v) =>
            (layout.order.length === 0 || layout.order.includes(v)) && !layout.disabled.includes(v),
        ) ?? null)
      : null;

  const rootRef = useRef<HTMLElement | null>(null);
  const roving = useRovingFocus(rootRef, {
    enabled: !inToolbar,
    orientation,
    loop,
    native,
    entry: pressedFirst,
    memory: false,
  });

  const context = useMemo<ToggleGroupContextValue>(
    () => ({
      optimistic,
      committed,
      pending,
      disabled,
      orientation,
      focusgroupStartValue,
      toggle,
      register,
    }),
    [optimistic, committed, pending, disabled, orientation, focusgroupStartValue, toggle, register],
  );

  const state: ToggleGroupRootState = { value: renderedValue, pending, disabled, orientation };

  const focusgroup = flag
    ? `toolbar ${orientation === "vertical" ? "block" : "inline"} ${loop ? "wrap" : "nowrap"} nomemory`
    : undefined;

  const element = useRender<ComponentPropsWithRef<"div">, ToggleGroupRootState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      role: "group",
      "data-orientation": orientation,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      // Inside a Toolbar the group has no engine: the keys are not owned there.
      ...(!inToolbar && roving),
      ...(focusgroup !== undefined && { focusgroup }),
    },
    ref: rootRef,
  });

  return <ToggleGroupContext value={context}>{element}</ToggleGroupContext>;
}

ToggleGroupRoot.displayName = "ToggleGroupRoot";
