"use client";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { rendersButton, useRender } from "../internal/use-render.js";

/** Details passed to `Toolbar.Button`'s `action`. */
export interface ToolbarButtonActionDetails extends ActionDetails {}

export interface ToolbarButtonState {
  /** This button's action is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface ToolbarButtonProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "type" | "tabIndex" | "aria-disabled" | "className" | "style" | "children"
> {
  /** Runs inside this button's own transition on click, Enter or Space. Sync or async; rejections reach the nearest Error Boundary. */
  action?: Action<[details: ToolbarButtonActionDetails]>;
  /**
   * `aria-disabled="true"`: the button stays focusable and in the arrow-key sequence so
   * assistive technology still finds it (APG Toolbar example), and never dispatches.
   */
  disabled?: boolean;
  /**
   * Forwarded as `default` to the button's `<ViewTransition>`: animates the commit that ends the
   * action (content keyed on `pending`), not a click. Static; any value makes a mount inside a
   * transition start a document view transition (issue #35).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ToolbarButtonState>;
  style?: StateValue<CSSProperties | undefined, ToolbarButtonState>;
  children?: StateValue<ReactNode, ToolbarButtonState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, ToolbarButtonState>;
}

/**
 * A toolbar command: `<button type="button">` that runs `action` in its own transition
 * (`data-pending` while it runs). Disabled is `aria-disabled`, so it stays focusable.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `aria-disabled`, `data-pending`,
 * `data-disabled`, `onClick`.
 */
export function ToolbarButton({
  action,
  disabled = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: ToolbarButtonProps) {
  const { pending, run } = useActionTrigger();
  const state: ToolbarButtonState = { pending, disabled };

  const element = useRender<ComponentPropsWithRef<"button">, ToolbarButtonState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...(rendersButton(render) && { type: "button" as const }),
      "aria-disabled": disabled ? true : undefined,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        if (disabled) {
          // A disabled link must not navigate either.
          event.preventDefault();
          return;
        }
        const details: ToolbarButtonActionDetails = createActionDetails(event.nativeEvent, {});
        run(() => action?.(details));
      },
    },
  });

  return useTransitionBoundary("Toolbar.Button", transition, element);
}

ToolbarButton.displayName = "ToolbarButton";
