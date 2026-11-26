"use client";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { registerTrigger } from "../internal/overlay/trigger-ref.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useLatest } from "../internal/use-latest.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useHoverCardContext } from "./hover-card-context.js";

/**
 * State of `HoverCard.Trigger`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface HoverCardTriggerState {
  /** Optimistic open state. */
  readonly open: boolean;
  /** The Root's transition is pending: the card is loading. */
  readonly pending: boolean;
  /** The Root's `disabled`. */
  readonly disabled: boolean;
}

/**
 * Props of `HoverCard.Trigger`.
 *
 * @see https://ui.funstack.work/components/hover-card
 */
export interface HoverCardTriggerProps extends Omit<
  ComponentPropsWithRef<"a">,
  "className" | "style" | "children"
> {
  /**
   * Experimental (Chromium 142+). Writes `interestfor` (after hydration, through the ref) and
   * renders `interest-delay-start` / `-end` from the Root's `delay` / `closeDelay`, so the
   * browser decides when interest starts and ends (long-press on touch included); the library
   * still owns the open, Escape and a press outside. No effect in other engines, or on an element
   * that does not implement `interestForElement`: the JS path runs.
   *
   * @defaultValue `false`
   */
  experimental_interestFor?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, HoverCardTriggerState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, HoverCardTriggerState>;
  /** Content, or a function of the part's state. Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, HoverCardTriggerState>;
  /**
   * A link (default), a router link component, or a button whose click opens nothing of this
   * kind (element form), or take over rendering (function form).
   */
  render?: RenderProp<ComponentPropsWithRef<"a">, HoverCardTriggerState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Whether keyboard users can reach the Trigger (design 1.2): `tabIndex >= 0`, and an `<a>` has an
 * `href` or an explicit `tabindex` (an `<a>` without `href` reports `tabIndex` 0 but is not
 * focusable).
 */
function isFocusable(target: HTMLElement): boolean {
  if (target.tabIndex < 0) return false;
  if (target.localName === "a" && !target.hasAttribute("href")) {
    return target.hasAttribute("tabindex");
  }
  return true;
}

/**
 * The element the user hovers or focuses: an `<a>` by default, with `href` and every other
 * anchor prop passed through. The card is opened by interest only; the Trigger's click is the
 * consumer's (a link navigates), and a press on it closes the card. The element must be
 * focusable (a development warning fires when it is not).
 *
 * The library attaches its listeners with `addEventListener` from `HoverCard.Root`, so every
 * `on*` prop passes through untouched (`onPointerEnter={preload}` starts loading during the
 * delay).
 *
 * Owned keys (conventions 1.2): `data-open` (optimistic), `data-pending`, `data-disabled`, and
 * `interestfor` while `experimental_interestFor` is on (written through the ref, removed while
 * disabled). No ARIA attribute.
 *
 * @see https://ui.funstack.work/components/hover-card
 */
export function HoverCardTrigger({
  experimental_interestFor = false,
  className,
  style,
  children,
  render,
  ...rest
}: HoverCardTriggerProps) {
  const ctx = useHoverCardContext("HoverCard.Trigger");
  const { disabled, ids, triggerRef, setTriggerElement, setInterestForRequested } = ctx;
  const native = experimental_interestFor && !disabled;

  // The attribute is written after hydration (design 2.3): a hover before hydration would
  // otherwise open an empty card.
  const element = useRef<HTMLElement | null>(null);
  const writes = useLatest({ native, popupId: ids.popup });
  const writeInterestFor = (target: HTMLElement): void => {
    const { native: on, popupId } = writes.current;
    if (on) target.setAttribute("interestfor", popupId);
    else target.removeAttribute("interestfor");
  };
  useLayoutEffect(() => {
    if (element.current !== null) writeInterestFor(element.current);
    setInterestForRequested(native);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `writeInterestFor` reads the ref
  }, [native, ids.popup, setInterestForRequested]);

  const checkElement = useElementCheck(
    isDev &&
      ((target: HTMLElement) =>
        isFocusable(target)
          ? null
          : "HoverCard.Trigger: the trigger is not focusable; keyboard users cannot open the " +
            "card. Render a link with `href` or a button, or set tabIndex={0}."),
  );

  const ref = useCallback(
    (target: HTMLElement) => {
      checkElement?.(target);
      element.current = target;
      const unregister = registerTrigger(triggerRef, target, "HoverCard.Trigger");
      setTriggerElement(target);
      if (writes.current.native) writeInterestFor(target);
      return () => {
        unregister();
        if (writes.current.native) target.removeAttribute("interestfor");
        if (element.current === target) element.current = null;
        setTriggerElement(null);
      };
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `writeInterestFor` reads the ref
    [checkElement, triggerRef, setTriggerElement, writes],
  );

  const state: HoverCardTriggerState = {
    open: ctx.optimistic,
    pending: ctx.pending,
    disabled,
  };

  const libraryProps: ComponentPropsWithRef<"a"> & DataAttributes = {
    "data-open": dataAttr(state.open),
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"a">, HoverCardTriggerState>({
    defaultElement: "a",
    render,
    state,
    className,
    // The native delays sit under the consumer's style: the consumer wins. Inert without the
    // `interestfor` attribute, so they are in the server HTML too.
    style: experimental_interestFor
      ? (s) => ({
          interestDelayStart: `${ctx.delay}ms`,
          interestDelayEnd: `${ctx.closeDelay}ms`,
          ...resolveStateValue(style, s),
        })
      : style,
    children,
    props: rest,
    libraryProps,
    ref,
  });
}

HoverCardTrigger.displayName = "HoverCardTrigger";
