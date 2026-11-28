"use client";
import { useCallback, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { DialogCloseRegistry, useDialogContext } from "../dialog/dialog-context.js";
import { useDialogPopup } from "../dialog/dialog-popup.js";
import type { DialogPopupProps, DialogPopupState } from "../dialog/dialog-popup.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { resolveStateValue } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { isVerticalSide, listenDrawerSwipe, swipeTouchAction } from "./drawer-swipe.js";
import type { DrawerSide } from "./drawer-swipe.js";

export type { DrawerSide } from "./drawer-swipe.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Drawer.Popup`, passed to the function forms of `className`, `style`, `children` and
 * `render`: Dialog's, with the `side`. A drag is not in the state: it is `data-swiping` and the
 * `--drawer-swipe-*` properties, written to the DOM.
 */
export interface DrawerPopupState extends DialogPopupState {
  /** The `side` prop. */
  readonly side: DrawerSide;
}

/**
 * Props of `Drawer.Popup`: `Dialog.Popup`'s, with `side` and `swipeDismiss`, and `lightDismiss`
 * defaulting to the Root's `modal`.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export interface DrawerPopupProps extends Omit<
  DialogPopupProps,
  "className" | "style" | "children" | "render"
> {
  /**
   * The edge the drawer is attached to. Rendered as `data-side` (also in the server HTML); the
   * swipe goes toward it. `inline-start` / `inline-end` follow the drawer's own `direction`.
   * The library places nothing: style `[data-side]`.
   *
   * @defaultValue `"bottom"`
   */
  side?: DrawerSide;
  /**
   * Let the user drag the drawer toward its edge to close it (mouse, pen, touch; after
   * hydration). The close is a dismissal: reported to `onOpenChange`, never to
   * `openChangeAction`. While dragging the drawer has `data-swiping`, `--drawer-swipe-x`,
   * `--drawer-swipe-y` and `--drawer-swipe-progress`; your CSS moves it. Also renders an inline
   * `touch-action`. Always give another way to close (`Drawer.Close`).
   *
   * @defaultValue `true`
   */
  swipeDismiss?: boolean;
  /**
   * As `Dialog.Popup`'s: close on a press outside the drawer (on the backdrop of a modal one).
   *
   * @defaultValue the Root's `modal`
   */
  lightDismiss?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, DrawerPopupState>;
  /** Inline style, or a function of the part's state that returns one. Merged over the `touch-action`. */
  style?: StateValue<CSSProperties | undefined, DrawerPopupState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, DrawerPopupState>;
  /** Must render a `<dialog>`. */
  render?: RenderProp<ComponentPropsWithRef<"dialog">, DrawerPopupState>;
}

/**
 * The drawer: `Dialog.Popup` (a `<dialog>`, with everything a dialog does) attached to an edge.
 * `side` is rendered as `data-side`; the library writes no inset, size or transform. With
 * `swipeDismiss` (default), a drag toward that edge (mouse, pen or touch, after hydration)
 * follows the pointer through `--drawer-swipe-x` / `-y` / `-progress` and, released past a
 * quarter of the drawer or with a flick, finishes the slide with your CSS transition and then
 * closes the dialog with `requestClose()`: a fact, reported to `onOpenChange(false, { reason:
 * "dismiss", event: <the pointerup> })`. A press inside a scroll container along the drawer's
 * axis scrolls it and never drags.
 *
 * Owned keys (conventions 1.2): Dialog.Popup's (`id`, `open`, `closedby`, `popover` (never
 * written), `onToggle`, `onBeforeToggle`, `data-modal`, `suppressHydrationWarning`;
 * `aria-labelledby` and `aria-describedby` token-merged), `data-side`, `data-swiping`; the inline `touch-action` is merged under your `style`.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export function DrawerPopup({
  side = "bottom",
  swipeDismiss = true,
  lightDismiss,
  className,
  style,
  children,
  render,
  ...rest
}: DrawerPopupProps) {
  const ctx = useDialogContext("Drawer.Popup");
  const { popupRef } = ctx;
  const extend = (state: DialogPopupState): DrawerPopupState => ({ ...state, side });

  // Development checks (design 5.1, 7), once per instance.
  const checks = useRef<DevChecks>({
    closeSeen: false,
    closeWarned: false,
    scrollWarned: false,
    listWarned: false,
  });
  const registerClose = useCallback(
    (element: Element) => {
      const dialog = popupRef.current;
      if (dialog === null || element.closest("dialog") === dialog) {
        checks.current.closeSeen = true;
      }
    },
    [popupRef],
  );

  const attachDismiss = useCallback(
    (dialog: HTMLDialogElement, dismiss: (event: Event) => void) => {
      const stopSwipe = listenDrawerSwipe(
        dialog,
        side,
        dismiss,
        isDev && !isVerticalSide(side)
          ? (scroller) => warnVerticalListInSideDrawer(scroller, checks.current)
          : undefined,
      );
      const stopChecks = isDev ? watchDevChecks(dialog, side, checks.current) : undefined;
      return () => {
        stopSwipe();
        stopChecks?.();
      };
    },
    [side],
  );

  const touchAction: CSSProperties | undefined = swipeDismiss
    ? { touchAction: swipeTouchAction(side) }
    : undefined;

  const ownProps: ComponentPropsWithRef<"dialog"> & DataAttributes = {
    "data-side": side,
    // Written through the DOM while a pointer drags (design 4.3); owned so a prop cannot set it.
    "data-swiping": undefined,
  };

  return useDialogPopup(
    {
      ...rest,
      lightDismiss: lightDismiss ?? ctx.modal,
      className: typeof className === "function" ? (s) => className(extend(s)) : className,
      style: (s) =>
        touchAction === undefined
          ? resolveStateValue(style, extend(s))
          : { ...touchAction, ...resolveStateValue(style, extend(s)) },
      children: typeof children === "function" ? (s) => children(extend(s)) : children,
      render: typeof render === "function" ? (props, s) => render(props, extend(s)) : render,
    },
    {
      namespace: "Drawer",
      ownProps,
      attachDismiss: swipeDismiss ? attachDismiss : undefined,
      wrapChildren: !isDev
        ? undefined
        : (content: ReactNode) => (
            <DialogCloseRegistry value={registerClose}>{content}</DialogCloseRegistry>
          ),
    },
  );
}

DrawerPopup.displayName = "DrawerPopup";

/** Once-per-instance flags of the development checks (design 5.1, 7). */
interface DevChecks {
  /** A Close part of this drawer has mounted. */
  closeSeen: boolean;
  closeWarned: boolean;
  scrollWarned: boolean;
  /** The side-drawer list warning (design 5.1) has been logged. */
  listWarned: boolean;
}

