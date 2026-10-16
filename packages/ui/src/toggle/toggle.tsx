"use client";
import { ViewTransition } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type { ActionDetails, ChangeAction, RenderProp, StateValue } from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { rendersButton, useRender } from "../internal/use-render.js";

export interface ToggleState {
  /** Optimistic pressed state: what the user sees, including an in-flight change. */
  readonly pressed: boolean;
  /** An action dispatched by this Toggle is in flight (including the resulting render). */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `pressedChangeAction`. */
export interface TogglePressedChangeDetails extends ActionDetails {
  // v0 adds nothing beyond `event`; the interface exists so fields can be added without a
  // breaking change (e.g. a `reason` if a ToggleGroup ever dispatches on an item's behalf).
}

export interface ToggleProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "type" | "aria-pressed" | "className" | "style" | "children"
> {
  /** Controlled pressed state. `undefined` means uncontrolled. */
  pressed?: boolean;
  /** Initial pressed state in uncontrolled mode. Default `false`. */
  defaultPressed?: boolean;
  /**
   * Called with the next pressed state on every user-initiated change. Runs inside the Toggle's
   * transition; may be sync or async. Rejections reach the nearest Error Boundary.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  pressedChangeAction?: ChangeAction<boolean, TogglePressedChangeDetails>;
  /** Renders a native disabled button; never dispatches. Default `false`. */
  disabled?: boolean;
  /**
   * Forwarded as `default` to the Toggle's `<ViewTransition>`. Default `"none"`. Animates the
   * commit that ends an action (and rollbacks), not the optimistic flip itself; animate the flip
   * with a CSS `transition` on `[data-pressed]`.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ToggleState>;
  style?: StateValue<CSSProperties | undefined, ToggleState>;
  /** Rendered from optimistic state inside the button; must not suspend. */
  children?: StateValue<ReactNode, ToggleState>;
  /** Replace the rendered element (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, ToggleState>;
}

/**
 * A two-state button (WAI-ARIA "Button" pattern, toggle variant). Renders
 * `<button type="button" aria-pressed>`; the pressed state flips optimistically and the element
 * carries `data-pending` while `pressedChangeAction` is in flight.
 */
export function Toggle({
  pressed,
  defaultPressed,
  pressedChangeAction,
  disabled = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: ToggleProps) {
  const { optimistic, pending, dispatch } = useControllableAction<
    boolean,
    TogglePressedChangeDetails
  >({
    controlled: pressed,
    defaultValue: defaultPressed,
    initialValue: false,
    action: pressedChangeAction,
    transitionTypes: (next) => transitionTypes("toggle", next ? "press" : "release"),
    warn: { component: "Toggle", prop: "pressed" },
  });

  const state: ToggleState = { pressed: optimistic, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"button">, ToggleState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    // Pass-through layer: a `render` element's own props win over these (its `type` included).
    // `type="button"` only on a real button; an `<a>` or a component element does not get it.
    props: rendersButton(render) ? { ...rest, type: "button" } : rest,
    // Library-controlled layer: wins over a `render` element's props.
    libraryProps: {
      // Owned so that native disabledness, `data-disabled` and the click guard always agree: a
      // `render` element cannot re-enable (`disabled={false}`) or disable the button on its own.
      disabled,
      "aria-pressed": optimistic,
      "data-pressed": dataAttr(optimistic),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        // Native buttons do not fire `click` when disabled; the guard covers `render` elements
        // that do not honour `disabled`.
        if (disabled) return;
        dispatch(!optimistic, createActionDetails(event.nativeEvent, {}));
      },
    },
  });

  return <ViewTransition default={transition ?? "none"}>{element}</ViewTransition>;
}

Toggle.displayName = "Toggle";
