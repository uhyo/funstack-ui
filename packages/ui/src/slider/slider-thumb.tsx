"use client";
import { useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import { mergeRefs } from "../internal/merge-props.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { percent, thumbBounds } from "./slider-arithmetic.js";
import { useSliderContext } from "./slider-context.js";
import type { SliderOrientation } from "./slider-root.js";

export interface SliderThumbState {
  readonly index: number;
  /** The value this thumb shows. */
  readonly value: number;
  /** The Root is pending and this thumb is the one the latest step or commit moved. */
  readonly pending: boolean;
  /** A pointer is captured on this thumb. */
  readonly dragging: boolean;
  readonly orientation: SliderOrientation;
  readonly disabled: boolean;
}

export interface SliderThumbProps extends Omit<
  ComponentPropsWithRef<"span">,
  | "onPointerDown"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  // The value attributes are the native input's (design 8): never authored.
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
  | "aria-orientation"
  | "className"
  | "style"
  | "children"
> {
  /** Which value this thumb edits. Default `0`. */
  index?: number;
  /** Form field name of this thumb's input; overrides the Root's `name`. */
  name?: string;
  /** The `form` attribute of this thumb's input; overrides the Root's. */
  form?: string;
  /**
   * Forwarded to the input (the element with role `slider`), not the styled element. Required
   * for every thumb of a multi-thumb slider unless `aria-labelledby` is given (dev warning).
   */
  "aria-label"?: string;
  /** Forwarded to the input. */
  "aria-labelledby"?: string;
  /** Forwarded to the input. */
  "aria-describedby"?: string;
  /** The native `<input type="range">` inside the thumb. */
  inputRef?: Ref<HTMLInputElement>;
  /** Forwarded to the input. */
  autoFocus?: boolean;
  className?: StateValue<string | undefined, SliderThumbState>;
  style?: StateValue<CSSProperties | undefined, SliderThumbState>;
  /** Rendered inside the styled element, next to the input (an icon, a value bubble). */
  children?: StateValue<ReactNode, SliderThumbState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, SliderThumbState>;
}

/** Visually hidden, sized to the thumb so an assistive-technology focus ring lands on it. */
const HIDDEN_INPUT_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  opacity: 0,
  pointerEvents: "none",
};

/** Chromium derives the accessibility orientation from `writing-mode`; `rtl` puts `min` at the bottom. */
const VERTICAL_INPUT_STYLE: CSSProperties = {
  ...HIDDEN_INPUT_STYLE,
  writingMode: "vertical-lr",
  direction: "rtl",
};

/**
 * One value handle: a styled element (`span`) **containing** a visually hidden native
 * `<input type="range">`, which is the focusable, labelled, form-participating `slider` with the
 * native keyboard (conventions 1.1 exception). `ref` goes to the styled element, `inputRef` to the
 * input. The input's native `min` / `max` are the neighbours' values, so thumbs cannot cross.
 *
 * Owned keys on the styled element: `onPointerDown`, `data-index`, `data-orientation`,
 * `data-dragging`, `data-pending`, `data-disabled`, and `--slider-value` / `touch-action` in
 * `style` (the consumer's entries win). `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `name`, `form` and `autoFocus` go to the input; every other input attribute is the library's.
 */
