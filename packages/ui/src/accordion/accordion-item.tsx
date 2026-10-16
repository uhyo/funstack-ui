"use client";
import {
  use,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  ViewTransition,
} from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  SyntheticEvent,
  ViewTransitionClass,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { AccordionItemContext, AccordionRootContext } from "./accordion-context.js";
import type { AccordionItemContextValue } from "./accordion-context.js";

export interface AccordionItemState {
  readonly value: string;
  /** Optimistic open state. `undefined` in JS-free mode (browser-owned, unknown to React). */
  readonly open: boolean | undefined;
  /** This item's open state is changing through an in-flight action. */
  readonly pending: boolean;
  /** Disabled by its own prop or by the Root. */
  readonly disabled: boolean;
}

export interface AccordionItemProps extends Omit<
  ComponentPropsWithRef<"details">,
  "open" | "name" | "onToggle" | "className" | "style" | "children"
> {
  /** Identifies the item in the Root's `value`. Required in both modes. */
  value: string;
  /**
   * JS-free mode only: renders the initial `open` attribute; the browser owns it from then on.
   * Ignored (dev warning) in library mode, where the Root's `defaultValue` / `value` decide.
   */
  defaultOpen?: boolean;
  /**
   * Disables this item: the Trigger renders `aria-disabled` and never toggles. Enforced by a
   * click handler, so in JS-free mode it does not hold before hydration or with JS off.
   */
  disabled?: boolean;
  /**
   * Library mode only. Forwarded as `default` to the `<ViewTransition>` around the `<details>`;
   * animates the commit that ends an action (the `open` attribute flip), not the optimistic
   * `data-open` flip. Ignored (dev warning) in JS-free mode.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, AccordionItemState>;
  style?: StateValue<CSSProperties | undefined, AccordionItemState>;
  children?: StateValue<ReactNode, AccordionItemState>;
  /** Must render a `<details>` element. */
  render?: RenderProp<ComponentPropsWithRef<"details">, AccordionItemState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * One accordion entry: the `<details>` element. In library mode its `open` attribute follows
 * committed state and `data-open` / `data-pending` follow optimistic state; in JS-free mode (or
 * outside any Root, as a standalone disclosure) the browser owns `open`.
 */
export function AccordionItem({
  value,
  defaultOpen = false,
  disabled: disabledProp = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: AccordionItemProps) {
  const root = use(AccordionRootContext);
  const isLibrary = root?.mode === "library";
  const disabled = disabledProp || (root?.disabled ?? false);
  const committedOpen = isLibrary ? root.committed.has(value) : undefined;
  const optimisticOpen = isLibrary ? root.optimistic.has(value) : undefined;
  const rootPending = root?.pending ?? false;
  const pending = isLibrary && rootPending && committedOpen !== optimisticOpen;
  // JS-free mode: the prop React writes never changes after the first render, so React never
  // rewrites the attribute the browser now owns.
  const [staticOpen] = useState(defaultOpen);

  useDevWarning(
    isLibrary && defaultOpen,
    "Accordion.Item: `defaultOpen` is ignored in library mode. Use `defaultValue` or `value` on " +
      "Accordion.Root instead.",
  );
  useDevWarning(
    !isLibrary && transition !== undefined,
    "Accordion.Item: `transition` has no effect in JS-free mode; the browser toggles the item " +
      "outside any React transition. Animate `::details-content` with CSS instead.",
  );

  const ref = useRef<HTMLDetailsElement | null>(null);
  const registerItem = root?.registerItem;
  const libraryRef = useCallback(
    (element: HTMLDetailsElement) => {
      if (isDev && element.tagName !== "DETAILS") {
        console.error(
          `Accordion.Item: expected to render a <details> element but got <${element.tagName.toLowerCase()}>. ` +
            "The platform semantics (toggle, find-in-page, exclusive groups) need a real <details>.",
        );
      }
      ref.current = element;
      const unregister = registerItem?.(value, element);
      return () => {
        ref.current = null;
        unregister?.();
      };
    },
    [registerItem, value],
  );

  // Platform path (design 2.3): the DOM differs from committed state on mount (a click before
  // hydration) → dispatch with reason "platform"; after the action settles (or when nothing is
  // pending) → re-apply committed state to the DOM.
  const dispatchFromDom = root?.dispatchFromDom;
  const reconcileOnMount = useEffectEvent((element: HTMLDetailsElement) => {
    if (disabled || dispatchFromDom === undefined) {
      element.open = committedOpen === true;
      return;
    }
    dispatchFromDom(value, element.open, undefined);
  });
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (!isLibrary || committedOpen === undefined) return;
    const element = ref.current;
    const first = !mounted.current;
    mounted.current = true;
    if (element === null || element.open === committedOpen || rootPending) return;
    if (first) reconcileOnMount(element);
    else element.open = committedOpen; // fires `toggle`; the handler sees DOM === committed
  }, [isLibrary, committedOpen, rootPending]);

  const onToggle = isLibrary
    ? (event: SyntheticEvent<HTMLDetailsElement>) => {
        const element = event.currentTarget;
        // Read `details.open`, never `ToggleEvent.newState`: `toggle` is coalesced.
        if (element.open === committedOpen) return; // our own commit echoing back
        if (disabled) {
          // A disabled item cannot be opened by the browser either; close it again now or, while
          // an action is in flight, when the transition ends (layout effect above).
          if (!rootPending) element.open = committedOpen === true;
          return;
        }
        root.dispatchFromDom(value, element.open, event.nativeEvent);
      }
    : undefined;

  const state: AccordionItemState = { value, open: optimisticOpen, pending, disabled };
  const itemContext: AccordionItemContextValue = {
    value,
    disabled,
    committedOpen,
    optimisticOpen,
    pending,
  };

  const element = useRender<ComponentPropsWithRef<"details">, AccordionItemState>({
    defaultElement: "details",
    render,
    state,
    className,
    style,
    children,
    ref: libraryRef,
    props: rest,
    // Library-controlled layer: `open`, `name` and `onToggle` are owned by the library in at
    // least one mode, so a `render` element cannot override them either (conventions 1.2).
    libraryProps: {
      open: isLibrary ? committedOpen : staticOpen,
      // Owned in both modes: in library mode there is one writer of `open`, so a render element's
      // `name` (a second, platform-level writer) is removed.
      name: !isLibrary ? root?.name : undefined,
      // Only installed in library mode; owning the key in static mode would strip a render
      // element's own `onToggle`.
      ...(isLibrary && { onToggle }),
      "data-open": dataAttr(optimisticOpen === true),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    },
  });

  return (
    <ViewTransition default={isLibrary ? (transition ?? "none") : "none"}>
      <AccordionItemContext value={itemContext}>{element}</AccordionItemContext>
    </ViewTransition>
  );
}

AccordionItem.displayName = "AccordionItem";
