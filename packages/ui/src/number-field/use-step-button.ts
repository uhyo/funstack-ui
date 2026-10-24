"use client";
import { useEffect, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { disabledButton, rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { isAtBound } from "./number-field-arithmetic.js";
import { useNumberFieldContext } from "./number-field-context.js";
import type { NumberFieldContextValue, StepDirection } from "./number-field-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** First repeat after the press, then the interval between repeats (Base UI, React Aria). */
const HOLD_DELAY = 400;
const HOLD_INTERVAL = 60;

interface ActiveHold {
  readonly pointerId: number;
  readonly detach: () => void;
}

export interface StepButtonHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onClick: (event: ReactMouseEvent<HTMLElement>) => void;
  readonly onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
}

/**
 * The press-and-hold of `NumberField.Increment` / `Decrement` (design 4.3): one step at
 * `pointerdown`, a repeat after 400 ms then every 60 ms, one commit at the release
 * (`pointerup`, `pointercancel`, `lostpointercapture`, or `blur` on the window). The press is
 * `preventDefault()`ed so focus stays where it is. A `click` with no pointer gesture before it
 * (assistive technology: `detail === 0`) is a one-step gesture.
 */
export function useStepButton(
  ctx: NumberFieldContextValue,
  direction: StepDirection,
  disabled: boolean,
): StepButtonHandlers {
  const active = useRef<ActiveHold | null>(null);
  /** A pointer gesture started on this button; the click that follows it is not an activation. */
  const pointerSeen = useRef(false);
  const latest = useRef({ ctx, disabled });
  useEffect(() => {
    latest.current = { ctx, disabled };
  });

  // An unmount mid-hold leaves no timer or listener behind.
  useEffect(
    () => () => {
      active.current?.detach();
      active.current = null;
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || !event.isPrimary) return;
    if (disabled) {
      // A focusable disabled render (`aria-disabled`) must not take focus from the input
      // either; native `disabled` focused nothing.
      event.preventDefault();
      return;
    }
    if (active.current !== null) return;
    const element = event.currentTarget;
    const native = event.nativeEvent;
    // No focus move off the input, no touch keyboard, no text selection.
    event.preventDefault();
    pointerSeen.current = true;
    const pointerId = native.pointerId;
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // An inactive pointer id (a synthetic event): the hold still follows the element.
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const view = element.ownerDocument.defaultView;
    const detach = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      element.removeEventListener("pointerup", onEnd);
      element.removeEventListener("pointercancel", onEnd);
      element.removeEventListener("lostpointercapture", onEnd);
      view?.removeEventListener("blur", onBlur);
      if (active.current?.pointerId === pointerId) active.current = null;
      // A click that follows this release (same task, or a touch tap later) is ignored; an
      // activation without a pointer afterwards is not.
      setTimeout(() => {
        pointerSeen.current = false;
      }, 0);
    };
    function onEnd(endEvent: Event): void {
      if ((endEvent as PointerEvent).pointerId !== pointerId) return;
      detach();
      latest.current.ctx.endHold(direction, endEvent);
    }
    function onBlur(blurEvent: Event): void {
      detach();
      latest.current.ctx.endHold(direction, blurEvent);
    }
    const tick = (): void => {
      timer = setTimeout(() => {
        timer = undefined;
        if (latest.current.ctx.tickHold(direction, undefined)) tick();
        else detach();
      }, HOLD_INTERVAL);
    };

    if (!ctx.beginHold(direction, native)) {
      // The first step reached the bound: the hold already committed.
      detach();
      return;
    }
    element.addEventListener("pointerup", onEnd);
    element.addEventListener("pointercancel", onEnd);
    element.addEventListener("lostpointercapture", onEnd);
    view?.addEventListener("blur", onBlur);
    active.current = { pointerId, detach };
    timer = setTimeout(() => {
      timer = undefined;
      if (latest.current.ctx.tickHold(direction, undefined)) tick();
      else detach();
    }, HOLD_DELAY);
  };

  const onClick = (event: ReactMouseEvent<HTMLElement>): void => {
    // A disabled link or component render (`aria-disabled`) must not navigate either.
    if (disabled) event.preventDefault();
    if (pointerSeen.current || active.current !== null || event.detail !== 0) {
      pointerSeen.current = false;
      return;
    }
    if (disabled) return;
    ctx.activate(direction, event.nativeEvent);
  };

  const onContextMenu = (event: ReactMouseEvent<HTMLElement>): void => {
    // A touch long-press would open the context menu mid-hold.
    if (active.current !== null) event.preventDefault();
  };

  return { onPointerDown, onClick, onContextMenu };
}

export interface NumberFieldButtonState {
  /** The Root is pending and the latest step or commit came from this button. */
  readonly pending: boolean;
  /** The prop, the Root's `disabled` or `readOnly`, or the next step would change nothing. */
  readonly disabled: boolean;
}

export interface NumberFieldIncrementProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "type"
  | "tabIndex"
  | "disabled"
  | "onPointerDown"
  | "onClick"
  | "onContextMenu"
  | "aria-controls"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Never steps. Native `disabled` on a `<button>` (also at the bound and under `readOnly`); with
   * a link or component `render`, `aria-disabled="true"` instead.
   */
  disabled?: boolean;
  className?: StateValue<string | undefined, NumberFieldButtonState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldButtonState>;
  children?: StateValue<ReactNode, NumberFieldButtonState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, NumberFieldButtonState>;
}

export type NumberFieldDecrementProps = NumberFieldIncrementProps;

const LABELS: Record<StepDirection, string> = { increment: "Increase", decrement: "Decrease" };

/** Shared by `NumberField.Increment` and `NumberField.Decrement` (design 3.3, 4.3). */
export function useStepButtonElement(
  direction: StepDirection,
  part: string,
  props: NumberFieldIncrementProps,
): ReactNode {
  const { disabled: disabledProp = false, className, style, children, render, ...rest } = props;
  const ctx = useNumberFieldContext(part);
  const { state } = ctx;
  const atBound = isAtBound(ctx.stepBase, direction === "increment" ? 1 : -1, ctx.bounds);
  const disabled = disabledProp || state.disabled || state.readOnly || atBound;
  const pending = ctx.pendingSource === direction;
  const buttonState: NumberFieldButtonState = { pending, disabled };
  const handlers = useStepButton(ctx, direction, disabled);

  useDevWarning(
    rest["aria-label"] === "",
    isDev &&
      `${part}: \`aria-label=""\` leaves the button without a name. Pass the label text instead ` +
        `(the default is "${LABELS[direction]}").`,
  );

  // The built-in name is a default the consumer's `aria-label` or `aria-labelledby` replaces.
  const props$ = {
    ...(rest["aria-labelledby"] === undefined ? { "aria-label": LABELS[direction] } : {}),
    ...rest,
  };

  return useRender<ComponentPropsWithRef<"button">, NumberFieldButtonState>({
    defaultElement: "button",
    render,
    state: buttonState,
    className,
    style,
    children,
    props: props$,
    libraryProps: {
      ...(rendersButton(render) ? { type: "button" as const } : {}),
      tabIndex: -1,
      "aria-controls": ctx.inputId,
      // A link or component render: native `disabled` would mean nothing on a link; the press and
      // click handlers refuse, so `aria-disabled`. The at-bound case follows the same branch.
      ...disabledButton(render, disabled).props,
      onPointerDown: handlers.onPointerDown,
      onClick: handlers.onClick,
      onContextMenu: handlers.onContextMenu,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    } as Partial<ComponentPropsWithRef<"button">> & DataAttributes,
  });
}
