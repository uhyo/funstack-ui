"use client";
import { use, useCallback } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import { interceptSummaryClick, useSummaryCheck } from "../internal/details-summary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { AccordionItemContext } from "./accordion-context.js";
import type { AccordionItemState } from "./accordion-item.js";

const isDev = process.env.NODE_ENV !== "production";

/** The trigger is the item's control; it renders the item's state object. */
export type AccordionTriggerState = AccordionItemState;

/**
 * Props of `Accordion.Trigger`.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export interface AccordionTriggerProps extends Omit<
  ComponentPropsWithRef<"summary">,
  "onClick" | "className" | "style" | "children"
> {
  /**
   * Library mode only. Forwarded as `default` to the `<ViewTransition>` around the `<summary>`.
   * Animates only the commit that ends an action (for example a spinner rendered from `pending`
   * disappearing); the optimistic `data-open` flip is a CSS job.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   */
  transition?: ViewTransitionClass;
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
 * @see https://ui.funstack.work/components/accordion
 */
export function AccordionTrigger({
  transition,
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

  useDevWarning(
    !isLibrary && transition !== undefined,
    isDev &&
      "Accordion.Trigger: `transition` has no effect in JS-free mode; the browser toggles the item " +
        "outside any React transition.",
  );

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
      "data-open": dataAttr(item.optimisticOpen === true),
      "data-pending": dataAttr(item.pending),
      "data-disabled": dataAttr(item.disabled),
      // Only owned when installed, so a render element keeps its own `onClick` in JS-free mode.
      ...(onClick && { onClick }),
    },
  });

  return useTransitionBoundary("Accordion.Trigger", isLibrary ? transition : undefined, element);
}

AccordionTrigger.displayName = "AccordionTrigger";
