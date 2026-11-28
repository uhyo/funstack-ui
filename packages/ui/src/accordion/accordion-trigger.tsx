"use client";
import { use, useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { interceptSummaryClick, useSummaryCheck } from "../internal/details-summary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { AccordionItemContext } from "./accordion-context.js";
import type { AccordionItemState } from "./accordion-item.js";

/** The trigger is the item's control; it renders the item's state object. */
export type AccordionTriggerState = AccordionItemState;

/**
 * Props of `Accordion.Trigger`.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export interface AccordionTriggerProps extends Omit<
  ComponentPropsWithRef<"summary">,
  "onClick" | "aria-disabled" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, AccordionTriggerState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, AccordionTriggerState>;
  /** Rendered from optimistic state; must not suspend. A heading inside is recommended. */
  children?: StateValue<ReactNode, AccordionTriggerState>;
  /** Must render a `<summary>` element. */
  render?: RenderProp<ComponentPropsWithRef<"summary">, AccordionTriggerState>;
}

/**
 * The item's disclosure control: the `<summary>`, which must be the first child of the Item. In
 * library mode the click is intercepted and dispatched through the Root's transition; the
 * element shows optimistic `data-open` and `data-pending`. The platform forbids `aria-expanded`
 * on a summary, so assistive technology hears the committed state (from `<details open>`).
 *
 * No `transition` prop: everything it renders is optimistic (conventions 5.1). The Item's
 * boundary covers it; animate the `data-open` flip with CSS.
 *
 * Owned keys (conventions 1.5): `aria-disabled`, `data-open`, `data-pending`, `data-disabled`,
 * `onClick` (library mode, or while disabled).
 *
 * @see https://ui.funstack.work/components/accordion
 */
export function AccordionTrigger({
  className,
  style,
  children,
  render,
  ...rest
}: AccordionTriggerProps) {
  // Only the Item's context (memoised per item), which carries what is needed of the Root's.
  const item = use(AccordionItemContext);
  if (item === null) {
    throw new Error("Accordion.Trigger must be rendered inside an Accordion.Item.");
  }
  const isLibrary = item.library;

  const registerTrigger = item.registerTrigger;
  const checkElement = useSummaryCheck("Accordion.Trigger");
  const libraryRef = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      const unregister = registerTrigger?.(element);
      // Always return a cleanup so the merged ref never calls back with `null`.
      return () => {
        unregister?.();
      };
    },
    [checkElement, registerTrigger],
  );

  const state: AccordionTriggerState = {
    value: item.value,
    open: item.optimisticOpen,
    pending: item.pending,
    disabled: item.disabled,
  };

  // JS-free mode attaches no click handler unless the item is disabled (design 2.1 / section 6).
  const onClick =
    isLibrary || item.disabled
      ? (event: MouseEvent<HTMLElement>) => {
          // A nested control never toggles; any other click is cancelled, which is what keeps the
          // browser from touching `open`.
          if (!interceptSummaryClick(event)) return;
          if (item.disabled || !isLibrary) return;
          item.dispatch?.(item.value, !item.optimisticOpen, event.nativeEvent);
        }
      : undefined;

  const element = useRender<ComponentPropsWithRef<"summary">, AccordionTriggerState>({
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
      "aria-disabled": item.disabled ? true : undefined,
      "data-open": dataAttr(item.optimisticOpen),
      "data-pending": dataAttr(item.pending),
      "data-disabled": dataAttr(item.disabled),
      // Only owned when installed, so a render element keeps its own `onClick` in JS-free mode.
      ...(onClick && { onClick }),
    },
  });

  return element;
}

AccordionTrigger.displayName = "AccordionTrigger";
