"use client";
import { Activity } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import { ToolbarContext } from "../internal/toolbar-context.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { usePopoverPopup } from "../internal/use-popover-popup.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { ComboboxPopupContext, useComboboxContext } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

export interface ComboboxPopupState {
  /** Committed open state. Read `:popover-open` for the DOM truth. */
  readonly open: boolean;
  /** The results shown are for an older text. */
  readonly stale: boolean;
  /** The deferred text the results are for. */
  readonly query: string;
}

export interface ComboboxPopupProps extends Omit<
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
   */
  keepMounted?: boolean;
  /**
   * Forwarded to the `<ViewTransition default>` around the popover element itself. Animates
   * library-driven opens and closes (typing, the Trigger, an accepted option) in every engine;
   * dismissals are the browser's (CSS only). **A deferred results render also activates the
   * boundary** (React: updates from `useDeferredValue` animate), so use a type map with
   * `default: "none"` unless every result change should cross-fade. Static.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ComboboxPopupState>;
  style?: StateValue<CSSProperties | undefined, ComboboxPopupState>;
  children?: StateValue<ReactNode, ComboboxPopupState>;
  /** Must render a `<div>`: a `<dialog>` would pull focus out of the input. */
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxPopupState>;
}

const preventDefault = (event: { preventDefault(): void }) => event.preventDefault();

/**
 * The listbox's container: `<div popover="auto">`, opened by the library with
 * `showPopover({ source: input })` and placed below (or, flipped, above) the input with CSS
 * Anchor Positioning, at least as wide as the input. Focus never enters it: a press anywhere in
 * it is `preventDefault()`ed so the input keeps focus (design 7.1). Holds the `List` and, outside
 * it, `Empty` and `Status`. Style it with `:popover-open`; it emits `data-stale` but no
 * `data-open`.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, `onPointerDown`, `onMouseDown`, `data-stale`.
 * Inline `position-area`, `position-try-fallbacks` and `min-width` sit under the consumer's
 * `style` (`style={{ positionTryFallbacks: "none" }}` removes the flip).
 */
export function ComboboxPopup({
  keepMounted,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxPopupProps) {
  const ctx = useComboboxContext("Combobox.Popup");
  const { popover } = ctx;

  const { setElement, visible, wrapContent } = usePopoverPopup(popover, {
    part: "Combobox.Popup",
    initialFocus: undefined,
    // Focus stays in the input: nothing inside the popup is ever focused.
    resolveInitialFocus: () => null,
    keepMounted,
    transition,
  });

  const devRef = useElementCheck(
    isDev &&
      ((element) =>
        element.tagName !== "DIV"
          ? `Combobox.Popup: rendered a <${element.tagName.toLowerCase()}>. Render a <div>: a ` +
            "<dialog popover> runs the dialog focusing steps and takes focus out of the input."
          : null),
  );
  const ref = useMergedRefs(setElement, devRef);

  const state: ComboboxPopupState = {
    open: popover.committed,
    stale: ctx.stale,
    query: ctx.query,
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: popover.ids.popup,
    popover: "auto",
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => preventDefault(event),
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => preventDefault(event),
    "data-stale": dataAttr(ctx.stale),
  };

  const content = (s: ComboboxPopupState): ReactNode => {
    let node: ReactNode;
    if (keepMounted === true) {
      node = (
        <Activity mode={visible ? "visible" : "hidden"}>
          {wrapContent(resolveStateValue(children, s))}
        </Activity>
      );
    } else {
      node = visible ? wrapContent(resolveStateValue(children, s)) : null;
    }
    // Not part of an enclosing Toolbar (the engine excludes `[popover]`).
    return (
      <ComboboxPopupContext value={true}>
        <ToolbarContext value={null}>{node}</ToolbarContext>
      </ComboboxPopupContext>
    );
  };

  const element = useRender<ComponentPropsWithRef<"div">, ComboboxPopupState>({
    defaultElement: "div",
    render,
    state,
    className,
    // `self-*` keywords resolve against the popup's own inherited direction, so a `dir="rtl"`
    // page or container flips the listbox with no JS; plain logical keywords would follow the
    // root only (design 7.2, conventions 13.1). The consumer wins.
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

  return useTransitionBoundary("Combobox.Popup", transition, element);
}

ComboboxPopup.displayName = "ComboboxPopup";
