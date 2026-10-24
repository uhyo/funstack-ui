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
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useRender } from "../internal/use-render.js";
import { AccordionItemContext } from "./accordion-context.js";
import type { AccordionItemState } from "./accordion-item.js";

/** The trigger is the item's control; it renders the item's state object. */
export type AccordionTriggerState = AccordionItemState;

export interface AccordionTriggerProps extends Omit<
  ComponentPropsWithRef<"summary">,
  "onClick" | "className" | "style" | "children"
> {
  /**
   * Library mode only. Forwarded as `default` to the `<ViewTransition>` around the `<summary>`.
   * Animates only the commit that ends an action (for example a spinner rendered from `pending`
   * disappearing); the optimistic `data-open` flip is a CSS job.
   *
   * Static (conventions 5.1): setting or unsetting it remounts the element, and any value, `"none"`
   * included, makes a mount inside a transition start a document view transition.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, AccordionTriggerState>;
  style?: StateValue<CSSProperties | undefined, AccordionTriggerState>;
  /** Rendered from optimistic state; must not suspend. A heading inside is recommended. */
  children?: StateValue<ReactNode, AccordionTriggerState>;
  /** Must render a `<summary>` element. */
  render?: RenderProp<ComponentPropsWithRef<"summary">, AccordionTriggerState>;
}

const NESTED_INTERACTIVE =
  "a[href], button, label, input, select, textarea, [contenteditable]:not([contenteditable='false'])";

/**
 * Nested controls with an activation behaviour of their own. The browser runs theirs instead of
 * the summary's (no toggle), so their click must keep its default: navigation, check, submit.
 */
const SELF_ACTIVATING =
  "a[href], button, label, input:is([type='button'], [type='submit'], [type='reset'], " +
  "[type='image'], [type='checkbox'], [type='radio'], [type='file'], [type='color'])";

/** The interactive descendant of the summary that was clicked (a link in the heading), if any. */
function nestedInteractive(target: EventTarget | null, summary: HTMLElement): Element | null {
  if (!(target instanceof Element) || target === summary) return null;
  const interactive = target.closest(NESTED_INTERACTIVE);
  return interactive !== null && interactive !== summary && summary.contains(interactive)
    ? interactive
    : null;
}

/**
 * The item's disclosure control: the `<summary>`, which must be the first child of the Item. In
 * library mode the click is intercepted and dispatched through the Root's transition; the
 * element shows optimistic `data-open` and `data-pending`. The platform forbids `aria-expanded`
 * on a summary, so assistive technology hears the committed state (from `<details open>`).
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
    "Accordion.Trigger: `transition` has no effect in JS-free mode; the browser toggles the item " +
      "outside any React transition.",
  );

  const registerTrigger = item.registerTrigger;
  const checkElement = useElementCheck((element) =>
    element.tagName !== "SUMMARY"
      ? `Accordion.Trigger: expected to render a <summary> element but got <${element.tagName.toLowerCase()}>. ` +
        "Only a <summary> toggles its parent <details>."
      : null,
  );
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
          const nested = nestedInteractive(event.target, event.currentTarget);
          if (nested !== null) {
            // A nested control never toggles. Controls without their own activation behaviour
            // (text input, select, textarea, contenteditable) would let the click fall through to
            // the summary's toggle, so cancel it; focus and pickers happen on mousedown and are
            // unaffected. Self-activating controls already pre-empt the summary's behaviour.
            if (!nested.matches(SELF_ACTIVATING)) event.preventDefault();
            return;
          }
          // Cancelling the click is what keeps the browser from touching `open`.
          event.preventDefault();
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
