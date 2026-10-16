"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
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
   * Default `false`.
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
 * `data-disabled`; and `interestfor` when `experimental_interestFor` is on.
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
    ...(experimental_interestFor && { interestfor: native ? popupId : undefined }),
  };

  return useRender<ComponentPropsWithRef<"button">, TooltipTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    // The native delays sit under the consumer's style: the consumer wins.
    style: native
      ? (s) => ({
          interestDelayStart: `${ctx.delay}ms`,
          interestDelayEnd: `${ctx.closeDelay}ms`,
          ...resolveStateValue(style, s),
        })
      : style,
    children,
    // `type="button"` only on a real button (the consumer may override it); a link or a
    // component element does not get it.
    props: rendersButton(render) ? { type: "button", ...rest } : rest,
    libraryProps,
    ref: ctx.setTriggerElement,
  });
}

TooltipTrigger.displayName = "TooltipTrigger";
