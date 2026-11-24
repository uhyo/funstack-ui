// No "use client": the pure half of `useRender`, usable from a directive-free part (a Root that
// may run as a Server Component, design/components/progress.md 8.1 and implementation note 14.1).
import { cloneElement, createElement, isValidElement } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { mergeProps, mergeRefs } from "./merge-props.js";
import type { RenderProp, StateValue } from "./types.js";

export interface ElementLikeProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
  ref?: Ref<unknown> | undefined;
}

/** `data-*` attributes are valid JSX but absent from the element prop types. */
export type DataAttributes = { [key: `data-${string}`]: string | undefined };

export interface RenderElementOptions<Props extends ElementLikeProps, State> {
  /** Intrinsic element rendered when `render` is not given. */
  defaultElement: string;
  render: RenderProp<Props, State> | undefined;
  state: State;
  className: StateValue<string | undefined, State> | undefined;
  style: StateValue<CSSProperties | undefined, State> | undefined;
  children: StateValue<ReactNode, State> | undefined;
  /**
   * The part's pass-through props for the element. A `render` element's own props win over
   * these. Their `ref` is replaced by `ref` below.
   */
  props: Omit<Props, "className" | "style" | "children"> & DataAttributes;
  /**
   * Library-controlled attributes the part computes (`role`, `aria-*` state, id wiring, `data-*`
   * state, the library's own event handlers). These win over a `render` element's props
   * (conventions 1.2).
   */
  libraryProps?: Partial<Omit<Props, "className" | "style" | "children">> & DataAttributes;
  /**
   * The element's ref, already merged from the library's ref, the consumer's `ref` and the
   * `render` element's ref. The `render` element's own ref is not attached separately.
   */
  ref: Ref<unknown> | undefined;
}

export function resolveStateValue<T, State>(value: StateValue<T, State>, state: State): T {
  return typeof value === "function" ? (value as (state: State) => T)(state) : value;
}

/**
 * Whether a part whose default element is a `<button>` should add `type="button"` (conventions
 * 1.2): no `render`, the function form (it receives button props and decides itself what to
 * spread), a host `<button>` element, or a **component** element (assumed to render a
 * `<button>`; if it renders a link, `type` is a harmless ignored attribute, while a missing
 * `type` on a `<button>` in a form is a silent submit). Only a host element of another tag (an
 * `<a>`) does not get it.
 */
export function rendersButton<Props, State>(render: RenderProp<Props, State> | undefined): boolean {
  if (render === undefined || typeof render === "function") return true;
  if (!isValidElement(render)) return false;
  return typeof render.type !== "string" || render.type === "button";
}

/**
 * Whether the rendered element is certainly a host `<button>`: no `render`, the function form, or
 * a host `"button"` element. The strict predicate for native `disabled`, which means nothing on a
 * link and would expose it as enabled to assistive technology; anything else (a link, a
 * component) takes the `aria-disabled` branch (design/components/button.md).
 */
export function isHostButton<Props, State>(render: RenderProp<Props, State> | undefined): boolean {
  if (render === undefined || typeof render === "function") return true;
  return isValidElement(render) && render.type === "button";
}

export interface DisabledButton {
  /**
   * Owned keys, spread where `disabled` goes: `disabled` (owned as absent in the focusable
   * branch, where the element may not be a host `<button>` and the part's click handler refuses,
   * so a render element's own is removed), and in that branch only `aria-disabled` (a host
   * button keeps a consumer's own).
   */
  readonly props: {
    readonly disabled: boolean | undefined;
    readonly "aria-disabled"?: true | undefined;
  };
  /**
   * Whether an invoker part may render `popovertarget` or `commandfor` / `command`: not when disabled in the
   * focusable branch, where nothing native stops the command (a component render spreading onto
   * a real `<button>` would be a live invoker before hydration).
   */
  readonly invoker: boolean;
}

/**
 * Whether the rendered element certainly cannot be natively disabled: a host element of a tag
 * other than `<button>` / `<input>` (an `<a>`, a `<div>`). No `render`, the function form and a
 * component element may render a button.
 */
function certainlyNotDisableable<Props, State>(
  render: RenderProp<Props, State> | undefined,
): boolean {
  if (rendersButton(render)) return false;
  return !(isValidElement(render) && render.type === "input");
}

