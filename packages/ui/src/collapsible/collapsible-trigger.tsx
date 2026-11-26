"use client";
import { use, useCallback } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import { interceptSummaryClick, useSummaryCheck } from "../internal/details-summary.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { CollapsibleContext } from "./collapsible-context.js";
import type { CollapsibleRootState } from "./collapsible-root.js";

const isDev = process.env.NODE_ENV !== "production";

/** The trigger is the Root's control; it renders the Root's state object. */
export type CollapsibleTriggerState = CollapsibleRootState;

/**
 * Props of `Collapsible.Trigger`.
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export interface CollapsibleTriggerProps extends Omit<
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
 * @see https://ui.funstack.work/components/collapsible
 */
export function CollapsibleTrigger({
  transition,
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

  useDevWarning(
    !isLibrary && transition !== undefined,
    isDev &&
      "Collapsible.Trigger: `transition` has no effect in JS-free mode; the browser toggles the " +
        "<details> outside any React transition.",
  );

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
      "data-open": dataAttr(root.optimisticOpen === true),
      "data-pending": dataAttr(root.pending),
      "data-disabled": dataAttr(root.disabled),
      // Only owned when installed, so a render element keeps its own `onClick` in JS-free mode.
      ...(onClick && { onClick }),
    },
  });

  return useTransitionBoundary("Collapsible.Trigger", isLibrary ? transition : undefined, element);
}

CollapsibleTrigger.displayName = "CollapsibleTrigger";
