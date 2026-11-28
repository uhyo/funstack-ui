"use client";
import { use, useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { interceptSummaryClick, useSummaryCheck } from "../internal/details-summary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { CollapsibleContext } from "./collapsible-context.js";
import type { CollapsibleRootState } from "./collapsible-root.js";

/** The trigger is the Root's control; it renders the Root's state object. */
export type CollapsibleTriggerState = CollapsibleRootState;

/**
 * Props of `Collapsible.Trigger`.
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export interface CollapsibleTriggerProps extends Omit<
  ComponentPropsWithRef<"summary">,
  "onClick" | "aria-disabled" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, CollapsibleTriggerState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, CollapsibleTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, CollapsibleTriggerState>;
  /** Must render a `<summary>` element. */
  render?: RenderProp<ComponentPropsWithRef<"summary">, CollapsibleTriggerState>;
}

/**
 * The disclosure control: the `<summary>`, which must be the first child of the Root. In library
 * mode the click is intercepted and dispatched through the Root's transition; the element shows
 * optimistic `data-open` and `data-pending`. The platform forbids `aria-expanded` on a summary,
 * so assistive technology hears the committed state (from `<details open>`).
 *
 * No `transition` prop: everything it renders is optimistic (conventions 5.1). The Root's
 * boundary covers it; animate the `data-open` flip with CSS.
 *
 * Owned keys (conventions 1.5): `aria-disabled`, `data-open`, `data-pending`, `data-disabled`,
 * `onClick` (library mode, or while disabled).
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export function CollapsibleTrigger({
  className,
  style,
  children,
  render,
  ...rest
}: CollapsibleTriggerProps) {
  const root = use(CollapsibleContext);
  if (root === null) {
    throw new Error("Collapsible.Trigger must be rendered inside a Collapsible.Root.");
  }
  const isLibrary = root.library;

  const checkElement = useSummaryCheck("Collapsible.Trigger");
  const libraryRef = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      // Always return a cleanup so the merged ref never calls back with `null`.
      return () => {};
    },
    [checkElement],
  );

  const state: CollapsibleTriggerState = {
    open: root.optimisticOpen,
    pending: root.pending,
    disabled: root.disabled,
  };

  // JS-free mode attaches no click handler unless disabled (design 2.1 and 6).
  const onClick =
    isLibrary || root.disabled
      ? (event: MouseEvent<HTMLElement>) => {
          // A nested control never toggles; any other click is cancelled, which is what keeps the
          // browser from touching `open`.
          if (!interceptSummaryClick(event)) return;
          if (root.disabled || !isLibrary) return;
          // `next` comes from the optimistic value: a second click while pending reverses the
          // first (design 2.2).
          root.dispatch(!root.optimisticOpen, event.nativeEvent);
        }
      : undefined;

  const element = useRender<ComponentPropsWithRef<"summary">, CollapsibleTriggerState>({
    defaultElement: "summary",
    render,
    state,
    className,
    style,
    children,
    ref: libraryRef,
    props: rest,
    // Library-controlled layer: wins over a `render` element's props (conventions 1.2).
    libraryProps: {
      "aria-disabled": root.disabled ? true : undefined,
      "data-open": dataAttr(root.optimisticOpen),
      "data-pending": dataAttr(root.pending),
      "data-disabled": dataAttr(root.disabled),
      // Only owned when installed, so a render element keeps its own `onClick` in JS-free mode.
      ...(onClick && { onClick }),
    },
  });

  return element;
}

CollapsibleTrigger.displayName = "CollapsibleTrigger";
