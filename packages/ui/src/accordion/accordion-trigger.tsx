"use client";
import { use, useCallback, ViewTransition } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { AccordionItemContext, AccordionRootContext } from "./accordion-context.js";
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
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, AccordionTriggerState>;
  style?: StateValue<CSSProperties | undefined, AccordionTriggerState>;
  /** Rendered from optimistic state; must not suspend. A heading inside is recommended. */
  children?: StateValue<ReactNode, AccordionTriggerState>;
  /** Must render a `<summary>` element. */
  render?: RenderProp<ComponentPropsWithRef<"summary">, AccordionTriggerState>;
}

const isDev = process.env.NODE_ENV !== "production";

const NESTED_INTERACTIVE =
  "a[href], button, input, select, textarea, [contenteditable]:not([contenteditable='false'])";

/** A click on an interactive descendant of the summary (a link in the heading) must not toggle. */
function isNestedInteractive(target: EventTarget | null, summary: HTMLElement): boolean {
  if (!(target instanceof Element) || target === summary) return false;
  const interactive = target.closest(NESTED_INTERACTIVE);
  return interactive !== null && interactive !== summary && summary.contains(interactive);
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
  const root = use(AccordionRootContext);
  const item = use(AccordionItemContext);
  if (item === null) {
    throw new Error("Accordion.Trigger must be rendered inside an Accordion.Item.");
  }
  const isLibrary = root?.mode === "library";

  useDevWarning(
    !isLibrary && transition !== undefined,
    "Accordion.Trigger: `transition` has no effect in JS-free mode; the browser toggles the item " +
      "outside any React transition.",
  );

  const registerTrigger = root?.registerTrigger;
  const libraryRef = useCallback(
    (element: HTMLElement) => {
      if (isDev && element.tagName !== "SUMMARY") {
        console.error(
          `Accordion.Trigger: expected to render a <summary> element but got <${element.tagName.toLowerCase()}>. ` +
            "Only a <summary> toggles its parent <details>.",
        );
      }
      const unregister = registerTrigger?.(element);
      // Always return a cleanup so the merged ref never calls back with `null`.
      return () => {
        unregister?.();
      };
    },
    [registerTrigger],
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
          if (isNestedInteractive(event.target, event.currentTarget)) return;
          // Cancelling the click is what keeps the browser from touching `open`.
          event.preventDefault();
          if (item.disabled || !isLibrary) return;
          root.dispatch(item.value, !item.optimisticOpen, event.nativeEvent);
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
      onClick,
    },
  });

  return (
    <ViewTransition default={isLibrary ? (transition ?? "none") : "none"}>{element}</ViewTransition>
  );
}

AccordionTrigger.displayName = "AccordionTrigger";