/**
 * Development check (design 5.1): a press in a side drawer refused by a scroll container that
 * scrolls only vertically. Computed `overflow` pairs the axes (`overflow-y: auto` makes
 * `overflow-x` compute to `auto`), so a vertical list is also a horizontal scroll container by
 * the rule, and a swipe never starts in it. Warns once per instance when the refusing element has
 * `overflow-x: auto`, a non-`visible` `overflow-y`, and nothing to scroll horizontally.
 */
function warnVerticalListInSideDrawer(scroller: Element, checks: DevChecks): void {
  if (checks.listWarned) return;
  const style = getComputedStyle(scroller);
  if (style.overflowX !== "auto" || style.overflowY === "visible") return;
  if (scroller.scrollWidth > scroller.clientWidth) return;
  checks.listWarned = true;
  console.error(
    "Drawer.Popup: a press in a vertically scrolling element of this side drawer did not start " +
      "a swipe. `overflow-y: auto` makes `overflow-x` compute to `auto`, so the element is a " +
      "horizontal scroll container, which keeps its presses (also for touch). To let the drawer " +
      "be swiped from it, give it `overflow-x: hidden; touch-action: pan-y pinch-zoom`.",
    scroller,
  );
}

/**
 * Development checks of a drawer with the swipe, installed with it:
 * - design 7: another way to close it. Warns at the `close` of a showing during which no Close
 *   part of this drawer was mounted.
 * - design 5.1: a `top` / `bottom` drawer whose dialog is itself the scroller cannot be scrolled
 *   by touch (`touch-action: pan-x`). Checked when it has opened.
 */
function watchDevChecks(
  dialog: HTMLDialogElement,
  side: DrawerSide,
  checks: DevChecks,
): () => void {
  const onToggle = (event: Event) => {
    if (event.target !== dialog || checks.scrollWarned || !dialog.open) return;
    if (!isVerticalSide(side)) return;
    const overflow = getComputedStyle(dialog).overflowY;
    if (overflow !== "auto" && overflow !== "scroll") return;
    if (dialog.scrollHeight <= dialog.clientHeight) return;
    checks.scrollWarned = true;
    console.error(
      `Drawer.Popup: this ${side} drawer scrolls its own content, which touch cannot scroll ` +
        "while the swipe owns the vertical axis (`touch-action: pan-x`). Scroll in a child " +
        "(`overflow-y: auto` on a body element) and give the dialog `overflow: hidden`.",
    );
  };
  const onClose = (event: Event) => {
    if (event.target !== dialog || checks.closeWarned || checks.closeSeen) return;
    checks.closeWarned = true;
    console.error(
      "Drawer.Popup: the drawer has no Drawer.Close. A swipe is a path-based gesture: give " +
        "another way to close the drawer (WCAG 2.5.1), which is also the only one before " +
        "hydration on a phone.",
    );
  };
  dialog.addEventListener("toggle", onToggle);
  dialog.addEventListener("close", onClose);
  return () => {
    dialog.removeEventListener("toggle", onToggle);
    dialog.removeEventListener("close", onClose);
  };
}
