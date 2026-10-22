"use client";
import { use, useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { CSPContext } from "../internal/csp-context.js";
import { FSUI_PRECEDENCE } from "../internal/anchor-position.js";
import { dataAttr } from "../internal/data-attr.js";
import {
  TOOLTIP_TRIGGER_MARKER,
  TOOLTIP_WARM_HREF,
  TOOLTIP_WARM_RULES,
  warmDelay,
} from "../internal/tooltip-warm.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { rendersButton, resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useTooltipContext } from "./tooltip-context.js";

export interface TooltipTriggerState {
  readonly disabled: boolean;
}

export interface TooltipTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  "className" | "style" | "children"
> {
  /**
   * Experimental (Chromium 142+). Renders `interestfor` and `interest-delay-start/end` so the
   * browser owns hover, focus, Escape and long-press; the library's JS trigger path is skipped
   * where the rendered element implements `interestForElement`. No effect in other engines (the
   * attribute is ignored and the JS path runs). Pair with `Tooltip.Popup experimental_hint`.
   * Skip-delay on this path comes from a shipped rule: the Trigger renders the
   * `data-fsui-tooltip-trigger` marker, an `interest-delay-start` of
   * `calc(<delay>ms * (1 - var(--fsui-tooltip-warm)))` and a hoisted
   * `<style href="@funstack/ui/tooltip-warm">` (nonce from `<CSPProvider>`). Default `false`.
   */
  experimental_interestFor?: boolean;
  className?: StateValue<string | undefined, TooltipTriggerState>;
  style?: StateValue<CSSProperties | undefined, TooltipTriggerState>;
  children?: StateValue<ReactNode, TooltipTriggerState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, TooltipTriggerState>;
}

/**
 * The element the user hovers or focuses: a `<button type="button">` by default. `render` may
 * substitute a link or a custom button; the element must be focusable (a dev warning fires when
 * it is not). A natively `disabled` button never opens a tooltip; use `aria-disabled` instead.
 *
 * The library attaches its hover / focus listeners with `addEventListener` from `Tooltip.Root`,
 * so every `on*` prop passes through untouched.
 *
 * Owned keys (conventions 1.2): `aria-describedby` (with `provides="description"`) or
 * `aria-labelledby` (with `provides="name"`), both token-merged with the consumer's ids;
 * `data-disabled`; and `interestfor` and `data-fsui-tooltip-trigger` when
 * `experimental_interestFor` is on.
 */
export function TooltipTrigger({
  experimental_interestFor = false,
  className,
  style,
  children,
  render,
  ...rest
}: TooltipTriggerProps) {
  const ctx = useTooltipContext("Tooltip.Trigger");
  const { disabled, popupId, provides, setInterestForRequested } = ctx;
  const native = experimental_interestFor && !disabled;
  const csp = use(CSPContext);

  useLayoutEffect(() => {
    setInterestForRequested(native);
  }, [native, setInterestForRequested]);

  const state: TooltipTriggerState = { disabled };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    // Only the relation in use is owned; the other one passes through untouched.
    ...(provides === "name" ? { "aria-labelledby": popupId } : { "aria-describedby": popupId }),
    "data-disabled": dataAttr(disabled),
    // Owned while the flag is on: a disabled tooltip removes the attribute, so the browser
    // cannot open it either. Unflagged, the key is omitted (conventions 1.2).
    ...(experimental_interestFor && {
      interestfor: native ? popupId : undefined,
      // What the shipped skip-delay rule matches (design 6); nothing else carries it.
      [TOOLTIP_TRIGGER_MARKER]: native ? "" : undefined,
    }),
  };

  // Skip-delay on the native path (design 6, conventions 12): the browser reads the delay from
  // the computed style when the hover starts, and only a rule can see that another tooltip is
  // showing. Hoisted into <head> by React (during SSR too) and deduplicated; nothing lands in
  // place.
  const warmRules = native ? (
    <style href={TOOLTIP_WARM_HREF} precedence={FSUI_PRECEDENCE} nonce={csp?.nonce}>
      {TOOLTIP_WARM_RULES}
    </style>
  ) : null;

  return useRender<ComponentPropsWithRef<"button">, TooltipTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    // The native delays sit under the consumer's style: the consumer wins. The open delay is 0
    // while another tooltip is showing (`--fsui-tooltip-warm`, design 6).
    style: native
      ? (s) => ({
          interestDelayStart: warmDelay(ctx.delay),
          interestDelayEnd: `${ctx.closeDelay}ms`,
          ...resolveStateValue(style, s),
        })
      : style,
    children: native
      ? (s) => (
          <>
            {warmRules}
            {resolveStateValue(children, s)}
          </>
        )
      : children,
    // `type="button"` only on a real button (the consumer may override it); a link or a
    // component element does not get it.
    props: rendersButton(render) ? { type: "button", ...rest } : rest,
    libraryProps,
    ref: ctx.setTriggerElement,
  });
}

TooltipTrigger.displayName = "TooltipTrigger";