/**
 * The disabled rule of a button-like part that accepts an arbitrary `render` (conventions 1.2,
 * design/components/button.md 17). Native `disabled` on a host `<button>` (the function form
 * included), and wherever the element may be a button and the click's effect is the browser's
 * own (`handlesClick: false`: a submitter, a reset button, a JS-free invoker; only native
 * `disabled` stops those before hydration). `aria-disabled`, which the part's click handler
 * honours by cancelling the click, otherwise: on an element that certainly cannot be natively
 * disabled (a host `<a>`, `<div>`), on a component or other non-button render whose own handler
 * is the action (`handlesClick: true`, the default), and with `alwaysFocusable` (an opt-in
 * focusable disabled control: a menu item, a Toolbar or `focusableWhenDisabled` Button). A part
 * that installs no click handler of its own (`Form.Submit`, a JS-free command part on a host
 * link) installs `cancelClick` while `invoker` is `false`, so the click is cancelled there too.
 *
 * When `disabled` and the part's pending `aria-disabled` meet, the native `disabled` wins:
 * `pendingAriaDisabled` below.
 */
export function disabledButton<Props, State>(
  render: RenderProp<Props, State> | undefined,
  disabled: boolean,
  options: { readonly handlesClick?: boolean; readonly alwaysFocusable?: boolean } = {},
): DisabledButton {
  const { handlesClick = true, alwaysFocusable = false } = options;
  const focusable =
    alwaysFocusable || (handlesClick ? !isHostButton(render) : certainlyNotDisableable(render));
  return {
    props: {
      disabled: focusable ? undefined : disabled,
      ...(focusable && { "aria-disabled": disabled ? true : undefined }),
    },
    invoker: !(focusable && disabled),
  };
}

/**
 * The click handler of a disabled part in the `aria-disabled` branch that has no click handler
 * of its own (`Form.Submit`, a JS-free command Trigger / Close on a host link): cancels the
 * click, so a disabled link does not navigate after hydration (conventions 1.2). Installed only
 * while disabled: an enabled render element keeps its own `onClick` as the only one.
 */
export function cancelClick(event: { preventDefault(): void }): void {
  event.preventDefault();
}

/**
 * The owned `aria-disabled` of a pure trigger that also renders it while pending (conventions
 * 3.6): the focusable-disabled branch's `true`; nothing while natively disabled (native
 * `disabled` wins, a second unavailable state on the same element says nothing new); otherwise
 * `true` while pending exactly when the part ignores activations (`ignoringPending`).
 */
export function pendingAriaDisabled(
  disabledProps: DisabledButton["props"],
  ignoringPending: boolean,
): true | undefined {
  if (disabledProps.disabled === true) return undefined;
  if (disabledProps["aria-disabled"] === true) return true;
  return ignoringPending ? true : undefined;
}

/**
 * The ref of a part with no library ref, merged from the consumer's `ref` and a `render`
 * element's ref without memoisation (the directive-free half of `use-render.tsx`,
 * progress.md 8.1). A fresh callback ref per render is correct because every merged callback
 * returns a cleanup; a single ref is passed through untouched.
 */
export function mergeRenderRef(
  consumerRef: Ref<unknown> | undefined,
  render: unknown,
): Ref<unknown> | undefined {
  const elementRef = isValidElement<ElementLikeProps>(render) ? render.props.ref : undefined;
  if (consumerRef != null && elementRef != null) return mergeRefs(consumerRef, elementRef);
  return consumerRef ?? elementRef;
}

/**
 * Resolves `render` and the function-form `className` / `style` / `children` of a part against
 * its state and produces the element (conventions 1.2, 1.3, 1.4). Pure: the caller merges the
 * refs (`useRender` memoises the merge; a directive-free part merges unmemoised).
 */
export function renderElement<Props extends ElementLikeProps, State>(
  options: RenderElementOptions<Props, State>,
): ReactNode {
  const { defaultElement, render, state, className, style, children, props, libraryProps, ref } =
    options;

  const partProps = {
    ...props,
    ref,
    className: resolveStateValue(className, state),
    style: resolveStateValue(style, state),
    children: resolveStateValue(children, state),
  } as Record<string, unknown>;
  const controlled = (libraryProps ?? {}) as Record<string, unknown>;

  if (isValidElement<ElementLikeProps>(render)) {
    // The element's ref is already part of `ref`.
    const { ref: _ignored, ...elementProps } = render.props as Record<string, unknown>;
    return cloneElement(render, mergeProps(partProps, elementProps, controlled) as Partial<Props>);
  }
  const resolved = mergeProps(partProps, {}, controlled) as unknown as Props;
  if (typeof render === "function") {
    return render(resolved, state);
  }
  return createElement(defaultElement, resolved);
}
