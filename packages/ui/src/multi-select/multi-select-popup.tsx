"use client";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { listenInvokerPresses } from "../internal/overlay/invokers.js";
import { usePopoverPopup } from "../internal/overlay/use-popover-popup.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { MultiSelectPopupContext, useMultiSelectContext } from "./multi-select-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `MultiSelect.Popup`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface MultiSelectPopupState {
  /** Committed open state. Read `:popover-open` for the DOM truth. */
  readonly open: boolean;
}

/**
 * Props of `MultiSelect.Popup`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "id"
  | "popover"
  | "onToggle"
  | "onBeforeToggle"
  | "onPointerDown"
  | "onMouseDown"
  | "className"
  | "style"
  | "children"
> {
  /**
   * `false` (default): the children are not rendered while the listbox is closed. `true`: they
   * stay mounted inside `<Activity mode="hidden">`.
   *
   * @defaultValue `false`
   */
  keepMounted?: boolean;
  /**
   * Forwarded to the `<ViewTransition default>` around the popover element itself. Animates the
   * library's opens and closes (the Trigger, the keys) in every engine; dismissals (Escape, a
   * click outside, focus leaving the Trigger) are the browser's and animate with CSS only.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal of the Popup inside a transition start a document view
   * transition (a ~250 ms page cross-fade that the next transition waits for); a plain open
   * starts none, as the content mounts under the already-mounted popup element. While a view
   * transition runs, the popup's CSS transitions are cut for the moment of the library's own
   * show or hide (an inline `transition: none !important`, restored right after), so only the
   * view transition animates it; a `@keyframes` animation is not cut, and a dismissal, which
   * runs no view transition, keeps its CSS exit.
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectPopupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectPopupState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MultiSelectPopupState>;
  /** Must render a `<div>`: a `<dialog>` would pull focus out of the Trigger. */
  render?: RenderProp<ComponentPropsWithRef<"div">, MultiSelectPopupState>;
}

const preventDefault = (event: { preventDefault(): void }) => event.preventDefault();

/**
 * The listbox's container: `<div popover="auto">`, opened by the library with
 * `showPopover({ source: trigger })` and placed below (or, flipped, above) the Trigger with CSS
 * Anchor Positioning, at least as wide as the Trigger (design/components/multi-select.md B.12).
 * Focus never enters it: a press anywhere in it is `preventDefault()`ed so the Trigger keeps
 * focus (B.4). Holds the `List` and, outside it, `Empty` and `Status`. Style it with
 * `:popover-open`; it emits no `data-open`.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, `onPointerDown`, `onMouseDown`. Inline
 * `position-area`, `position-try-fallbacks` and `min-width` sit under the consumer's `style`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectPopup({
  keepMounted,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectPopupProps) {
  const ctx = useMultiSelectContext("MultiSelect.Popup");
  const { popover } = ctx;

  const { setElement, renderContent } = usePopoverPopup(popover, {
    part: "MultiSelect.Popup",
    // Focus stays on the Trigger: nothing inside the popup is ever focused.
    initialFocus: () => null,
    keepMounted,
    transition,
    // While shown, a press on an invoker of the popup (the Trigger included) moves no focus.
    whileShown: listenInvokerPresses,
  });

  const devRef = useElementCheck(
    isDev &&
      ((element) =>
        element.tagName !== "DIV"
          ? `MultiSelect.Popup: rendered a <${element.tagName.toLowerCase()}>. Render a <div>: ` +
            "a <dialog popover> runs the dialog focusing steps and takes focus out of the Trigger."
          : null),
  );
  const ref = useMergedRefs(setElement, devRef);

  const state: MultiSelectPopupState = { open: popover.committed };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: popover.ids.popup,
    popover: "auto",
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => preventDefault(event),
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => preventDefault(event),
  };

  const content = (s: MultiSelectPopupState): ReactNode => (
    <MultiSelectPopupContext value={true}>
      {renderContent(() => resolveStateValue(children, s))}
    </MultiSelectPopupContext>
  );

  const element = useRender<ComponentPropsWithRef<"div">, MultiSelectPopupState>({
    defaultElement: "div",
    render,
    state,
    className,
    // `self-*` keywords resolve against the popup's own inherited direction (conventions 13.1;
    // combobox.md 7.2). The consumer wins.
    style: (s) => ({
      positionArea: "self-block-end span-self-inline-end",
      positionTryFallbacks: "flip-block",
      minWidth: "anchor-size(width)",
      ...resolveStateValue(style, s),
    }),
    children: content,
    props: rest,
    libraryProps,
    ref,
  });

  return useTransitionBoundary("MultiSelect.Popup", transition, element);
}

MultiSelectPopup.displayName = "MultiSelectPopup";