export function SliderThumb({
  index = 0,
  name,
  form,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  inputRef: consumerInputRef,
  autoFocus,
  className,
  style,
  children,
  render,
  ...rest
}: SliderThumbProps) {
  const ctx = useSliderContext("Slider.Thumb");
  const value = ctx.shown[index];
  const inRange = value !== undefined;
  const shownValue = value ?? ctx.min;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const mergedInputRef = useMemo(
    () => mergeRefs<HTMLInputElement | null>(inputRef, consumerInputRef),
    [consumerInputRef],
  );

  // Registration with the Root (pointer focus, reconciliation, reset), from a layout effect so
  // the Root's mount reconciliation, which runs after its children's, sees every input.
  const { registerThumb, onItemMounted } = ctx;
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    const unregister = registerThumb(index, input);
    onItemMounted();
    return unregister;
  }, [index, registerThumb, onItemMounted]);

  // React surfaces no `onChange` for the native `change` (design 4.2), and the vertical
  // ArrowLeft / ArrowRight normalisation needs the `keydown` before the browser acts on it.
  const onNativeChange = useEffectEvent((event: Event) => {
    ctx.inputCommit(index, event);
  });
  const onNativeKeyDown = useEffectEvent((event: KeyboardEvent) => {
    ctx.inputKeyDown(index, event);
  });
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.addEventListener("change", onNativeChange);
    input.addEventListener("keydown", onNativeKeyDown);
    return () => {
      input.removeEventListener("change", onNativeChange);
      input.removeEventListener("keydown", onNativeKeyDown);
    };
  }, [inRange]);

  useDevWarning(
    !inRange,
    `Slider.Thumb: \`index={${index}}\` is outside the value (${ctx.shown.length} ` +
      `${ctx.shown.length === 1 ? "value" : "values"}). The Thumb renders nothing.`,
  );
  useDevWarning(
    inRange && ctx.shown.length > 1 && ariaLabel === undefined && ariaLabelledBy === undefined,
    `Slider.Thumb: each thumb of a multi-thumb slider needs its own name (\`aria-label\` or ` +
      `\`aria-labelledby\`), e.g. "Minimum price"; the thumb at index ${index} has none.`,
  );

  const pending = ctx.pending && ctx.pendingThumb === index;
  const dragging = ctx.draggingThumb === index;
  const state: SliderThumbState = {
    index,
    value: shownValue,
    pending,
    dragging,
    orientation: ctx.orientation,
    disabled: ctx.disabled,
  };

  const { lower, upper } = thumbBounds(ctx.shown, index, ctx.min, ctx.max, ctx.gap);
  const input = inRange ? (
    <input
      ref={mergedInputRef}
      type="range"
      id={ctx.thumbId(index)}
      name={name ?? ctx.name}
      form={form ?? ctx.form}
      min={lower}
      max={upper}
      step={ctx.step}
      value={shownValue}
      disabled={ctx.disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-valuetext={ctx.getAriaValueText?.(shownValue, index)}
      style={ctx.orientation === "vertical" ? VERTICAL_INPUT_STYLE : HIDDEN_INPUT_STYLE}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        ctx.inputStep(index, Number(event.target.value), event.nativeEvent);
      }}
    />
  ) : null;

  const geometry = {
    "--slider-value": `${percent(shownValue, ctx.min, ctx.max)}%`,
    touchAction: ctx.orientation === "vertical" ? "pan-x" : "pan-y",
  } as CSSProperties;

  const element = useRender<ComponentPropsWithRef<"span">, SliderThumbState>({
    defaultElement: "span",
    render,
    state,
    className,
    // The library's entries lose to the consumer's own (design 3.2).
    style: (s) => ({ ...geometry, ...resolveStateValue(style, s) }),
    children: undefined,
    props: rest,
    libraryProps: {
      "data-index": String(index),
      "data-orientation": ctx.orientation,
      "data-dragging": dataAttr(dragging),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(ctx.disabled),
      onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => {
        ctx.beginGesture(index, event.nativeEvent, event.currentTarget);
      },
      // Owned, so a `render` element's own children can never drop the input.
      children: (
        <>
          {input}
          {resolveStateValue(children, state)}
        </>
      ),
      // `children` is not in the library layer's type (useRender resolves it), but an owned
      // key wins over a `render` element's own children, which is what keeps the input.
    } as Partial<ComponentPropsWithRef<"span">> & DataAttributes,
  });

  return inRange ? element : null;
}

SliderThumb.displayName = "SliderThumb";
